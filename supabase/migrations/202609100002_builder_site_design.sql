-- Shared definitions are editor-only drafts. Publications contain resolved page snapshots.
create table if not exists public.builder_site (id text primary key check (id = 'site'), payload jsonb not null);
alter table public.builder_site enable row level security;
create policy builder_site_read on public.builder_site for select to authenticated using (public.builder_is_editor());
grant select on public.builder_site to authenticated, service_role;

create or replace function public.builder_save_site(expected_version integer, design jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old jsonb; result jsonb; revisions jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select payload into old from public.builder_site where id='site';
  if coalesce((old->>'version')::integer,0) is distinct from expected_version then raise exception 'Site design changed in another window. Reopen it before saving.'; end if;
  if design->>'schemaVersion' is distinct from '1' or jsonb_typeof(design->'components') is distinct from 'array' or jsonb_typeof(design->'theme') is distinct from 'object' or length(design::text)>5000000 then raise exception 'Invalid or oversized site design'; end if;
  revisions := coalesce(old->'revisions','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',now(),'design',design));
  select jsonb_agg(value order by n) into revisions from jsonb_array_elements(revisions) with ordinality as r(value,n) where n>jsonb_array_length(revisions)-30;
  result := jsonb_build_object('version',expected_version+1,'draft',design,'published',coalesce(old->'published','null'::jsonb),'revisions',revisions);
  insert into public.builder_site(id,payload) values('site',result) on conflict(id) do update set payload=excluded.payload;
  return result;
end;
$$;
revoke all on function public.builder_save_site(integer,jsonb) from public;
grant execute on function public.builder_save_site(integer,jsonb) to authenticated;

-- Only the JWT-verifying edge function may submit resolved snapshots.
create or replace function public.builder_publish_snapshot(page_id uuid, expected_version integer, expected_site_version integer, snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare item jsonb; site_version integer; stamp text; revisions jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select (payload->>'version')::integer into site_version from public.builder_site where id='site';
  if coalesce(site_version,0) is distinct from expected_site_version then raise exception 'Site design changed. Review publication again.'; end if;
  select payload into item from public.builder_pages where id=page_id;
  if item is null or (item->>'version')::integer is distinct from expected_version then raise exception 'Save the latest draft before publishing'; end if;
  if snapshot->>'schemaVersion' is distinct from '1' or snapshot->>'slug' is distinct from item->'draft'->>'slug' or snapshot->>'title' is distinct from item->'draft'->>'title' or jsonb_typeof(snapshot->'data'->'content') is distinct from 'array' or length(snapshot::text)>2000000 then raise exception 'Invalid publication snapshot'; end if;
  stamp := to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  revisions := item->'revisions' || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',stamp,'label','Published','document',snapshot));
  select jsonb_agg(value order by n) into revisions from jsonb_array_elements(revisions) with ordinality as r(value,n) where n>jsonb_array_length(revisions)-50;
  item := item || jsonb_build_object('published',snapshot,'publishedAt',stamp,'version',expected_version+1,'revisions',revisions);
  insert into public.builder_publications(id,slug,document) values(page_id,snapshot->>'slug',snapshot) on conflict(id) do update set slug=excluded.slug,document=excluded.document,published_at=now();
  update public.builder_pages set payload=item where id=page_id;
  return item;
end;
$$;
revoke all on function public.builder_publish_snapshot(uuid,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.builder_publish_snapshot(uuid,integer,integer,jsonb) to service_role;

create or replace function public.builder_publish_site(expected_version integer, page_versions jsonb, page_snapshots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare site jsonb; snapshot jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select payload into site from public.builder_site where id='site';
  if site is null or (site->>'version')::integer is distinct from expected_version then raise exception 'Site design changed. Review publication again.'; end if;
  if jsonb_typeof(page_versions) is distinct from 'object' or jsonb_typeof(page_snapshots) is distinct from 'array' then raise exception 'Invalid publication request'; end if;
  if (select count(*) from jsonb_object_keys(page_versions)) <> (select count(*) from public.builder_pages) or exists(select 1 from public.builder_pages where (page_versions->>id::text)::integer is distinct from (payload->>'version')::integer) then raise exception 'Pages changed. Review affected pages again.'; end if;
  for snapshot in select value from jsonb_array_elements(page_snapshots) loop
    perform public.builder_publish_snapshot((snapshot->>'id')::uuid,(page_versions->>(snapshot->>'id'))::integer,expected_version,snapshot->'document');
  end loop;
  site := site || jsonb_build_object('published',site->'draft','version',expected_version+1);
  update public.builder_site set payload=site where id='site';
  select jsonb_build_object('site',site,'pages',coalesce(jsonb_agg(payload),'[]'::jsonb)) into result from public.builder_pages;
  return result;
end;
$$;
revoke all on function public.builder_publish_site(integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.builder_publish_site(integer,jsonb,jsonb) to service_role;
