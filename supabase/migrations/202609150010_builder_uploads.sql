-- Physical object accounting and durable upload reservations. No Storage row or
-- provider-owned schema is mutated: objects are written/removed through its API.
alter table public.builder_project_billing
  add column workspace_bytes bigint not null default 0 check(workspace_bytes>=0),
  add column storage_bytes bigint not null default 0 check(storage_bytes>=0);
update public.builder_project_billing set workspace_bytes=registered_bytes;

create table public.builder_uploads (
  id uuid primary key,
  project_id text not null references public.builder_projects(id) on delete cascade,
  asset_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  worker_id text not null check(worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  bucket_id text not null check(bucket_id in ('builder-media','builder-source','builder-project-files')),
  object_name text not null,
  bytes bigint not null check(bytes between 1 and 52428800),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  mime text not null check(length(mime) between 1 and 255 and mime !~ '[[:cntrl:]]'),
  asset_kind text not null check(asset_kind in ('image','icon','font','licence','code','design','other')),
  status text not null default 'reserved' check(status in ('reserved','receiving','storing','stored','removing','removed')),
  owner_token uuid,
  completed_token uuid,
  completion_evidence jsonb,
  cancel_requested boolean not null default false,
  object_version text,
  object_etag text,
  verified_at timestamptz,
  received_bytes bigint not null default 0 check(received_bytes between 0 and bytes),
  activity_at timestamptz not null default clock_timestamp(),
  maintenance_at timestamptz not null default 'epoch',
  local_cleanup_pending boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(project_id,asset_id),
  unique(bucket_id,object_name),
  check((status in ('receiving','storing','removing')) = (owner_token is not null)),
  check((status in ('stored','removed')) = (completed_token is not null)),
  check((status in ('stored','removed')) = (completion_evidence is not null)),
  check(status in ('stored','removed') or local_cleanup_pending),
  check((bucket_id='builder-project-files' and project_id<>'kaizen' and object_name=project_id||'/'||asset_id::text)
    or (bucket_id in ('builder-media','builder-source') and project_id='kaizen' and object_name=asset_id::text))
);
alter table public.builder_uploads enable row level security;
revoke all on public.builder_uploads from public,anon,authenticated,service_role;
create index builder_uploads_worker on public.builder_uploads(worker_id,status,updated_at);
create index builder_uploads_maintenance on public.builder_uploads(worker_id,maintenance_at,id) where local_cleanup_pending;

create function public.builder_upload_access(target text, actor uuid, changing boolean default true) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0403',message='Sign in with a confirmed, active account before uploading';
  end if;
  if not exists(select 1 from builder_project_members m join builder_projects p on p.id=m.project_id
    where m.project_id=target and m.user_id=actor and (not changing or not p.archived)) then
    raise exception using errcode='P0403',message='Current website access is required before uploading';
  end if;
end;
$$;

create function public.builder_storage_object_bytes(metadata jsonb) returns bigint
language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(metadata->'size') is distinct from 'number' or metadata->>'size' !~ '^[0-9]{1,15}$' then
    raise exception using errcode='P0409',message='Stored file usage needs to be verified before uploading';
  end if;
  return (metadata->>'size')::bigint;
end;
$$;

create function public.builder_storage_objects(target text) returns table(bucket text, name text, bytes bigint, version text, etag text)
language sql stable security definer set search_path=public,pg_temp as $$
  select o.bucket_id,o.name,builder_storage_object_bytes(to_jsonb(o)->'metadata'),
    to_jsonb(o)->>'version',to_jsonb(o)->'metadata'->>'eTag'
  from storage.objects o where (target='kaizen' and o.bucket_id in ('builder-media','builder-source'))
    or (target<>'kaizen' and o.bucket_id='builder-project-files' and split_part(o.name,'/',1)=target)
$$;

-- Include pending bytes, unregistered files and retained objects. A completed
-- reservation and its matching provider object are counted once, at the larger
-- observed amount. Expiry alone never releases a reservation.
create function public.builder_storage_sync(target text) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare amount bigint; payer uuid;
begin
  perform 1 from builder_projects where id=target for update;
  select user_id into payer from builder_project_billing where project_id=target for update;
  if payer is null then raise exception using errcode='P0409',message='Set up website billing before uploading'; end if;
  perform 1 from builder_billing_accounts where user_id=payer for update;
  select coalesce(sum(greatest(coalesce(o.bytes,0),coalesce(u.bytes,0))),0) into amount
    from builder_storage_objects(target) o full join
      (select bucket_id,object_name,bytes from builder_uploads where project_id=target and status<>'removed') u
      on u.bucket_id=o.bucket and u.object_name=o.name;
  update builder_project_billing set storage_bytes=amount where project_id=target;
  return amount;
end;
$$;

create function public.builder_upload_public(item public.builder_uploads) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('id',item.id,'projectId',item.project_id,'assetId',item.asset_id,'bytes',item.bytes,
    'sha256',item.sha256,'status',item.status,'cancelRequested',item.cancel_requested)
$$;

create function public.builder_upload_reserve(target text, actor uuid, request_id uuid, asset uuid,
  file_bytes bigint, file_hash text, file_mime text, asset_kind text, worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; billing builder_project_billing%rowtype; account builder_billing_accounts%rowtype;
  selected builder_plans%rowtype; selected_bucket text; object_key text; stored bigint; added bigint;
begin
  perform 1 from builder_projects where id=target for update;
  perform builder_upload_access(target,actor);
  if request_id is null or asset is null or file_bytes is null or file_bytes not between 1 and 52428800
    or file_hash is null or file_hash !~ '^[a-f0-9]{64}$' or file_mime is null or length(file_mime) not between 1 and 255 or file_mime ~ '[[:cntrl:]]'
    or asset_kind is null or asset_kind not in ('image','icon','font','licence','code','design','other')
    or worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception using errcode='22023',message='Invalid upload metadata'; end if;
  selected_bucket:=case when target='kaizen' then case when asset_kind in ('image','icon','font') then 'builder-media' else 'builder-source' end else 'builder-project-files' end;
  object_key:=case when target='kaizen' then asset::text else target||'/'||asset::text end;
  select * into item from builder_uploads where id=request_id or (project_id=target and asset_id=asset) for update;
  if found then
    if item.id<>request_id or item.project_id<>target or item.asset_id<>asset or item.actor_id is distinct from actor
      or item.bytes<>file_bytes or item.sha256<>file_hash or item.mime<>file_mime or item.asset_kind<>asset_kind or item.bucket_id<>selected_bucket or item.worker_id<>worker then
      raise exception using errcode='P0409',message='This upload already belongs to a different file or account';
    end if;
    if item.cancel_requested or item.status in ('removing','removed') then raise exception using errcode='P0409',message='This upload was cancelled. Start a new import'; end if;
    return builder_upload_public(item);
  end if;
  stored:=builder_storage_sync(target);
  if exists(select 1 from builder_storage_objects(target) where builder_storage_objects.bucket=selected_bucket and name=object_key) then
    raise exception using errcode='P0409',message='This stored file already exists. Verify the original import before retrying';
  end if;
  select * into billing from builder_project_billing where project_id=target;
  select * into account from builder_billing_accounts where user_id=billing.user_id for update;
  selected:=builder_billing_plan(billing.user_id);
  added:=greatest(billing.workspace_bytes,stored+file_bytes)-billing.registered_bytes;
  if account.registered_bytes+account.repository_bytes+added>selected.storage_bytes then
    raise exception using errcode='P0429',message='The billing account has reached its storage limit. Remove unused files or ask the billing owner to upgrade';
  end if;
  if (select count(*) from builder_uploads u join builder_project_billing b on b.project_id=u.project_id
      where b.user_id=billing.user_id and u.status not in ('stored','removed'))>=20 then
    raise exception using errcode='P0429',message='Finish or cancel a pending upload before starting another';
  end if;
  insert into builder_uploads(id,project_id,asset_id,actor_id,worker_id,bucket_id,object_name,bytes,sha256,mime,asset_kind)
    values(request_id,target,asset,actor,worker,selected_bucket,object_key,file_bytes,file_hash,file_mime,asset_kind) returning * into item;
  perform builder_storage_sync(target);
  return builder_upload_public(item);
end;
$$;

create function public.builder_upload_read(target text, actor uuid, request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype;
begin
  perform builder_upload_access(target,actor,false);
  select * into item from builder_uploads where id=request_id and project_id=target;
  if not found then return null; end if;
  return builder_upload_public(item);
end;
$$;

create function public.builder_upload_cancel(target text, actor uuid, request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype;
begin
  perform 1 from builder_projects where id=target for update;
  perform builder_upload_access(target,actor,false);
  select * into item from builder_uploads where id=request_id and project_id=target for update;
  if not found then raise exception using errcode='P0403',message='This upload does not belong to the website'; end if;
  if item.actor_id is distinct from actor and not exists(select 1 from builder_project_members where project_id=target and user_id=actor and role='owner') then
    raise exception using errcode='P0403',message='Only the uploader or website owner can cancel this upload';
  end if;
  -- Completed assets belong to saved work/history. Upload cancellation cannot
  -- delete them; retained-asset cleanup has a separate reference check.
  if item.status not in ('stored','removed') then
    update builder_uploads set cancel_requested=true,updated_at=clock_timestamp() where id=item.id returning * into item;
  end if;
  return builder_upload_public(item);
end;
$$;

-- The service reads durable ownership after a reconnect or uncertain RPC reply.
-- An interactive caller must still be the original uploader with current access.
-- Actor-less reads are reserved for the trusted cleanup worker.
create function public.builder_upload_worker_read(request_id uuid, worker text, actor uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype;
begin
  select * into item from builder_uploads where id=request_id;
  if item.id is null or worker is distinct from item.worker_id then
    raise exception using errcode='P0403',message='Configured upload worker required'; end if;
  if actor is not null then
    if actor is distinct from item.actor_id then
      raise exception using errcode='P0403',message='Resume this upload with its original account'; end if;
    perform builder_upload_access(item.project_id,actor,false);
  end if;
  return to_jsonb(item);
end;
$$;

create function public.builder_upload_claim(request_id uuid, worker text, token uuid, previous_owner uuid default null, cleanup_only boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; target text;
begin
  select project_id into target from builder_uploads where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null or cleanup_only is null then
    raise exception using errcode='P0403',message='Configured upload worker required'; end if;
  if item.status in ('stored','removed') then raise exception using errcode='P0409',message='This upload is already finished'; end if;
  if cleanup_only then
    if not item.cancel_requested then raise exception using errcode='P0409',message='Cancel the upload before removing its data'; end if;
  else
    perform builder_upload_access(target,item.actor_id);
    if item.cancel_requested or item.status='removing' then raise exception using errcode='P0409',message='This upload was cancelled'; end if;
  end if;
  if item.owner_token=token then
    if cleanup_only and item.status<>'removing' then
      update builder_uploads set status='removing',updated_at=clock_timestamp() where id=item.id returning * into item;
    end if;
    return to_jsonb(item);
  end if;
  if item.owner_token is not null and item.owner_token is distinct from previous_owner or item.owner_token is null and previous_owner is not null then
    raise exception using errcode='P0409',message='Reconcile the existing upload worker before retrying'; end if;
  update builder_uploads set owner_token=token,status=case when cleanup_only then 'removing' else 'receiving' end,updated_at=clock_timestamp()
    where id=item.id returning * into item;
  return to_jsonb(item);
end;
$$;

create function public.builder_upload_assert(request_id uuid, worker text, token uuid, actor uuid, storing boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; target text;
begin
  select project_id into target from builder_uploads where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or item.worker_id is distinct from worker or token is null or item.owner_token is distinct from token
    or item.actor_id is distinct from actor or item.status not in ('receiving','storing') or item.cancel_requested or storing is null then
    raise exception using errcode='P0409',message='This upload no longer owns the operation'; end if;
  perform builder_upload_access(target,actor);
  if not storing and item.status<>'receiving' then
    raise exception using errcode='P0409',message='This upload is already being stored'; end if;
  if storing and item.status='receiving' then
    update builder_uploads set status='storing',updated_at=clock_timestamp() where id=item.id returning * into item;
  end if;
  return to_jsonb(item);
end;
$$;

create function public.builder_upload_finish(request_id uuid, worker text, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; target text; object record; observed timestamptz;
begin
  select project_id into target from builder_uploads where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null then raise exception using errcode='P0403',message='Configured upload worker required'; end if;
  if item.status='stored' and item.completed_token=token then
    if verification is distinct from item.completion_evidence then
      raise exception using errcode='P0409',message='Completed upload evidence changed'; end if;
    return builder_upload_public(item);
  end if;
  if item.owner_token is distinct from token or item.status<>'storing' or item.cancel_requested then
    raise exception using errcode='P0409',message='This upload no longer owns the operation'; end if;
  perform builder_upload_access(target,item.actor_id);
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'id' is distinct from request_id::text
    or verification->>'attemptId' is distinct from token::text or verification->'bytes' is distinct from to_jsonb(item.bytes)
    or verification->>'sha256' is distinct from item.sha256 or coalesce(verification->>'version','')='' or coalesce(verification->>'etag','')=''
    or jsonb_typeof(verification->'version') is distinct from 'string' or jsonb_typeof(verification->'etag') is distinct from 'string'
    or jsonb_typeof(verification->'verifiedAt') is distinct from 'string'
    or verification-array['id','attemptId','bytes','sha256','version','etag','verifiedAt']<>'{}'::jsonb then
    raise exception using errcode='22023',message='Verified stored file evidence required'; end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes' or observed>clock_timestamp()+interval '30 seconds' then
    raise exception using errcode='P0409',message='Fresh stored file verification required'; end if;
  select * into object from builder_storage_objects(target) where bucket=item.bucket_id and name=item.object_name;
  if object.name is null or object.bytes<>item.bytes or object.version is distinct from verification->>'version' or object.etag is distinct from verification->>'etag' then
    raise exception using errcode='P0409',message='The stored file changed or its byte count could not be verified'; end if;
  update builder_uploads set status='stored',owner_token=null,completed_token=token,completion_evidence=verification,object_version=object.version,object_etag=object.etag,
    verified_at=observed,updated_at=clock_timestamp() where id=item.id returning * into item;
  perform builder_storage_sync(target);
  return builder_upload_public(item);
end;
$$;

-- Only successfully accepted new bytes extend the resume window. HEAD, repeated
-- creation and failed/empty PATCH requests cannot keep a reservation alive.
create function public.builder_upload_progress(request_id uuid, worker text, token uuid, actor uuid, received bigint) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype;
begin
  perform builder_upload_assert(request_id,worker,token,actor,false);
  select * into item from builder_uploads where id=request_id;
  if received is null or received<item.received_bytes or received>item.bytes then
    raise exception using errcode='22023',message='Invalid accepted upload offset'; end if;
  if received>item.received_bytes then
    update builder_uploads set received_bytes=received,activity_at=clock_timestamp(),updated_at=clock_timestamp() where id=request_id;
  end if;
end;
$$;

create function public.builder_upload_cleanup_due(item public.builder_uploads) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select case when item.status in ('stored','removed') then item.local_cleanup_pending else
    item.cancel_requested or item.activity_at<now()-interval '7 days'
    or not exists(select 1 from auth.users where id=item.actor_id and deleted_at is null and email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=item.actor_id and status in ('processing','completed'))
    or not exists(select 1 from builder_project_members m join builder_projects p on p.id=m.project_id
      where m.project_id=item.project_id and m.user_id=item.actor_id and not p.archived)
  end
$$;

-- Discovery grants no deletion authority. The service acquires its local lock
-- and rechecks eligibility before it cancels anything. Failed items rotate to
-- the back so that one unavailable provider object cannot starve other cleanup.
create function public.builder_upload_cleanup_queue(worker text, batch_size integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if worker is null or worker !~ '^[a-zA-Z0-9_-]{1,100}$' or batch_size is null or batch_size not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid upload maintenance request'; end if;
  return (select coalesce(jsonb_agg(q.id order by q.maintenance_at,q.id),'[]'::jsonb) from
    (select u.id,u.maintenance_at from builder_uploads u where u.worker_id=worker and u.local_cleanup_pending and builder_upload_cleanup_due(u)
      order by u.maintenance_at,u.id limit batch_size) q);
end;
$$;

create function public.builder_upload_cleanup_prepare(request_id uuid, worker text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; target text;
begin
  select project_id into target from builder_uploads where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id then
    raise exception using errcode='P0403',message='Configured upload worker required'; end if;
  update builder_uploads set maintenance_at=clock_timestamp() where id=request_id;
  if not builder_upload_cleanup_due(item) then return null; end if;
  if item.status not in ('stored','removed') then
    update builder_uploads set cancel_requested=true,updated_at=clock_timestamp() where id=request_id returning * into item;
  end if;
  return to_jsonb(item);
end;
$$;

-- The host acknowledges this only after removing the local file and recovery
-- state. A lost acknowledgement keeps the terminal row discoverable on restart.
create function public.builder_upload_cleanup_ack(request_id uuid, worker text, completed uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype;
begin
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or completed is null
    or completed is distinct from item.completed_token or item.status not in ('stored','removed') then
    raise exception using errcode='P0409',message='Confirmed upload completion required before local cleanup'; end if;
  update builder_uploads set local_cleanup_pending=false where id=request_id;
end;
$$;

create function public.builder_upload_remove_finish(request_id uuid, worker text, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_uploads%rowtype; target text; observed timestamptz;
begin
  select project_id into target from builder_uploads where id=request_id;
  perform 1 from builder_projects where id=target for update;
  select * into item from builder_uploads where id=request_id for update;
  if item.id is null or worker is distinct from item.worker_id or token is null then raise exception using errcode='P0403',message='Configured upload worker required'; end if;
  if item.status='removed' and item.completed_token=token then
    if verification is distinct from item.completion_evidence then
      raise exception using errcode='P0409',message='Completed upload removal evidence changed'; end if;
    return builder_upload_public(item);
  end if;
  if item.owner_token is distinct from token or item.status<>'removing' or not item.cancel_requested then
    raise exception using errcode='P0409',message='This cleanup no longer owns the upload'; end if;
  if jsonb_typeof(verification) is distinct from 'object' or verification->>'id' is distinct from request_id::text
    or verification->>'attemptId' is distinct from token::text or verification->'localRemoved' is distinct from 'true'::jsonb
    or verification->'providerRemoved' is distinct from 'true'::jsonb
    or jsonb_typeof(verification->'verifiedAt') is distinct from 'string'
    or verification-array['id','attemptId','localRemoved','providerRemoved','verifiedAt']<>'{}'::jsonb then
    raise exception using errcode='22023',message='Verified upload removal required'; end if;
  observed:=(verification->>'verifiedAt')::timestamptz;
  if observed is null or not isfinite(observed) or observed<clock_timestamp()-interval '5 minutes' or observed>clock_timestamp()+interval '30 seconds'
    or exists(select 1 from builder_storage_objects(target) where bucket=item.bucket_id and name=item.object_name) then
    raise exception using errcode='P0409',message='Confirm the stored file is removed before releasing its space'; end if;
  update builder_uploads set status='removed',owner_token=null,completed_token=token,completion_evidence=verification,updated_at=clock_timestamp()
    where id=item.id returning * into item;
  perform builder_storage_sync(target);
  return builder_upload_public(item);
end;
$$;

create or replace function public.builder_initial_billing_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare usage jsonb;
begin
  if new.role<>'owner' or exists(select 1 from builder_project_billing where project_id=new.project_id) then return new; end if;
  perform 1 from builder_projects where id=new.project_id for update;
  if exists(select 1 from builder_project_billing where project_id=new.project_id) then return new; end if;
  perform builder_billing_account(new.user_id);
  if new.project_id='kaizen' then
    usage:=builder_workspace_usage(jsonb_build_object('pages',coalesce((select jsonb_agg(payload) from builder_pages),'[]'::jsonb),
      'assets',coalesce((select jsonb_agg(payload) from builder_assets),'[]'::jsonb)));
  else select builder_workspace_usage(payload) into usage from builder_project_workspaces where project_id=new.project_id; end if;
  insert into builder_project_billing(project_id,user_id,page_count,workspace_bytes)
    values(new.project_id,new.user_id,coalesce((usage->>'pages')::integer,0),coalesce((usage->>'bytes')::bigint,0));
  return new;
end;
$$;

create or replace function public.builder_workspace_limit_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare usage jsonb;
begin
  perform 1 from builder_projects where id=new.project_id for update;
  -- The original site's separate tables are authoritative; its compatibility
  -- workspace must not reset or replace their usage counters.
  if new.project_id='kaizen' then return new; end if;
  usage:=builder_workspace_usage(new.payload);
  update builder_project_billing set page_count=(usage->>'pages')::integer,workspace_bytes=(usage->>'bytes')::bigint where project_id=new.project_id;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  return new;
end;
$$;

create or replace function public.builder_legacy_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare usage jsonb;
begin
  perform 1 from builder_projects where id='kaizen' for update;
  usage:=builder_workspace_usage(jsonb_build_object('pages',coalesce((select jsonb_agg(payload) from builder_pages),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(payload) from builder_assets),'[]'::jsonb)));
  update builder_project_billing set page_count=(usage->>'pages')::integer,workspace_bytes=(usage->>'bytes')::bigint where project_id='kaizen';
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  return null;
end;
$$;

create or replace function public.builder_billing_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare total jsonb; old_account uuid; next_account uuid; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; previous_bytes bigint:=0; previous_repository_bytes bigint:=0; previous_pages integer:=0; added_projects integer:=1;
begin
  if tg_op<>'INSERT' then old_account:=old.user_id; end if;
  if tg_op<>'DELETE' then next_account:=new.user_id; end if;
  -- A deterministic lock order also makes two simultaneous billing transfers
  -- between the same accounts safe. Counters change under these row locks.
  perform 1 from builder_billing_accounts where user_id in (old_account,next_account) order by user_id for update;
  if tg_op='DELETE' then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes,repository_bytes=repository_bytes-old.repository_bytes where user_id=old_account;
    return old;
  end if;
  select * into account from builder_billing_accounts where user_id=next_account;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  new.registered_bytes:=greatest(new.workspace_bytes,new.storage_bytes);
  total:=builder_repository_usage_totals(new.project_id,new.repository_usage,new.repository_staging_job,new.repository_production_job);
  new.repository_bytes:=(total->>'bytes')::bigint;
  new.repository_pages:=(total->>'pages')::integer;
  selected:=builder_billing_plan(next_account);
  if tg_op='UPDATE' and old_account=next_account then
    previous_bytes:=old.registered_bytes; previous_repository_bytes:=old.repository_bytes; previous_pages:=old.page_count; added_projects:=0;
  end if;
  if added_projects=1 and account.project_count+1>selected.projects then
    raise exception using errcode='P0429',message='Your website limit is reached. Upgrade your plan or move a website to another billing owner. Archived websites also count';
  end if;
  -- A downgrade does not destroy data or prevent editing existing pages. Only
  -- increases beyond the current allowance are refused during a draft save.
  if greatest(new.page_count,new.repository_pages)>selected.pages_per_project and (added_projects=1 or new.page_count>previous_pages) then
    raise exception using errcode='P0429',message='This website has reached its page limit. Remove a page or ask the billing owner to upgrade';
  end if;
  if account.registered_bytes+account.repository_bytes-previous_bytes-previous_repository_bytes+new.registered_bytes+new.repository_bytes>selected.storage_bytes and (added_projects=1 or (tg_op='UPDATE' and new.workspace_bytes>old.workspace_bytes and new.registered_bytes>old.registered_bytes)) then
    raise exception using errcode='P0429',message='The billing account has reached its storage limit. Remove unused files or ask the billing owner to upgrade';
  end if;
  if tg_op='UPDATE' and old_account<>next_account then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes,repository_bytes=repository_bytes-old.repository_bytes where user_id=old_account;
  end if;
  update builder_billing_accounts set project_count=project_count+added_projects,registered_bytes=registered_bytes-previous_bytes+new.registered_bytes,repository_bytes=repository_bytes-previous_repository_bytes+new.repository_bytes where user_id=next_account;
  return new;
end;
$$;

-- Existing objects, including files absent from any workspace, stay accounted
-- for after migration. Their bytes come from provider metadata, never a browser.
do $$ declare item record; begin
  for item in select project_id from builder_project_billing order by project_id loop perform builder_storage_sync(item.project_id); end loop;
end; $$;

revoke all on function public.builder_upload_access(text,uuid,boolean),public.builder_storage_object_bytes(jsonb),public.builder_storage_objects(text),
  public.builder_upload_cleanup_due(public.builder_uploads),public.builder_upload_cleanup_queue(text,integer),
  public.builder_upload_cleanup_prepare(uuid,text),public.builder_upload_cleanup_ack(uuid,text,uuid),public.builder_upload_progress(uuid,text,uuid,uuid,bigint),
  public.builder_storage_sync(text),public.builder_upload_public(public.builder_uploads),
  public.builder_upload_reserve(text,uuid,uuid,uuid,bigint,text,text,text,text),public.builder_upload_read(text,uuid,uuid),public.builder_upload_cancel(text,uuid,uuid),
  public.builder_upload_worker_read(uuid,text,uuid),public.builder_upload_claim(uuid,text,uuid,uuid,boolean),public.builder_upload_assert(uuid,text,uuid,uuid,boolean),public.builder_upload_finish(uuid,text,uuid,jsonb),
  public.builder_upload_remove_finish(uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.builder_upload_reserve(text,uuid,uuid,uuid,bigint,text,text,text,text),public.builder_upload_read(text,uuid,uuid),public.builder_upload_cancel(text,uuid,uuid),
  public.builder_upload_cleanup_queue(text,integer),public.builder_upload_cleanup_prepare(uuid,text),public.builder_upload_cleanup_ack(uuid,text,uuid),public.builder_upload_progress(uuid,text,uuid,uuid,bigint),
  public.builder_upload_worker_read(uuid,text,uuid),public.builder_upload_claim(uuid,text,uuid,uuid,boolean),public.builder_upload_assert(uuid,text,uuid,uuid,boolean),public.builder_upload_finish(uuid,text,uuid,jsonb),
  public.builder_upload_remove_finish(uuid,text,uuid,jsonb) to service_role;
