-- One current deletion request per account. No passwords, tokens or copied email
-- addresses are retained. Auth is soft-deleted so website/history FKs survive.
create table public.builder_account_deletions (
  user_id uuid primary key references auth.users(id),
  request_id uuid not null unique default gen_random_uuid(),
  status text not null check(status in ('pending','cancelled','processing','completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  operator_approved_at timestamptz
);
create table public.builder_account_deletion_projects (
  request_id uuid not null references public.builder_account_deletions(request_id) on delete cascade,
  project_id text not null references public.builder_projects(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  primary key(request_id,project_id)
);
create index builder_account_deletion_project_queue on public.builder_account_deletion_projects(project_id,request_id);
alter table public.builder_account_deletions enable row level security;
alter table public.builder_account_deletion_projects enable row level security;
revoke all on public.builder_account_deletions,public.builder_account_deletion_projects from public,anon,authenticated,service_role;

-- Serialize membership changes with the request snapshot and final closure.
-- Existing project locks still protect last-owner and permission operations.
create function public.builder_account_membership_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare account uuid; state text;
begin
  account:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if tg_op='UPDATE' and old.user_id<>new.user_id then
    perform pg_advisory_xact_lock(hashtextextended('builder-account:'||least(old.user_id::text,new.user_id::text),0));
    perform pg_advisory_xact_lock(hashtextextended('builder-account:'||greatest(old.user_id::text,new.user_id::text),0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||account::text,0));
  select status into state from builder_account_deletions where user_id=account;
  if tg_op<>'DELETE' and state in ('processing','completed') then
    raise exception using errcode='40001',message='This account is being deleted and cannot receive project access';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.builder_account_membership_guard() from public,anon,authenticated,service_role;
create trigger builder_account_membership_guard before insert or update or delete on public.builder_project_members
for each row execute function public.builder_account_membership_guard();

create function public.builder_account_deletion_request(actor uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare current_request builder_account_deletions%rowtype; result uuid:=gen_random_uuid();
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception using errcode='42501',message='An active account is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||actor::text,0));
  select * into current_request from builder_account_deletions where user_id=actor for update;
  if found and current_request.status in ('pending','processing','completed') then return current_request.request_id; end if;
  if current_request.request_id is not null then delete from builder_account_deletion_projects where request_id=current_request.request_id; end if;
  insert into builder_account_deletions(user_id,request_id,status) values(actor,result,'pending')
  on conflict(user_id) do update set request_id=excluded.request_id,status='pending',requested_at=now(),completed_at=null,operator_approved_at=null;
  insert into builder_account_deletion_projects(request_id,project_id)
  select result,project_id from builder_project_members where user_id=actor;
  return result;
end;
$$;

create function public.builder_account_deletion_cancel(actor uuid, request uuid) returns void
language plpgsql security definer set search_path=public as $$
declare state text;
begin
  if actor is null then raise exception using errcode='42501',message='An active account is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||actor::text,0));
  select status into state from builder_account_deletions where user_id=actor and request_id=request for update;
  if not found then raise exception using errcode='42501',message='This is not your current account request'; end if;
  if state not in ('pending','cancelled') then raise exception using errcode='40001',message='Account deletion has already started'; end if;
  update builder_account_deletions set status='cancelled' where user_id=actor;
  delete from builder_account_deletion_projects where request_id=request;
end;
$$;

create function public.builder_account_deletion_state(actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare own_request jsonb; reviews jsonb;
begin
  if actor is null then raise exception using errcode='42501',message='An active account is required'; end if;
  select jsonb_build_object('id',d.request_id,'status',d.status,'requestedAt',d.requested_at,
    'needsOperator',not exists(select 1 from builder_account_deletion_projects s where s.request_id=d.request_id),
    'accessChanged',d.status='pending' and (
      exists(select project_id from builder_project_members where user_id=actor except select project_id from builder_account_deletion_projects where request_id=d.request_id)
      or exists(select project_id from builder_account_deletion_projects where request_id=d.request_id except select project_id from builder_project_members where user_id=actor)),
    'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,
      'approved',s.approved_by is not null and s.approved_by<>actor and exists(select 1 from builder_project_members m where m.project_id=p.id and m.user_id=s.approved_by and m.role='owner'),
      'lastOwner',exists(select 1 from builder_project_members m where m.project_id=p.id and m.user_id=actor and m.role='owner') and (select count(*) from builder_project_members m where m.project_id=p.id and m.role='owner')<=1) order by p.name,p.id)
      from builder_account_deletion_projects s join builder_projects p on p.id=s.project_id where s.request_id=d.request_id),'[]'::jsonb))
    into own_request from builder_account_deletions d where d.user_id=actor and d.status<>'cancelled';
  select coalesce(jsonb_agg(jsonb_build_object('id',d.request_id,'projectId',p.id,'projectName',p.name,
    'name',case when d.status='pending' then left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),200) else '' end,
    'email',case when d.status='pending' then coalesce(u.email,'') else '' end,'status',d.status,'requestedAt',d.requested_at,
    'approved',s.approved_by is not null and s.approved_by<>d.user_id and exists(select 1 from builder_project_members a where a.project_id=p.id and a.user_id=s.approved_by and a.role='owner')) order by d.requested_at,p.id),'[]'::jsonb)
    into reviews from builder_account_deletion_projects s join builder_account_deletions d on d.request_id=s.request_id
      join builder_projects p on p.id=s.project_id join auth.users u on u.id=d.user_id
      join builder_project_members reviewer on reviewer.project_id=p.id and reviewer.user_id=actor and reviewer.role='owner'
    where d.user_id<>actor and d.status in ('pending','processing');
  return jsonb_build_object('request',own_request,'reviews',reviews);
end;
$$;

-- Only the verified API may pass an account as actor. A null actor is a separate
-- service-role operator action for an orphan request with no project membership;
-- the HTTP handler never accepts or supplies that override.
create function public.builder_account_deletion_prepare(actor uuid, request uuid, target text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare account uuid; deletion builder_account_deletions%rowtype; has_scopes boolean;
begin
  select user_id into account from builder_account_deletions where request_id=request;
  if account is null then raise exception using errcode='42501',message='Account request unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||account::text,0));
  select * into deletion from builder_account_deletions where request_id=request for update;
  if not found or deletion.status='cancelled' then raise exception using errcode='40001',message='This account request changed or was cancelled'; end if;
  has_scopes:=exists(select 1 from builder_account_deletion_projects where request_id=request);
  if actor is null then
    if has_scopes or exists(select 1 from builder_project_members where user_id=account) then
      raise exception using errcode='42501',message='Project owner approvals are required';
    end if;
  elsif deletion.status='pending' then
    if actor=account or not exists(select 1 from builder_account_deletion_projects s join builder_project_members m on m.project_id=s.project_id
      where s.request_id=request and s.project_id=target and m.user_id=actor and m.role='owner') then
      raise exception using errcode='42501',message='Another current project owner must confirm this request';
    end if;
  elsif actor<>account and not exists(select 1 from builder_account_deletion_projects s join builder_project_members m on m.project_id=s.project_id
    where s.request_id=request and m.user_id=actor and m.role='owner') then
    raise exception using errcode='42501',message='Current project owner access is required';
  end if;
  if deletion.status in ('processing','completed') then
    return jsonb_build_object('status',deletion.status,'userId',account);
  end if;
  -- Membership RPCs also lock their project before changing ownership. Lock
  -- actual membership rows as well, covering direct privileged updates.
  perform 1 from builder_projects p where p.id in (select project_id from builder_account_deletion_projects where request_id=request) order by p.id for update;
  perform 1 from builder_project_members m where m.project_id in (select project_id from builder_account_deletion_projects where request_id=request) order by m.project_id,m.user_id for update;
  if exists(select project_id from builder_project_members where user_id=account except select project_id from builder_account_deletion_projects where request_id=request)
    or exists(select project_id from builder_account_deletion_projects where request_id=request except select project_id from builder_project_members where user_id=account) then
    raise exception using errcode='40001',message='Project access changed; cancel and make a new account request';
  end if;
  if exists(select 1 from builder_project_members m where m.user_id=account and m.role='owner'
    and (select count(*) from builder_project_members other where other.project_id=m.project_id and other.role='owner')<=1) then
    raise exception using errcode='P0409',message='Keep another owner for every website before deleting this account';
  end if;
  if actor is null then update builder_account_deletions set operator_approved_at=now() where request_id=request;
  else update builder_account_deletion_projects set approved_by=actor,approved_at=now() where request_id=request and project_id=target; end if;
  if has_scopes and exists(select 1 from builder_account_deletion_projects s where s.request_id=request and (
    s.approved_by is null or s.approved_by=account or not exists(select 1 from builder_project_members m where m.project_id=s.project_id and m.user_id=s.approved_by and m.role='owner'))) then
    return jsonb_build_object('status','pending');
  end if;
  update builder_account_deletions set status='processing' where request_id=request;
  delete from builder_project_members where user_id=account;
  return jsonb_build_object('status','processing','userId',account);
end;
$$;

create function public.builder_account_deletion_complete(request uuid) returns void
language plpgsql security definer set search_path=public as $$
declare account uuid; state text;
begin
  select user_id into account from builder_account_deletions where request_id=request;
  if account is null then raise exception using errcode='40001',message='Account request unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||account::text,0));
  select status into state from builder_account_deletions where request_id=request for update;
  if state='completed' then return; end if;
  if state<>'processing' or exists(select 1 from auth.users where id=account and deleted_at is null) then
    raise exception using errcode='40001',message='Account removal is not yet confirmed';
  end if;
  update builder_account_deletions set status='completed',completed_at=now() where request_id=request;
end;
$$;

create function public.builder_account_orphan_requests() returns table(request_id uuid,user_id uuid,status text,requested_at timestamptz)
language sql stable security definer set search_path=public as $$
  select d.request_id,d.user_id,d.status,d.requested_at from builder_account_deletions d
  where d.status in ('pending','processing') and not exists(select 1 from builder_account_deletion_projects s where s.request_id=d.request_id)
  and not exists(select 1 from builder_project_members m where m.user_id=d.user_id) order by d.requested_at;
$$;

revoke all on function public.builder_account_deletion_request(uuid),public.builder_account_deletion_cancel(uuid,uuid),public.builder_account_deletion_state(uuid),public.builder_account_deletion_prepare(uuid,uuid,text),public.builder_account_deletion_complete(uuid),public.builder_account_orphan_requests() from public,anon,authenticated;
grant execute on function public.builder_account_deletion_request(uuid),public.builder_account_deletion_cancel(uuid,uuid),public.builder_account_deletion_state(uuid),public.builder_account_deletion_prepare(uuid,uuid,text),public.builder_account_deletion_complete(uuid),public.builder_account_orphan_requests() to service_role;
