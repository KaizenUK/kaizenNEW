-- Durable removal jobs retain identity and charges until provider absence and
-- local cleanup are verified. The upload worker owns both transfer and removal.
alter table public.builder_asset_files add column cleanup_checked_at timestamptz not null default 'epoch';
create table public.builder_asset_cleanup (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.builder_projects(id),
  asset_id uuid not null,
  worker_id text not null check(worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  phase text not null default 'pending' check(phase in ('pending','removing','removed')),
  owner_token uuid,
  completed_token uuid,
  completion_evidence jsonb,
  eligible_at timestamptz not null default clock_timestamp()+interval '7 days',
  checked_at timestamptz not null default 'epoch',
  local_cleanup_pending boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  unique(project_id,asset_id),
  foreign key(project_id,asset_id) references public.builder_asset_files(project_id,asset_id),
  check((phase='removing')=(owner_token is not null)),
  check((phase='removed')=(completed_token is not null)),
  check((phase='removed')=(completion_evidence is not null)),
  check(phase='removed' or local_cleanup_pending)
);
alter table public.builder_asset_cleanup enable row level security;
revoke all on public.builder_asset_cleanup from public,anon,authenticated,service_role;
create index builder_asset_cleanup_worker on public.builder_asset_cleanup(worker_id,checked_at,id) where local_cleanup_pending;
create index builder_asset_file_cleanup_scan on public.builder_asset_files(cleanup_checked_at,project_id,asset_id) where status in ('legacy','observed','verified');

-- A provider delete may succeed before its completion RPC. The cleanup job
-- keeps those bytes reserved until verified completion, including adopted files
-- which have no original upload ledger row. One object is still counted once.
create or replace function public.builder_storage_sync(target text) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare amount bigint; payer uuid;
begin
  perform 1 from builder_projects where id=target for update;
  select user_id into payer from builder_project_billing where project_id=target for update;
  if payer is null then raise exception using errcode='P0409',message='Set up website billing before uploading'; end if;
  perform 1 from builder_billing_accounts where user_id=payer for update;
  with reservations as (
    select u.bucket_id,u.object_name,u.bytes from builder_uploads u where u.project_id=target and u.status<>'removed'
    union all select f.bucket_id,f.object_name,f.bytes from builder_asset_cleanup c
      join builder_asset_files f on f.project_id=c.project_id and f.asset_id=c.asset_id
      where c.project_id=target and c.phase<>'removed'
  ), reserved as (select r.bucket_id,r.object_name,max(r.bytes) as bytes from reservations r group by r.bucket_id,r.object_name)
  select coalesce(sum(greatest(coalesce(o.bytes,0),coalesce(r.bytes,0))),0) into amount
    from builder_storage_objects(target) o full join reserved r on r.bucket_id=o.bucket and r.object_name=o.name;
  update builder_project_billing set storage_bytes=amount where project_id=target;
  return amount;
end;
$$;

-- A new saved reference restarts any pending removal's recovery window. The
-- existing reference guard holds the catalogue row before this job-row update;
-- cleanup claims acquire those locks in the same order.
create function public.builder_asset_cleanup_reference_reset() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status not in ('removing','removed') then
    update builder_asset_cleanup set eligible_at=clock_timestamp()+interval '7 days'
      where project_id=new.project_id and asset_id=new.asset_id and phase='pending';
  end if;
  return new;
end;
$$;
-- Library registration/adoption can race discovery, so refresh the grace period
-- whenever its verified catalogue receipt changes too.
create trigger builder_asset_cleanup_reference_reset after update of verified_at on public.builder_asset_files
  for each row execute function public.builder_asset_cleanup_reference_reset();

create or replace function public.builder_asset_reference_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb:=to_jsonb(new); document jsonb; target text; source_project text; item builder_asset_files%rowtype;
begin
  target:=case tg_argv[0] when 'legacy' then 'kaizen' when 'project' then row_data->>'id' else row_data->>'project_id' end;
  document:=case tg_argv[1] when 'release' then jsonb_build_array(row_data->'request',row_data->'snapshot',row_data->'baseline')
    else row_data->tg_argv[1] end;
  if tg_table_name='builder_project_copies' and row_data->>'status'='pending' then source_project:=row_data->>'source_project_id'; end if;
  for item in select f.* from builder_asset_files f
    where (f.project_id in (target,source_project) or f.project_id='kaizen') and builder_asset_reference_match(document,f.asset_id,f.file_url)
    order by f.project_id,f.asset_id for share
  loop
    if item.status in ('removing','removed') then
      raise exception using errcode='P0409',message='This file is being removed or is no longer available. Import a replacement before saving'; end if;
    update builder_asset_cleanup set eligible_at=clock_timestamp()+interval '7 days'
      where project_id=item.project_id and asset_id=item.asset_id and phase='pending';
  end loop;
  return new;
end;
$$;

create function public.builder_asset_cleanup_queue(worker text, batch_size integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype;
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or batch_size is null or batch_size not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid file cleanup request'; end if;
  perform builder_native_asset_lock();
  -- Bounded discovery gives referenced files another check without letting one
  -- unavailable object monopolise maintenance. Native host proof follows in its
  -- matching integration; until then the original repository stays excluded.
  for item in select f.* from builder_asset_files f where not builder_native_asset_project(f.project_id) and f.status in ('legacy','observed','verified')
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

create function public.builder_asset_cleanup_read(request_id uuid, worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_cleanup%rowtype; file builder_asset_files%rowtype;
begin
  select * into item from builder_asset_cleanup where id=request_id;
  if item.id is null or worker is distinct from item.worker_id then raise exception using errcode='P0403',message='Configured file cleanup worker required'; end if;
  select * into file from builder_asset_files where project_id=item.project_id and asset_id=item.asset_id;
  update builder_asset_cleanup set checked_at=clock_timestamp() where id=request_id;
  return to_jsonb(item)||jsonb_build_object('bytes',file.bytes,'sha256',file.sha256,'mime',file.mime,'bucket_id',file.bucket_id,'object_name',file.object_name,
    'file_url',file.file_url,'object_scope',case when file.identity_source='discovery' then 'orphan' else 'registered' end);
end;
$$;

create function public.builder_asset_cleanup_claim(request_id uuid, worker text, token uuid, previous_owner uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_cleanup%rowtype; file builder_asset_files%rowtype; target text; asset uuid;
begin
  select project_id,asset_id into target,asset from builder_asset_cleanup where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into file from builder_asset_files where project_id=target and asset_id=asset for update;
  select * into item from builder_asset_cleanup where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null then raise exception using errcode='P0403',message='Configured file cleanup worker required'; end if;
  if item.phase='removed' then raise exception using errcode='P0409',message='This file cleanup is already complete'; end if;
  if item.phase='pending' then
    if item.eligible_at>clock_timestamp() then raise exception using errcode='P0409',message='Keep this file available for import recovery'; end if;
    if exists(select 1 from builder_uploads u where u.project_id=target and u.asset_id=asset and (u.status<>'stored' or u.local_cleanup_pending)) then
      raise exception using errcode='P0409',message='Finish the original upload cleanup before removing its stored file'; end if;
    if file.status not in ('legacy','observed','verified') then raise exception using errcode='P0409',message='The file cleanup state changed'; end if;
    -- The reference trigger refuses retained content and creates the save fence.
    update builder_asset_files set status='removing' where project_id=target and asset_id=asset;
  end if;
  if item.owner_token=token then return builder_asset_cleanup_read(request_id,worker); end if;
  if (item.owner_token is not null and item.owner_token is distinct from previous_owner)
    or (item.owner_token is null and previous_owner is not null) then
    raise exception using errcode='P0409',message='Reconcile the existing file cleanup worker before retrying'; end if;
  update builder_asset_cleanup set phase='removing',owner_token=token,checked_at=clock_timestamp() where id=request_id;
  return builder_asset_cleanup_read(request_id,worker);
end;
$$;

create function public.builder_asset_cleanup_finish(request_id uuid, worker text, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_cleanup%rowtype; file builder_asset_files%rowtype; target text; asset uuid; observed timestamptz;
begin
  select project_id,asset_id into target,asset from builder_asset_cleanup where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into file from builder_asset_files where project_id=target and asset_id=asset for update;
  select * into item from builder_asset_cleanup where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null then raise exception using errcode='P0403',message='Configured file cleanup worker required'; end if;
  if item.phase='removed' and item.completed_token=token then
    if verification is distinct from item.completion_evidence then raise exception using errcode='P0409',message='Completed file cleanup evidence changed'; end if;
    return builder_asset_cleanup_read(request_id,worker);
  end if;
  if item.phase<>'removing' or item.owner_token is distinct from token or file.status<>'removing' then
    raise exception using errcode='P0409',message='This cleanup no longer owns the file'; end if;
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'id' is distinct from request_id::text
    or verification->>'attemptId' is distinct from token::text or verification->'localRemoved' is distinct from 'true'::jsonb
    or verification->'providerRemoved' is distinct from 'true'::jsonb or jsonb_typeof(verification->'verifiedAt') is distinct from 'string'
    or verification-array['id','attemptId','localRemoved','providerRemoved','verifiedAt']<>'{}'::jsonb then
    raise exception using errcode='22023',message='Verified file removal required'; end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes' or observed>clock_timestamp()+interval '30 seconds'
    or exists(select 1 from storage.objects where bucket_id=file.bucket_id and name=file.object_name) then
    raise exception using errcode='P0409',message='Confirm the stored file is removed before releasing its space'; end if;
  if exists(select 1 from builder_uploads u where u.project_id=target and u.asset_id=asset and (u.status<>'stored' or u.local_cleanup_pending)) then
    raise exception using errcode='P0409',message='Reconcile the original upload before completing stored file removal'; end if;
  update builder_asset_files set status='removed' where project_id=target and asset_id=asset;
  update builder_uploads set status='removed',cancel_requested=true,owner_token=null,completed_token=token,
    completion_evidence=verification||jsonb_build_object('id',id),updated_at=clock_timestamp()
    where project_id=target and asset_id=asset;
  update builder_asset_cleanup set phase='removed',owner_token=null,completed_token=token,completion_evidence=verification where id=request_id;
  perform builder_storage_sync(target);
  return builder_asset_cleanup_read(request_id,worker);
end;
$$;

create function public.builder_asset_cleanup_ack(request_id uuid, worker text, completed uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update builder_asset_cleanup set local_cleanup_pending=false where id=request_id and worker_id=worker and phase='removed' and completed_token=completed;
  if not found then raise exception using errcode='P0409',message='Confirmed file removal required before local cleanup'; end if;
end;
$$;

revoke all on function public.builder_asset_cleanup_reference_reset(),public.builder_asset_cleanup_queue(text,integer),public.builder_asset_cleanup_read(uuid,text),
  public.builder_asset_cleanup_claim(uuid,text,uuid,uuid),public.builder_asset_cleanup_finish(uuid,text,uuid,jsonb),public.builder_asset_cleanup_ack(uuid,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_asset_cleanup_queue(text,integer),public.builder_asset_cleanup_read(uuid,text),public.builder_asset_cleanup_claim(uuid,text,uuid,uuid),
  public.builder_asset_cleanup_finish(uuid,text,uuid,jsonb),public.builder_asset_cleanup_ack(uuid,text,uuid) to service_role;
