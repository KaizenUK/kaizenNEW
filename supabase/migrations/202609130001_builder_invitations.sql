-- An Auth invitation and a membership write cannot share a transaction. The
-- version below prevents a delayed response from restoring access removed meanwhile.
alter table public.builder_projects add column access_version integer not null default 1;

create function public.builder_membership_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' then
    update builder_projects set access_version=access_version+1 where id=old.project_id;
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.project_id<>old.project_id) then
    update builder_projects set access_version=access_version+1 where id=new.project_id;
  end if;
  return null;
end;
$$;
revoke all on function public.builder_membership_changed() from public,anon,authenticated,service_role;
create trigger builder_membership_version after insert or update or delete on public.builder_project_members
for each row execute function public.builder_membership_changed();

-- A single bounded counter per project; it stores no recipient addresses or tokens.
create table public.builder_invitation_limits (
  project_id text primary key references public.builder_projects(id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 20)
);
alter table public.builder_invitation_limits enable row level security;
revoke all on public.builder_invitation_limits from public,anon,authenticated,service_role;

create function public.builder_member_directory(target text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from builder_projects p join builder_project_members m on m.project_id=p.id
    where p.id=target and m.user_id=auth.uid() and m.role='owner' and not p.archived)
  then raise exception 'Project owner access required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'user_id',m.user_id,'email',u.email,
    'name',left(regexp_replace(coalesce(
      case when jsonb_typeof(u.raw_user_meta_data->'full_name')='string' then u.raw_user_meta_data->>'full_name' end,
      case when jsonb_typeof(u.raw_user_meta_data->'name')='string' then u.raw_user_meta_data->>'name' end,''),
      '[[:cntrl:]]',' ','g'),200),
    'role',m.role,'can_publish',m.can_publish,
    'invitation_state',case when u.email_confirmed_at is null then 'invited'
      when u.raw_user_meta_data->'builder_password_set'='false'::jsonb then 'setup' else 'active' end
  ) order by lower(u.email),m.user_id)
  from builder_project_members m join auth.users u on u.id=m.user_id
  where m.project_id=target),'[]'::jsonb);
end;
$$;
revoke all on function public.builder_member_directory(text) from public,anon,authenticated,service_role;
grant execute on function public.builder_member_directory(text) to authenticated;

create function public.builder_prepare_invitation(target text, actor uuid, address text default null, member_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare account auth.users%rowtype; project_version integer; matches integer; chosen_email text; window_time timestamptz:=date_trunc('hour',now());
begin
  select access_version into project_version from builder_projects where id=target for update;
  if not exists(select 1 from builder_projects p join builder_project_members m on m.project_id=p.id
    where p.id=target and m.user_id=actor and m.role='owner' and not p.archived)
  then raise exception 'Project owner access required' using errcode='42501'; end if;
  if (address is null)=(member_id is null) then
    raise exception 'Choose an email address or an existing member' using errcode='22023';
  end if;
  if member_id is not null then
    select u.* into account from builder_project_members m join auth.users u on u.id=m.user_id
      where m.project_id=target and m.user_id=member_id and u.deleted_at is null;
    if not found then raise exception 'Project member not found' using errcode='42501'; end if;
    chosen_email:=lower(trim(account.email));
  else
    chosen_email:=lower(trim(address));
    if length(chosen_email) not between 3 and 254 or chosen_email !~ '^[^[:space:]<>@[:cntrl:]]+@[^[:space:]<>@[:cntrl:]]+\.[^[:space:]<>@[:cntrl:]]+$' then
      raise exception 'Use a valid email address' using errcode='22023';
    end if;
    select count(*) into matches from auth.users where lower(email)=chosen_email and deleted_at is null;
    if matches>1 then raise exception 'Account needs an operator check' using errcode='40001'; end if;
    select * into account from auth.users where lower(email)=chosen_email and deleted_at is null;
  end if;
  insert into builder_invitation_limits(project_id,window_start,attempts) values(target,window_time,1)
    on conflict(project_id) do update set window_start=excluded.window_start,
      attempts=case when builder_invitation_limits.window_start=excluded.window_start then builder_invitation_limits.attempts+1 else 1 end
    where builder_invitation_limits.window_start<>excluded.window_start or builder_invitation_limits.attempts<20;
  if not found then raise exception 'Invitation limit reached' using errcode='P0429'; end if;
  return jsonb_build_object('email',chosen_email,'accountId',account.id,
    'confirmed',account.email_confirmed_at is not null,
    'alreadyMember',exists(select 1 from builder_project_members where project_id=target and user_id=account.id),
    'version',project_version);
end;
$$;
revoke all on function public.builder_prepare_invitation(text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.builder_prepare_invitation(text,uuid,text,uuid) to service_role;

create function public.builder_complete_invitation(target text, actor uuid, address text, member_id uuid,
  expected_access_version integer, add_member boolean, member_role text, publish_permission boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare project_version integer;
begin
  select access_version into project_version from builder_projects where id=target for update;
  if not exists(select 1 from builder_projects p join builder_project_members m on m.project_id=p.id
    where p.id=target and m.user_id=actor and m.role='owner' and not p.archived)
  then raise exception 'Project owner access required' using errcode='42501'; end if;
  if project_version is distinct from expected_access_version then
    raise exception 'Project access changed. Refresh before inviting again' using errcode='40001';
  end if;
  if not exists(select 1 from auth.users where id=member_id and lower(email)=address and deleted_at is null) then
    raise exception 'The invited account changed' using errcode='40001';
  end if;
  if add_member is true then
    if member_role is null or member_role not in ('owner','editor') or publish_permission is null then
      raise exception 'Choose valid project access' using errcode='22023';
    end if;
    -- Inviting never edits an existing person's permissions or demotes the last owner.
    insert into builder_project_members(project_id,user_id,role,can_publish)
      values(target,member_id,member_role,publish_permission) on conflict(project_id,user_id) do nothing;
    return found;
  end if;
  if add_member is null or not exists(select 1 from builder_project_members where project_id=target and user_id=member_id) then
    raise exception 'Project member not found' using errcode='42501';
  end if;
  return false;
end;
$$;
revoke all on function public.builder_complete_invitation(text,uuid,text,uuid,integer,boolean,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.builder_complete_invitation(text,uuid,text,uuid,integer,boolean,text,boolean) to service_role;
