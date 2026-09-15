-- Saved content, revisions, previews and publication history retain their files.
-- This database view of references is only part of removal proof: repository
-- projects additionally require working-copy and retained-release verification.
create function public.builder_asset_reference_match(document jsonb, asset uuid, file_url text default null) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select coalesce(position(asset::text in lower(document::text))>0
    or (coalesce(file_url,'')<>'' and position(lower(file_url) in lower(document::text))>0),false)
$$;

create function public.builder_asset_references(target text, asset uuid)
returns table(source text, reference_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare address text;
begin
  select file_url into address from builder_asset_files where project_id=target and asset_id=asset;
  return query
  with documents(source,document) as (
    select 'Library',a.payload from builder_assets a where target='kaizen'
    union all select 'Pages and history',p.payload from builder_pages p where target='kaizen'
    union all select 'Published pages',p.document from builder_publications p where target='kaizen'
    union all select 'Saved blocks',s.payload from builder_saved s where target='kaizen'
    union all select 'Site design',s.payload from builder_site s where target='kaizen'
    union all select 'Redirects',r.payload from builder_routes r where target='kaizen'
    union all select 'Release history',jsonb_build_array(r.request,r.snapshot,r.baseline) from builder_releases r where target='kaizen'
    union all select 'Private previews',p.document from builder_previews p
      where target='kaizen' and p.revoked_at is null and p.expires_at>clock_timestamp()
    -- Public Kaizen media can also be referenced from another website.
    union all select 'Website settings',p.settings from builder_projects p where p.id=target or target='kaizen'
    union all select 'Workspace and library',w.payload from builder_project_workspaces w where w.project_id=target or target='kaizen'
    union all select 'Client previews',p.payload from builder_project_previews p
      where (p.project_id=target or target='kaizen') and p.expires_at>clock_timestamp()
    union all select 'Publication reviews',r.snapshot from builder_client_reviews r
      where (r.project_id=target or target='kaizen') and r.expires_at>clock_timestamp()
    union all select 'Publication history',j.snapshot from builder_client_jobs j where j.project_id=target or target='kaizen'
    -- Pending copies still need the source bytes as well as their destination.
    union all select 'Pending website copies',c.workspace from builder_project_copies c
      where c.status='pending' and (c.project_id=target or c.source_project_id=target or target='kaizen')
  )
  select d.source,count(*) from documents d
    where builder_asset_reference_match(d.document,asset,address) group by d.source order by d.source;
end;
$$;

-- Serialize new references with file-removal claims. Checking references only
-- when cleanup starts would allow a later save to point at a disappearing file.
create function public.builder_asset_reference_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb:=to_jsonb(new); document jsonb; target text; source_project text; item builder_asset_files%rowtype;
begin
  target:=case tg_argv[0] when 'legacy' then 'kaizen' when 'project' then row_data->>'id' else row_data->>'project_id' end;
  document:=case tg_argv[1] when 'release' then jsonb_build_array(row_data->'request',row_data->'snapshot',row_data->'baseline')
    else row_data->tg_argv[1] end;
  if tg_table_name='builder_project_copies' and row_data->>'status'='pending' then source_project:=row_data->>'source_project_id'; end if;
  for item in select f.* from builder_asset_files f
    where (f.project_id in (target,source_project) or f.project_id='kaizen')
      and builder_asset_reference_match(document,f.asset_id,f.file_url)
    order by f.project_id,f.asset_id for share
  loop
    if item.status in ('removing','removed') then
      raise exception using errcode='P0409',message='This file is being removed or is no longer available. Import a replacement before saving';
    end if;
  end loop;
  return new;
end;
$$;

create trigger builder_asset_reference_guard before insert or update on public.builder_assets
  for each row execute function public.builder_asset_reference_guard('legacy','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_pages
  for each row execute function public.builder_asset_reference_guard('legacy','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_publications
  for each row execute function public.builder_asset_reference_guard('legacy','document');
create trigger builder_asset_reference_guard before insert or update on public.builder_saved
  for each row execute function public.builder_asset_reference_guard('legacy','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_site
  for each row execute function public.builder_asset_reference_guard('legacy','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_routes
  for each row execute function public.builder_asset_reference_guard('legacy','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_releases
  for each row execute function public.builder_asset_reference_guard('legacy','release');
create trigger builder_asset_reference_guard before insert or update on public.builder_previews
  for each row execute function public.builder_asset_reference_guard('legacy','document');
create trigger builder_asset_reference_guard before insert or update on public.builder_projects
  for each row execute function public.builder_asset_reference_guard('project','settings');
create trigger builder_asset_reference_guard before insert or update on public.builder_project_workspaces
  for each row execute function public.builder_asset_reference_guard('client','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_project_previews
  for each row execute function public.builder_asset_reference_guard('client','payload');
create trigger builder_asset_reference_guard before insert or update on public.builder_client_reviews
  for each row execute function public.builder_asset_reference_guard('client','snapshot');
create trigger builder_asset_reference_guard before insert or update on public.builder_client_jobs
  for each row execute function public.builder_asset_reference_guard('client','snapshot');
create trigger builder_asset_reference_guard before insert or update on public.builder_project_copies
  for each row execute function public.builder_asset_reference_guard('client','workspace');

-- Called by the removal coordinator before changing provider bytes. Its row
-- update waits for earlier reference writers; this volatile function then reads
-- their committed references before allowing the removal state.
create function public.builder_native_asset_project(target text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select target='kaizen'
$$;
create function public.builder_native_asset_lock() returns void
language sql volatile security definer set search_path=public,pg_temp as $$
  select pg_advisory_xact_lock(hashtextextended('builder-native-assets',0))
$$;
create function public.builder_native_asset_removal_check(target text, asset uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if builder_native_asset_project(target) then
    raise exception using errcode='P0409',message='Verify repository and retained release references before removing this file'; end if;
end;
$$;
create function public.builder_asset_removal_reference_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status in ('removing','removed') and old.status not in ('removing','removed') then
    if exists(select 1 from builder_asset_references(new.project_id,new.asset_id)) then
      raise exception using errcode='P0409',message='This file is still used by saved website content or retained history'; end if;
    perform builder_native_asset_removal_check(new.project_id,new.asset_id);
  end if;
  return new;
end;
$$;
create trigger builder_asset_removal_reference_guard before update of status on public.builder_asset_files
  for each row execute function public.builder_asset_removal_reference_guard();

-- Archive and account closure preserve websites. Any privileged project purge
-- must finish provider and local cleanup before cascades can erase its ledger.
create function public.builder_project_storage_deletion_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.id='kaizen' then raise exception using errcode='P0409',message='Preserve the original website and its repository'; end if;
  if exists(select 1 from storage.objects o where o.bucket_id='builder-project-files' and split_part(o.name,'/',1)=old.id)
    or exists(select 1 from builder_uploads u where u.project_id=old.id and (u.status<>'removed' or u.local_cleanup_pending))
    or exists(select 1 from builder_asset_files f where f.project_id=old.id and f.status<>'removed') then
    raise exception using errcode='P0409',message='Finish verified website file cleanup before deleting this project'; end if;
  return old;
end;
$$;
create trigger builder_project_storage_deletion_guard before delete on public.builder_projects
  for each row execute function public.builder_project_storage_deletion_guard();

revoke all on function public.builder_native_asset_lock(),public.builder_native_asset_project(text),public.builder_native_asset_removal_check(text,uuid),
  public.builder_asset_reference_match(jsonb,uuid,text),public.builder_asset_references(text,uuid),
  public.builder_asset_reference_guard(),public.builder_asset_removal_reference_guard(),public.builder_project_storage_deletion_guard()
  from public,anon,authenticated,service_role;
grant execute on function public.builder_asset_references(text,uuid) to service_role;
