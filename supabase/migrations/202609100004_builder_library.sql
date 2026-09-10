-- Atomic library edits and immutable-file replacement in drafts only.
create or replace function public.builder_update_asset_metadata(changes jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare change jsonb; old jsonb; patch jsonb; result jsonb := '[]'::jsonb; updated jsonb; tags jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 2000 then raise exception 'Choose between 1 and 2,000 assets'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(changes)) <> jsonb_array_length(changes) then raise exception 'Choose different assets'; end if;
  for change in select value from jsonb_array_elements(changes) loop
    select payload into old from public.builder_assets where id=(change->>'id')::uuid for update;
    if old is null or old is distinct from change->'expected' then raise exception 'An asset changed in another window. Refresh the library and try again.'; end if;
    patch := change->'patch';
    if jsonb_typeof(patch) is distinct from 'object' or (patch - array['tags','pack','favourite']) <> '{}'::jsonb then raise exception 'Invalid asset metadata'; end if;
    if patch ? 'pack' and (jsonb_typeof(patch->'pack') is distinct from 'string' or length(btrim(patch->>'pack')) not between 1 and 120) then raise exception 'Invalid pack name'; end if;
    if patch ? 'favourite' and jsonb_typeof(patch->'favourite') is distinct from 'boolean' then raise exception 'Invalid favourite'; end if;
    if patch ? 'tags' then
      if jsonb_typeof(patch->'tags') is distinct from 'array' or jsonb_array_length(patch->'tags') > 50 then raise exception 'Use up to 50 tags'; end if;
      if exists(select 1 from jsonb_array_elements(patch->'tags') tag where jsonb_typeof(tag) <> 'string' or length(btrim(tag#>>'{}')) not between 1 and 80) then raise exception 'Invalid tag'; end if;
      select coalesce(jsonb_agg(tag order by n),'[]'::jsonb) into tags from (select btrim(value) tag,min(n) n from jsonb_array_elements_text(patch->'tags') with ordinality x(value,n) group by btrim(value)) unique_tags;
      patch := jsonb_set(patch,'{tags}',tags);
    end if;
    if patch ? 'pack' then patch := patch || jsonb_build_object('pack',btrim(patch->>'pack'),'originalPack',coalesce(old->>'originalPack',old->>'pack')); end if;
    updated := old || patch;
    update public.builder_assets set payload=updated where id=(change->>'id')::uuid;
    result := result || jsonb_build_array(updated);
  end loop;
  return result;
end;
$$;
revoke all on function public.builder_update_asset_metadata(jsonb) from public;
grant execute on function public.builder_update_asset_metadata(jsonb) to authenticated;

create or replace function public.builder_replace_asset_url(value jsonb, old_url text, new_url text) returns jsonb
language plpgsql immutable set search_path=public as $$
declare result jsonb; entry record;
begin
  if jsonb_typeof(value)='object' then
    result := '{}'::jsonb;
    for entry in select * from jsonb_each(value) loop
      result := result || jsonb_build_object(entry.key,case when entry.key=any(array['src','href','poster','captions','backgroundImage','fontUrl','image']) and entry.value=to_jsonb(old_url) then to_jsonb(new_url) else public.builder_replace_asset_url(entry.value,old_url,new_url) end);
    end loop;
    return result;
  elsif jsonb_typeof(value)='array' then
    select coalesce(jsonb_agg(public.builder_replace_asset_url(item,old_url,new_url) order by n),'[]'::jsonb) into result from jsonb_array_elements(value) with ordinality x(item,n);
    return result;
  end if;
  return value;
end;
$$;
revoke all on function public.builder_replace_asset_url(jsonb,text,text) from public;

create or replace function public.builder_replace_asset(review jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare source jsonb; replacement jsonb; site jsonb; row record; changed jsonb; saved jsonb; result jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  -- Legacy metadata/saved-block writes do not take the advisory lock: lock their rows too.
  lock table public.builder_saved in share row exclusive mode;
  perform 1 from public.builder_assets order by id for update;
  select payload into source from public.builder_assets where id=(review->'source'->>'id')::uuid;
  select payload into replacement from public.builder_assets where id=(review->'replacement'->>'id')::uuid;
  if source is null or replacement is null or source= replacement or source is distinct from review->'source' or replacement is distinct from review->'replacement' then raise exception 'Assets changed. Review the replacement again.'; end if;
  if source->>'kind' not in ('image','icon','font') or source->>'kind' is distinct from replacement->>'kind' or coalesce(source->>'url','')='' or coalesce(replacement->>'url','')='' then raise exception 'Choose a replacement of the same supported type'; end if;
  select payload into site from public.builder_site where id='site';
  if coalesce((site->>'version')::integer,0) is distinct from (review->>'siteVersion')::integer then raise exception 'Site design changed. Review the replacement again.'; end if;
  if jsonb_typeof(review->'pageVersions') is distinct from 'object' or (select count(*) from jsonb_object_keys(review->'pageVersions')) <> (select count(*) from public.builder_pages) or exists(select 1 from public.builder_pages where (payload->>'version')::integer is distinct from (review->'pageVersions'->>id::text)::integer) then raise exception 'Pages changed. Review the replacement again.'; end if;
  select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) into saved from public.builder_saved;
  if saved is distinct from (select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) from jsonb_array_elements(review->'saved') item) then raise exception 'Reusable content changed. Review the replacement again.'; end if;
  for row in select id,payload from public.builder_pages order by id loop
    changed := public.builder_replace_asset_url(row.payload->'draft',source->>'url',replacement->>'url');
    if changed is distinct from row.payload->'draft' then perform public.builder_save_page(row.id,(row.payload->>'version')::integer,changed,'Replaced ' || (source->>'name')); end if;
  end loop;
  if site is not null then
    changed := public.builder_replace_asset_url(site->'draft',source->>'url',replacement->>'url');
    if changed is distinct from site->'draft' then perform public.builder_save_site((site->>'version')::integer,changed); end if;
  end if;
  update public.builder_saved set payload=public.builder_replace_asset_url(payload,source->>'url',replacement->>'url');
  select jsonb_build_object('pages',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_pages),'assets',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_assets),'saved',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_saved),'site',(select payload from public.builder_site where id='site')) into result;
  return result;
end;
$$;
revoke all on function public.builder_replace_asset(jsonb) from public;
grant execute on function public.builder_replace_asset(jsonb) to authenticated;
