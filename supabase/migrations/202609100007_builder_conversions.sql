-- Conversion requests are asset metadata. Availability comes only from the deployed code registry.
create or replace function public.builder_validate_conversion(owner jsonb, draft jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare source jsonb; file jsonb; key text;
begin
  if coalesce(owner->>'kind','') not in ('code','design') or jsonb_typeof(draft) is distinct from 'object' or jsonb_typeof(draft->'title') is distinct from 'string' or length(btrim(draft->>'title'))=0 or length(draft->>'title')>160 or jsonb_typeof(draft->'notes') is distinct from 'string' or length(draft->>'notes')>8000 or coalesce(draft->>'status','') not in ('requested','in_progress','needs_review','blocked','cancelled') or jsonb_typeof(draft->'requirements') is distinct from 'object' then raise exception 'Invalid conversion request'; end if;
  foreach key in array array['summary','fields','mobile','behaviour'] loop
    if jsonb_typeof(draft->'requirements'->key) is distinct from 'string' or length(draft->'requirements'->>key)>4000 then raise exception 'Invalid conversion requirements'; end if;
  end loop;
  if jsonb_typeof(draft->'sources') is distinct from 'array' then raise exception 'Select source references'; end if;
  if jsonb_array_length(draft->'sources') not between 1 and 50 or (select count(distinct value->>'assetId') from jsonb_array_elements(draft->'sources')) <> jsonb_array_length(draft->'sources') then raise exception 'Select up to 50 unique source references'; end if;
  if not exists(select 1 from jsonb_array_elements(draft->'sources') where value->>'assetId'=owner->>'id' and value->>'hash'=owner->>'hash' and value->>'role'='source') then raise exception 'Keep the original source file attached'; end if;
  for source in select value from jsonb_array_elements(draft->'sources') loop
    select payload into file from public.builder_assets where id=(source->>'assetId')::uuid;
    if file is null or file->>'hash' is distinct from source->>'hash' or coalesce(source->>'role','') not in ('source','reference','licence') or (source->>'role'='licence' and file->>'kind'<>'licence') or (source->>'role'='source' and file->>'kind' not in ('code','design')) then raise exception 'A referenced file is missing or changed'; end if;
  end loop;
end;
$$;
revoke all on function public.builder_validate_conversion(jsonb,jsonb) from public;

create or replace function public.builder_set_asset_conversion(expected jsonb, draft jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare original jsonb; result jsonb; version integer; at text; history jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  perform 1 from public.builder_assets order by id for update;
  select payload into original from public.builder_assets where id=(expected->>'id')::uuid;
  if original is null or original is distinct from expected then raise exception 'This asset or conversion request changed in another window. Refresh before saving.'; end if;
  perform public.builder_validate_conversion(original,draft);
  version := coalesce((original->'conversion'->>'version')::integer,0)+1;
  at := to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select coalesce(jsonb_agg(value order by ord),'[]') into history from jsonb_array_elements(coalesce(original->'conversion'->'history','[]') || jsonb_build_array(jsonb_build_object('version',version,'at',at,'status',draft->>'status','note',draft->>'notes'))) with ordinality as entries(value,ord) where ord > greatest(0,jsonb_array_length(coalesce(original->'conversion'->'history','[]'))+1-30);
  result := original || jsonb_build_object('conversion',jsonb_build_object('title',btrim(draft->>'title'),'requirements',draft->'requirements','sources',draft->'sources','status',draft->>'status','notes',draft->>'notes','version',version,'updatedAt',at,'history',history));
  update public.builder_assets set payload=result where id=(original->>'id')::uuid;
  return result;
end;
$$;
revoke all on function public.builder_set_asset_conversion(jsonb,jsonb) from public;
grant execute on function public.builder_set_asset_conversion(jsonb,jsonb) to authenticated;
