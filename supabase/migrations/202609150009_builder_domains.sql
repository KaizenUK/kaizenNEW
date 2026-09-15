-- Domain claims are private control-plane state. Only the verified projects
-- function and the configured host worker may call these routines.
create table public.builder_domains (
  id uuid primary key,
  project_id text not null references public.builder_projects(id),
  hostname text not null check(length(hostname) between 3 and 232 and hostname=lower(hostname)
    and hostname ~ '^[a-z0-9][a-z0-9.-]*\.[a-z][a-z0-9-]*$'),
  verification_token text not null check(verification_token ~ '^[a-f0-9]{64}$'),
  worker_id text not null check(worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  binding_kind text not null check(binding_kind in ('client-primary','client-alias','repository-alias')),
  candidate_destination_id uuid,
  destination_id uuid,
  requested_by uuid references auth.users(id) on delete set null,
  operation text not null default 'connect' check(operation in ('connect','remove')),
  status text not null default 'waiting_dns' check(status in ('waiting_dns','queued','checking_dns','provisioning','connected','removing','attention','removed')),
  version integer not null default 1 check(version>0),
  owner_token uuid,
  withdrawal_only boolean not null default false,
  completed_token uuid,
  claimed_at timestamptz,
  dns_checked_at timestamptz,
  connected_at timestamptz,
  certificate_expires_at timestamptz,
  last_evidence jsonb check(last_evidence is null or octet_length(last_evidence::text)<=10000),
  removed_at timestamptz,
  reason text check(reason in ('ownership_missing','routing_missing','routing_mismatch','lookup_failed','domain_in_use',
    'provider_failed','tls_pending','routing_failed','access_changed','configuration_changed')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_check_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key(destination_id,project_id) references public.builder_client_destinations(id,project_id),
  check((binding_kind='repository-alias') = (candidate_destination_id is null)),
  check((status in ('checking_dns','provisioning','removing')) = (owner_token is not null)),
  check((status='removed') = (removed_at is not null))
);
create unique index builder_domains_one_current_project on public.builder_domains(project_id) where status<>'removed';
-- An unverified claim must not let a stranger reserve someone else's domain.
create unique index builder_domains_one_verified_hostname on public.builder_domains(hostname) where claimed_at is not null and status<>'removed';
create index builder_domains_worker_queue on public.builder_domains(worker_id,status,updated_at);
create index builder_domains_next_check on public.builder_domains(worker_id,next_check_at) where status<>'removed';
alter table public.builder_domains enable row level security;
revoke all on public.builder_domains from public,anon,authenticated,service_role;

-- The domain worker controls readiness, never an operator's enabled flag.
alter table public.builder_client_destinations add column domain_ready boolean not null default true;
grant select(domain_ready) on public.builder_client_destinations to authenticated;
create or replace function public.builder_client_destination_version() returns trigger language plpgsql set search_path=public as $$
begin
  if (new.project_id,new.environment,new.origin) is distinct from (old.project_id,old.environment,old.origin) then raise exception 'Destination identity is immutable. Provision a new destination'; end if;
  if (new.label,new.worker_id,new.enabled,new.domain_ready) is distinct from (old.label,old.worker_id,old.enabled,old.domain_ready) then new.version:=old.version+1; end if;
  return new;
end;
$$;

create function public.builder_domain_access(target text, actor uuid, changing boolean default false) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare member builder_project_members%rowtype;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0403',message='Sign in with a confirmed, active account to manage website domains';
  end if;
  select * into member from builder_project_members where project_id=target and user_id=actor;
  if not found then raise exception using errcode='P0403',message='Current website membership required'; end if;
  if changing and (member.role<>'owner' or not member.can_publish) then
    raise exception using errcode='P0403',message='A website owner with publishing permission must manage its domain';
  end if;
  return member.role='owner' and member.can_publish;
end;
$$;

create function public.builder_domain_public(item public.builder_domains) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('id',item.id,'projectId',item.project_id,'hostname',item.hostname,'status',item.status,
    'operation',item.operation,'version',item.version,'bindingKind',item.binding_kind,
    'verification',jsonb_build_object('type','TXT','name','_kaizen-verification.'||item.hostname,'value','kaizen-domain-verification='||item.verification_token),
    'reason',item.reason,'dnsCheckedAt',item.dns_checked_at,'connectedAt',item.connected_at,'removedAt',item.removed_at,
    'certificateExpiresAt',item.certificate_expires_at);
$$;

create function public.builder_domain_state(target text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare permitted boolean; is_archived boolean;
begin
  permitted:=builder_domain_access(target,actor);
  select archived into is_archived from builder_projects where id=target;
  return jsonb_build_object('projectId',target,'canManage',permitted,'archived',is_archived,
    'domain',(select builder_domain_public(d) from builder_domains d where project_id=target and status<>'removed'),
    'history',coalesce((select jsonb_agg(builder_domain_public(d) order by d.removed_at desc,d.id desc)
      from (select * from builder_domains where project_id=target and status='removed' order by removed_at desc,id desc limit 10) d),'[]'::jsonb));
end;
$$;

create function public.builder_domain_no_publication(target text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from builder_client_jobs where project_id=target and phase in ('queued','building','activating','verifying','recovery_required'))
    or (target=builder_legacy_project_id() and exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required'))) then
    raise exception using errcode='P0409',message='Finish the website publication or recovery before changing its domain';
  end if;
end;
$$;

create function public.builder_domain_request(target text, actor uuid, request_id uuid, command text,
  expected_version integer default null, domain_hostname text default null, challenge text default null, worker text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare project builder_projects%rowtype; item builder_domains%rowtype; destination builder_client_destinations%rowtype;
begin
  select * into project from builder_projects where id=target for update;
  perform builder_domain_access(target,actor,true);
  if request_id is null or command is null or command not in ('add','verify','remove') then
    raise exception using errcode='22023',message='Choose a valid domain action';
  end if;
  if project.archived and command<>'remove' then raise exception using errcode='P0409',message='Restore this website before connecting a domain'; end if;
  select * into item from builder_domains where id=request_id for update;
  if command='add' then
    if found then
      if item.project_id<>target or item.hostname is distinct from domain_hostname or item.status='removed' then
        raise exception using errcode='P0409',message='This domain request changed. Refresh the domain settings';
      end if;
      return builder_domain_state(target,actor);
    end if;
    if domain_hostname is null or length(domain_hostname)>232 or domain_hostname<>lower(domain_hostname)
      or domain_hostname !~ '^[a-z0-9][a-z0-9.-]*\.[a-z][a-z0-9-]*$'
      or exists(select 1 from unnest(string_to_array(domain_hostname,'.')) label where label !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
      or challenge is null or challenge !~ '^[a-f0-9]{64}$' or worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' then
      raise exception using errcode='22023',message='Use a valid domain name and server-issued verification record';
    end if;
    if exists(select 1 from builder_domains where project_id=target and status<>'removed') then
      raise exception using errcode='P0409',message='Remove the current domain before connecting another';
    end if;
    select * into destination from builder_client_destinations where project_id=target and environment='production' and enabled for update;
    insert into builder_domains(id,project_id,hostname,verification_token,worker_id,requested_by,binding_kind,candidate_destination_id,destination_id)
      values(request_id,target,domain_hostname,challenge,worker,actor,
        case when project.capabilities->>'publishPath'='github' then 'repository-alias'
          when destination.id is not null then 'client-alias' else 'client-primary' end,
        case when project.capabilities->>'publishPath'='github' then null else coalesce(destination.id,gen_random_uuid()) end,
        destination.id);
    return builder_domain_state(target,actor);
  end if;
  if item.id is null or item.project_id<>target then raise exception using errcode='P0403',message='This domain does not belong to the website'; end if;
  -- Repeating a lost queued response is harmless, but a different observed
  -- version can never cancel or replace a worker's current operation.
  if item.status='queued' and item.requested_by=actor and item.version=expected_version+1
    and item.operation=(case when command='remove' then 'remove' else 'connect' end) then return builder_domain_state(target,actor); end if;
  if expected_version is null or item.version<>expected_version or item.owner_token is not null then
    raise exception using errcode='P0409',message='Domain setup changed or is running. Refresh its status before trying again';
  end if;
  if item.status='removed' then
    if command='remove' then return builder_domain_state(target,actor); end if;
    raise exception using errcode='P0409',message='Add the domain again to receive a new verification record';
  end if;
  if item.operation='remove' and command<>'remove' then raise exception using errcode='P0409',message='Finish removing this domain before connecting it again'; end if;
  perform builder_domain_no_publication(target);
  if command='remove' and item.binding_kind='client-primary' and item.destination_id is not null then
    update builder_client_destinations set enabled=false where id=item.destination_id and project_id=target;
  end if;
  update builder_domains set operation=case when command='remove' then 'remove' else 'connect' end,
    status='queued',requested_by=actor,reason=null,attempt_count=0,next_check_at=clock_timestamp(),
    version=version+1,updated_at=clock_timestamp() where id=item.id;
  return builder_domain_state(target,actor);
end;
$$;

create function public.builder_domain_claim(request_id uuid, worker text, token uuid, previous_owner uuid default null, cleanup_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text; is_archived boolean;
begin
  select project_id into target from builder_domains where id=request_id;
  select archived into is_archived from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null or cleanup_only is null then raise exception using errcode='P0403',message='Configured domain worker ownership required'; end if;
  -- Existing hosting must continue to be checked after an ownership transfer or
  -- archive. A first connection still requires the current requester's authority.
  if not cleanup_only and item.operation<>'remove' and item.connected_at is null then
    perform builder_domain_access(target,item.requested_by,true);
    if is_archived then raise exception using errcode='P0409',message='Restore the website before connecting its domain'; end if;
  end if;
  perform builder_domain_no_publication(target);
  if item.owner_token=token then
    if item.withdrawal_only is distinct from cleanup_only then raise exception using errcode='P0409',message='A withdrawal claim cannot become a connection'; end if;
    return to_jsonb(item);
  end if;
  if item.owner_token is not null then
    -- The host must hold its filesystem lock and prove the previous process is
    -- stopped before using this explicit recovery CAS. Elapsed time is not proof.
    if previous_owner is distinct from item.owner_token then raise exception using errcode='P0409',message='Domain work is already claimed; reconcile its existing worker'; end if;
  elsif item.status not in ('queued','waiting_dns','attention','connected') or previous_owner is not null
    or (item.status<>'queued' and item.next_check_at>clock_timestamp()) then
    raise exception using errcode='P0409',message='This domain check is not due';
  end if;
  update builder_domains set owner_token=token,withdrawal_only=cleanup_only,status=case when operation='remove' then 'removing'
    when claimed_at is not null then 'provisioning' else 'checking_dns' end,
    reason=null,attempt_count=least(attempt_count+1,1000),version=version+1,updated_at=clock_timestamp() where id=item.id returning * into item;
  return to_jsonb(item);
end;
$$;

create function public.builder_domain_withdrawal(item public.builder_domains, token uuid, verification jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare observed timestamptz;
begin
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'domainId' is distinct from item.id::text
    or verification->>'attemptId' is distinct from token::text or verification->>'projectId' is distinct from item.project_id
    or verification->>'hostname' is distinct from item.hostname or verification->'providerWithdrawn' is distinct from 'true'::jsonb
    or verification->'routingRemoved' is distinct from 'true'::jsonb
    or verification-array['domainId','attemptId','projectId','hostname','providerWithdrawn','routingRemoved','verifiedAt'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='Verified provider and release route withdrawal required';
  end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes'
    or observed>clock_timestamp()+interval '30 seconds' then
    raise exception using errcode='P0409',message='Fresh route withdrawal evidence required';
  end if;
end;
$$;

create function public.builder_domain_dns_result(request_id uuid, token uuid, result text, withdrawal jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text;
begin
  select project_id into target from builder_domains where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if token is null or item.id is null or item.owner_token is distinct from token or item.operation<>'connect'
    or item.status not in ('checking_dns','provisioning') then raise exception using errcode='P0409',message='The domain check no longer owns this operation'; end if;
  if result is null or result not in ('verified','ownership_missing','routing_missing','routing_mismatch','lookup_failed') then raise exception using errcode='22023',message='Invalid domain DNS result'; end if;
  if result='verified' then
    if item.withdrawal_only then raise exception using errcode='P0409',message='A withdrawal claim cannot verify a connection'; end if;
    if item.connected_at is null then
      perform builder_domain_access(target,item.requested_by,true);
      if exists(select 1 from builder_projects where id=target and archived) then raise exception using errcode='P0409',message='Restore the website before connecting its domain'; end if;
    end if;
    begin
      update builder_domains set claimed_at=coalesce(claimed_at,clock_timestamp()),status='provisioning',dns_checked_at=clock_timestamp(),
        reason=null,version=version+1,updated_at=clock_timestamp() where id=request_id returning * into item;
    exception when unique_violation then
      update builder_domains set status='attention',reason='domain_in_use',owner_token=null,completed_token=token,
        next_check_at=clock_timestamp()+interval '1 hour',dns_checked_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=request_id returning * into item;
    end;
  else
    if item.claimed_at is not null then perform builder_domain_withdrawal(item,token,withdrawal); end if;
    if item.binding_kind='client-primary' and item.destination_id is not null then
      update builder_client_destinations set domain_ready=false where id=item.destination_id and project_id=target;
    end if;
    update builder_domains set status=case when result='lookup_failed' then 'attention' else 'waiting_dns' end,
      reason=result,owner_token=null,completed_token=token,dns_checked_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      ,next_check_at=clock_timestamp()+least(3600,30*power(2,least(greatest(item.attempt_count-1,0),7)))*interval '1 second'
      where id=request_id returning * into item;
  end if;
  return to_jsonb(item);
end;
$$;

create function public.builder_domain_worker_error(request_id uuid, token uuid, failure text, withdrawal jsonb default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text;
begin
  if token is null or failure is null or failure not in ('provider_failed','tls_pending','routing_failed','access_changed','configuration_changed') then
    raise exception using errcode='22023',message='Invalid domain worker failure';
  end if;
  select project_id into target from builder_domains where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if item.id is null or item.owner_token is distinct from token then raise exception using errcode='P0409',message='The domain worker no longer owns this operation'; end if;
  perform builder_domain_no_publication(target);
  if item.claimed_at is not null then perform builder_domain_withdrawal(item,token,withdrawal); end if;
  if item.binding_kind='client-primary' and item.destination_id is not null then
    update builder_client_destinations set domain_ready=false where id=item.destination_id and project_id=target;
  end if;
  update builder_domains set status='attention',reason=failure,owner_token=null,completed_token=token,
    next_check_at=clock_timestamp()+least(3600,30*power(2,least(greatest(item.attempt_count-1,0),7)))*interval '1 second',
    version=version+1,updated_at=clock_timestamp() where id=request_id and owner_token=token;
  if not found then raise exception using errcode='P0409',message='The domain worker no longer owns this operation'; end if;
end;
$$;

revoke all on function public.builder_domain_access(text,uuid,boolean),public.builder_domain_public(public.builder_domains),
  public.builder_domain_state(text,uuid),public.builder_domain_no_publication(text),
  public.builder_domain_request(text,uuid,uuid,text,integer,text,text,text),public.builder_domain_claim(uuid,text,uuid,uuid,boolean),
  public.builder_domain_withdrawal(public.builder_domains,uuid,jsonb),public.builder_domain_dns_result(uuid,uuid,text,jsonb),
  public.builder_domain_worker_error(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.builder_domain_state(text,uuid),public.builder_domain_request(text,uuid,uuid,text,integer,text,text,text),
  public.builder_domain_claim(uuid,text,uuid,uuid,boolean),public.builder_domain_dns_result(uuid,uuid,text,jsonb),public.builder_domain_worker_error(uuid,uuid,text,jsonb) to service_role;

-- Disabled destinations keep their original identity, manifests and history.
-- Reconnecting a former primary domain provisions a new destination and store.
alter table public.builder_client_destinations drop constraint builder_client_destinations_project_id_environment_key;
alter table public.builder_client_destinations drop constraint builder_client_destinations_origin_key;
create unique index builder_client_current_environment on public.builder_client_destinations(project_id,environment) where enabled;
create unique index builder_client_current_origin on public.builder_client_destinations(origin) where enabled;

create function public.builder_domain_worker_queue(worker text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception using errcode='22023',message='Configure a valid domain worker'; end if;
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.updated_at,d.id) from
    (select * from builder_domains where worker_id=worker and status<>'removed'
      and (owner_token is not null or status='queued' or next_check_at<=clock_timestamp())
      -- Failed claimed work rotates by its latest attempt so a full batch cannot
      -- starve the domain whose pending host transaction needs reconciliation.
      order by case when owner_token is not null then updated_at else next_check_at end,updated_at,id limit 100) d),'[]'::jsonb);
end;
$$;

create function public.builder_domain_worker_get(request_id uuid, worker text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; destination builder_client_destinations%rowtype; artifact text;
begin
  select * into item from builder_domains where id=request_id;
  if item.id is null or worker is null or item.worker_id is distinct from worker then
    raise exception using errcode='P0403',message='Configured domain worker required';
  end if;
  if item.binding_kind='repository-alias' then
    select r.artifact_id into artifact from builder_release_head h join builder_releases r on r.id=h.release_id where h.id='site';
  else
    select * into destination from builder_client_destinations where id=item.candidate_destination_id and project_id=item.project_id;
    artifact:=destination.active_artifact_id;
  end if;
  return to_jsonb(item)||jsonb_build_object('active_artifact_id',artifact,
    'destination_enabled',case when item.binding_kind='repository-alias' then true
      when destination.id is not null then destination.enabled
      else item.binding_kind='client-primary' and item.destination_id is null end);
end;
$$;

create function public.builder_domain_worker_assert(request_id uuid, worker text, token uuid, withdrawal_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text; is_archived boolean;
begin
  select project_id into target from builder_domains where id=request_id;
  select archived into is_archived from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if item.id is null or worker is null or item.worker_id is distinct from worker or token is null
    or item.owner_token is distinct from token or withdrawal_only is null then
    raise exception using errcode='P0409',message='The domain worker no longer owns this operation';
  end if;
  perform builder_domain_no_publication(target);
  if not withdrawal_only then
    if item.withdrawal_only then raise exception using errcode='P0409',message='A withdrawal claim cannot reconnect a domain'; end if;
    if item.operation<>'connect' then raise exception using errcode='P0409',message='This domain is being removed'; end if;
    if item.connected_at is null then
      perform builder_domain_access(target,item.requested_by,true);
      if is_archived then raise exception using errcode='P0409',message='Restore the website before connecting its domain'; end if;
    end if;
    if item.destination_id is not null and not exists(select 1 from builder_client_destinations where id=item.destination_id and project_id=target and enabled) then
      raise exception using errcode='P0409',message='The domain publication destination is disabled';
    end if;
  end if;
  return builder_domain_worker_get(request_id,worker);
end;
$$;

create function public.builder_domain_fail_queued(request_id uuid, worker text, failure text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text;
begin
  if failure is null or failure not in ('access_changed','configuration_changed') then
    raise exception using errcode='22023',message='Invalid unclaimed domain failure';
  end if;
  select project_id into target from builder_domains where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if item.id is null or worker is null or item.worker_id is distinct from worker or item.owner_token is not null
    or item.claimed_at is not null or item.operation<>'connect' or item.status not in ('queued','waiting_dns','attention') then
    raise exception using errcode='P0409',message='Retain the existing domain operation for reconciliation';
  end if;
  update builder_domains set status='attention',reason=failure,next_check_at=clock_timestamp()+interval '1 hour',
    version=version+1,updated_at=clock_timestamp() where id=request_id;
end;
$$;

revoke all on function public.builder_domain_worker_get(uuid,text),public.builder_domain_worker_assert(uuid,text,uuid,boolean),
  public.builder_domain_fail_queued(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.builder_domain_worker_get(uuid,text),public.builder_domain_worker_assert(uuid,text,uuid,boolean),
  public.builder_domain_fail_queued(uuid,text,text) to service_role;

create function public.builder_domain_connect_finish(request_id uuid, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; destination builder_client_destinations%rowtype; target text; current_artifact text;
  expires_at timestamptz; verified_at timestamptz; baseline jsonb;
begin
  select project_id into target from builder_domains where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if token is not null and item.completed_token=token and item.status='connected' and item.last_evidence=verification then return builder_domain_public(item); end if;
  if item.id is null or token is null or item.owner_token is distinct from token or item.status<>'provisioning' or item.operation<>'connect' or item.withdrawal_only then
    raise exception using errcode='P0409',message='The domain worker no longer owns this connection';
  end if;
  if item.connected_at is null then
    perform builder_domain_access(target,item.requested_by,true);
    if exists(select 1 from builder_projects where id=target and archived) then raise exception using errcode='P0409',message='Restore the website before connecting its domain'; end if;
  end if;
  perform builder_domain_no_publication(target);
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'domainId' is distinct from item.id::text
    or verification->>'attemptId' is distinct from token::text
    or verification->>'projectId' is distinct from target or verification->>'hostname' is distinct from item.hostname
    or verification->>'origin' is distinct from 'https://'||item.hostname or verification->>'bindingKind' is distinct from item.binding_kind
    or verification->>'destinationId' is distinct from item.candidate_destination_id::text
    or coalesce(verification->>'artifactId','') !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$'
    or coalesce(verification->>'manifestSha256','') !~ '^[a-f0-9]{64}$' or coalesce(verification->>'certificateSha256','') !~ '^[a-f0-9]{64}$'
    or verification->'certificateNames' is distinct from jsonb_build_array(item.hostname)
    or verification->'certificateAutoRenew' is distinct from 'true'::jsonb or verification->'certificateSelfSigned' is distinct from 'false'::jsonb
    or verification->'providerOwned' is distinct from 'true'::jsonb
    or verification-array['domainId','attemptId','projectId','hostname','origin','bindingKind','destinationId','artifactId','manifestSha256',
      'certificateSha256','certificateNames','certificateAutoRenew','certificateSelfSigned','certificateExpiresAt','verifiedAt','providerOwned'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='Verified domain, certificate and served-release evidence required';
  end if;
  expires_at:=(verification->>'certificateExpiresAt')::timestamptz;
  verified_at:=(verification->>'verifiedAt')::timestamptz;
  if expires_at is null or not isfinite(expires_at) or expires_at<=clock_timestamp()+interval '1 hour' or verified_at is null or not isfinite(verified_at)
    or verified_at<clock_timestamp()-interval '5 minutes' or verified_at>clock_timestamp()+interval '30 seconds'
    or item.dns_checked_at is null or item.dns_checked_at<clock_timestamp()-interval '5 minutes'
    or verified_at<item.dns_checked_at then raise exception using errcode='P0409',message='Check fresh DNS, HTTPS and release evidence before connecting the domain'; end if;
  if item.binding_kind='repository-alias' then
    if target<>builder_legacy_project_id() then raise exception using errcode='P0409',message='The repository hosting configuration changed'; end if;
    select r.artifact_id into current_artifact from builder_release_head h join builder_releases r on r.id=h.release_id where h.id='site';
    if current_artifact is null or current_artifact is distinct from verification->>'artifactId' then
      raise exception using errcode='P0409',message='The live website changed. Verify its domain again';
    end if;
  else
    select * into destination from builder_client_destinations where id=item.candidate_destination_id for update;
    if destination.id is null then
      if item.binding_kind<>'client-primary' or verification->>'artifactId' is distinct from 'domain-'||item.id::text then
        raise exception using errcode='P0409',message='The domain requires its own verified empty release baseline';
      end if;
      baseline:=jsonb_build_object('artifactId',verification->>'artifactId','projectId',target,'destinationId',item.candidate_destination_id,
        'environment','production','origin','https://'||item.hostname,'manifestSha256',verification->>'manifestSha256');
      perform builder_client_provision(target,item.candidate_destination_id,'production','https://'||item.hostname,item.hostname,item.worker_id,verification->>'artifactId',baseline);
    elsif destination.project_id<>target or not destination.enabled or destination.environment<>'production'
      or destination.active_artifact_id is distinct from verification->>'artifactId'
      or (item.binding_kind='client-primary' and destination.origin is distinct from 'https://'||item.hostname) then
      raise exception using errcode='P0409',message='The publication destination changed. Verify its domain again';
    end if;
  end if;
  if item.binding_kind='client-primary' then
    update builder_client_destinations set domain_ready=true where id=item.candidate_destination_id and project_id=target and enabled;
  end if;
  update builder_domains set status='connected',destination_id=candidate_destination_id,owner_token=null,completed_token=token,
    connected_at=coalesce(connected_at,clock_timestamp()),certificate_expires_at=expires_at,last_evidence=verification,
    reason=null,attempt_count=0,next_check_at=clock_timestamp()+interval '15 minutes',
    version=version+1,updated_at=clock_timestamp() where id=request_id returning * into item;
  return builder_domain_public(item);
end;
$$;

create function public.builder_domain_remove_finish(request_id uuid, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_domains%rowtype; target text; verified_at timestamptz;
begin
  select project_id into target from builder_domains where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_domains where id=request_id for update;
  if token is not null and item.completed_token=token and item.status='removed' and item.last_evidence=verification then return builder_domain_public(item); end if;
  if item.id is null or token is null or item.owner_token is distinct from token or item.status<>'removing' or item.operation<>'remove' then
    raise exception using errcode='P0409',message='The domain worker no longer owns this removal';
  end if;
  -- Cleanup may finish after its requester loses access: it can only complete
  -- the already-authorized removal, never reconnect, reassign or delete data.
  perform builder_domain_no_publication(target);
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'domainId' is distinct from item.id::text
    or verification->>'attemptId' is distinct from token::text
    or verification->>'projectId' is distinct from target or verification->>'hostname' is distinct from item.hostname
    or verification->'providerRemoved' is distinct from 'true'::jsonb or verification->'routingRemoved' is distinct from 'true'::jsonb
    or verification-array['domainId','attemptId','projectId','hostname','providerRemoved','routingRemoved','verifiedAt'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='Verified removal of this domain routing and hosting object is required';
  end if;
  verified_at:=(verification->>'verifiedAt')::timestamptz;
  if verified_at is null or verified_at<clock_timestamp()-interval '5 minutes' or verified_at>clock_timestamp()+interval '30 seconds' then
    raise exception using errcode='P0409',message='Verify that the domain routing is removed before finishing';
  end if;
  if item.binding_kind='client-primary' and item.destination_id is not null then
    update builder_client_destinations set enabled=false where id=item.destination_id and project_id=target;
  end if;
  update builder_domains set status='removed',owner_token=null,completed_token=token,last_evidence=verification,
    removed_at=clock_timestamp(),reason=null,version=version+1,updated_at=clock_timestamp() where id=request_id returning * into item;
  return builder_domain_public(item);
end;
$$;

create function public.builder_domain_publication_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target text;
begin
  if tg_table_name='builder_client_jobs' then
    if new.phase<>'queued' then return new; end if;
    target:=new.project_id;
  else
    if new.status<>'queued' then return new; end if;
    target:=builder_legacy_project_id();
  end if;
  perform 1 from builder_projects where id=target for update;
  if exists(select 1 from builder_domains where project_id=target and owner_token is not null) then
    raise exception using errcode='P0409',message='Domain setup is running. Wait for its status before publishing';
  end if;
  if tg_table_name='builder_client_jobs' then
    if exists(select 1 from builder_client_destinations where id=new.destination_id and not domain_ready) then
      raise exception using errcode='P0409',message='The website domain is unavailable. Check its settings before publishing';
    end if;
  end if;
  return new;
end;
$$;
create trigger builder_domain_publication_guard before insert or update of phase on public.builder_client_jobs for each row execute function public.builder_domain_publication_guard();
create trigger builder_domain_publication_guard before insert or update of status on public.builder_releases for each row execute function public.builder_domain_publication_guard();

create function public.builder_domain_review_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=new.project_id for update;
  if exists(select 1 from builder_client_destinations where id=new.destination_id and not domain_ready) then
    raise exception using errcode='P0409',message='The website domain is unavailable. Check its settings before publishing';
  end if;
  return new;
end;
$$;
create trigger builder_domain_review_guard before insert on public.builder_client_reviews for each row execute function public.builder_domain_review_guard();
revoke all on function public.builder_domain_review_guard() from public,anon,authenticated,service_role;

revoke all on function public.builder_domain_worker_queue(text),public.builder_domain_connect_finish(uuid,uuid,jsonb),
  public.builder_domain_remove_finish(uuid,uuid,jsonb),public.builder_domain_publication_guard() from public,anon,authenticated,service_role;
grant execute on function public.builder_domain_worker_queue(text),public.builder_domain_connect_finish(uuid,uuid,jsonb),
  public.builder_domain_remove_finish(uuid,uuid,jsonb) to service_role;

create or replace function public.builder_client_history(target text, before_job uuid default null) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare anchor_time timestamptz; result jsonb;
begin
  if not builder_project_access(target,'read') then raise exception 'Project access required'; end if;
  if before_job is not null then
    select created_at into anchor_time from builder_client_jobs where project_id=target and id=before_job;
    if not found then raise exception 'Invalid release history cursor. Open the latest releases'; end if;
  end if;
  with visible as not materialized (
    select id,project_id,destination_id,destination,action,phase,previous_artifact_id,artifact_id,rollback_of,error,log,created_at,updated_at
      from builder_client_jobs where project_id=target
  ), page as (
    select * from visible where before_job is null or (created_at,id)<(anchor_time,before_job)
      order by created_at desc,id desc limit 51
  ), current_jobs as (
    select * from visible where phase in ('queued','building','activating','verifying','recovery_required')
      or id in (select active_job_id from builder_client_destinations where project_id=target and enabled and domain_ready)
  ), destinations as (
    select id,project_id,environment,origin,label,(enabled and domain_ready) as enabled,version,active_artifact_id,active_job_id
      from builder_client_destinations where project_id=target
  )
  select jsonb_build_object(
    'destinations',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from destinations d),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'currentRows',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc,j.id desc) from current_jobs j),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
