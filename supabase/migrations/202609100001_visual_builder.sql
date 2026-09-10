-- Shared Kaizen builder. Access is explicitly granted to existing Supabase Auth users.
create table if not exists public.builder_editors (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.builder_editors enable row level security;
create or replace function public.builder_is_editor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.builder_editors where user_id = auth.uid());
$$;
revoke all on function public.builder_is_editor() from public;
grant execute on function public.builder_is_editor() to authenticated;

create table if not exists public.builder_pages (id uuid primary key, payload jsonb not null);
create table if not exists public.builder_publications (id uuid primary key references public.builder_pages(id), slug text not null unique, document jsonb not null, published_at timestamptz not null default now());
create table if not exists public.builder_assets (id uuid primary key, hash text not null, payload jsonb not null);
create table if not exists public.builder_saved (id uuid primary key, payload jsonb not null);
alter table public.builder_pages enable row level security;
alter table public.builder_publications enable row level security;
alter table public.builder_assets enable row level security;
alter table public.builder_saved enable row level security;
create policy builder_pages_read on public.builder_pages for select to authenticated using (public.builder_is_editor());
create policy builder_publications_read on public.builder_publications for select to anon, authenticated using (true);
create policy builder_assets_read on public.builder_assets for select to authenticated using (public.builder_is_editor());
create policy builder_assets_insert on public.builder_assets for insert to authenticated with check (public.builder_is_editor() and payload->>'id' = id::text and payload->>'hash' = hash);
create policy builder_assets_update on public.builder_assets for update to authenticated using (public.builder_is_editor()) with check (public.builder_is_editor() and payload->>'id' = id::text and payload->>'hash' = hash);
create policy builder_saved_all on public.builder_saved for all to authenticated using (public.builder_is_editor()) with check (public.builder_is_editor());
grant select on public.builder_pages to authenticated;
grant select on public.builder_publications to anon, authenticated;
grant select, insert, update on public.builder_assets to authenticated;
grant select, insert, update, delete on public.builder_saved to authenticated;
revoke insert, update, delete on public.builder_pages, public.builder_publications from anon, authenticated;

create or replace function public.builder_save_page(page_id uuid, expected_version integer, document jsonb, revision_label text default 'Autosaved draft') returns jsonb
language plpgsql security definer set search_path = public as $$
declare old jsonb; result jsonb; revisions jsonb; stamp text; page_slug text;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if document->>'schemaVersion' is distinct from '1' or jsonb_typeof(document->'data'->'content') is distinct from 'array' or length(document::text) > 2000000 then raise exception 'Unsupported or oversized page document'; end if;
  if coalesce(length(trim(document->>'title')), 0) not between 1 and 200 then raise exception 'Add a page title of 1–200 characters'; end if;
  page_slug := document->>'slug';
  if page_slug is null or length(page_slug) > 180 or page_slug !~ '^[a-z0-9]([a-z0-9/-]*[a-z0-9])?$' or page_slug like '%//%' then raise exception 'Invalid page URL'; end if;
  if page_slug ~ '^(builder|studio|api|editor-api|_astro|blog|blogdetail|insights|services|products|case-studies|about|contact|thank-you|index|home|review|pledge|contract-product-owner|performance-scanner|get-started|privacy-policy|cookie-policy|gdpr-policy|terms-and-conditions|web-design[^/]*|digital-transformation|agile-coaching|project-rescue|product-owner)(/|$)' then raise exception 'This URL belongs to the existing site'; end if;
  select payload into old from public.builder_pages where id = page_id;
  if coalesce((old->>'version')::integer, 0) <> expected_version then raise exception 'This page changed in another window. Export your draft, then reopen it before saving.'; end if;
  if exists(select 1 from public.builder_pages where id <> page_id and (payload->'draft'->>'slug' = page_slug or payload->'published'->>'slug' = page_slug)) then raise exception 'Another page uses this URL'; end if;
  stamp := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  revisions := coalesce(old->'revisions', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'createdAt', stamp, 'label', left(revision_label, 120), 'document', document));
  select jsonb_agg(value order by n) into revisions from jsonb_array_elements(revisions) with ordinality as r(value,n) where n > jsonb_array_length(revisions)-50;
  result := jsonb_build_object('id', page_id, 'version', expected_version+1, 'draft', document, 'published', coalesce(old->'published', 'null'::jsonb), 'publishedAt', old->'publishedAt', 'updatedAt', stamp, 'revisions', revisions);
  insert into public.builder_pages(id,payload) values(page_id,result) on conflict(id) do update set payload=excluded.payload;
  return result;
end;
$$;
revoke all on function public.builder_save_page(uuid, integer, jsonb, text) from public;
grant execute on function public.builder_save_page(uuid, integer, jsonb, text) to authenticated;

-- Only the JWT-verifying publishing function may promote drafts.
create or replace function public.builder_publish_page(page_id uuid, expected_version integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare item jsonb; stamp text; revisions jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select payload into item from public.builder_pages where id = page_id;
  if item is null or (item->>'version')::integer <> expected_version then raise exception 'Save the latest draft before publishing'; end if;
  stamp := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  revisions := item->'revisions' || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',stamp,'label','Published','document',item->'draft'));
  select jsonb_agg(value order by n) into revisions from jsonb_array_elements(revisions) with ordinality as r(value,n) where n > jsonb_array_length(revisions)-50;
  item := item || jsonb_build_object('published',item->'draft','publishedAt',stamp,'version',expected_version+1,'revisions',revisions);
  insert into public.builder_publications(id,slug,document) values(page_id,item->'draft'->>'slug',item->'draft') on conflict(id) do update set slug=excluded.slug, document=excluded.document, published_at=now();
  update public.builder_pages set payload=item where id=page_id;
  return item;
end;
$$;
revoke all on function public.builder_publish_page(uuid, integer) from public, anon, authenticated;
grant execute on function public.builder_publish_page(uuid, integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('builder-media','builder-media',true,52428800,array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml','font/woff','font/woff2','font/ttf','font/otf']),
 ('builder-source','builder-source',false,52428800,array['application/octet-stream','text/plain','application/pdf'])
on conflict(id) do nothing;
create policy builder_storage_insert on storage.objects for insert to authenticated with check (bucket_id in ('builder-media','builder-source') and public.builder_is_editor());
create policy builder_storage_read on storage.objects for select to authenticated using (bucket_id in ('builder-media','builder-source') and public.builder_is_editor());
