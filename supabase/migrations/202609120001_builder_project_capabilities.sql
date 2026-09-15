-- Product behaviour is configured on the project, never inferred from its name or ID.
-- Only the operator/service role can change these switches. Membership is not configuration authority.
alter table public.builder_projects add column capabilities jsonb not null
  default '{"hasInventory":false,"legacyWorkspace":false,"publishPath":"worker"}'::jsonb;
alter table public.builder_projects add constraint builder_project_capabilities_valid check (
  jsonb_typeof(capabilities) = 'object'
  and jsonb_typeof(capabilities->'hasInventory') is not distinct from 'boolean'
  and jsonb_typeof(capabilities->'legacyWorkspace') is not distinct from 'boolean'
  and coalesce(capabilities->>'publishPath' in ('github','worker'), false)
  and ((capabilities->>'publishPath' = 'github') = (capabilities->>'legacyWorkspace' = 'true'))
);
-- The original tables and GitHub worker represent one preserved workspace.
create unique index builder_one_legacy_workspace on public.builder_projects
  ((capabilities->>'legacyWorkspace')) where capabilities->>'legacyWorkspace' = 'true';
update public.builder_projects set capabilities =
  '{"hasInventory":true,"legacyWorkspace":true,"publishPath":"github"}'::jsonb where id='kaizen';

create function public.builder_legacy_project_id() returns text
language sql stable security definer set search_path=public as $$
  select id from public.builder_projects where capabilities->>'legacyWorkspace' = 'true';
$$;
revoke all on function public.builder_legacy_project_id() from public;
grant execute on function public.builder_legacy_project_id() to authenticated,service_role;

create or replace function public.builder_commit_project_workspace(target text, actor uuid, expected_version integer, workspace jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare next_version integer;
begin
  perform 1 from public.builder_projects where id=target for update;
  if target=public.builder_legacy_project_id() then raise exception 'Use the legacy workspace API for the original site'; end if;
  if not exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id where p.id=target and m.user_id=actor and not p.archived) then raise exception 'Project editor access required'; end if;
  update public.builder_project_workspaces set payload=workspace,version=version+1,updated_at=now() where project_id=target and version=expected_version returning version into next_version;
  if not found then raise exception 'This project changed during the operation. Reload before retrying'; end if;
  return next_version;
end;
$$;

create or replace function public.builder_is_editor() returns boolean language sql stable security definer set search_path=public as $$
  select public.builder_project_access(public.builder_legacy_project_id(),'edit');
$$;

create or replace function public.builder_sync_legacy_members() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.project_id=public.builder_legacy_project_id() then delete from public.builder_editors where user_id=old.user_id; end if;
    return old;
  end if;
  if new.project_id=public.builder_legacy_project_id() then insert into public.builder_editors(user_id) values(new.user_id) on conflict do nothing; end if;
  return new;
end;
$$;

create or replace function public.builder_guard_legacy_release() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.requested_by is not null then
    perform 1 from public.builder_projects where id=public.builder_legacy_project_id() for share;
    if not exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id where m.project_id=public.builder_legacy_project_id() and m.user_id=new.requested_by and m.can_publish and not p.archived) then raise exception 'Project publish permission required'; end if;
  end if;
  return new;
end;
$$;
