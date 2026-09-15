-- Preserve the identity of existing library files without claiming their bytes
-- were newly verified. New registrations require a worker verification receipt.
create table public.builder_asset_files (
  project_id text not null references public.builder_projects(id) on delete cascade,
  asset_id uuid not null,
  bytes bigint not null check(bytes between 0 and 52428800),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  mime text not null check(length(mime) between 1 and 255 and mime !~ '[[:cntrl:]]'),
  asset_kind text not null check(asset_kind in ('image','icon','font','licence','code','design','other')),
  bucket_id text not null,
  object_name text not null,
  file_url text,
  identity_source text not null default 'registered' check(identity_source in ('registered','discovery')),
  status text not null check(status in ('legacy','observed','verified','removing','removed')),
  object_version text,
  object_etag text,
  verified_at timestamptz,
  primary key(project_id,asset_id),
  unique(bucket_id,object_name),
  check(status<>'verified' or (object_version is not null and object_etag is not null and verified_at is not null)),
  check((identity_source='registered' and ((project_id='kaizen' and bucket_id in ('builder-media','builder-source') and object_name=asset_id::text)
    or(project_id<>'kaizen' and bucket_id='builder-project-files' and object_name=project_id||'/'||asset_id::text)))
    or(identity_source='discovery' and octet_length(object_name) between 1 and 1024 and object_name !~ '[[:cntrl:]]'
      and ((project_id='kaizen' and bucket_id in ('builder-media','builder-source'))
        or(project_id<>'kaizen' and bucket_id='builder-project-files' and split_part(object_name,'/',1)=project_id))))
);
alter table public.builder_asset_files enable row level security;
revoke all on public.builder_asset_files from public,anon,authenticated,service_role;

create function public.builder_asset_file_identity(target text, asset jsonb) returns public.builder_asset_files
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype;
begin
  if jsonb_typeof(asset) is distinct from 'object' or asset->>'id' is null
    or asset->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    or jsonb_typeof(asset->'size') is distinct from 'number' then
    raise exception using errcode='22023',message='Invalid stored file identity'; end if;
  select * into item from builder_asset_files where project_id=target and asset_id=(asset->>'id')::uuid;
  if item.asset_id is null or item.status not in ('legacy','verified') or item.bytes::text is distinct from asset->>'size'
    or item.sha256 is distinct from asset->>'hash' or item.mime is distinct from asset->>'mime' or item.asset_kind is distinct from asset->>'kind' then
    raise exception using errcode='P0409',message='Verify this file through the upload service before adding it to the library'; end if;
  return item;
end;
$$;

create function public.builder_asset_file_capture(item public.builder_uploads) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior builder_asset_files%rowtype;
begin
  if item.status<>'stored' then return; end if;
  select * into prior from builder_asset_files where project_id=item.project_id and asset_id=item.asset_id for update;
  if found and (prior.status not in ('legacy','verified') or prior.bytes<>item.bytes or prior.sha256<>item.sha256
    or prior.mime<>item.mime or prior.asset_kind<>item.asset_kind) then
    raise exception using errcode='P0409',message='This stored file identity is already in use'; end if;
  insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status,object_version,object_etag,verified_at)
    values(item.project_id,item.asset_id,item.bytes,item.sha256,item.mime,item.asset_kind,item.bucket_id,item.object_name,
      case when item.project_id<>'kaizen' then '/builder-project-media/'||item.project_id||'/'||item.asset_id::text
        when item.bucket_id='builder-source' then 'private:'||item.asset_id::text else null end,
      'verified',item.object_version,item.object_etag,item.verified_at)
    on conflict(project_id,asset_id) do update set status='verified',object_version=excluded.object_version,
      object_etag=excluded.object_etag,verified_at=excluded.verified_at;
end;
$$;
create function public.builder_asset_file_upload_trigger() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform builder_asset_file_capture(new); return new; end;
$$;
create trigger builder_asset_file_upload after insert or update of status on public.builder_uploads
  for each row when(new.status='stored') execute function public.builder_asset_file_upload_trigger();

do $$ declare item builder_uploads%rowtype; target text; asset jsonb; bucket text; begin
  for item in select * from builder_uploads where status='stored' loop perform builder_asset_file_capture(item); end loop;
  for target,asset in select 'kaizen',payload from builder_assets union all
    select w.project_id,a.value from builder_project_workspaces w cross join lateral jsonb_array_elements(w.payload->'assets') a where w.project_id<>'kaizen' loop
    bucket:=case when target<>'kaizen' then 'builder-project-files' when asset->>'kind' in ('image','icon','font') then 'builder-media' else 'builder-source' end;
    insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status)
      values(target,(asset->>'id')::uuid,(asset->>'size')::bigint,asset->>'hash',asset->>'mime',asset->>'kind',bucket,
        case when target='kaizen' then asset->>'id' else target||'/'||(asset->>'id') end,asset->>'url','legacy')
      on conflict(project_id,asset_id) do update set file_url=coalesce(builder_asset_files.file_url,excluded.file_url);
    perform builder_asset_file_identity(target,asset);
  end loop;
end $$;

-- A library identity is never reassigned by uploading to a missing provider
-- key. Recover existing bytes through adoption, or import a new replacement ID.
create function public.builder_asset_file_reservation_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from builder_asset_files where project_id=new.project_id and asset_id=new.asset_id) then
    raise exception using errcode='P0409',message='This library file already exists. Recover it or upload a replacement'; end if;
  return new;
end;
$$;
create trigger builder_asset_file_reservation_guard before insert on public.builder_uploads
  for each row execute function public.builder_asset_file_reservation_guard();

create function public.builder_asset_file_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype; asset jsonb; target text;
begin
  if tg_table_name='builder_assets' then target:='kaizen'; else target:=new.project_id; end if;
  perform 1 from builder_projects where id=target for update;
  if tg_table_name='builder_assets' then
    if new.payload->>'id' is distinct from new.id::text or new.payload->>'hash' is distinct from new.hash then
      raise exception using errcode='22023',message='Invalid library file identity'; end if;
    item:=builder_asset_file_identity(target,new.payload);
    if item.file_url is null or item.file_url is distinct from new.payload->>'url' then
      raise exception using errcode='P0409',message='Keep the verified address of this library file'; end if;
  elsif target<>'kaizen' then
    if jsonb_typeof(new.payload->'assets') is distinct from 'array' then raise exception using errcode='22023',message='Invalid library files'; end if;
    for asset in select value from jsonb_array_elements(new.payload->'assets') loop
      item:=builder_asset_file_identity(target,asset);
      if item.file_url is null or item.file_url is distinct from asset->>'url' then
        raise exception using errcode='P0409',message='Keep the verified address of this library file'; end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger builder_asset_file_guard before insert or update on public.builder_assets for each row execute function public.builder_asset_file_guard();
create trigger builder_asset_file_guard before insert or update of payload on public.builder_project_workspaces for each row execute function public.builder_asset_file_guard();

-- Service-only: the caller's verified JWT actor and a canonical server-selected
-- public origin are supplied by the existing projects Edge handler.
create function public.builder_register_asset(target text, actor uuid, asset jsonb, public_origin text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype; old_asset jsonb; workspace jsonb; version integer; object record; canonical text;
begin
  perform 1 from builder_projects where id=target for update;
  perform builder_upload_access(target,actor);
  item:=builder_asset_file_identity(target,asset);
  if target='kaizen' then select payload into old_asset from builder_assets where id=item.asset_id;
  else
    select w.payload,w.version into workspace,version from builder_project_workspaces w where project_id=target;
    select value into old_asset from jsonb_array_elements(workspace->'assets') where value->>'id'=item.asset_id::text;
  end if;
  if old_asset is not null then
    if old_asset->>'hash' is distinct from asset->>'hash' or old_asset->>'pack' is distinct from asset->>'pack'
      or old_asset->>'path' is distinct from asset->>'path' then raise exception using errcode='P0409',message='This asset ID is already in use'; end if;
    return old_asset;
  end if;
  if item.status<>'verified' then raise exception using errcode='P0409',message='Verify the stored file before recovering this import'; end if;
  select * into object from builder_storage_objects(target) where bucket=item.bucket_id and name=item.object_name;
  if object.name is null or object.bytes<>item.bytes or object.version is distinct from item.object_version or object.etag is distinct from item.object_etag then
    raise exception using errcode='P0409',message='The stored file changed. Verify it again before registering'; end if;
  canonical:=item.file_url;
  if canonical is null then
    if target<>'kaizen' or item.bucket_id<>'builder-media' or public_origin is null
      or public_origin !~ '^https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?$' then
      raise exception using errcode='22023',message='Configure the verified file address before registering'; end if;
    canonical:=public_origin||'/storage/v1/object/public/builder-media/'||item.asset_id::text;
    update builder_asset_files set file_url=canonical where project_id=target and asset_id=item.asset_id;
  end if;
  asset:=jsonb_set(asset,'{url}',to_jsonb(canonical));
  if target='kaizen' then insert into builder_assets(id,hash,payload) values(item.asset_id,item.sha256,asset);
  else
    workspace:=jsonb_set(workspace,'{assets}',(workspace->'assets')||jsonb_build_array(asset));
    perform builder_commit_project_workspace(target,actor,version,workspace);
  end if;
  return asset;
end;
$$;

-- Adopting an already-stored file only reads provider bytes. It never creates a
-- temporary reservation or grants permission to remove that pre-existing file.
create function public.builder_asset_adoption_context(target text, actor uuid, request_id uuid, asset uuid,
  file_bytes bigint,file_hash text,file_mime text,asset_kind text,worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_files%rowtype; upload builder_uploads%rowtype; selected_bucket text; object_key text; object record;
begin
  perform 1 from builder_projects where id=target for update;
  perform builder_upload_access(target,actor);
  if request_id is null or asset is null or file_bytes is null or file_bytes not between 1 and 52428800
    or file_hash is null or file_hash !~ '^[a-f0-9]{64}$' or file_mime is null or length(file_mime) not between 1 and 255 or file_mime ~ '[[:cntrl:]]'
    or asset_kind is null or asset_kind not in ('image','icon','font','licence','code','design','other')
    or worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception using errcode='22023',message='Invalid stored file metadata'; end if;
  selected_bucket:=case when target<>'kaizen' then 'builder-project-files' when asset_kind in ('image','icon','font') then 'builder-media' else 'builder-source' end;
  object_key:=case when target='kaizen' then asset::text else target||'/'||asset::text end;
  select * into item from builder_asset_files where project_id=target and asset_id=asset;
  if found and (item.status not in ('legacy','observed','verified') or item.bytes<>file_bytes or item.sha256<>file_hash
    or item.bucket_id<>selected_bucket or item.object_name<>object_key
    or(item.status<>'observed' and (item.mime<>file_mime or item.asset_kind<>asset_kind))) then
    raise exception using errcode='P0409',message='This file already belongs to a different library entry'; end if;
  select * into upload from builder_uploads where project_id=target and asset_id=asset;
  if found and (upload.id<>request_id or upload.worker_id<>worker or upload.bytes<>file_bytes or upload.sha256<>file_hash or upload.mime<>file_mime or upload.asset_kind<>asset_kind
    or upload.cancel_requested or upload.status in ('removing','removed')
    or(upload.status<>'stored' and upload.actor_id is distinct from actor)) then
    raise exception using errcode='P0409',message='Resume the original upload before recovering its library entry'; end if;
  select * into object from builder_storage_objects(target) o where o.bucket=selected_bucket and o.name=object_key;
  if object.name is null or object.bytes<>file_bytes then raise exception using errcode='P0409',message='The stored file could not be matched to this import'; end if;
  perform builder_storage_sync(target);
  return jsonb_build_object('id',request_id,'project_id',target,'asset_id',asset,'bytes',file_bytes,'sha256',file_hash,'mime',file_mime,
    'asset_kind',asset_kind,'bucket_id',selected_bucket,'object_name',object_key,'pendingUpload',coalesce(upload.status<>'stored',false));
end;
$$;

create function public.builder_asset_adopt_finish(target text, actor uuid, request_id uuid, asset uuid,
  file_bytes bigint,file_hash text,file_mime text,asset_kind text,worker text,verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb; object record; observed timestamptz;
begin
  context:=builder_asset_adoption_context(target,actor,request_id,asset,file_bytes,file_hash,file_mime,asset_kind,worker);
  if (context->>'pendingUpload')::boolean then raise exception using errcode='P0409',message='Finish the original upload before recovering its library entry'; end if;
  if jsonb_typeof(verification) is distinct from 'object' or verification->'bytes' is distinct from to_jsonb(file_bytes)
    or verification->>'sha256' is distinct from file_hash or coalesce(verification->>'version','')='' or coalesce(verification->>'etag','')=''
    or jsonb_typeof(verification->'version') is distinct from 'string' or jsonb_typeof(verification->'etag') is distinct from 'string'
    or jsonb_typeof(verification->'verifiedAt') is distinct from 'string'
    or verification-array['bytes','sha256','version','etag','verifiedAt']<>'{}'::jsonb then
    raise exception using errcode='22023',message='Verified stored file evidence required'; end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes' or observed>clock_timestamp()+interval '30 seconds' then
    raise exception using errcode='P0409',message='Fresh stored file verification required'; end if;
  select * into object from builder_storage_objects(target) o where o.bucket=context->>'bucket_id' and o.name=context->>'object_name';
  if object.version is distinct from verification->>'version' or object.etag is distinct from verification->>'etag' then
    raise exception using errcode='P0409',message='The stored file changed during verification'; end if;
  insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status,object_version,object_etag,verified_at)
    values(target,asset,file_bytes,file_hash,file_mime,asset_kind,context->>'bucket_id',context->>'object_name',
      case when target<>'kaizen' then '/builder-project-media/'||target||'/'||asset::text when context->>'bucket_id'='builder-source' then 'private:'||asset::text else null end,
      'verified',object.version,object.etag,observed)
    on conflict(project_id,asset_id) do update set status='verified',object_version=excluded.object_version,object_etag=excluded.object_etag,verified_at=excluded.verified_at,
      mime=excluded.mime,asset_kind=excluded.asset_kind,identity_source='registered',
      file_url=case when builder_asset_files.status='observed' then excluded.file_url else builder_asset_files.file_url end;
  return jsonb_build_object('id',request_id,'projectId',target,'assetId',asset,'bytes',file_bytes,'sha256',file_hash,'status','stored');
end;
$$;

revoke all on function public.builder_asset_file_identity(text,jsonb),public.builder_asset_file_capture(public.builder_uploads),public.builder_asset_file_upload_trigger(),
  public.builder_asset_file_reservation_guard(),public.builder_asset_file_guard(),public.builder_register_asset(text,uuid,jsonb,text),
  public.builder_asset_adoption_context(text,uuid,uuid,uuid,bigint,text,text,text,text),public.builder_asset_adopt_finish(text,uuid,uuid,uuid,bigint,text,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_register_asset(text,uuid,jsonb,text),
  public.builder_asset_adoption_context(text,uuid,uuid,uuid,bigint,text,text,text,text),public.builder_asset_adopt_finish(text,uuid,uuid,uuid,bigint,text,text,text,text,jsonb) to service_role;
revoke insert on public.builder_assets from authenticated;
