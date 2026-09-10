-- Generated files are immutable ordinary media rows; original image metadata points to a frozen set.
create or replace function public.builder_set_asset_image(expected jsonb, image jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare original jsonb; variant jsonb; result jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  perform 1 from public.builder_assets order by id for update;
  select payload into original from public.builder_assets where id=(expected->>'id')::uuid;
  if original is null or original is distinct from expected then raise exception 'This asset changed. Refresh the library before optimising again.'; end if;
  if original->>'kind' <> 'image' or coalesce(original->>'generatedFrom','')<>'' or image->>'source' is distinct from original->>'url' or coalesce(image->>'status','') not in ('ready','original') or jsonb_typeof(image->'variants') is distinct from 'array' or jsonb_array_length(image->'variants')>5 then raise exception 'Invalid optimised image metadata'; end if;
  if (image->>'status'='ready') is distinct from (jsonb_array_length(image->'variants')>0) or (image ? 'note' and jsonb_typeof(image->'note')<>'string') then raise exception 'Invalid optimisation status'; end if;
  if (image ? 'width' and coalesce((image->>'width')::integer,0) not between 1 and 100000) or (image ? 'height' and coalesce((image->>'height')::integer,0) not between 1 and 100000) then raise exception 'Invalid image dimensions'; end if;
  if (select count(distinct value->>'width') from jsonb_array_elements(image->'variants')) <> jsonb_array_length(image->'variants') then raise exception 'Duplicate image widths'; end if;
  for variant in select value from jsonb_array_elements(image->'variants') loop
    if coalesce((variant->>'width')::integer,0) not between 1 and 2560 or coalesce((variant->>'height')::integer,0) not between 1 and 100000 or not exists(select 1 from public.builder_assets where payload->>'url'=variant->>'url' and payload->>'generatedFrom'=original->>'url' and payload->>'mime'='image/webp' and payload->>'hash'=variant->>'hash' and (payload->>'size')::bigint=(variant->>'size')::bigint) then raise exception 'An optimised image file is missing or changed'; end if;
  end loop;
  result := original || jsonb_build_object('image',image);
  update public.builder_assets set payload=result where id=(original->>'id')::uuid;
  return result;
end;
$$;
revoke all on function public.builder_set_asset_image(jsonb,jsonb) from public;
grant execute on function public.builder_set_asset_image(jsonb,jsonb) to authenticated;
