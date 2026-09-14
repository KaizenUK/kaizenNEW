-- Versioned legal documents and caller-bound personal-data requests.
-- Only the verified account function may supply an actor. No browser metadata
-- is accepted as proof of legal acceptance or project-owner authority.
create table public.builder_legal_versions (
  version text primary key check(version ~ '^\d{4}-\d{2}-\d{2}(\.\d+)?$'),
  terms_hash text not null check(terms_hash ~ '^[a-f0-9]{64}$'),
  privacy_hash text not null check(privacy_hash ~ '^[a-f0-9]{64}$'),
  active boolean not null default false,
  registered_at timestamptz not null default now()
);
create unique index builder_one_active_legal_version on public.builder_legal_versions((true)) where active;
insert into public.builder_legal_versions(version,terms_hash,privacy_hash,active) values
('2026-09-14','ef1737304c088cc28d645b0c1e78e0ceffbf6a55b927d85589baf5cfac8dce41','66d1f0ceac877e87351ae703af32aa67415eb069b7fd3e204c8b1a58706dc85d',true);
create table public.builder_legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null references public.builder_legal_versions(version),
  accepted_at timestamptz not null default clock_timestamp(),
  retention_hold boolean not null default false,
  primary key(user_id,version)
);
create table public.builder_privacy_requests (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  project_id text references public.builder_projects(id) on delete set null,
  project_name text,
  requester_name text not null,
  requester_email text not null,
  kind text not null check(kind in ('export','erasure')),
  details text not null check(length(details) between 1 and 1000),
  status text not null default 'open' check(status in ('open','in_review','fulfilled','declined','cancelled')),
  version integer not null default 1 check(version>0),
  requested_at timestamptz not null default clock_timestamp(),
  response text not null default '' check(length(response)<=2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  retention_hold boolean not null default false
);
create index builder_privacy_requests_by_actor on public.builder_privacy_requests(user_id,requested_at desc,id desc);
create index builder_privacy_requests_by_project on public.builder_privacy_requests(project_id,requested_at desc,id desc);
alter table public.builder_legal_versions enable row level security;
alter table public.builder_legal_acceptances enable row level security;
alter table public.builder_privacy_requests enable row level security;
revoke all on public.builder_legal_versions,public.builder_legal_acceptances,public.builder_privacy_requests from public,anon,authenticated,service_role;

create function public.builder_legal_version_immutable() returns trigger language plpgsql as $$
begin
  if new.version<>old.version or new.terms_hash<>old.terms_hash or new.privacy_hash<>old.privacy_hash or new.registered_at<>old.registered_at then
    raise exception using errcode='40001',message='Register a new legal document version instead of changing its recorded contents';
  end if;
  return new;
end;
$$;
revoke all on function public.builder_legal_version_immutable() from public,anon,authenticated,service_role;
create trigger builder_legal_version_immutable before update on public.builder_legal_versions
for each row execute function public.builder_legal_version_immutable();

create function public.builder_legal_state(actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare current_version builder_legal_versions%rowtype; acceptance timestamptz;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception using errcode='42501',message='An active account is required';
  end if;
  select * into current_version from builder_legal_versions where active;
  if not found then raise exception using errcode='55000',message='Current legal documents are unavailable'; end if;
  select accepted_at into acceptance from builder_legal_acceptances where user_id=actor and version=current_version.version;
  return jsonb_build_object('version',current_version.version,'termsHash',current_version.terms_hash,
    'privacyHash',current_version.privacy_hash,'termsUrl','/builder/legal/'||current_version.version||'/terms/',
    'privacyUrl','/builder/legal/'||current_version.version||'/privacy/','acceptedAt',acceptance);
end;
$$;
create function public.builder_legal_accept(actor uuid, expected_version text, terms_hash text, privacy_hash text, confirmed boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_version builder_legal_versions%rowtype;
begin
  perform builder_legal_state(actor);
  select * into current_version from builder_legal_versions where active for share;
  if confirmed is distinct from true or expected_version is distinct from current_version.version
    or terms_hash is distinct from current_version.terms_hash or privacy_hash is distinct from current_version.privacy_hash then
    raise exception using errcode='40001',message='Review and accept the current document versions';
  end if;
  insert into builder_legal_acceptances(user_id,version) values(actor,current_version.version) on conflict do nothing;
  return builder_legal_state(actor);
end;
$$;

create function public.builder_privacy_operator_needed(target text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select target is null or not exists(select 1 from builder_project_members m join auth.users u on u.id=m.user_id
    where m.project_id=target and m.role='owner' and u.deleted_at is null);
$$;
revoke all on function public.builder_privacy_operator_needed(text) from public,anon,authenticated,service_role;

create function public.builder_privacy_projects(actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception using errcode='42501',message='An active account is required';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from builder_projects p join builder_project_members m on m.project_id=p.id where m.user_id=actor),'[]'::jsonb);
end;
$$;
create function public.builder_privacy_request(actor uuid, target text, request_kind text, request_details text, request_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior builder_privacy_requests%rowtype; person auth.users%rowtype; website text;
begin
  select * into person from auth.users where id=actor and deleted_at is null;
  if not found then raise exception using errcode='42501',message='An active account is required'; end if;
  if request_id is null or request_kind is null or request_kind not in ('export','erasure') or request_details is null
    or length(trim(request_details)) not between 1 and 1000 or request_details ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then
    raise exception using errcode='22023',message='Choose a request type and add up to 1000 characters of detail';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-privacy:'||actor::text,0));
  select * into prior from builder_privacy_requests where id=request_id;
  if found then
    if prior.user_id is distinct from actor or prior.project_id is distinct from target or prior.kind<>request_kind or prior.details<>trim(request_details) then
      raise exception using errcode='40001',message='This request identity already records different information';
    end if;
    return prior.id;
  end if;
  if target is not null then
    select name into website from builder_projects where id=target for update;
    if not found or not exists(select 1 from builder_project_members where project_id=target and user_id=actor) then
      raise exception using errcode='42501',message='Current website access is required';
    end if;
  end if;
  if (select count(*) from builder_privacy_requests where user_id=actor and requested_at>now()-interval '1 day')>=20 then
    raise exception using errcode='P0429',message='Too many requests; contact the privacy address if you need help';
  end if;
  insert into builder_privacy_requests(id,user_id,project_id,project_name,requester_name,requester_email,kind,details)
    values(request_id,actor,target,website,left(coalesce(person.raw_user_meta_data->>'full_name',person.raw_user_meta_data->>'name',''),200),
    left(coalesce(person.email,''),254),request_kind,trim(request_details));
  return request_id;
end;
$$;

create function public.builder_privacy_list(actor uuid, inbox boolean default false, before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare anchor_time timestamptz; result jsonb; next_id uuid;
begin
  if actor is not null and not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception using errcode='42501',message='An active account is required';
  end if;
  if actor is null and inbox is distinct from true then raise exception using errcode='42501',message='Operator inbox required'; end if;
  if before_id is not null then
    select requested_at into anchor_time from builder_privacy_requests r where r.id=before_id and
      case when actor is null then builder_privacy_operator_needed(r.project_id)
      when inbox then exists(select 1 from builder_project_members where project_id=r.project_id and user_id=actor and role='owner')
      else r.user_id=actor end;
    if not found then raise exception using errcode='42501',message='Request page unavailable'; end if;
  end if;
  with visible as (
    select r.* from builder_privacy_requests r where
      case when actor is null then builder_privacy_operator_needed(r.project_id)
      when inbox then exists(select 1 from builder_project_members where project_id=r.project_id and user_id=actor and role='owner')
      else r.user_id=actor end
      and (before_id is null or (r.requested_at,r.id)<(anchor_time,before_id))
    order by r.requested_at desc,r.id desc limit 51
  ), page as (select * from visible order by requested_at desc,id desc limit 50)
  select coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'projectId',r.project_id,'projectName',r.project_name,
    'name',r.requester_name,'email',r.requester_email,'kind',r.kind,'details',r.details,'status',r.status,'version',r.version,
    'requestedAt',r.requested_at,'response',r.response,'updatedAt',r.updated_at,'needsOperator',builder_privacy_operator_needed(r.project_id))
    order by r.requested_at desc,r.id desc) from page r),'[]'::jsonb),
    case when (select count(*) from visible)>50 then (select id from page order by requested_at,id limit 1) else null end
    into result,next_id;
  return jsonb_build_object('items',result,'nextCursor',next_id);
end;
$$;
create function public.builder_privacy_update(actor uuid, request_id uuid, expected_version integer, next_status text, owner_response text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_privacy_requests%rowtype; target text;
begin
  if actor is not null and not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception using errcode='42501',message='An active account is required';
  end if;
  select project_id into target from builder_privacy_requests where id=request_id;
  if target is not null then perform 1 from builder_projects where id=target for update; end if;
  select * into item from builder_privacy_requests where id=request_id for update;
  if not found then raise exception using errcode='42501',message='Request unavailable'; end if;
  if next_status='cancelled' then
    if actor is null or item.user_id is distinct from actor then raise exception using errcode='42501',message='Only the requester can cancel'; end if;
  elsif next_status in ('in_review','fulfilled','declined') then
    if actor is null then
      if not builder_privacy_operator_needed(item.project_id) then raise exception using errcode='42501',message='Current website owner review is required'; end if;
    elsif not exists(select 1 from builder_project_members where project_id=item.project_id and user_id=actor and role='owner') then
      raise exception using errcode='42501',message='Current website owner review is required';
    end if;
    if owner_response is null or length(trim(owner_response)) not between 1 and 2000 or owner_response ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then
      raise exception using errcode='22023',message='Record a short response without private data or download links';
    end if;
  else raise exception using errcode='22023',message='Choose a request action'; end if;
  if item.version is distinct from expected_version or item.status not in ('open','in_review') then
    raise exception using errcode='40001',message='This request changed; refresh before responding';
  end if;
  update builder_privacy_requests set status=next_status,version=version+1,updated_at=clock_timestamp(),
    response=case when next_status='cancelled' then response else trim(owner_response) end,
    reviewed_by=case when next_status='cancelled' then reviewed_by else actor end,
    closed_at=case when next_status in ('fulfilled','declined','cancelled') then clock_timestamp() else null end
    where id=request_id;
end;
$$;
create function public.builder_prune_privacy_records() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from builder_privacy_requests where closed_at<now()-interval '2 years' and not retention_hold;
  delete from builder_legal_acceptances a using auth.users u where a.user_id=u.id and u.deleted_at<now()-interval '2 years' and not a.retention_hold;
end;
$$;
revoke all on function public.builder_legal_state(uuid),public.builder_legal_accept(uuid,text,text,text,boolean),
 public.builder_privacy_projects(uuid),public.builder_privacy_request(uuid,text,text,text,uuid),public.builder_privacy_list(uuid,boolean,uuid),
 public.builder_privacy_update(uuid,uuid,integer,text,text),public.builder_prune_privacy_records() from public,anon,authenticated;
grant execute on function public.builder_legal_state(uuid),public.builder_legal_accept(uuid,text,text,text,boolean),
 public.builder_privacy_projects(uuid),public.builder_privacy_request(uuid,text,text,text,uuid),public.builder_privacy_list(uuid,boolean,uuid),
 public.builder_privacy_update(uuid,uuid,integer,text,text),public.builder_prune_privacy_records() to service_role;
