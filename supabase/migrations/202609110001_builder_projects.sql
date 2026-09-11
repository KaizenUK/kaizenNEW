-- Client projects use private storage and a server-validated workspace store.
-- The original Kaizen tables remain authoritative for the legacy site during migration.
create table public.builder_projects (
  id text primary key check (id = 'kaizen' or id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  name text not null check (length(trim(name)) between 1 and 100),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  destination jsonb not null default '{"kind":"unconfigured","label":"No deployment destination configured"}'::jsonb,
  settings jsonb not null default '{}'::jsonb
);
create table public.builder_project_members (
  project_id text not null references public.builder_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor')),
  can_publish boolean not null default false,
  primary key (project_id,user_id)
);
create table public.builder_project_workspaces (
  project_id text primary key references public.builder_projects(id) on delete cascade,
  version integer not null default 0,
  payload jsonb not null default '{"pages":[],"assets":[],"saved":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  check (octet_length(payload::text) <= 50000000 and jsonb_typeof(payload->'pages') is not distinct from 'array' and jsonb_typeof(payload->'assets') is not distinct from 'array' and jsonb_typeof(payload->'saved') is not distinct from 'array')
);
create table public.builder_project_previews (
  project_id text not null references public.builder_projects(id) on delete cascade,
  id uuid not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  primary key(project_id,id)
);
alter table public.builder_projects enable row level security;
alter table public.builder_project_members enable row level security;
alter table public.builder_project_workspaces enable row level security;
alter table public.builder_project_previews enable row level security;

create function public.builder_project_access(target text, capability text default 'read', actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id
    where m.project_id=target and m.user_id=actor and (actor=auth.uid() or current_setting('request.jwt.claim.role',true)='service_role')
    and case capability when 'read' then true when 'edit' then not p.archived
      when 'owner' then m.role='owner' when 'publish' then not p.archived and m.can_publish else false end),false);
$$;
revoke all on function public.builder_project_access(text,text,uuid) from public;
grant execute on function public.builder_project_access(text,text,uuid) to authenticated,service_role;
create policy project_member_read on public.builder_projects for select to authenticated using(public.builder_project_access(id));
create policy project_members_read on public.builder_project_members for select to authenticated using(public.builder_project_access(project_id));
create policy project_workspace_read on public.builder_project_workspaces for select to authenticated using(public.builder_project_access(project_id));
create policy project_preview_read on public.builder_project_previews for select to authenticated using(public.builder_project_access(project_id) and expires_at>now());
revoke all on public.builder_projects,public.builder_project_members,public.builder_project_workspaces,public.builder_project_previews from public,anon,authenticated;
grant select on public.builder_projects,public.builder_project_members,public.builder_project_workspaces,public.builder_project_previews to authenticated;
grant all on public.builder_projects,public.builder_project_members,public.builder_project_workspaces,public.builder_project_previews to service_role;

create function public.builder_create_project(project_name text) returns text
language plpgsql security definer set search_path=public as $$
declare result text := gen_random_uuid()::text;
begin
  if auth.uid() is null then raise exception 'Sign in to create a project'; end if;
  if project_name is null or length(trim(project_name)) not between 1 and 100 or project_name ~ '[[:cntrl:]]' then raise exception 'Use a project name of 1–100 characters'; end if;
  insert into public.builder_projects(id,name) values(result,trim(project_name));
  insert into public.builder_project_members(project_id,user_id,role,can_publish) values(result,auth.uid(),'owner',true);
  insert into public.builder_project_workspaces(project_id) values(result);
  return result;
end;
$$;
revoke all on function public.builder_create_project(text) from public;
grant execute on function public.builder_create_project(text) to authenticated;

create function public.builder_update_project(target text, expected_version integer, project_name text default null, archive boolean default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.builder_projects where id=target for update;
  if not public.builder_project_access(target,'owner') then raise exception 'Project owner access required'; end if;
  if project_name is not null and (length(trim(project_name)) not between 1 and 100 or project_name ~ '[[:cntrl:]]') then raise exception 'Use a project name of 1–100 characters'; end if;
  update public.builder_projects set name=coalesce(trim(project_name),name),archived=coalesce(archive,archived),version=version+1,updated_at=now() where id=target and version=expected_version;
  if not found then raise exception 'Project changed in another window. Refresh before retrying'; end if;
end;
$$;
revoke all on function public.builder_update_project(text,integer,text,boolean) from public;
grant execute on function public.builder_update_project(text,integer,text,boolean) to authenticated;

create function public.builder_set_project_member(target text, member_id uuid, member_role text, publish_permission boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.builder_projects where id=target for update;
  if not public.builder_project_access(target,'owner') then raise exception 'Project owner access required'; end if;
  if member_role is not null and member_role not in ('owner','editor') then raise exception 'Choose owner or editor access'; end if;
  if member_role is distinct from 'owner' and exists(select 1 from public.builder_project_members where project_id=target and user_id=member_id and role='owner') and (select count(*) from public.builder_project_members where project_id=target and role='owner')<=1 then raise exception 'Keep at least one project owner'; end if;
  if member_role is null then delete from public.builder_project_members where project_id=target and user_id=member_id;
  else insert into public.builder_project_members(project_id,user_id,role,can_publish) values(target,member_id,member_role,coalesce(publish_permission,false)) on conflict(project_id,user_id) do update set role=excluded.role,can_publish=excluded.can_publish; end if;
end;
$$;
revoke all on function public.builder_set_project_member(text,uuid,text,boolean) from public;
grant execute on function public.builder_set_project_member(text,uuid,text,boolean) to authenticated;

-- Only the JWT-verifying Edge API may submit validated workspace changes.
-- Membership is checked again under the project lock so revocation/archive wins races.
create function public.builder_commit_project_workspace(target text, actor uuid, expected_version integer, workspace jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare next_version integer;
begin
  perform 1 from public.builder_projects where id=target for update;
  if target='kaizen' then raise exception 'Use the legacy workspace API for the original site'; end if;
  if not exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id where p.id=target and m.user_id=actor and not p.archived) then raise exception 'Project editor access required'; end if;
  update public.builder_project_workspaces set payload=workspace,version=version+1,updated_at=now() where project_id=target and version=expected_version returning version into next_version;
  if not found then raise exception 'This project changed during the operation. Reload before retrying'; end if;
  return next_version;
end;
$$;
revoke all on function public.builder_commit_project_workspace(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.builder_commit_project_workspace(text,uuid,integer,jsonb) to service_role;

create function public.builder_project_preview_write(target text, actor uuid, preview_id uuid, snapshot jsonb default null, revoke boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare existing jsonb;
begin
  perform 1 from public.builder_projects where id=target for update;
  if not exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id where p.id=target and m.user_id=actor and not p.archived) then raise exception 'Project editor access required'; end if;
  if revoke then delete from public.builder_project_previews where project_id=target and id=preview_id; return null; end if;
  if snapshot->>'id' is distinct from preview_id::text or snapshot->'document'->>'schemaVersion' is distinct from '1' or length(snapshot::text)>2000000 or (snapshot->>'expiresAt')::timestamptz>now()+interval '169 hours' or (snapshot->>'expiresAt')::timestamptz<=now() then raise exception 'Invalid preview snapshot'; end if;
  select payload into existing from public.builder_project_previews where project_id=target and id=preview_id;
  if existing is not null then
    if existing->'document' is distinct from snapshot->'document' then raise exception 'This preview ID is already in use'; end if;
    return existing;
  end if;
  delete from public.builder_project_previews where project_id=target and expires_at<=now();
  if (select count(*) from public.builder_project_previews where project_id=target)>=100 then raise exception 'Revoke an active preview before creating another'; end if;
  insert into public.builder_project_previews(project_id,id,payload,expires_at) values(target,preview_id,snapshot,(snapshot->>'expiresAt')::timestamptz);
  return snapshot;
end;
$$;
revoke all on function public.builder_project_preview_write(text,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.builder_project_preview_write(text,uuid,uuid,jsonb,boolean) to service_role;

insert into public.builder_projects(id,name,destination) values('kaizen','Kaizen workspace','{"kind":"legacy-hosted","label":"Existing Kaizen publication destination"}');
-- Existing explicitly granted editors retain editing/publication rights. Deterministically
-- assign an initial owner without adding unrelated Auth users; owners may adjust roles later.
insert into public.builder_project_members(project_id,user_id,role,can_publish)
select 'kaizen',user_id,case when row_number() over(order by user_id)=1 then 'owner' else 'editor' end,true from public.builder_editors;
create or replace function public.builder_is_editor() returns boolean language sql stable security definer set search_path=public as $$
  select public.builder_project_access('kaizen','edit');
$$;
create function public.builder_sync_legacy_members() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.project_id='kaizen' then delete from public.builder_editors where user_id=old.user_id; end if;
    return old;
  end if;
  if new.project_id='kaizen' then insert into public.builder_editors(user_id) values(new.user_id) on conflict do nothing; end if;
  return new;
end;
$$;
create trigger builder_sync_legacy_members after insert or update or delete on public.builder_project_members for each row execute function public.builder_sync_legacy_members();
create function public.builder_guard_legacy_release() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.requested_by is not null then
    perform 1 from public.builder_projects where id='kaizen' for share;
    if not exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id where m.project_id='kaizen' and m.user_id=new.requested_by and m.can_publish and not p.archived) then raise exception 'Project publish permission required'; end if;
  end if;
  return new;
end;
$$;
do $$ begin
  if to_regclass('public.builder_releases') is not null then
    create trigger builder_guard_legacy_release before insert on public.builder_releases for each row execute function public.builder_guard_legacy_release();
  end if;
end; $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('builder-project-files','builder-project-files',false,52428800,null);
create policy project_files_read on storage.objects for select to authenticated using (
  bucket_id='builder-project-files' and public.builder_project_access(split_part(name,'/',1))
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'
);
create policy project_files_insert on storage.objects for insert to authenticated with check (
  bucket_id='builder-project-files' and public.builder_project_access(split_part(name,'/',1),'edit')
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'
);
-- No client update/delete policy: original bytes used by histories cannot be overwritten.
