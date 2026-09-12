-- Operator diagnostics contain only identifiers, enums and bounded browser details.
-- Project owners/editors do not become database operators by using the builder.
create table public.builder_client_errors (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.builder_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text not null check (category in ('network','session','access','conflict','build','unknown')),
  source text not null check (source in ('browser','workspace','helper')),
  screen text not null check (screen in ('projects','pages','site','assets','repository','settings','releases','redirects','previews','backups','existing','page-editor','website-editor','unknown')),
  page_id text check (page_id = 'kaizen' or page_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  route_hash text check (route_hash ~ '^[a-f0-9]{64}$'),
  browser_family text not null check (browser_family in ('Edge','Firefox','Chrome','Safari','Other')),
  browser_version integer check (browser_version between 0 and 9999),
  platform text not null check (platform in ('Android','iOS','Windows','macOS','Linux','Other')),
  helper_mode text not null check (helper_mode in ('local','hosted')),
  helper_status text not null check (helper_status in ('not-checked','connected','connecting','disconnected'))
);
create index builder_client_errors_by_project on public.builder_client_errors(project_id,created_at desc);
create index builder_client_errors_by_actor on public.builder_client_errors(project_id,user_id,created_at desc);
create index builder_client_errors_expiry on public.builder_client_errors(created_at);
alter table public.builder_client_errors enable row level security;
revoke all on public.builder_client_errors from public, anon, authenticated, service_role;
grant select on public.builder_client_errors to service_role;

create function public.builder_record_client_error(target text, actor uuid, diagnostic jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  -- The project lock also serializes membership changes and concurrent rate-limit checks.
  perform 1 from public.builder_projects where id=target for update;
  if not exists (
    select 1 from public.builder_projects p join public.builder_project_members m on m.project_id=p.id
    where p.id=target and m.user_id=actor and not p.archived
  ) then raise exception 'Project membership required' using errcode='42501'; end if;

  if (select count(*) from public.builder_client_errors where project_id=target and user_id=actor and created_at > now()-interval '1 hour') >= 20
    or (select count(*) from public.builder_client_errors where project_id=target and created_at > now()-interval '1 day') >= 2000
  then return false; end if;

  -- Clock, identity and project are server-owned. Ignore any extra JSON properties.
  insert into public.builder_client_errors(project_id,user_id,category,source,screen,page_id,route_hash,browser_family,browser_version,platform,helper_mode,helper_status)
  values(target,actor,diagnostic->>'category',diagnostic->>'source',diagnostic->>'screen',diagnostic->>'page_id',diagnostic->>'route_hash',diagnostic->>'browser_family',(diagnostic->>'browser_version')::integer,diagnostic->>'platform',diagnostic->>'helper_mode',diagnostic->>'helper_status');
  return true;
end;
$$;
revoke all on function public.builder_record_client_error(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.builder_record_client_error(text,uuid,jsonb) to service_role;

create function public.builder_prune_client_errors() returns bigint
language plpgsql security definer set search_path=public as $$
declare removed bigint;
begin
  delete from public.builder_client_errors where created_at < now()-interval '14 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.builder_prune_client_errors() from public,anon,authenticated;
grant execute on function public.builder_prune_client_errors() to service_role;
