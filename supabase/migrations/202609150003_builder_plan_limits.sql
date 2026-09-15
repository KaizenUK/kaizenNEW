-- Durable account usage, including archived websites. Browser storage and
-- request-time estimates are never the authority for a quota decision.
alter table public.builder_billing_accounts
  add column project_count integer not null default 0 check(project_count>=0),
  add column registered_bytes bigint not null default 0 check(registered_bytes>=0);
create table public.builder_project_billing (
  project_id text primary key references public.builder_projects(id) on delete cascade,
  user_id uuid not null references public.builder_billing_accounts(user_id),
  page_count integer not null default 0 check(page_count>=0),
  registered_bytes bigint not null default 0 check(registered_bytes>=0)
);
create index builder_project_billing_account on public.builder_project_billing(user_id);
create table public.builder_billing_months (
  user_id uuid not null references public.builder_billing_accounts(user_id),
  month date not null check(extract(day from month)=1),
  publications integer not null default 0 check(publications>=0),
  primary key(user_id,month)
);
create table public.builder_publication_allowances (
  kind text not null check(kind in ('client','legacy')),
  job_id uuid not null,
  project_id text not null references public.builder_projects(id),
  user_id uuid not null references public.builder_billing_accounts(user_id),
  month date not null,
  state text not null check(state in ('reserved','consumed','returned')),
  primary key(kind,job_id),
  foreign key(user_id,month) references public.builder_billing_months(user_id,month)
);
alter table public.builder_project_billing enable row level security;
alter table public.builder_billing_months enable row level security;
alter table public.builder_publication_allowances enable row level security;
revoke all on public.builder_project_billing,public.builder_billing_months,public.builder_publication_allowances from public,anon,authenticated,service_role;

create function public.builder_workspace_usage(workspace jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare item jsonb; bytes bigint:=0;
begin
  if jsonb_typeof(workspace->'pages') is distinct from 'array' or jsonb_typeof(workspace->'assets') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid workspace usage';
  end if;
  for item in select value from jsonb_array_elements(workspace->'assets') loop
    if jsonb_typeof(item->'size') is distinct from 'number' or item->>'size' !~ '^[0-9]{1,15}$' then
      raise exception using errcode='22023',message='Invalid asset size';
    end if;
    bytes:=bytes+(item->>'size')::bigint;
  end loop;
  return jsonb_build_object('pages',jsonb_array_length(workspace->'pages'),'bytes',bytes);
end;
$$;

-- Backfill existing beta projects without applying a new growth limit to their
-- saved data. New assignments below must pass all current plan checks.
insert into public.builder_project_billing(project_id,user_id,page_count,registered_bytes)
  select distinct on(p.id) p.id,m.user_id,
    coalesce((u.usage->>'pages')::integer,0),coalesce((u.usage->>'bytes')::bigint,0)
  from public.builder_projects p join public.builder_project_members m on m.project_id=p.id and m.role='owner'
  left join lateral(select case when p.id='kaizen' then jsonb_build_object(
    'pages',coalesce((select jsonb_agg(payload) from public.builder_pages),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(payload) from public.builder_assets),'[]'::jsonb)) else
    (select payload from public.builder_project_workspaces where project_id=p.id) end as payload) w on true
  left join lateral(select public.builder_workspace_usage(coalesce(w.payload,'{"pages":[],"assets":[]}'::jsonb)) as usage) u on true
  order by p.id,m.user_id;
update public.builder_billing_accounts a set project_count=u.projects,registered_bytes=u.bytes
  from (select user_id,count(*)::integer as projects,sum(registered_bytes)::bigint as bytes from public.builder_project_billing group by user_id) u
  where a.user_id=u.user_id;

create function public.builder_billing_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_account uuid; next_account uuid; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; previous_bytes bigint:=0; previous_pages integer:=0; added_projects integer:=1;
begin
  if tg_op<>'INSERT' then old_account:=old.user_id; end if;
  if tg_op<>'DELETE' then next_account:=new.user_id; end if;
  -- A deterministic lock order also makes two simultaneous billing transfers
  -- between the same accounts safe. Counters change under these row locks.
  perform 1 from builder_billing_accounts where user_id in (old_account,next_account) order by user_id for update;
  if tg_op='DELETE' then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes where user_id=old_account;
    return old;
  end if;
  select * into account from builder_billing_accounts where user_id=next_account;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  selected:=builder_billing_plan(next_account);
  if tg_op='UPDATE' and old_account=next_account then
    previous_bytes:=old.registered_bytes; previous_pages:=old.page_count; added_projects:=0;
  end if;
  if added_projects=1 and account.project_count+1>selected.projects then
    raise exception using errcode='P0429',message='Your website limit is reached. Upgrade your plan or move a website to another billing owner. Archived websites also count';
  end if;
  -- A downgrade does not destroy data or prevent editing existing pages. Only
  -- increases beyond the current allowance are refused during a draft save.
  if new.page_count>selected.pages_per_project and (added_projects=1 or new.page_count>previous_pages) then
    raise exception using errcode='P0429',message='This website has reached its page limit. Remove a page or ask the billing owner to upgrade';
  end if;
  if account.registered_bytes-previous_bytes+new.registered_bytes>selected.storage_bytes and (added_projects=1 or new.registered_bytes>previous_bytes) then
    raise exception using errcode='P0429',message='The billing account has reached its storage limit. Remove unused files or ask the billing owner to upgrade';
  end if;
  if tg_op='UPDATE' and old_account<>next_account then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes where user_id=old_account;
  end if;
  update builder_billing_accounts set project_count=project_count+added_projects,registered_bytes=registered_bytes-previous_bytes+new.registered_bytes where user_id=next_account;
  return new;
end;
$$;
create trigger builder_billing_usage_guard before insert or update or delete on public.builder_project_billing for each row execute function public.builder_billing_usage_guard();

create function public.builder_initial_billing_owner() returns trigger
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
  insert into builder_project_billing(project_id,user_id,page_count,registered_bytes)
    values(new.project_id,new.user_id,coalesce((usage->>'pages')::integer,0),coalesce((usage->>'bytes')::bigint,0));
  return new;
end;
$$;
create trigger builder_initial_billing_owner after insert or update on public.builder_project_members for each row execute function public.builder_initial_billing_owner();

create function public.builder_keep_billing_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.project_id=old.project_id and new.user_id=old.user_id and new.role='owner' then return new; end if;
  if exists(select 1 from builder_project_billing b join builder_projects p on p.id=b.project_id where b.project_id=old.project_id and b.user_id=old.user_id) then
    raise exception using errcode='P0409',message='Another owner must take over website billing before this owner can leave';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger builder_keep_billing_owner before update or delete on public.builder_project_members for each row execute function public.builder_keep_billing_owner();

create function public.builder_take_project_billing(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=target for update;
  if not exists(select 1 from builder_project_members where project_id=target and user_id=actor and role='owner') then
    raise exception using errcode='P0403',message='Only a website owner can take over its billing';
  end if;
  if exists(select 1 from builder_project_billing where project_id=target and user_id=actor) then return; end if;
  if exists(select 1 from builder_client_jobs where project_id=target and phase in ('queued','building','activating','verifying','recovery_required'))
    or (target='kaizen' and exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required'))) then
    raise exception using errcode='P0409',message='Finish the pending publication or recovery before changing website billing';
  end if;
  perform builder_billing_account(actor);
  update builder_project_billing set user_id=actor where project_id=target;
  if not found then raise exception using errcode='P0409',message='The website billing record needs to be checked'; end if;
end;
$$;

create function public.builder_workspace_limit_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare usage jsonb;
begin
  perform 1 from builder_projects where id=new.project_id for update;
  -- The original site's separate tables are authoritative; its compatibility
  -- workspace must not reset or replace their usage counters.
  if new.project_id='kaizen' then return new; end if;
  usage:=builder_workspace_usage(new.payload);
  update builder_project_billing set page_count=(usage->>'pages')::integer,registered_bytes=(usage->>'bytes')::bigint where project_id=new.project_id;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  return new;
end;
$$;
create trigger builder_workspace_limit_guard before insert or update of payload on public.builder_project_workspaces for each row execute function public.builder_workspace_limit_guard();

create function public.builder_legacy_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare usage jsonb;
begin
  perform 1 from builder_projects where id='kaizen' for update;
  usage:=builder_workspace_usage(jsonb_build_object('pages',coalesce((select jsonb_agg(payload) from builder_pages),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(payload) from builder_assets),'[]'::jsonb)));
  update builder_project_billing set page_count=(usage->>'pages')::integer,registered_bytes=(usage->>'bytes')::bigint where project_id='kaizen';
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  return null;
end;
$$;
create trigger builder_legacy_page_usage after insert or update or delete on public.builder_pages for each statement execute function public.builder_legacy_usage_guard();
create trigger builder_legacy_asset_usage after insert or update or delete on public.builder_assets for each statement execute function public.builder_legacy_usage_guard();

create function public.builder_project_plan_check(target text, candidate jsonb default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare billing builder_project_billing%rowtype; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; usage jsonb;
begin
  perform 1 from builder_projects where id=target for update;
  select * into billing from builder_project_billing where project_id=target;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before publishing'; end if;
  select * into account from builder_billing_accounts where user_id=billing.user_id for update;
  if not exists(select 1 from auth.users where id=billing.user_id and deleted_at is null) then
    raise exception using errcode='P0409',message='An active billing owner is required before publishing';
  end if;
  selected:=builder_billing_plan(billing.user_id);
  if account.project_count>selected.projects or billing.page_count>selected.pages_per_project or account.registered_bytes>selected.storage_bytes then
    raise exception using errcode='P0429',message='This website exceeds its current plan. Ask the billing owner to reduce usage or upgrade before publishing';
  end if;
  if candidate is not null then
    usage:=builder_workspace_usage(candidate);
    if (usage->>'pages')::integer>selected.pages_per_project or (usage->>'bytes')::bigint>selected.storage_bytes then
      raise exception using errcode='P0429',message='The reviewed publication exceeds its current plan. Review a smaller website or ask the billing owner to upgrade';
    end if;
  end if;
  return billing.user_id;
end;
$$;

create function public.builder_reserve_publication(allowance_kind text, request_id uuid, target text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid; selected builder_plans%rowtype; period date:=date_trunc('month',clock_timestamp() at time zone 'UTC')::date; reserved integer;
begin
  account:=builder_project_plan_check(target);
  if exists(select 1 from builder_publication_allowances where kind=allowance_kind and job_id=request_id) then return; end if;
  selected:=builder_billing_plan(account);
  insert into builder_billing_months(user_id,month) values(account,period) on conflict do nothing;
  update builder_billing_months set publications=publications+1 where user_id=account and month=period and publications<selected.publishes_per_month returning publications into reserved;
  if not found then raise exception using errcode='P0429',message='The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month'; end if;
  insert into builder_publication_allowances(kind,job_id,project_id,user_id,month,state) values(allowance_kind,request_id,target,account,period,'reserved');
end;
$$;

create function public.builder_settle_publication(allowance_kind text, request_id uuid, next_phase text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare allowance builder_publication_allowances%rowtype;
begin
  select * into allowance from builder_publication_allowances where kind=allowance_kind and job_id=request_id for update;
  if not found then return; end if;
  if next_phase='live' and allowance.state<>'consumed' then
    -- Explicit operator recovery may restore a previously failed artifact.
    -- Account for it in its original month without blocking disaster recovery.
    if allowance.state='returned' then update builder_billing_months set publications=publications+1 where user_id=allowance.user_id and month=allowance.month; end if;
    update builder_publication_allowances set state='consumed' where kind=allowance_kind and job_id=request_id;
  elsif next_phase in ('failed','rolled_back') and allowance.state='reserved' then
    update builder_billing_months set publications=publications-1 where user_id=allowance.user_id and month=allowance.month;
    update builder_publication_allowances set state='returned' where kind=allowance_kind and job_id=request_id;
  end if;
end;
$$;

create function public.builder_client_plan_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=new.project_id for update;
  -- Rollback and removal remain available even after a downgrade or exhaustion.
  if new.action<>'publish' then return new; end if;
  if tg_op='INSERT' then
    perform builder_project_plan_check(new.project_id,new.snapshot->'workspace');
    perform builder_reserve_publication('client',new.id,new.project_id);
  elsif old.phase in ('queued','building') and new.phase in ('building','activating') then perform builder_project_plan_check(new.project_id,new.snapshot->'workspace'); end if;
  perform builder_settle_publication('client',new.id,new.phase);
  return new;
end;
$$;
create trigger builder_client_plan_guard before insert or update of phase on public.builder_client_jobs for each row execute function public.builder_client_plan_guard();

create function public.builder_legacy_plan_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Operator application deployments are not customer publishing requests.
  if new.requested_by is null or new.rollback_of is not null or new.request->>'action'='unpublish' then return new; end if;
  if tg_op='INSERT' then
    perform builder_project_plan_check('kaizen',jsonb_build_object('pages',new.snapshot->'pages','assets','[]'::jsonb));
    perform builder_reserve_publication('legacy',new.id,'kaizen');
  elsif old.status in ('queued','building') and new.status in ('building','activating') then
    perform builder_project_plan_check('kaizen',jsonb_build_object('pages',new.snapshot->'pages','assets','[]'::jsonb));
  end if;
  perform builder_settle_publication('legacy',new.id,new.status);
  return new;
end;
$$;
create trigger builder_legacy_plan_guard before insert or update of status on public.builder_releases for each row execute function public.builder_legacy_plan_guard();

create function public.builder_project_billing_summary(target text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare billing builder_project_billing%rowtype; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; member_role text;
begin
  select role into member_role from builder_project_members where project_id=target and user_id=actor;
  if not found then raise exception using errcode='P0403',message='Website membership required'; end if;
  select * into billing from builder_project_billing where project_id=target;
  if not found then raise exception using errcode='P0409',message='The website billing record needs to be checked'; end if;
  select * into account from builder_billing_accounts where user_id=billing.user_id;
  selected:=builder_billing_plan(billing.user_id);
  return jsonb_build_object('isBillingOwner',billing.user_id=actor,'canTakeBilling',member_role='owner' and billing.user_id<>actor,
    'plan',to_jsonb(selected),'pages',billing.page_count,'registeredBytes',billing.registered_bytes,
    'accountUsage',case when billing.user_id=actor then jsonb_build_object('projects',account.project_count,'registeredBytes',account.registered_bytes,
      'publications',coalesce((select publications from builder_billing_months where user_id=billing.user_id and month=date_trunc('month',clock_timestamp() at time zone 'UTC')::date),0)) else null end);
end;
$$;

revoke all on function public.builder_workspace_usage(jsonb),public.builder_billing_usage_guard(),public.builder_initial_billing_owner(),public.builder_keep_billing_owner(),
  public.builder_take_project_billing(text,uuid),public.builder_workspace_limit_guard(),public.builder_legacy_usage_guard(),public.builder_project_plan_check(text,jsonb),public.builder_reserve_publication(text,uuid,text),
  public.builder_settle_publication(text,uuid,text),public.builder_client_plan_guard(),public.builder_legacy_plan_guard(),public.builder_project_billing_summary(text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_take_project_billing(text,uuid),public.builder_project_billing_summary(text,uuid) to service_role;
