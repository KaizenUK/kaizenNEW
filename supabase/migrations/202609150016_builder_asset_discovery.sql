-- Discover provider objects which never reached upload/library registration.
-- Observations grant read/verification authority only; normal cleanup still has
-- to check references and wait through its recovery window before removal.
create table public.builder_asset_discovery (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.builder_projects(id),
  asset_id uuid not null,
  bucket_id text not null check(bucket_id in ('builder-media','builder-source','builder-project-files')),
  object_name text not null check(octet_length(object_name) between 1 and 1024 and object_name !~ '[[:cntrl:]]'),
  bytes bigint not null check(bytes between 0 and 52428800),
  object_version text not null,
  object_etag text not null,
  worker_id text not null check(worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  phase text not null default 'pending' check(phase in ('pending','managed','absent')),
  observed_at timestamptz not null default clock_timestamp(),
  checked_at timestamptz not null default 'epoch',
  unique(bucket_id,object_name),
  check((project_id='kaizen' and bucket_id in ('builder-media','builder-source'))
    or(project_id<>'kaizen' and bucket_id='builder-project-files' and split_part(object_name,'/',1)=project_id))
);
alter table public.builder_asset_discovery enable row level security;
revoke all on public.builder_asset_discovery from public,anon,authenticated,service_role;
create index builder_asset_discovery_worker on public.builder_asset_discovery(worker_id,checked_at,id) where phase='pending';

-- Match both literal paths and their URL-encoded spelling. Slash remains a
-- separator; punctuation and UTF-8 bytes are encoded like encodeURIComponent.
create function public.builder_storage_encoded_path(input text) returns text
language plpgsql immutable strict set search_path=public,pg_temp as $$
declare bytes bytea:=convert_to(input,'UTF8'); result text:=''; value integer;
begin
  if octet_length(bytes)=0 then return result; end if;
  for n in 0..octet_length(bytes)-1 loop
    value:=get_byte(bytes,n);
    if value between 48 and 57 or value between 65 and 90 or value between 97 and 122 or value in (33,39,40,41,42,45,46,47,95,126) then
      result:=result||chr(value);
    else result:=result||'%'||upper(lpad(to_hex(value),2,'0')); end if;
  end loop;
  return result;
end;
$$;
create or replace function public.builder_asset_reference_match(document jsonb, asset uuid, file_url text default null) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select coalesce(position(asset::text in lower(document::text))>0
    or (coalesce(file_url,'')<>'' and (position(lower(file_url) in lower(document::text))>0
      or position(lower(substr(to_jsonb(file_url)::text,2,length(to_jsonb(file_url)::text)-2)) in lower(document::text))>0
      or position(lower(builder_storage_encoded_path(file_url)) in lower(document::text))>0)),false)
$$;

create function public.builder_asset_discovery_queue(worker text, batch_size integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; asset uuid; leaf text;
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or batch_size is null or batch_size not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid file discovery request'; end if;
  for item in
    with objects as (
      select p.id as project_id,o.bucket_id,o.name,
        case when jsonb_typeof(to_jsonb(o)->'metadata'->'size')='number' and to_jsonb(o)->'metadata'->>'size' ~ '^[0-9]{1,15}$'
          then (to_jsonb(o)->'metadata'->>'size')::bigint end as bytes,
        to_jsonb(o)->>'version' as version,to_jsonb(o)->'metadata'->>'eTag' as etag,d.checked_at
      from storage.objects o join builder_projects p on p.id=split_part(o.name,'/',1)
      left join builder_asset_discovery d on d.bucket_id=o.bucket_id and d.object_name=o.name
      where p.id<>'kaizen' and o.bucket_id='builder-project-files'
        and octet_length(o.name) between 1 and 1024 and o.name !~ '[[:cntrl:]]' and o.name !~ '(^|/)(\.|\.\.)(/|$)'
        and not exists(select 1 from builder_asset_files f where f.bucket_id=o.bucket_id and f.object_name=o.name)
        and not exists(select 1 from builder_uploads u where u.bucket_id=o.bucket_id and u.object_name=o.name)
    ) select * from objects where bytes between 0 and 52428800 and length(version) between 1 and 255 and length(etag) between 1 and 255
      order by coalesce(checked_at,'epoch'),bucket_id,name limit batch_size
  loop
    leaf:=substr(item.name,length(item.project_id)+2);
    asset:=case when leaf ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then leaf::uuid else gen_random_uuid() end;
    insert into builder_asset_discovery(project_id,asset_id,bucket_id,object_name,bytes,object_version,object_etag,worker_id)
      values(item.project_id,asset,item.bucket_id,item.name,item.bytes,item.version,item.etag,worker)
      on conflict(bucket_id,object_name) do update set phase='pending',bytes=excluded.bytes,object_version=excluded.object_version,object_etag=excluded.object_etag,
        observed_at=case when (builder_asset_discovery.bytes,builder_asset_discovery.object_version,builder_asset_discovery.object_etag)
          is distinct from (excluded.bytes,excluded.object_version,excluded.object_etag) or builder_asset_discovery.phase='absent'
          then clock_timestamp() else builder_asset_discovery.observed_at end;
  end loop;
  return (select coalesce(jsonb_agg(q.id order by q.checked_at,q.id),'[]'::jsonb) from
    (select d.id,d.checked_at from builder_asset_discovery d where d.worker_id=worker and d.phase='pending'
      order by d.checked_at,d.id limit batch_size) q);
end;
$$;

create function public.builder_asset_discovery_read(request_id uuid, worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_discovery%rowtype; target text;
begin
  select project_id into target from builder_asset_discovery where id=request_id;
  perform 1 from builder_projects where id=target for share;
  select * into item from builder_asset_discovery where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id then raise exception using errcode='P0403',message='Configured file discovery worker required'; end if;
  if item.phase<>'pending' then return null; end if;
  if exists(select 1 from builder_asset_files f where f.bucket_id=item.bucket_id and f.object_name=item.object_name)
    or exists(select 1 from builder_uploads u where u.bucket_id=item.bucket_id and u.object_name=item.object_name) then
    update builder_asset_discovery set phase='managed',checked_at=clock_timestamp() where id=request_id; return null;
  end if;
  update builder_asset_discovery set checked_at=clock_timestamp() where id=request_id;
  return to_jsonb(item)||jsonb_build_object('object_scope','orphan');
end;
$$;

create function public.builder_asset_discovery_finish(request_id uuid, worker text, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_asset_discovery%rowtype; target text; observed timestamptz; object record;
begin
  select project_id into target from builder_asset_discovery where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_asset_discovery where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id then raise exception using errcode='P0403',message='Configured file discovery worker required'; end if;
  if item.phase='managed' then return jsonb_build_object('catalogued',false); end if;
  if exists(select 1 from builder_asset_files f where f.bucket_id=item.bucket_id and f.object_name=item.object_name)
    or exists(select 1 from builder_uploads u where u.bucket_id=item.bucket_id and u.object_name=item.object_name) then
    update builder_asset_discovery set phase='managed',checked_at=clock_timestamp() where id=request_id;
    return jsonb_build_object('catalogued',false);
  end if;
  if jsonb_typeof(verification) is distinct from 'object' or jsonb_typeof(verification->'present') is distinct from 'boolean'
    or jsonb_typeof(verification->'verifiedAt') is distinct from 'string' then raise exception using errcode='22023',message='Verified file observation required'; end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes' or observed>clock_timestamp()+interval '30 seconds' then
    raise exception using errcode='P0409',message='Fresh file observation required'; end if;
  select * into object from builder_storage_objects(target) o where o.bucket=item.bucket_id and o.name=item.object_name;
  if verification->'present'='false'::jsonb then
    if verification-array['present','verifiedAt']<>'{}'::jsonb or object.name is not null then
      raise exception using errcode='P0409',message='Confirm the observed file is absent before continuing'; end if;
    update builder_asset_discovery set phase='absent',checked_at=clock_timestamp() where id=request_id;
    perform builder_storage_sync(target);
    return jsonb_build_object('catalogued',false);
  end if;
  if verification-array['present','bytes','sha256','mime','version','etag','verifiedAt']<>'{}'::jsonb
    or verification->'bytes' is distinct from to_jsonb(item.bytes) or coalesce(verification->>'sha256','') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(verification->'sha256') is distinct from 'string' or jsonb_typeof(verification->'mime') is distinct from 'string'
    or length(verification->>'mime') not between 1 and 255 or verification->>'mime' ~ '[[:cntrl:]]'
    or verification->>'version' is distinct from item.object_version or verification->>'etag' is distinct from item.object_etag
    or jsonb_typeof(verification->'version') is distinct from 'string' or jsonb_typeof(verification->'etag') is distinct from 'string'
    or object.name is null or object.bytes<>item.bytes or object.version is distinct from item.object_version or object.etag is distinct from item.object_etag then
    raise exception using errcode='P0409',message='The stored file changed during discovery. Verify it again'; end if;
  insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,identity_source,status,object_version,object_etag,verified_at)
    values(target,item.asset_id,item.bytes,verification->>'sha256',verification->>'mime','other',item.bucket_id,item.object_name,item.object_name,
      'discovery','observed',item.object_version,item.object_etag,observed);
  update builder_asset_discovery set phase='managed',checked_at=clock_timestamp() where id=request_id;
  perform builder_storage_sync(target);
  return jsonb_build_object('catalogued',true);
end;
$$;

revoke all on function public.builder_storage_encoded_path(text),public.builder_asset_discovery_queue(text,integer),public.builder_asset_discovery_read(uuid,text),public.builder_asset_discovery_finish(uuid,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_asset_discovery_queue(text,integer),public.builder_asset_discovery_read(uuid,text),public.builder_asset_discovery_finish(uuid,text,jsonb) to service_role;
