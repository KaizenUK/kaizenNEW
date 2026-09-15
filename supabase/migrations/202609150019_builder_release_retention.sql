-- A private retirement fence, not a filesystem-deletion instruction. The host
-- must additionally hold its store/native-operation locks, protect serving and
-- recovery files, verify ownership/retention, and confirm physical removal.
-- No project/job foreign keys: tombstones survive deletion, and a retirement
-- claim must never wait for publication/project rows while holding this lock.
create table public.builder_release_retirements (
  project_id text not null check(project_id='kaizen' or project_id ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  scope text not null check(scope in ('repository:staging','repository:production') or scope ~ '^client:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  artifact_id text not null check(artifact_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'),
  worker_id text not null check(worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  store_fingerprint text not null check(store_fingerprint ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  bytes bigint not null check(bytes between 0 and 1099511627776),
  phase text not null default 'pending' check(phase in ('pending','removing','removed')),
  owner_token uuid,
  attempt_generation bigint not null default 0 check(attempt_generation between 0 and 2147483647),
  created_at timestamptz not null default clock_timestamp(),
  eligible_at timestamptz not null default clock_timestamp()+interval '7 days',
  referenced_at timestamptz,
  completed_at timestamptz,
  primary key(project_id,scope,artifact_id),
  check((phase='pending')=(owner_token is null)),
  check((phase='removed')=(completed_at is not null))
);
alter table public.builder_release_retirements enable row level security;
revoke all on public.builder_release_retirements from public,anon,authenticated,service_role;
create index builder_release_retirement_pending on public.builder_release_retirements(worker_id,eligible_at) where phase='pending';

-- Writers may already hold project/destination/billing locks. Retirement only
-- reads those tables (no row locks, writes, or foreign-key checks), so it never
-- reverses that order. Every reference/claim transaction uses this same fence.
create function public.builder_release_retention_lock() returns void
language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  -- PostgREST uses READ COMMITTED. A caller retaining an older transaction
  -- snapshot could otherwise miss a retirement committed during its lock wait.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception using errcode='P0409',message='Release retention requires a fresh database snapshot. Retry with READ COMMITTED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-release-retention',0));
end;
$$;

create function public.builder_release_retention_protected(target text, release_scope text, artifact text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from builder_releases r where target='kaizen' and release_scope='repository:production' and
      (r.status in ('queued','building','activating','verifying','recovery_required') or r.id in
        (select h.release_id from builder_release_head h)) and
      artifact in (r.artifact_id,r.recovery_artifact,r.recovery_baseline_artifact,
        (select p.artifact_id from builder_releases p where p.id=r.previous_release_id),
        (select p.artifact_id from builder_releases p where p.id=r.rollback_of))
    union all
    select 1 from builder_client_destinations d where d.project_id=target and release_scope='client:'||d.id::text
      and artifact in (d.active_artifact_id,(select j.previous_artifact_id from builder_client_jobs j where j.id=d.active_job_id))
    union all
    select 1 from builder_client_reviews r where r.project_id=target and release_scope='client:'||r.destination_id::text
      and r.expires_at>clock_timestamp() and artifact in (r.artifact_id,r.previous_artifact_id)
    union all
    select 1 from builder_client_jobs j where j.project_id=target and release_scope='client:'||j.destination_id::text
      and j.phase in ('queued','building','activating','verifying','recovery_required')
      and artifact in (j.artifact_id,j.previous_artifact_id,j.recovery_target)
    union all
    select 1 from builder_repository_output_jobs j where j.project_id=target and release_scope='repository:'||j.channel
      and (j.phase in ('reserved','held') or j.id in
        (select b.repository_staging_job from builder_project_billing b where b.project_id=target
         union all select b.repository_production_job from builder_project_billing b where b.project_id=target))
      and artifact in (j.artifact_id,(select p.artifact_id from builder_repository_output_jobs p where p.id=j.previous_job))
    union all
    select 1 from builder_domains d where d.project_id=target and d.status<>'removed'
      and artifact=d.last_evidence->>'artifactId' and release_scope=case when d.binding_kind='repository-alias'
        then 'repository:production' else 'client:'||coalesce(d.destination_id,d.candidate_destination_id)::text end
  )
$$;

create function public.builder_release_retention_reference(target text, release_scope text, artifact text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_release_retirements%rowtype;
begin
  if artifact is null then return; end if;
  perform builder_release_retention_lock();
  select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
  if not found then return; end if;
  if item.phase<>'pending' then
    raise exception using errcode='P0409',message='This release is being removed or is no longer retained. Choose another release'; end if;
  update builder_release_retirements set referenced_at=clock_timestamp(),eligible_at=clock_timestamp()+interval '7 days'
    where project_id=target and scope=release_scope and artifact_id=artifact;
end;
$$;

create function public.builder_release_retention_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb:=to_jsonb(new); old_data jsonb; target text; release_scope text; artifact text;
  references_to_check text[]; previous text; identity_keys text[]; key text;
begin
  if tg_op='UPDATE' then
    old_data:=to_jsonb(old);
    -- Indirect rollback/head references are read after the retirement lock.
    -- Their target identities must not change underneath an existing pointer.
    identity_keys:=case tg_table_name
      when 'builder_releases' then array['id','previous_release_id','rollback_of']
      when 'builder_client_reviews' then array['id','project_id','destination_id','artifact_id','previous_artifact_id','rollback_of']
      when 'builder_client_jobs' then array['id','project_id','destination_id','worker_id','artifact_id','previous_artifact_id','rollback_of']
      when 'builder_repository_output_jobs' then array['id','project_id','channel','artifact_id','previous_job']
      when 'builder_client_destinations' then array['id','project_id']
      when 'builder_project_billing' then array['project_id']
      when 'builder_domains' then array['id','project_id']
      else array['id'] end;
    foreach key in array identity_keys loop
      if row_data->key is distinct from old_data->key then
        raise exception using errcode='P0409',message='Release reference identity is immutable. Create a new publication'; end if;
    end loop;
    if tg_table_name='builder_releases' and row_data->>'artifact_id' is distinct from old_data->>'artifact_id'
      and not (old_data->>'artifact_id' is null and old_data->>'status'='queued' and row_data->>'status'='building') then
      raise exception using errcode='P0409',message='Only the first worker claim can assign a release artifact'; end if;
  end if;
  if tg_table_name='builder_releases' then
    -- Historical metadata/failure acknowledgement can remain writable after
    -- retention. A recovery transition/changed target still passes the fence.
    if tg_op='UPDATE' and row_data->>'status' in ('live','failed','rolled_back') and
      (row_data->>'status',row_data->>'worker_id',row_data->>'recovery_artifact',row_data->>'recovery_baseline_artifact') is not distinct from
      (old_data->>'status',old_data->>'worker_id',old_data->>'recovery_artifact',old_data->>'recovery_baseline_artifact') then return new; end if;
    if row_data->>'status' in ('failed','rolled_back') and
      (tg_op='INSERT' or (row_data->>'worker_id',row_data->>'recovery_artifact',row_data->>'recovery_baseline_artifact') is not distinct from
        (old_data->>'worker_id',old_data->>'recovery_artifact',old_data->>'recovery_baseline_artifact')) then return new; end if;
    perform builder_release_retention_lock();
    target:='kaizen';release_scope:='repository:production';
    references_to_check:=array[row_data->>'artifact_id',row_data->>'recovery_artifact',row_data->>'recovery_baseline_artifact'];
    select artifact_id into artifact from builder_releases where id=(row_data->>'previous_release_id')::uuid;
    references_to_check:=array_append(references_to_check,artifact);
    select artifact_id into artifact from builder_releases where id=(row_data->>'rollback_of')::uuid;
    references_to_check:=array_append(references_to_check,artifact);
  elsif tg_table_name='builder_release_head' then
    if tg_op='UPDATE' and new.release_id is not distinct from old.release_id then return new; end if;
    perform builder_release_retention_lock();
    target:='kaizen';release_scope:='repository:production';
    select artifact_id,previous_release_id::text into artifact,previous from builder_releases where id=new.release_id;
    references_to_check:=array[artifact];
    select artifact_id into artifact from builder_releases where id=previous::uuid;
    references_to_check:=array_append(references_to_check,artifact);
  elsif tg_table_name in ('builder_client_reviews','builder_client_jobs') then
    if tg_table_name='builder_client_reviews' then
      if (row_data->>'expires_at')::timestamptz<=clock_timestamp() then return new; end if;
    else
      if tg_op='UPDATE' and row_data->>'phase' in ('live','failed','rolled_back') and
        (row_data->>'phase',row_data->>'recovery_target') is not distinct from
        (old_data->>'phase',old_data->>'recovery_target') then return new; end if;
      if row_data->>'phase' in ('failed','rolled_back') and
        (tg_op='INSERT' or row_data->>'recovery_target' is not distinct from old_data->>'recovery_target') then return new; end if;
    end if;
    perform builder_release_retention_lock();
    target:=new.project_id;release_scope:='client:'||new.destination_id::text;
    references_to_check:=array[new.artifact_id,new.previous_artifact_id,row_data->>'recovery_target'];
  elsif tg_table_name='builder_client_destinations' then
    if tg_op='UPDATE' and (new.active_artifact_id,new.active_job_id) is not distinct from (old.active_artifact_id,old.active_job_id) then return new; end if;
    perform builder_release_retention_lock();
    target:=new.project_id;release_scope:='client:'||new.id::text;
    select previous_artifact_id into previous from builder_client_jobs where id=new.active_job_id;
    references_to_check:=array[new.active_artifact_id,previous];
  elsif tg_table_name='builder_repository_output_jobs' then
    if new.phase='failed' then return new; end if;
    if tg_op='UPDATE' and new.phase='live' and new.phase is not distinct from old.phase then return new; end if;
    perform builder_release_retention_lock();
    target:=new.project_id;release_scope:='repository:'||new.channel;
    select artifact_id into previous from builder_repository_output_jobs where id=new.previous_job;
    references_to_check:=array[new.artifact_id,previous];
  elsif tg_table_name='builder_project_billing' then
    if tg_op='UPDATE' and (new.repository_staging_job,new.repository_production_job) is not distinct from (old.repository_staging_job,old.repository_production_job) then return new; end if;
    perform builder_release_retention_lock();
    for artifact,release_scope,previous in select j.artifact_id,'repository:'||j.channel,p.artifact_id
      from builder_repository_output_jobs j left join builder_repository_output_jobs p on p.id=j.previous_job
      where j.id in (new.repository_staging_job,new.repository_production_job)
    loop
      perform builder_release_retention_reference(new.project_id,release_scope,artifact);
      perform builder_release_retention_reference(new.project_id,release_scope,previous);
    end loop;
    return new;
  elsif tg_table_name='builder_domains' then
    if new.status='removed' then return new; end if;
    perform builder_release_retention_lock();
    target:=new.project_id;
    release_scope:=case when new.binding_kind='repository-alias' then 'repository:production'
      else 'client:'||coalesce(new.destination_id,new.candidate_destination_id)::text end;
    references_to_check:=array[new.last_evidence->>'artifactId'];
  else raise exception 'Unsupported release reference source'; end if;
  foreach artifact in array references_to_check loop
    perform builder_release_retention_reference(target,release_scope,artifact);
  end loop;
  return new;
end;
$$;

create trigger builder_release_retention_guard before insert or update on public.builder_releases for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_release_head for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_client_reviews for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_client_jobs for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_client_destinations for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_repository_output_jobs for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_project_billing for each row execute function public.builder_release_retention_guard();
create trigger builder_release_retention_guard before insert or update on public.builder_domains for each row execute function public.builder_release_retention_guard();

create function public.builder_release_retention_observe(target text, release_scope text, artifact text, worker text,
  fingerprint text, manifest text, stored_bytes bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_release_retirements%rowtype;
begin
  if target is null or release_scope is null or artifact is null or worker is null or fingerprint is null or manifest is null or stored_bytes is null
    or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or fingerprint !~ '^[a-f0-9]{64}$' or manifest !~ '^[a-f0-9]{64}$'
    or artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$' or stored_bytes not between 0 and 1099511627776
    or not (target='kaizen' or target ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
    or not (release_scope in ('repository:staging','repository:production') or release_scope ~ '^client:[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') then
    raise exception using errcode='22023',message='Invalid retained release identity'; end if;
  perform builder_release_retention_lock();
  select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
  if found and (item.worker_id,item.store_fingerprint,item.manifest_sha256,item.bytes) is distinct from (worker,fingerprint,manifest,stored_bytes) then
    raise exception using errcode='P0409',message='This retirement belongs to a different worker, store or artifact'; end if;
  if item.phase in ('removing','removed') then return to_jsonb(item); end if;
  if builder_release_retention_protected(target,release_scope,artifact) then
    perform builder_release_retention_reference(target,release_scope,artifact);
    return jsonb_build_object('phase','protected','artifact_id',artifact); end if;
  if item.artifact_id is null then
    if not exists(select 1 from builder_projects where id=target) or
      (release_scope like 'client:%' and not exists(select 1 from builder_client_destinations d
        where d.project_id=target and release_scope='client:'||d.id::text)) then
      raise exception using errcode='22023',message='The retained release website or destination is unavailable'; end if;
    insert into builder_release_retirements(project_id,scope,artifact_id,worker_id,store_fingerprint,manifest_sha256,bytes)
      values(target,release_scope,artifact,worker,fingerprint,manifest,stored_bytes) returning * into item;
  end if;
  return to_jsonb(item);
end;
$$;

create function public.builder_release_retention_claim(target text, release_scope text, artifact text, worker text,
  fingerprint text, manifest text, token uuid, generation bigint default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_release_retirements%rowtype;
begin
  if generation is null or generation not between 0 and 2147483647 then
    raise exception using errcode='22023',message='Invalid release retirement attempt generation'; end if;
  perform builder_release_retention_lock();
  select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
  if item.artifact_id is null or token is null or (item.worker_id,item.store_fingerprint,item.manifest_sha256) is distinct from (worker,fingerprint,manifest) then
    raise exception using errcode='P0403',message='The recorded release retirement identity is required'; end if;
  if item.attempt_generation<>generation then
    raise exception using errcode='P0409',message='This release retirement attempt was cancelled. Use a new observation'; end if;
  if item.owner_token is not null then
    if item.owner_token<>token then raise exception using errcode='P0409',message='Another attempt owns this retirement'; end if;
    if builder_release_retention_protected(target,release_scope,artifact) then
      raise exception using errcode='P0409',message='The retirement is not clear of publication references'; end if;
    return to_jsonb(item); end if;
  if builder_release_retention_protected(target,release_scope,artifact) then
    perform builder_release_retention_reference(target,release_scope,artifact);
    select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
    return to_jsonb(item); end if;
  if item.eligible_at>clock_timestamp() then return to_jsonb(item); end if;
  update builder_release_retirements set phase='removing',owner_token=token
    where project_id=target and scope=release_scope and artifact_id=artifact returning * into item;
  return to_jsonb(item);
end;
$$;

create function public.builder_release_retention_finish(target text, release_scope text, artifact text, worker text,
  fingerprint text, manifest text, token uuid, proof jsonb, generation bigint default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_release_retirements%rowtype;
begin
  perform builder_release_retention_lock();
  select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
  if item.artifact_id is null or token is null or generation is null or item.attempt_generation is distinct from generation or item.owner_token is distinct from token or
    (item.worker_id,item.store_fingerprint,item.manifest_sha256) is distinct from (worker,fingerprint,manifest) then
    raise exception using errcode='P0403',message='The recorded release retirement attempt is required'; end if;
  if proof is distinct from jsonb_build_object('artifactId',artifact,'storeFingerprint',fingerprint,'manifestSha256',manifest,'artifactAbsent',true) then
    raise exception using errcode='P0409',message='Verify the owned release files are absent before completing retirement'; end if;
  if item.phase='removed' then return to_jsonb(item); end if;
  if item.phase<>'removing' or builder_release_retention_protected(target,release_scope,artifact) then
    raise exception using errcode='P0409',message='The retirement is not clear of publication references'; end if;
  update builder_release_retirements set phase='removed',completed_at=clock_timestamp()
    where project_id=target and scope=release_scope and artifact_id=artifact returning * into item;
  return to_jsonb(item);
end;
$$;

-- Cancellation serializes with every delayed claim. Incrementing the generation
-- permanently invalidates an old request without accumulating token tombstones.
-- A claim that already won is returned for exact owned completion, not cancelled.
create function public.builder_release_retention_cancel(target text, release_scope text, artifact text, worker text,
  fingerprint text, manifest text, token uuid, generation bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_release_retirements%rowtype;
begin
  if token is null or generation is null or generation not between 0 and 2147483647 then
    raise exception using errcode='22023',message='Invalid release retirement attempt generation'; end if;
  perform builder_release_retention_lock();
  select * into item from builder_release_retirements where project_id=target and scope=release_scope and artifact_id=artifact;
  if item.artifact_id is null or (item.worker_id,item.store_fingerprint,item.manifest_sha256) is distinct from (worker,fingerprint,manifest) then
    raise exception using errcode='P0403',message='The recorded release retirement identity is required'; end if;
  if item.attempt_generation<generation then
    raise exception using errcode='P0409',message='This retirement attempt is newer than the recorded observation'; end if;
  if item.attempt_generation=generation then
    if item.owner_token is not null then
      if item.owner_token<>token then raise exception using errcode='P0409',message='Another attempt owns this retirement'; end if;
      return to_jsonb(item);
    end if;
    if generation=2147483647 then
      raise exception using errcode='P0409',message='The retirement attempt limit requires operator reconciliation'; end if;
    update builder_release_retirements set attempt_generation=attempt_generation+1
      where project_id=target and scope=release_scope and artifact_id=artifact returning * into item;
  end if;
  return to_jsonb(item)||jsonb_build_object('phase','cancelled','retirement_phase',item.phase,
    'cancelled_token',token,'cancelled_generation',generation);
end;
$$;

revoke all on function public.builder_release_retention_lock(),public.builder_release_retention_protected(text,text,text),
  public.builder_release_retention_reference(text,text,text),public.builder_release_retention_guard(),
  public.builder_release_retention_observe(text,text,text,text,text,text,bigint),
  public.builder_release_retention_claim(text,text,text,text,text,text,uuid,bigint),
  public.builder_release_retention_finish(text,text,text,text,text,text,uuid,jsonb,bigint),
  public.builder_release_retention_cancel(text,text,text,text,text,text,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.builder_release_retention_observe(text,text,text,text,text,text,bigint),
  public.builder_release_retention_claim(text,text,text,text,text,text,uuid,bigint),
  public.builder_release_retention_finish(text,text,text,text,text,text,uuid,jsonb,bigint),
  public.builder_release_retention_cancel(text,text,text,text,text,text,uuid,bigint) to service_role;
