-- A copy is one durable project, even when the Edge invocation or browser stops.
-- Its frozen workspace reserves the full plan allowance before copying bytes.
create table public.builder_project_copies (
  project_id text primary key references public.builder_projects(id) on delete cascade,
  source_project_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  source_legacy boolean not null,
  requested_name text not null,
  workspace jsonb not null check(octet_length(workspace::text)<=50000000),
  status text not null default 'pending' check(status in ('pending','complete')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.builder_project_copies enable row level security;
revoke all on public.builder_project_copies from public,anon,authenticated,service_role;

create function public.builder_project_copy_state(target text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_copies%rowtype;
begin
  select * into item from builder_project_copies where project_id=target;
  if item.project_id is null or item.actor_id is distinct from actor then
    raise exception using errcode='P0403',message='Resume this copy with its original account'; end if;
  perform builder_upload_access(target,actor);
  perform builder_upload_access(item.source_project_id,actor,false);
  return to_jsonb(item)||jsonb_build_object('storedAssets',coalesce((
    select jsonb_agg(u.asset_id order by u.asset_id) from builder_uploads u
      where u.project_id=target and u.status='stored'), '[]'::jsonb));
end;
$$;

-- Expired partial files may already have been verified as removed. Explicitly
-- resuming the copy starts those same immutable files again only after local
-- cleanup was acknowledged. Old worker tokens remain invalid.
create function public.builder_project_copy_resume(target text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_copies%rowtype;
begin
  perform 1 from builder_projects where id=target for update;
  perform builder_project_copy_state(target,actor);
  select * into item from builder_project_copies where project_id=target;
  if item.status='pending' then
    update builder_uploads u set status='reserved',owner_token=null,completed_token=null,completion_evidence=null,
      cancel_requested=false,object_version=null,object_etag=null,verified_at=null,received_bytes=0,
      activity_at=clock_timestamp(),updated_at=clock_timestamp(),local_cleanup_pending=true
      where u.project_id=target and u.status='removed' and not u.local_cleanup_pending
        and exists(select 1 from jsonb_array_elements(item.workspace->'assets') a where a->>'id'=u.asset_id::text)
        and not exists(select 1 from storage.objects o where o.bucket_id=u.bucket_id and o.name=u.object_name);
    perform builder_storage_sync(target);
  end if;
  return builder_project_copy_state(target,actor);
end;
$$;

create function public.builder_project_copy_begin(source text, actor uuid, request_id uuid, project_name text, workspace jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_copies%rowtype; usage jsonb; legacy boolean;
begin
  if request_id is null or request_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or project_name is null or length(trim(project_name)) not between 1 and 100 or project_name ~ '[[:cntrl:]]' then
    raise exception using errcode='22023',message='Invalid website copy request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-copy:'||request_id::text,0));
  select * into item from builder_project_copies where project_id=request_id::text;
  if found then
    if item.source_project_id is distinct from source or item.actor_id is distinct from actor or item.requested_name<>trim(project_name) then
      raise exception using errcode='P0409',message='This copy request already belongs to another website or account'; end if;
    return builder_project_copy_resume(item.project_id,actor);
  end if;
  perform builder_upload_access(source,actor,false);
  if exists(select 1 from builder_project_copies where project_id=source and status='pending') then
    raise exception using errcode='P0409',message='Finish the source copy before duplicating it'; end if;
  if jsonb_typeof(workspace) is distinct from 'object' or octet_length(workspace::text)>50000000
    or jsonb_typeof(workspace->'saved') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid website copy contents'; end if;
  usage:=builder_workspace_usage(workspace);
  select (capabilities->>'legacyWorkspace')::boolean into legacy from builder_projects where id=source;
  insert into builder_projects(id,name) values(request_id::text,trim(project_name));
  insert into builder_project_members(project_id,user_id,role,can_publish) values(request_id::text,actor,'owner',true);
  insert into builder_project_workspaces(project_id) values(request_id::text);
  insert into builder_project_copies(project_id,source_project_id,actor_id,source_legacy,requested_name,workspace)
    values(request_id::text,source,actor,legacy,trim(project_name),workspace);
  update builder_project_billing set workspace_bytes=(usage->>'bytes')::bigint,page_count=(usage->>'pages')::integer
    where project_id=request_id::text;
  return builder_project_copy_state(request_id::text,actor);
end;
$$;

create function public.builder_project_copy_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from builder_project_copies where project_id=new.project_id and status='pending') then
    raise exception using errcode='P0409',message='Finish copying this website before editing it'; end if;
  return new;
end;
$$;
create trigger builder_project_copy_guard before update of payload on public.builder_project_workspaces
  for each row execute function public.builder_project_copy_guard();

create function public.builder_project_copy_finish(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_copies%rowtype; asset jsonb;
begin
  -- Same project-first lock order as uploads and workspace commits.
  perform 1 from builder_projects where id=target for update;
  perform builder_project_copy_state(target,actor);
  select * into item from builder_project_copies where project_id=target for update;
  if item.status='complete' then return; end if;
  for asset in select value from jsonb_array_elements(item.workspace->'assets') loop
    if not exists(select 1 from builder_uploads u join builder_storage_objects(target) o on o.bucket=u.bucket_id and o.name=u.object_name
      where u.project_id=target and u.asset_id::text=asset->>'id'
      and u.status='stored' and u.bytes::text=asset->>'size' and u.sha256=asset->>'hash'
      and u.mime=asset->>'mime' and u.asset_kind=asset->>'kind'
      and o.bytes=u.bytes and o.version=u.object_version and o.etag=u.object_etag) then
      raise exception using errcode='P0409',message='Finish copying every file before opening this website'; end if;
  end loop;
  update builder_project_copies set status='complete',updated_at=clock_timestamp() where project_id=target;
  perform builder_commit_project_workspace(target,actor,0,item.workspace);
  -- The destination now owns the full snapshot and histories. Keep the retry
  -- identity, without retaining a second private copy of the workspace forever.
  update builder_project_copies set workspace='{"pages":[],"assets":[],"saved":[]}'::jsonb where project_id=target;
end;
$$;

create function public.builder_project_copy_summaries(actor uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('projectId',c.project_id,'pending',true,
    'canResume',coalesce(c.actor_id=actor,false),'files',jsonb_array_length(c.workspace->'assets'),
    'copied',(select count(*) from builder_uploads u where u.project_id=c.project_id and u.status='stored'))),'[]'::jsonb)
    from builder_project_copies c join builder_project_members m on m.project_id=c.project_id and m.user_id=actor
    where c.status='pending'
$$;

revoke all on function public.builder_project_copy_state(text,uuid),public.builder_project_copy_resume(text,uuid),public.builder_project_copy_begin(text,uuid,uuid,text,jsonb),
  public.builder_project_copy_guard(),public.builder_project_copy_finish(text,uuid),public.builder_project_copy_summaries(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_project_copy_state(text,uuid),public.builder_project_copy_resume(text,uuid),public.builder_project_copy_begin(text,uuid,uuid,text,jsonb),
  public.builder_project_copy_finish(text,uuid),public.builder_project_copy_summaries(uuid) to service_role;
