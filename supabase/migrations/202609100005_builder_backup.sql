-- Restore editable drafts without promoting or deleting any publication.
create or replace function public.builder_backup_workspace() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  return jsonb_build_object('pages',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_pages),'assets',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_assets),'saved',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_saved),'site',(select payload from public.builder_site where id='site'));
end;
$$;
revoke all on function public.builder_backup_workspace() from public;
grant execute on function public.builder_backup_workspace() to authenticated;

create or replace function public.builder_backup_history(items jsonb, maximum integer) returns jsonb
language sql immutable set search_path=public as $$
  select coalesce(jsonb_agg(value order by n),'[]'::jsonb) from (
    select value,n from (select distinct on(value->>'id') value,n from jsonb_array_elements(items) with ordinality x(value,n) order by value->>'id',n desc) unique_items order by n desc limit maximum
  ) recent;
$$;
revoke all on function public.builder_backup_history(jsonb,integer) from public;

create or replace function public.builder_restore_backup(plan jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare expected jsonb; site jsonb; saved jsonb; originals jsonb; item jsonb; old jsonb; result jsonb; history jsonb; previous jsonb; stamp text;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  lock table public.builder_saved in share row exclusive mode;
  perform 1 from public.builder_assets order by id for update;
  if jsonb_typeof(plan) is distinct from 'object' or length(plan::text)>50000000 or jsonb_typeof(plan->'pages') is distinct from 'array' or jsonb_array_length(plan->'pages')>500 or jsonb_typeof(plan->'saved') is distinct from 'array' or jsonb_array_length(plan->'saved')>2000 then raise exception 'Invalid or oversized restore plan'; end if;
  expected := plan->'expected';
  select payload into site from public.builder_site where id='site';
  if coalesce((site->>'version')::integer,0) is distinct from (expected->>'siteVersion')::integer then raise exception 'Site design changed. Review the backup again.'; end if;
  if jsonb_typeof(expected->'pageVersions') is distinct from 'object' or (select count(*) from jsonb_object_keys(expected->'pageVersions')) <> (select count(*) from public.builder_pages) or exists(select 1 from public.builder_pages where (payload->>'version')::integer is distinct from (expected->'pageVersions'->>id::text)::integer) then raise exception 'Pages changed. Review the backup again.'; end if;
  select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) into saved from public.builder_saved;
  if jsonb_typeof(expected->'saved') is distinct from 'array' or saved is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb) from jsonb_array_elements(expected->'saved')) then raise exception 'Reusable content changed. Review the backup again.'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(plan->'pages')) <> jsonb_array_length(plan->'pages') or (select count(distinct value->>'id') from jsonb_array_elements(plan->'saved')) <> jsonb_array_length(plan->'saved') then raise exception 'Duplicate restored IDs'; end if;
  stamp := to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for item in select value from jsonb_array_elements(coalesce(plan->'assetUpdates','[]'::jsonb)) loop
    select payload into old from public.builder_assets where id=(item->'expected'->>'id')::uuid;
    if old is null or old is distinct from item->'expected' then raise exception 'An asset changed. Review the backup again.'; end if;
    if ((item->'asset') - array['tags','favourite','originalPack','image','generatedFrom','conversion']) is distinct from (old - array['tags','favourite','originalPack','image','generatedFrom','conversion']) then raise exception 'Restoring metadata cannot overwrite an asset file'; end if;
    update public.builder_assets set payload=item->'asset' where id=(old->>'id')::uuid;
  end loop;
  for item in select payload from public.builder_assets where payload ? 'conversion' loop
    perform public.builder_validate_conversion(item,item->'conversion');
    if jsonb_typeof(item->'conversion'->'version') is distinct from 'number' or coalesce((item->'conversion'->>'version')::integer,0)<1 or jsonb_typeof(item->'conversion'->'updatedAt') is distinct from 'string' or jsonb_typeof(item->'conversion'->'history') is distinct from 'array' or jsonb_array_length(item->'conversion'->'history')>30 then raise exception 'Invalid conversion history in backup'; end if;
  end loop;
  select coalesce(jsonb_object_agg(id::text,payload),'{}'::jsonb) into originals from public.builder_pages;
  -- Stage all restored draft URLs together so unpublished pages can exchange URLs.
  -- Every write, including this staging, rolls back if any save fails.
  for item in select value from jsonb_array_elements(plan->'pages') loop
    update public.builder_pages set payload=jsonb_set(payload,'{draft}',item->'draft') where id=(item->>'id')::uuid;
  end loop;
  for item in select value from jsonb_array_elements(plan->'pages') loop
    old := originals->(item->>'id');
    if jsonb_typeof(item->'revisions') is distinct from 'array' or jsonb_array_length(item->'revisions')>50 then raise exception 'Invalid restored page history'; end if;
    result := public.builder_save_page((item->>'id')::uuid,coalesce((old->>'version')::integer,0),item->'draft','Restored project backup');
    history := item->'revisions';
    if item->'published' is not null and item->'published' <> 'null'::jsonb then history := history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',coalesce(item->>'publishedAt',stamp),'label','Published snapshot from backup','document',item->'published')); end if;
    history := history || coalesce(old->'revisions','[]'::jsonb);
    if old is not null then history := history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',stamp,'label','Before project restore','document',old->'draft')); end if;
    history := history || jsonb_build_array(result->'revisions'->-1);
    result := jsonb_set(result,'{revisions}',public.builder_backup_history(history,50));
    update public.builder_pages set payload=result where id=(item->>'id')::uuid;
  end loop;
  if plan->'site' is not null and plan->'site' <> 'null'::jsonb then
    if jsonb_typeof(plan->'site'->'revisions') is distinct from 'array' or jsonb_array_length(plan->'site'->'revisions')>30 then raise exception 'Invalid restored site history'; end if;
    result := public.builder_save_site(coalesce((site->>'version')::integer,0),plan->'site'->'draft');
    history := plan->'site'->'revisions' || coalesce(site->'revisions','[]'::jsonb);
    if site is not null then history := history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',stamp,'design',site->'draft')); end if;
    result := jsonb_set(result,'{revisions}',public.builder_backup_history(history || jsonb_build_array(result->'revisions'->-1),30));
    update public.builder_site set payload=result where id='site';
  end if;
  for item in select value from jsonb_array_elements(plan->'saved') loop
    insert into public.builder_saved(id,payload) values((item->>'id')::uuid,item) on conflict(id) do update set payload=excluded.payload;
  end loop;
  return jsonb_build_object('pages',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_pages),'assets',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_assets),'saved',(select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.builder_saved),'site',(select payload from public.builder_site where id='site'));
end;
$$;
revoke all on function public.builder_restore_backup(jsonb) from public;
grant execute on function public.builder_restore_backup(jsonb) to authenticated;
