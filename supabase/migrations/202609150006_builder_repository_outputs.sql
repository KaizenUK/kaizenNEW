-- A verified release artifact, not its browser or public marker, owns this
-- measurement. Pending output is retained until a definitive worker outcome.
create table public.builder_repository_output_jobs (
  id uuid primary key,
  project_id text not null references public.builder_projects(id),
  channel text not null check(channel in ('staging','production')),
  artifact_id text not null check(artifact_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'),
  commit_hash text not null check(commit_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  measurement jsonb not null check(jsonb_typeof(measurement)='object'),
  previous_job uuid references public.builder_repository_output_jobs(id),
  phase text not null check(phase in ('reserved','held','live','failed')),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index builder_repository_output_pending on public.builder_repository_output_jobs(project_id,channel) where phase='reserved';
alter table public.builder_repository_output_jobs enable row level security;
revoke all on public.builder_repository_output_jobs from public,anon,authenticated,service_role;
alter table public.builder_project_billing
  add column repository_staging_job uuid references public.builder_repository_output_jobs(id),
  add column repository_production_job uuid references public.builder_repository_output_jobs(id);

create function public.builder_repository_output_sample(sample jsonb) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(sample) is distinct from 'object' then raise exception using errcode='22023',message='Invalid release usage measurement'; end if;
  if jsonb_typeof(sample->'bytes') is distinct from 'number' or sample->>'bytes' !~ '^[0-9]{1,13}$' or (sample->>'bytes')::bigint>1099511627776
    or jsonb_typeof(sample->'sourceBytes') is distinct from 'number' or sample->>'sourceBytes' !~ '^[0-9]{1,13}$' or (sample->>'sourceBytes')::bigint>1099511627776
    or jsonb_typeof(sample->'pages') is distinct from 'number' or sample->>'pages' !~ '^[0-9]{1,6}$' or (sample->>'pages')::integer>100000
    or jsonb_typeof(sample->'sourceRevision') is distinct from 'string' or sample->>'sourceRevision' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(sample->'manifestSha256') is distinct from 'string' or sample->>'manifestSha256' !~ '^[a-f0-9]{64}$'
    or exists(select 1 from jsonb_object_keys(sample) k where k not in ('bytes','pages','sourceBytes','sourceRevision','manifestSha256')) then
    raise exception using errcode='22023',message='Invalid release usage measurement';
  end if;
end;
$$;

create function public.builder_repository_usage_totals(target text, usage jsonb, staging_job uuid, production_job uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('bytes',
    greatest(coalesce((usage->'source'->>'bytes')::bigint,0),coalesce((select max((measurement->>'sourceBytes')::bigint)
      from builder_repository_output_jobs where id in (staging_job,production_job) or (project_id=target and phase in ('reserved','held'))),0))+
    greatest(coalesce((usage->'preview'->>'bytes')::bigint,0),coalesce((usage->'staging'->>'bytes')::bigint,0),coalesce((usage->'production'->>'bytes')::bigint,0),
      coalesce((select max((measurement->>'bytes')::bigint) from builder_repository_output_jobs where project_id=target and phase in ('reserved','held')),0)),
    'pages',greatest(coalesce((usage->'preview'->>'pages')::integer,0),coalesce((usage->'staging'->>'pages')::integer,0),coalesce((usage->'production'->>'pages')::integer,0),
      coalesce((select max((measurement->>'pages')::integer) from builder_repository_output_jobs where project_id=target and phase in ('reserved','held')),0)));
$$;

-- Check a replacement against other websites and the real candidate. Existing
-- larger copies remain accounted for while switching, but do not prevent a
-- smaller valid replacement from resolving usage after a downgrade.
create function public.builder_repository_candidate_check(target text, source_bytes bigint, output_bytes bigint, pages integer) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_billing%rowtype; account builder_billing_accounts%rowtype; selected builder_plans%rowtype;
begin
  perform builder_repository_usage_access(target,null);
  if source_bytes is null or output_bytes is null or pages is null or source_bytes<0 or output_bytes<0 or pages<0 then
    raise exception using errcode='22023',message='Invalid repository usage measurement';
  end if;
  select * into item from builder_project_billing where project_id=target for update;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before publishing'; end if;
  select * into account from builder_billing_accounts where user_id=item.user_id for update;
  if not exists(select 1 from auth.users where id=item.user_id and deleted_at is null) then
    raise exception using errcode='P0409',message='An active billing owner is required before publishing';
  end if;
  selected:=builder_billing_plan(item.user_id);
  if account.project_count>selected.projects or greatest(item.page_count,pages)>selected.pages_per_project
    or account.registered_bytes+account.repository_bytes-item.repository_bytes+source_bytes+output_bytes>selected.storage_bytes then
    raise exception using errcode='P0429',message='This website exceeds its current plan. Reduce its pages or files, or ask the billing owner to upgrade';
  end if;
  return item.user_id;
end;
$$;

create function public.builder_repository_output_begin(target text, request_id uuid, output_channel text, artifact text, source_commit text, sample jsonb, recovery boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_repository_output_jobs%rowtype; prior uuid;
begin
  if recovery is true then
    -- Archiving closes new builds, but cannot prevent an operator restoring a
    -- previously owned artifact under the stopped-process recovery lock.
    perform 1 from builder_projects where id=target for update;
    if not found then raise exception using errcode='P0409',message='The recovery website is unavailable'; end if;
  else
    perform builder_repository_usage_access(target,null);
  end if;
  perform builder_repository_output_sample(sample);
  if request_id is null or output_channel is null or output_channel not in ('staging','production') or artifact is null or artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'
    or source_commit is null or source_commit !~ '^([a-f0-9]{40}|[a-f0-9]{64})$' or recovery is null then
    raise exception using errcode='22023',message='Invalid release usage identity';
  end if;
  select * into item from builder_repository_output_jobs where id=request_id for update;
  if found then
    if item.project_id<>target or item.channel<>output_channel or item.artifact_id<>artifact or item.commit_hash<>source_commit or item.measurement<>sample then
      raise exception using errcode='P0409',message='This usage reservation belongs to a different release artifact';
    end if;
    if item.phase='reserved' and not recovery then perform builder_repository_candidate_check(target,(sample->>'sourceBytes')::bigint,(sample->>'bytes')::bigint,(sample->>'pages')::integer); end if;
    return jsonb_build_object('id',item.id,'phase',item.phase);
  end if;
  if not recovery and exists(select 1 from builder_repository_output_jobs where project_id=target and channel=output_channel and phase in ('reserved','held')) then
    raise exception using errcode='P0409',message='Reconcile the pending release usage before deploying again';
  end if;
  if not recovery then perform builder_repository_candidate_check(target,(sample->>'sourceBytes')::bigint,(sample->>'bytes')::bigint,(sample->>'pages')::integer); end if;
  select case when output_channel='staging' then repository_staging_job else repository_production_job end into prior from builder_project_billing where project_id=target for update;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before publishing'; end if;
  if recovery then
    -- The recovery caller holds the existing filesystem recovery lock and has
    -- proved the earlier worker stopped. Keep its bytes held until the new
    -- selection is verified; a delayed earlier settlement cannot release them.
    update builder_repository_output_jobs set phase='held' where project_id=target and channel=output_channel and phase='reserved';
  end if;
  insert into builder_repository_output_jobs(id,project_id,channel,artifact_id,commit_hash,measurement,previous_job,phase)
    values(request_id,target,output_channel,artifact,source_commit,sample,prior,'reserved');
  update builder_project_billing set repository_revision=repository_revision+1 where project_id=target;
  return jsonb_build_object('id',request_id,'phase','reserved');
end;
$$;

create function public.builder_repository_output_settle(target text, request_id uuid, output_channel text, artifact text, source_commit text, sample jsonb, outcome text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_repository_output_jobs%rowtype; current_job uuid;
begin
  -- A revoked/archived project must still reconcile an already-started release.
  perform 1 from builder_projects where id=target for update;
  perform builder_repository_output_sample(sample);
  if outcome is null or outcome not in ('live','failed') then raise exception using errcode='22023',message='Invalid release usage outcome'; end if;
  select * into item from builder_repository_output_jobs where id=request_id for update;
  if not found and outcome='failed' then
    -- The worker proves it did not switch, even if a reserve acknowledgement was
    -- lost. A tombstone prevents a delayed begin from reopening that attempt.
    select case when output_channel='staging' then repository_staging_job else repository_production_job end into current_job from builder_project_billing where project_id=target for update;
    insert into builder_repository_output_jobs(id,project_id,channel,artifact_id,commit_hash,measurement,previous_job,phase)
      values(request_id,target,output_channel,artifact,source_commit,sample,current_job,'failed') returning * into item;
  end if;
  if item.id is null or item.project_id<>target or item.channel is distinct from output_channel or item.artifact_id is distinct from artifact or item.commit_hash is distinct from source_commit or item.measurement<>sample then
    raise exception using errcode='P0409',message='This release usage observation is stale or belongs to different output';
  end if;
  if item.phase=outcome then return jsonb_build_object('id',item.id,'phase',item.phase); end if;
  if item.phase='held' then raise exception using errcode='P0409',message='A recovery now owns this output reservation'; end if;
  if item.phase='live' then raise exception using errcode='P0409',message='A live output measurement cannot be discarded'; end if;
  if outcome='live' then
    select case when output_channel='staging' then repository_staging_job else repository_production_job end into current_job from builder_project_billing where project_id=target for update;
    if current_job is distinct from item.previous_job or exists(select 1 from builder_repository_output_jobs where project_id=target and channel=output_channel and phase='reserved' and id<>request_id) then
      raise exception using errcode='P0409',message='A newer output owns this website. Reconcile its usage before changing it';
    end if;
    update builder_repository_output_jobs set phase='failed',updated_at=clock_timestamp() where project_id=target and channel=output_channel and phase='held';
    update builder_repository_output_jobs set phase='live',updated_at=clock_timestamp() where id=request_id;
    update builder_project_billing set repository_revision=repository_revision+1,
      repository_staging_job=case when output_channel='staging' then request_id else repository_staging_job end,
      repository_production_job=case when output_channel='production' then request_id else repository_production_job end,
      repository_usage=jsonb_set(repository_usage,array[output_channel],jsonb_build_object('revision',source_commit,'bytes',sample->'bytes','pages',sample->'pages'),true)
      where project_id=target;
  else
    update builder_repository_output_jobs set phase='failed',updated_at=clock_timestamp() where id=request_id;
    update builder_project_billing set repository_revision=repository_revision+1 where project_id=target;
  end if;
  return jsonb_build_object('id',request_id,'phase',outcome);
end;
$$;

create function public.builder_repository_output_read(target text, output_channel text, artifact text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',id,'phase',phase,'commit',commit_hash,'measurement',measurement)
    from builder_repository_output_jobs where project_id=target and channel=output_channel and artifact_id=artifact order by updated_at desc,id limit 1;
$$;

create function public.builder_repository_staged_plan_check(target text, source_commit text, artifact text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_repository_output_jobs%rowtype;
begin
  perform 1 from builder_projects where id=target for update;
  select j.* into item from builder_project_billing b join builder_repository_output_jobs j on j.id=b.repository_staging_job where b.project_id=target;
  if not found or item.phase<>'live' or item.commit_hash is distinct from source_commit or item.artifact_id is distinct from artifact then
    raise exception using errcode='P0409',message='The reviewed staging output has not been measured. Check its deployment before publishing';
  end if;
  return builder_repository_candidate_check(target,(item.measurement->>'sourceBytes')::bigint,(item.measurement->>'bytes')::bigint,(item.measurement->>'pages')::integer);
end;
$$;

-- A repository retry is charged to the current payer/month and measured staged
-- artifact; the generic managed-workspace guard is not its candidate authority.
create function public.builder_reserve_native_publication(request_id uuid, target text, source_commit text, artifact text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare payer uuid; period date:=date_trunc('month',clock_timestamp() at time zone 'UTC')::date; selected builder_plans%rowtype; allowance builder_publication_allowances%rowtype;
begin
  payer:=builder_repository_staged_plan_check(target,source_commit,artifact);
  select * into allowance from builder_publication_allowances where kind='repository' and job_id=request_id for update;
  if found and allowance.state<>'returned' then return; end if;
  selected:=builder_billing_plan(payer);
  insert into builder_billing_months(user_id,month) values(payer,period) on conflict do nothing;
  update builder_billing_months set publications=publications+1 where user_id=payer and month=period and publications<selected.publishes_per_month;
  if not found then raise exception using errcode='P0429',message='The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month'; end if;
  insert into builder_publication_allowances(kind,job_id,project_id,user_id,month,state) values('repository',request_id,target,payer,period,'reserved')
    on conflict(kind,job_id) do update set user_id=excluded.user_id,month=excluded.month,state='reserved';
end;
$$;

revoke all on function public.builder_repository_output_sample(jsonb),public.builder_repository_usage_totals(text,jsonb,uuid,uuid),public.builder_repository_candidate_check(text,bigint,bigint,integer),
  public.builder_repository_output_begin(text,uuid,text,text,text,jsonb,boolean),public.builder_repository_output_settle(text,uuid,text,text,text,jsonb,text),
  public.builder_repository_output_read(text,text,text),public.builder_repository_staged_plan_check(text,text,text),public.builder_reserve_native_publication(uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_repository_output_begin(text,uuid,text,text,text,jsonb,boolean),public.builder_repository_output_settle(text,uuid,text,text,text,jsonb,text),public.builder_repository_output_read(text,text,text) to service_role;

create or replace function public.builder_billing_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare total jsonb; old_account uuid; next_account uuid; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; previous_bytes bigint:=0; previous_repository_bytes bigint:=0; previous_pages integer:=0; added_projects integer:=1;
begin
  if tg_op<>'INSERT' then old_account:=old.user_id; end if;
  if tg_op<>'DELETE' then next_account:=new.user_id; end if;
  -- A deterministic lock order also makes two simultaneous billing transfers
  -- between the same accounts safe. Counters change under these row locks.
  perform 1 from builder_billing_accounts where user_id in (old_account,next_account) order by user_id for update;
  if tg_op='DELETE' then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes,repository_bytes=repository_bytes-old.repository_bytes where user_id=old_account;
    return old;
  end if;
  select * into account from builder_billing_accounts where user_id=next_account;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  total:=builder_repository_usage_totals(new.project_id,new.repository_usage,new.repository_staging_job,new.repository_production_job);
  new.repository_bytes:=(total->>'bytes')::bigint;
  new.repository_pages:=(total->>'pages')::integer;
  selected:=builder_billing_plan(next_account);
  if tg_op='UPDATE' and old_account=next_account then
    previous_bytes:=old.registered_bytes; previous_repository_bytes:=old.repository_bytes; previous_pages:=old.page_count; added_projects:=0;
  end if;
  if added_projects=1 and account.project_count+1>selected.projects then
    raise exception using errcode='P0429',message='Your website limit is reached. Upgrade your plan or move a website to another billing owner. Archived websites also count';
  end if;
  -- A downgrade does not destroy data or prevent editing existing pages. Only
  -- increases beyond the current allowance are refused during a draft save.
  if greatest(new.page_count,new.repository_pages)>selected.pages_per_project and (added_projects=1 or new.page_count>previous_pages) then
    raise exception using errcode='P0429',message='This website has reached its page limit. Remove a page or ask the billing owner to upgrade';
  end if;
  if account.registered_bytes+account.repository_bytes-previous_bytes-previous_repository_bytes+new.registered_bytes+new.repository_bytes>selected.storage_bytes and (added_projects=1 or new.registered_bytes>previous_bytes) then
    raise exception using errcode='P0429',message='The billing account has reached its storage limit. Remove unused files or ask the billing owner to upgrade';
  end if;
  if tg_op='UPDATE' and old_account<>next_account then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes,repository_bytes=repository_bytes-old.repository_bytes where user_id=old_account;
  end if;
  update builder_billing_accounts set project_count=project_count+added_projects,registered_bytes=registered_bytes-previous_bytes+new.registered_bytes,repository_bytes=repository_bytes-previous_repository_bytes+new.repository_bytes where user_id=next_account;
  return new;
end;
$$;


create or replace function public.builder_repository_usage_write(target text, actor uuid, expected_version integer, channel text, sample jsonb, operation text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_billing%rowtype; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; next_usage jsonb; next_bytes bigint; next_pages integer;
begin
  perform builder_repository_usage_access(target,actor);
  if expected_version is null or expected_version<0 or channel is null or channel not in ('source','preview','staging','production') or operation is null or operation not in ('observe','reserve','publish')
    or jsonb_typeof(sample) is distinct from 'object' then raise exception using errcode='22023',message='Invalid repository usage measurement'; end if;
  if jsonb_typeof(sample->'bytes') is distinct from 'number' or sample->>'bytes' !~ '^[0-9]{1,13}$' or (sample->>'bytes')::bigint>1099511627776
    or jsonb_typeof(sample->'revision') is distinct from 'string' or sample->>'revision' !~ '^([a-f0-9]{40}|[a-f0-9]{64})$'
    or (channel='source' and sample ? 'pages')
    or (channel<>'source' and (jsonb_typeof(sample->'pages') is distinct from 'number' or sample->>'pages' !~ '^[0-9]{1,6}$' or (sample->>'pages')::integer>100000))
    or exists(select 1 from jsonb_object_keys(sample) as k where k not in ('bytes','pages','revision')) then
    raise exception using errcode='22023',message='Invalid repository usage measurement';
  end if;
  select * into item from builder_project_billing where project_id=target for update;
  if not found or item.repository_revision<>expected_version then
    raise exception using errcode='P0409',message='Website storage changed. Refresh it before retrying';
  end if;
  select * into account from builder_billing_accounts where user_id=item.user_id for update;
  selected:=builder_billing_plan(item.user_id);
  next_usage:=jsonb_set(item.repository_usage,array[channel],sample,true);
  next_bytes:=coalesce((next_usage->'source'->>'bytes')::bigint,0)+greatest(coalesce((next_usage->'preview'->>'bytes')::bigint,0),
    coalesce((next_usage->'staging'->>'bytes')::bigint,0),coalesce((next_usage->'production'->>'bytes')::bigint,0));
  next_pages:=greatest(coalesce((next_usage->'preview'->>'pages')::integer,0),coalesce((next_usage->'staging'->>'pages')::integer,0),coalesce((next_usage->'production'->>'pages')::integer,0));
  if operation='publish' and channel='preview' then
    perform builder_repository_candidate_check(target,coalesce((next_usage->'source'->>'bytes')::bigint,0),(sample->>'bytes')::bigint,(sample->>'pages')::integer);
  end if;
  next_bytes:=(builder_repository_usage_totals(target,next_usage,item.repository_staging_job,item.repository_production_job)->>'bytes')::bigint;
  if operation<>'observe' and not(operation='publish' and channel='preview') and (
    (greatest(item.page_count,next_pages)>selected.pages_per_project and (operation='publish' or next_pages>item.repository_pages)) or
    (account.registered_bytes+account.repository_bytes-item.repository_bytes+next_bytes>selected.storage_bytes and (operation='publish' or next_bytes>item.repository_bytes)) or
    (operation='publish' and account.project_count>selected.projects)) then
    raise exception using errcode='P0429',message='This website exceeds its current plan. Reduce its pages or files, or ask the billing owner to upgrade';
  end if;
  update builder_project_billing set repository_usage=next_usage,repository_revision=repository_revision+1 where project_id=target;
  return builder_repository_usage_read(target,actor);
end;
$$;

create or replace function public.builder_take_project_billing(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=target for update;
  if not exists(select 1 from builder_project_members where project_id=target and user_id=actor and role='owner') then
    raise exception using errcode='P0403',message='Only a website owner can take over its billing';
  end if;
  if exists(select 1 from builder_project_billing where project_id=target and user_id=actor) then return; end if;
  if exists(select 1 from builder_client_jobs where project_id=target and phase in ('queued','building','activating','verifying','recovery_required'))
    or exists(select 1 from builder_repository_output_jobs where project_id=target and phase in ('reserved','held'))
    or exists(select 1 from builder_repository_publications where project_id=target and phase in ('reserved','sent'))
    or (target='kaizen' and exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required'))) then
    raise exception using errcode='P0409',message='Finish the pending publication or recovery before changing website billing';
  end if;
  perform builder_billing_account(actor);
  update builder_project_billing set user_id=actor where project_id=target;
  if not found then raise exception using errcode='P0409',message='The website billing record needs to be checked'; end if;
end;
$$;
