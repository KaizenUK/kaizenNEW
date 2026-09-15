-- A cancelled copy keeps a small private request tombstone after its generated
-- project is purged. A late Edge retry cannot recreate the same destination.
create table public.builder_project_copy_cancellations (
  project_id text primary key check(project_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  requested_by uuid references auth.users(id) on delete set null,
  original_actor uuid references auth.users(id) on delete set null,
  phase text not null default 'cleaning' check(phase in ('cleaning','complete')),
  created_at timestamptz not null default clock_timestamp(),
  checked_at timestamptz not null default 'epoch',
  completed_at timestamptz,
  check((phase='complete')=(completed_at is not null))
);
alter table public.builder_project_copy_cancellations enable row level security;
revoke all on public.builder_project_copy_cancellations from public,anon,authenticated,service_role;
create index builder_copy_cancellation_pending on public.builder_project_copy_cancellations(checked_at,project_id) where phase='cleaning';
alter table public.builder_project_copies drop constraint builder_project_copies_status_check;
alter table public.builder_project_copies add constraint builder_project_copies_status_check check(status in ('pending','complete','cancelling'));

-- All writes, adoption, upload claims and completion already use this guard.
-- Reads and removal can still reconcile after an owner cancels the copy.
create or replace function public.builder_upload_access(target text, actor uuid, changing boolean default true) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0403',message='Sign in with a confirmed, active account before uploading'; end if;
  if not exists(select 1 from builder_project_members m join builder_projects p on p.id=m.project_id
    where m.project_id=target and m.user_id=actor) then
    raise exception using errcode='P0403',message='Current website access is required before uploading'; end if;
  if changing and exists(select 1 from builder_project_copy_cancellations where project_id=target) then
    raise exception using errcode='P0409',message='This copy was cancelled. Start a new copy from the original website'; end if;
  if changing and exists(select 1 from builder_projects where id=target and archived) then
    raise exception using errcode='P0403',message='Current website access is required before uploading'; end if;
end;
$$;

alter function public.builder_project_copy_begin(text,uuid,uuid,text,jsonb) rename to builder_project_copy_begin_internal;
revoke all on function public.builder_project_copy_begin_internal(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.builder_project_copy_begin(source text, actor uuid, request_id uuid, project_name text, workspace jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if request_id is null then raise exception using errcode='22023',message='Invalid website copy request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-copy:'||request_id::text,0));
  if exists(select 1 from builder_project_copy_cancellations where project_id=request_id::text) then
    raise exception using errcode='P0409',message='This copy was cancelled. Start a new copy from the original website'; end if;
  if exists(select 1 from builder_project_copies where project_id=source and status<>'complete') then
    raise exception using errcode='P0409',message='Finish the source copy before duplicating it'; end if;
  return builder_project_copy_begin_internal(source,actor,request_id,project_name,workspace);
end;
$$;

create or replace function public.builder_project_copy_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from builder_project_copies where project_id=new.project_id and status<>'complete') then
    raise exception using errcode='P0409',message='Finish copying this website before editing it'; end if;
  return new;
end;
$$;

create function public.builder_cancelled_copy_project_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not new.archived and exists(select 1 from builder_project_copy_cancellations where project_id=new.id) then
    raise exception using errcode='P0409',message='This copy was cancelled. Start a new copy from the original website'; end if;
  return new;
end;
$$;
create trigger builder_cancelled_copy_project_guard before insert or update on public.builder_projects
  for each row execute function public.builder_cancelled_copy_project_guard();

create function public.builder_project_copy_cancel(target text, actor uuid, expected_version integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_copies%rowtype; cancelled builder_project_copy_cancellations%rowtype; website builder_projects%rowtype;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0403',message='Sign in with a confirmed, active account before cancelling this copy'; end if;
  if target is null or target='kaizen' or target !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
    raise exception using errcode='22023',message='Choose a valid unfinished copy'; end if;
  perform builder_native_asset_lock();
  perform pg_advisory_xact_lock(hashtextextended('builder-copy:'||target,0));
  select * into website from builder_projects where id=target for update;
  select * into cancelled from builder_project_copy_cancellations where project_id=target for update;
  if cancelled.phase='complete' then
    if actor is distinct from cancelled.requested_by and actor is distinct from cancelled.original_actor then
      raise exception using errcode='P0403',message='This copy cancellation belongs to another account'; end if;
    return jsonb_build_object('projectId',target,'cancelled',true,'cleanupPending',false);
  end if;
  perform builder_upload_access(target,actor,false);
  if not exists(select 1 from builder_project_members where project_id=target and user_id=actor and role='owner') then
    raise exception using errcode='P0403',message='Only a website owner can cancel this copy'; end if;
  if cancelled.phase='cleaning' then
    return jsonb_build_object('projectId',target,'cancelled',true,'cleanupPending',true);
  end if;
  select * into item from builder_project_copies where project_id=target for update;
  if item.project_id is null or item.status<>'pending' then
    raise exception using errcode='P0409',message='Only an unfinished copy can be cancelled'; end if;
  if expected_version is null or expected_version is distinct from website.version then
    raise exception using errcode='P0409',message='The website changed. Refresh Projects before cancelling this copy'; end if;
  insert into builder_project_copy_cancellations(project_id,requested_by,original_actor) values(target,actor,item.actor_id);
  update builder_projects set archived=true where id=target;
  update builder_uploads set cancel_requested=true,updated_at=clock_timestamp()
    where project_id=target and status not in ('stored','removed');
  -- Stop retaining the frozen source/destination snapshot only after all new
  -- writes are fenced out. Physical bytes and unfinished attempts remain charged.
  update builder_project_copies set status='cancelling',workspace='{"pages":[],"assets":[],"saved":[]}'::jsonb,
    updated_at=clock_timestamp() where project_id=target;
  update builder_project_billing set workspace_bytes=0,page_count=0 where project_id=target;
  perform builder_storage_sync(target);
  update builder_asset_cleanup set eligible_at=clock_timestamp() where project_id=target and phase='pending';
  return jsonb_build_object('projectId',target,'cancelled',true,'cleanupPending',true);
end;
$$;

-- Explicit cancellation can remove its generated destination immediately, but
-- every original upload, reference, ownership and provider check still applies.
create function public.builder_cancelled_copy_cleanup_ready() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.phase='pending' and exists(select 1 from builder_project_copy_cancellations where project_id=new.project_id and phase='cleaning') then
    new.eligible_at:=clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger builder_cancelled_copy_cleanup_ready before insert on public.builder_asset_cleanup
  for each row execute function public.builder_cancelled_copy_cleanup_ready();

create or replace function public.builder_project_copy_summaries(actor uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('projectId',c.project_id,'pending',true,
    'canResume',c.status='pending' and coalesce(c.actor_id=actor,false),'files',jsonb_array_length(c.workspace->'assets'),
    'copied',(select count(*) from builder_uploads u where u.project_id=c.project_id and u.status='stored'))
    ||case when c.status='cancelling' then '{"cancelling":true}'::jsonb else '{}'::jsonb end),'[]'::jsonb)
    from builder_project_copies c join builder_project_members m on m.project_id=c.project_id and m.user_id=actor
    where c.status in ('pending','cancelling')
$$;

create function public.builder_project_copy_purge_queue(worker text, batch_size integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or batch_size is null or batch_size not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid copy cleanup request'; end if;
  return (select coalesce(jsonb_agg(q.project_id order by q.checked_at,q.project_id),'[]'::jsonb) from
    (select project_id,checked_at from builder_project_copy_cancellations where phase='cleaning' order by checked_at,project_id limit batch_size) q);
end;
$$;

create function public.builder_project_copy_purge(target text, worker text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare cancelled builder_project_copy_cancellations%rowtype;
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception using errcode='22023',message='Invalid copy cleanup worker'; end if;
  perform builder_native_asset_lock();
  perform pg_advisory_xact_lock(hashtextextended('builder-copy:'||target,0));
  perform 1 from builder_projects where id=target for update;
  select * into cancelled from builder_project_copy_cancellations where project_id=target for update;
  if cancelled.project_id is null then raise exception using errcode='P0403',message='A confirmed copy cancellation is required'; end if;
  if cancelled.phase='complete' then return true; end if;
  update builder_project_copy_cancellations set checked_at=clock_timestamp() where project_id=target;
  if builder_native_asset_project(target)
    or not exists(select 1 from builder_project_copies where project_id=target and status='cancelling')
    or exists(select 1 from storage.objects o where o.bucket_id='builder-project-files' and split_part(o.name,'/',1)=target)
    or exists(select 1 from builder_uploads where project_id=target and (status<>'removed' or local_cleanup_pending))
    or exists(select 1 from builder_asset_files where project_id=target and status<>'removed')
    or exists(select 1 from builder_asset_cleanup where project_id=target and (phase<>'removed' or local_cleanup_pending))
    or exists(select 1 from builder_asset_discovery where project_id=target and phase='pending')
    or exists(select 1 from builder_client_destinations where project_id=target)
    or exists(select 1 from builder_domains where project_id=target) then return false; end if;
  -- Terminal worker records have all been acknowledged. Remove their restrictive
  -- foreign keys before the existing project deletion guard permits cascades.
  delete from builder_asset_discovery where project_id=target;
  delete from builder_asset_cleanup where project_id=target;
  delete from builder_projects where id=target;
  update builder_project_copy_cancellations set phase='complete',completed_at=clock_timestamp() where project_id=target;
  return true;
end;
$$;

revoke all on function public.builder_project_copy_begin(text,uuid,uuid,text,jsonb),public.builder_project_copy_cancel(text,uuid,integer),
  public.builder_cancelled_copy_project_guard(),public.builder_cancelled_copy_cleanup_ready(),
  public.builder_project_copy_purge_queue(text,integer),public.builder_project_copy_purge(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_project_copy_begin(text,uuid,uuid,text,jsonb),public.builder_project_copy_cancel(text,uuid,integer),
  public.builder_project_copy_purge_queue(text,integer),public.builder_project_copy_purge(text,text) to service_role;
