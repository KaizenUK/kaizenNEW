-- Native source, drafts, builds and releases are outside PostgreSQL. A durable
-- producer record and a global generation join those writes to file cleanup.
-- Configuration comes only from the operator's complete native host inventory.
-- Cleanup stays disabled until every producer and the root scanner are wired.
create table public.builder_native_asset_state (
  singleton boolean primary key default true check(singleton),
  epoch bigint not null default 0 check(epoch>=0),
  configuration text check(configuration ~ '^[a-f0-9]{64}$'),
  cleanup_worker text check(cleanup_worker ~ '^[a-zA-Z0-9_-]{1,100}$'),
  coverage text[] not null default '{}',
  producers jsonb not null default '[]',
  enabled boolean not null default false,
  check(not enabled or (configuration is not null and cleanup_worker is not null))
);
insert into public.builder_native_asset_state(singleton) values(true);
create table public.builder_native_asset_scopes (
  project_id text primary key references public.builder_projects(id)
);
insert into public.builder_native_asset_scopes(project_id) values('kaizen');
create table public.builder_native_asset_operations (
  id uuid primary key,
  worker_id text not null,
  configuration text not null check(configuration ~ '^[a-f0-9]{64}$'),
  project_id text not null references public.builder_projects(id),
  process_id integer not null check(process_id>0),
  host text not null check(length(host) between 1 and 253 and host ~ '^[a-zA-Z0-9_.-]+$'),
  instance_id uuid not null,
  phase text not null check(phase in ('active','complete')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check((phase='complete')=(completed_at is not null))
);
create index builder_native_asset_active on public.builder_native_asset_operations(worker_id,id) where phase='active';
alter table public.builder_native_asset_state enable row level security;
alter table public.builder_native_asset_scopes enable row level security;
alter table public.builder_native_asset_operations enable row level security;
revoke all on public.builder_native_asset_state,public.builder_native_asset_scopes,public.builder_native_asset_operations
  from public,anon,authenticated,service_role;
alter table public.builder_asset_cleanup add column native_clearance jsonb;

create or replace function public.builder_native_asset_project(target text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from builder_native_asset_scopes where project_id=target)
$$;

-- This lock always precedes project/catalogue/job locks. It is held only for
-- short database transactions, never for the filesystem scan or a build.
create or replace function public.builder_native_asset_lock() returns void
language sql volatile security definer set search_path=public,pg_temp as $$
  select pg_advisory_xact_lock(hashtextextended('builder-native-assets',0))
$$;

create function public.builder_native_asset_configure(worker text, fingerprint text, projects text[], producers jsonb, enable_cleanup boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare entry jsonb; project text; current builder_native_asset_state%rowtype;
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or fingerprint is null or fingerprint !~ '^[a-f0-9]{64}$'
    or projects is null or cardinality(projects) not between 1 and 100 or enable_cleanup is null
    or array_position(projects,null) is not null or cardinality(projects)<>(select count(distinct p) from unnest(projects) p)
    or jsonb_typeof(producers) is distinct from 'array' or jsonb_array_length(producers) not between 1 and 100
    or octet_length(producers::text)>65536 then
    raise exception using errcode='22023',message='Invalid native website configuration'; end if;
  perform builder_native_asset_lock();
  select * into current from builder_native_asset_state where singleton for update;
  if current.configuration=fingerprint and current.cleanup_worker=worker and current.coverage=projects
    and current.producers=producers and current.enabled=enable_cleanup then return; end if;
  if exists(select 1 from builder_native_asset_operations where phase='active') then
    raise exception using errcode='P0409',message='Reconcile active website operations before changing native configuration'; end if;
  if exists(select 1 from builder_native_asset_scopes where not(project_id=any(projects))) then
    raise exception using errcode='P0409',message='Keep every retained native website in the host inventory'; end if;
  foreach project in array projects loop
    perform 1 from builder_projects where id=project for update;
    if not found then raise exception using errcode='22023',message='Configure an existing native website'; end if;
  end loop;
  if exists(select 1 from builder_asset_cleanup where project_id=any(projects) and phase='removing') then
    raise exception using errcode='P0409',message='Reconcile native file removal before changing its host inventory'; end if;
  for entry in select value from jsonb_array_elements(producers) loop
    if jsonb_typeof(entry) is distinct from 'object' or entry-array['workerId','projectIds']<>'{}'::jsonb
      or jsonb_typeof(entry->'workerId') is distinct from 'string' or entry->>'workerId' !~ '^[a-zA-Z0-9_-]{1,100}$'
      or jsonb_typeof(entry->'projectIds') is distinct from 'array' or jsonb_array_length(entry->'projectIds') not between 1 and 100
      or exists(select 1 from jsonb_array_elements(entry->'projectIds') p where jsonb_typeof(p)<>'string' or not((p#>>'{}')=any(projects))) then
      raise exception using errcode='22023',message='Invalid native website producer'; end if;
  end loop;
  if (select count(distinct p->>'workerId') from jsonb_array_elements(producers) p)<>jsonb_array_length(producers)
    or exists(select 1 from unnest(projects) p where not exists(select 1 from jsonb_array_elements(producers) w where w->'projectIds' ? p)) then
    raise exception using errcode='22023',message='Every native website needs its configured producer'; end if;
  insert into builder_native_asset_scopes(project_id) select unnest(projects) on conflict do nothing;
  -- A client can become a native website. Pending jobs transfer to its native
  -- worker and regain the full recovery window; removed receipts keep ownership.
  update builder_asset_cleanup set worker_id=worker,native_clearance=null,eligible_at=clock_timestamp()+interval '7 days'
    where project_id=any(projects) and phase='pending';
  update builder_native_asset_state set epoch=epoch+1,configuration=fingerprint,cleanup_worker=worker,
    coverage=projects,producers=builder_native_asset_configure.producers,enabled=enable_cleanup where singleton;
end;
$$;

create function public.builder_native_operation_valid(request_id uuid, worker text, fingerprint text, target text, process_id integer, host text, instance uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if request_id is null or instance is null or worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$'
    or fingerprint is null or fingerprint !~ '^[a-f0-9]{64}$' or target is null or process_id is null or process_id<1
    or host is null or length(host) not between 1 and 253 or host !~ '^[a-zA-Z0-9_.-]+$' then
    raise exception using errcode='22023',message='Invalid native website operation'; end if;
end;
$$;
create function public.builder_native_operation_receipt(item public.builder_native_asset_operations) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',item.id,'workerId',item.worker_id,'configuration',item.configuration,'projectId',item.project_id,
    'processId',item.process_id,'host',item.host,'instanceId',item.instance_id,'phase',item.phase)
$$;
create function public.builder_native_operation_begin(request_id uuid, worker text, fingerprint text, target text, process_id integer, host text, instance uuid, actor uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_native_asset_operations%rowtype; state builder_native_asset_state%rowtype;
begin
  perform builder_native_operation_valid(request_id,worker,fingerprint,target,process_id,host,instance);
  perform builder_native_asset_lock();
  select * into state from builder_native_asset_state where singleton for update;
  select * into item from builder_native_asset_operations where id=request_id for update;
  if found then
    if (item.worker_id,item.configuration,item.project_id,item.process_id,item.host,item.instance_id)
      is distinct from (worker,fingerprint,target,process_id,host,instance) then
      raise exception using errcode='P0409',message='This native operation already belongs to another process'; end if;
    if item.phase='complete' then return builder_native_operation_receipt(item); end if;
  end if;
  if state.configuration is distinct from fingerprint or not exists(select 1 from jsonb_array_elements(state.producers) p
    where p->>'workerId'=worker and p->'projectIds' ? target) then
    raise exception using errcode='P0403',message='Configured native website producer required'; end if;
  -- The signed helper supplies verified Auth. A service-only deployment worker
  -- may omit actor; neither path grants the browser a privileged database key.
  if actor is not null then perform builder_upload_access(target,actor); end if;
  if item.id is not null then return builder_native_operation_receipt(item); end if;
  if (select count(*) from builder_native_asset_operations where worker_id=worker and phase='active')>=100 then
    raise exception using errcode='P0429',message='Reconcile unfinished native website operations before starting more'; end if;
  insert into builder_native_asset_operations(id,worker_id,configuration,project_id,process_id,host,instance_id,phase)
    values(request_id,worker,fingerprint,target,process_id,host,instance,'active') returning * into item;
  update builder_native_asset_state set epoch=epoch+1 where singleton;
  return builder_native_operation_receipt(item);
end;
$$;

create function public.builder_native_operation_end(request_id uuid, worker text, fingerprint text, target text, process_id integer, host text, instance uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_native_asset_operations%rowtype; state builder_native_asset_state%rowtype;
begin
  perform builder_native_operation_valid(request_id,worker,fingerprint,target,process_id,host,instance);
  perform builder_native_asset_lock();
  select * into state from builder_native_asset_state where singleton for update;
  select * into item from builder_native_asset_operations where id=request_id for update;
  if found then
    if (item.worker_id,item.configuration,item.project_id,item.process_id,item.host,item.instance_id)
      is distinct from (worker,fingerprint,target,process_id,host,instance) then
      raise exception using errcode='P0409',message='This native operation already belongs to another process'; end if;
    if item.phase='complete' then return builder_native_operation_receipt(item); end if;
    update builder_native_asset_operations set phase='complete',completed_at=clock_timestamp() where id=request_id returning * into item;
  else
    if state.configuration is distinct from fingerprint or not exists(select 1 from jsonb_array_elements(state.producers) p
      where p->>'workerId'=worker and p->'projectIds' ? target) then
      raise exception using errcode='P0403',message='Configured native website producer required'; end if;
    -- End can overtake a begin whose reply was lost. This tombstone prevents
    -- the late begin from opening a producer after local work has stopped.
    insert into builder_native_asset_operations(id,worker_id,configuration,project_id,process_id,host,instance_id,phase,completed_at)
      values(request_id,worker,fingerprint,target,process_id,host,instance,'complete',clock_timestamp()) returning * into item;
  end if;
  update builder_native_asset_state set epoch=epoch+1 where singleton;
  return builder_native_operation_receipt(item);
end;
$$;

create function public.builder_native_operation_assets(request_id uuid, worker text, fingerprint text, after_key text default '') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_native_asset_operations%rowtype; files jsonb; last_key text;
begin
  perform builder_native_asset_lock();
  select * into item from builder_native_asset_operations where id=request_id;
  if item.id is null or item.worker_id is distinct from worker or item.configuration is distinct from fingerprint or item.phase<>'active' then
    raise exception using errcode='P0403',message='Active native website operation required'; end if;
  if after_key is null or length(after_key)>100 then raise exception using errcode='22023',message='Invalid native file cursor'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('assetId',q.asset_id,'projectId',q.project_id,'url',q.file_url) order by q.key),'[]'::jsonb),max(q.key)
    into files,last_key from (select f.*,f.project_id||':'||f.asset_id::text as key from builder_asset_files f
      where f.project_id in ('kaizen',item.project_id) and f.status in ('removing','removed')
        and f.project_id||':'||f.asset_id::text>after_key order by key limit 100) q;
  return jsonb_build_object('id',request_id,'assets',files,'cursor',case when jsonb_array_length(files)=100 then last_key else null end);
end;
$$;

create function public.builder_native_cleanup_observe(worker text, fingerprint text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare state builder_native_asset_state%rowtype;
begin
  perform builder_native_asset_lock();
  select * into state from builder_native_asset_state where singleton;
  if not state.enabled or state.cleanup_worker is distinct from worker or state.configuration is distinct from fingerprint then
    raise exception using errcode='P0403',message='Configured native file cleanup worker required'; end if;
  if exists(select 1 from builder_native_asset_operations where phase='active') then
    raise exception using errcode='P0409',message='Finish or reconcile native website operations before checking file removal'; end if;
  return jsonb_build_object('epoch',state.epoch::text,'configuration',state.configuration,'projects',state.coverage);
end;
$$;

create function public.builder_native_cleanup_clearance(request_id uuid, worker text, token uuid, fingerprint text, scan_epoch bigint, inventory_hash text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare observation jsonb; item builder_asset_cleanup%rowtype; target text;
begin
  observation:=builder_native_cleanup_observe(worker,fingerprint);
  if token is null or scan_epoch is null or scan_epoch::text is distinct from observation->>'epoch'
    or inventory_hash is null or inventory_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='P0409',message='Native website files changed. Repeat the complete reference check'; end if;
  select project_id into target from builder_asset_cleanup where id=request_id;
  perform 1 from builder_projects where id=target for update;
  perform 1 from builder_asset_files f join builder_asset_cleanup c on c.project_id=f.project_id and c.asset_id=f.asset_id
    where c.id=request_id for update of f;
  select * into item from builder_asset_cleanup where id=request_id for update;
  if item.id is null or item.worker_id is distinct from worker or item.phase<>'pending' or not builder_native_asset_project(item.project_id) then
    raise exception using errcode='P0409',message='Check the pending native file cleanup before retrying'; end if;
  update builder_asset_cleanup set native_clearance=jsonb_build_object('epoch',scan_epoch::text,'configuration',fingerprint,
    'token',token,'inventory',inventory_hash) where id=request_id;
end;
$$;

-- Finding a retained native reference restarts the recovery grace period. This
-- observation grants no removal authority and is tied to the same generation.
create function public.builder_native_cleanup_referenced(request_id uuid, worker text, fingerprint text, scan_epoch bigint, inventory_hash text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare observation jsonb; item builder_asset_cleanup%rowtype; target text;
begin
  observation:=builder_native_cleanup_observe(worker,fingerprint);
  if scan_epoch is null or scan_epoch::text is distinct from observation->>'epoch'
    or inventory_hash is null or inventory_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='P0409',message='Native website files changed. Repeat the complete reference check'; end if;
  select project_id into target from builder_asset_cleanup where id=request_id;
  perform 1 from builder_projects where id=target for update;
  perform 1 from builder_asset_files f join builder_asset_cleanup c on c.project_id=f.project_id and c.asset_id=f.asset_id
    where c.id=request_id for update of f;
  select * into item from builder_asset_cleanup where id=request_id for update;
  if item.id is null or item.worker_id is distinct from worker or item.phase<>'pending' or not builder_native_asset_project(item.project_id) then
    raise exception using errcode='P0409',message='Check the pending native file cleanup before retrying'; end if;
  update builder_asset_cleanup set native_clearance=null,eligible_at=clock_timestamp()+interval '7 days' where id=request_id;
end;
$$;

create or replace function public.builder_native_asset_removal_check(target text, asset uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare state builder_native_asset_state%rowtype;
begin
  if not builder_native_asset_project(target) then return; end if;
  select * into state from builder_native_asset_state where singleton;
  if not state.enabled or exists(select 1 from builder_native_asset_operations where phase='active')
    or not exists(select 1 from builder_asset_cleanup c where c.project_id=target and c.asset_id=asset and c.phase='pending'
      and c.worker_id=state.cleanup_worker and c.native_clearance->>'epoch'=state.epoch::text
      and c.native_clearance->>'configuration'=state.configuration) then
    raise exception using errcode='P0409',message='Verify repository and retained release references before removing this file'; end if;
end;
$$;

-- All claims participate, including ordinary clients, because an operator can
-- register a previously managed client as a native website in the same period.
alter function public.builder_asset_cleanup_claim(uuid,text,uuid,uuid) rename to builder_asset_cleanup_claim_internal;
revoke all on function public.builder_asset_cleanup_claim_internal(uuid,text,uuid,uuid) from public,anon,authenticated,service_role;
create function public.builder_asset_cleanup_claim(request_id uuid, worker text, token uuid, previous_owner uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_cleanup%rowtype;
begin
  perform builder_native_asset_lock();
  select * into item from builder_asset_cleanup where id=request_id;
  if item.phase='pending' and builder_native_asset_project(item.project_id)
    and item.native_clearance->>'token' is distinct from token::text then
    raise exception using errcode='P0409',message='Repeat the native reference check for this removal attempt'; end if;
  return builder_asset_cleanup_claim_internal(request_id,worker,token,previous_owner);
end;
$$;

create function public.builder_native_asset_cleanup_queue(worker text, fingerprint text, batch_size integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype;
begin
  perform builder_native_cleanup_observe(worker,fingerprint);
  if batch_size is null or batch_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid native cleanup batch'; end if;
  for item in select f.* from builder_asset_files f where builder_native_asset_project(f.project_id) and f.status in ('legacy','observed','verified')
    order by f.cleanup_checked_at,f.project_id,f.asset_id limit batch_size for update skip locked
  loop
    update builder_asset_files set cleanup_checked_at=clock_timestamp() where project_id=item.project_id and asset_id=item.asset_id;
    if exists(select 1 from builder_asset_references(item.project_id,item.asset_id)) then
      update builder_asset_cleanup set eligible_at=clock_timestamp()+interval '7 days'
        where project_id=item.project_id and asset_id=item.asset_id and phase='pending';
    elsif not exists(select 1 from builder_uploads u where u.project_id=item.project_id and u.asset_id=item.asset_id
      and (u.status<>'stored' or u.local_cleanup_pending)) then
      insert into builder_asset_cleanup(project_id,asset_id,worker_id) values(item.project_id,item.asset_id,worker)
        on conflict(project_id,asset_id) do nothing;
    end if;
  end loop;
  return (select coalesce(jsonb_agg(q.id order by q.checked_at,q.id),'[]'::jsonb) from
    (select c.id,c.checked_at from builder_asset_cleanup c where c.worker_id=worker and c.local_cleanup_pending
      and (c.phase<>'pending' or c.eligible_at<=clock_timestamp()) order by c.checked_at,c.id limit batch_size) q);
end;
$$;

revoke all on function public.builder_native_asset_lock(),public.builder_native_asset_configure(text,text,text[],jsonb,boolean),
  public.builder_native_operation_valid(uuid,text,text,text,integer,text,uuid),public.builder_native_operation_receipt(public.builder_native_asset_operations),
  public.builder_native_operation_begin(uuid,text,text,text,integer,text,uuid,uuid),public.builder_native_operation_end(uuid,text,text,text,integer,text,uuid),
  public.builder_native_operation_assets(uuid,text,text,text),public.builder_native_cleanup_observe(text,text),
  public.builder_native_cleanup_clearance(uuid,text,uuid,text,bigint,text),public.builder_native_asset_cleanup_queue(text,text,integer),
  public.builder_native_cleanup_referenced(uuid,text,text,bigint,text),
  public.builder_asset_cleanup_claim(uuid,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.builder_native_asset_configure(text,text,text[],jsonb,boolean),
  public.builder_native_operation_begin(uuid,text,text,text,integer,text,uuid,uuid),public.builder_native_operation_end(uuid,text,text,text,integer,text,uuid),
  public.builder_native_operation_assets(uuid,text,text,text),public.builder_native_cleanup_observe(text,text),
  public.builder_native_cleanup_clearance(uuid,text,uuid,text,bigint,text),public.builder_native_asset_cleanup_queue(text,text,integer),
  public.builder_native_cleanup_referenced(uuid,text,text,bigint,text),
  public.builder_asset_cleanup_claim(uuid,text,uuid,uuid) to service_role;
