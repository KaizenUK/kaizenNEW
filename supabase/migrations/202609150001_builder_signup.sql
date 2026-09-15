-- First sign-in creates a project once, after provider confirmation and explicit
-- current legal acceptance. Existing users and invitations keep their history.
create table public.builder_account_initializations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_project_id text references public.builder_projects(id) on delete set null,
  initialized_at timestamptz not null default clock_timestamp()
);
alter table public.builder_account_initializations enable row level security;
revoke all on public.builder_account_initializations from public,anon,authenticated,service_role;
insert into public.builder_account_initializations(user_id) select id from auth.users;

-- Remember invitations even if access is removed before the first sign-in.
create function public.builder_remember_project_membership() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into builder_account_initializations(user_id) values(new.user_id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.builder_remember_project_membership() from public,anon,authenticated,service_role;
create trigger builder_remember_project_membership after insert on public.builder_project_members
for each row execute function public.builder_remember_project_membership();

create function public.builder_bootstrap_account(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare first_project text; fresh boolean; current_version text;
begin
  -- Actor comes only from the JWT-verifying function, never browser metadata.
  perform 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null and nullif(email,'') is not null for share;
  if not found then raise exception using errcode='P0401',message='Confirm your email before opening the Builder'; end if;
  select version into current_version from builder_legal_versions where active for share;
  if current_version is null or not exists(select 1 from builder_legal_acceptances where user_id=actor and version=current_version) then
    raise exception using errcode='P0403',message='Accept the current documents before opening the Builder';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-first-project:'||actor::text,0));
  insert into builder_account_initializations(user_id) values(actor) on conflict do nothing;
  fresh := found;
  if fresh and not exists(select 1 from builder_project_members where user_id=actor) then
    first_project := gen_random_uuid()::text;
    insert into builder_projects(id,name) values(first_project,'My website');
    insert into builder_project_members(project_id,user_id,role,can_publish) values(first_project,actor,'owner',true);
    insert into builder_project_workspaces(project_id) values(first_project);
    update builder_account_initializations set first_project_id=first_project where user_id=actor;
  else
    fresh := false;
  end if;
  -- Only currently accessible projects are returned, including on retries after
  -- archival, deletion or access revocation. The initialization survives those.
  select p.id into first_project from builder_projects p
    join builder_project_members m on m.project_id=p.id
    join builder_account_initializations i on i.user_id=m.user_id
    where m.user_id=actor
    order by p.archived,(p.id=i.first_project_id) desc nulls last,(p.id='kaizen') desc,p.created_at,p.id limit 1;
  return jsonb_build_object('created',fresh,'projectId',first_project);
end;
$$;
revoke all on function public.builder_bootstrap_account(uuid) from public,anon,authenticated,service_role;
grant execute on function public.builder_bootstrap_account(uuid) to service_role;
