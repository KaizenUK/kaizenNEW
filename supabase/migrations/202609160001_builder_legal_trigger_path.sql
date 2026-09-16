-- The legal version trigger ran with the updating role's own search path. It
-- is the only builder function without a pinned path, so pin it like the rest.
-- Body unchanged: recorded legal documents stay immutable.
create or replace function public.builder_legal_version_immutable() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.version<>old.version or new.terms_hash<>old.terms_hash or new.privacy_hash<>old.privacy_hash or new.registered_at<>old.registered_at then
    raise exception using errcode='40001',message='Register a new legal document version instead of changing its recorded contents';
  end if;
  return new;
end;
$$;
revoke all on function public.builder_legal_version_immutable() from public,anon,authenticated,service_role;
