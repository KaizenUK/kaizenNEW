-- Saved previews are private workspace data, not public pages or bearer-capability links.
create table public.builder_previews (
  id uuid primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  document jsonb,
  revoked_at timestamptz,
  duration_hours integer not null check (duration_hours in (1,24,168)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.builder_previews enable row level security;
revoke all on public.builder_previews from public,anon,authenticated;

create function public.builder_preview_summary(item public.builder_previews) returns jsonb
language sql stable set search_path=public as $$
  select jsonb_build_object('id',item.id,'title',item.document->>'title','slug',item.document->>'slug','createdAt',item.created_at,'expiresAt',item.expires_at);
$$;
revoke all on function public.builder_preview_summary(public.builder_previews) from public,anon,authenticated;

create function public.builder_create_preview(preview_id uuid, snapshot jsonb, hours integer default 24) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_previews;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-previews'));
  if preview_id is null or hours is null or hours not in (1,24,168) or snapshot->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(snapshot->'data'->'content') is distinct from 'array' or snapshot ? 'site'
    or coalesce(length(trim(snapshot->>'title')),0) not between 1 and 200 or length(snapshot::text)>2000000 then
    raise exception 'Invalid or oversized preview snapshot'; end if;
  select * into item from builder_previews where id=preview_id;
  if found then
    if item.revoked_at is not null or item.expires_at<=clock_timestamp() or item.document is null then raise exception 'This preview has expired or was revoked. Create a new preview.'; end if;
    if item.document is distinct from snapshot or item.duration_hours<>hours or item.created_by<>auth.uid() then raise exception 'Preview ID was already used for a different snapshot'; end if;
    if item.expires_at<=clock_timestamp() then raise exception 'This preview has expired. Create a new preview.'; end if;
    return public.builder_preview_summary(item);
  end if;
  update builder_previews set document=null where expires_at<=clock_timestamp() and document is not null;
  if (select count(*) from builder_previews where expires_at>clock_timestamp() and revoked_at is null)>=50 then raise exception 'There are already 50 active previews. Revoke an old preview before creating another.'; end if;
  insert into builder_previews(id,created_by,document,duration_hours,expires_at)
    values(preview_id,auth.uid(),snapshot,hours,clock_timestamp()+make_interval(hours=>hours)) returning * into item;
  return public.builder_preview_summary(item);
end;
$$;
revoke all on function public.builder_create_preview(uuid,jsonb,integer) from public,anon;
grant execute on function public.builder_create_preview(uuid,jsonb,integer) to authenticated;

create function public.builder_read_preview(preview_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_previews;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  select * into item from builder_previews where id=preview_id and expires_at>clock_timestamp() and revoked_at is null and document is not null;
  if not found then raise exception 'This preview has expired, was revoked, or does not exist.'; end if;
  return public.builder_preview_summary(item)||jsonb_build_object('document',item.document);
end;
$$;
revoke all on function public.builder_read_preview(uuid) from public,anon;
grant execute on function public.builder_read_preview(uuid) to authenticated;

create function public.builder_list_previews() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  return coalesce((select jsonb_agg(public.builder_preview_summary(p) order by p.created_at desc,p.id)
    from builder_previews p where p.expires_at>clock_timestamp() and p.revoked_at is null and p.document is not null),'[]'::jsonb);
end;
$$;
revoke all on function public.builder_list_previews() from public,anon;
grant execute on function public.builder_list_previews() to authenticated;

create function public.builder_revoke_preview(preview_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-previews'));
  update builder_previews set document=null,revoked_at=coalesce(revoked_at,clock_timestamp()) where id=preview_id;
  return true;
end;
$$;
revoke all on function public.builder_revoke_preview(uuid) from public,anon;
grant execute on function public.builder_revoke_preview(uuid) to authenticated;
