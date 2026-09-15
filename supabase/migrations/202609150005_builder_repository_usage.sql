-- Trusted source and rendered-output measurements share the account's storage
-- allowance. Preview/staging/production are copies of one website: bill the
-- largest current output, plus its source and registered managed assets. Retained
-- recovery copies/dependencies remain operational storage, bounded separately.
alter table public.builder_billing_accounts add column repository_bytes bigint not null default 0 check(repository_bytes>=0);
alter table public.builder_project_billing
  add column repository_usage jsonb not null default '{}'::jsonb check(jsonb_typeof(repository_usage)='object'),
  add column repository_revision integer not null default 0 check(repository_revision>=0),
  add column repository_bytes bigint not null default 0 check(repository_bytes>=0),
  add column repository_pages integer not null default 0 check(repository_pages>=0);

create function public.builder_repository_usage_access(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=target and not archived for update;
  if not found then raise exception using errcode='P0403',message='An active website is required to check storage'; end if;
  -- Only the private release worker may omit actor; the Edge handler always
  -- supplies verified Auth and never accepts a caller-selected actor.
  if actor is not null and (not exists(select 1 from builder_project_members m join auth.users u on u.id=m.user_id
    where m.project_id=target and m.user_id=actor and m.role in ('owner','editor') and u.deleted_at is null and u.email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed'))) then
    raise exception using errcode='P0403',message='Current website editing permission is required';
  end if;
end;
$$;

create function public.builder_repository_usage_read(target text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_billing%rowtype;
begin
  perform builder_repository_usage_access(target,actor);
  select * into item from builder_project_billing where project_id=target;
  if not found then raise exception using errcode='P0409',message='Set up the website billing owner before saving'; end if;
  return jsonb_build_object('version',item.repository_revision,'measurements',item.repository_usage);
end;
$$;

create function public.builder_repository_usage_write(target text, actor uuid, expected_version integer, channel text, sample jsonb, operation text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_billing%rowtype; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; next_usage jsonb; next_bytes bigint; next_pages integer;
begin
  perform builder_repository_usage_access(target,actor);
  if expected_version is null or expected_version<0 or channel is null or channel not in ('source','preview','staging','production') or operation is null or operation not in ('observe','reserve','publish')
    or jsonb_typeof(sample) is distinct from 'object' then raise exception using errcode='22023',message='Invalid repository usage measurement'; end if;
  if jsonb_typeof(sample->'bytes') is distinct from 'number' or sample->>'bytes' !~ '^[0-9]{1,13}$' or (sample->>'bytes')::bigint>1099511627776
    or jsonb_typeof(sample->'revision') is distinct from 'string' or sample->>'revision' !~ '^([a-f0-9]{40}|[a-f0-9]{64})$'
    or (channel='source' and sample ? 'pages')
    or (channel<>'source' and (jsonb_typeof(sample->'pages') is distinct from 'number' or sample->>'pages' !~ '^[0-9]{1,6}$' or (sample->>'pages')::integer>100000))
    or exists(select 1 from jsonb_object_keys(sample) as k where k not in ('bytes','pages','revision')) then
    raise exception using errcode='22023',message='Invalid repository usage measurement';
  end if;
  select * into item from builder_project_billing where project_id=target for update;
  if not found or item.repository_revision<>expected_version then
    raise exception using errcode='P0409',message='Website storage changed. Refresh it before retrying';
  end if;
  select * into account from builder_billing_accounts where user_id=item.user_id for update;
  selected:=builder_billing_plan(item.user_id);
  next_usage:=jsonb_set(item.repository_usage,array[channel],sample,true);
  next_bytes:=coalesce((next_usage->'source'->>'bytes')::bigint,0)+greatest(coalesce((next_usage->'preview'->>'bytes')::bigint,0),
    coalesce((next_usage->'staging'->>'bytes')::bigint,0),coalesce((next_usage->'production'->>'bytes')::bigint,0));
  next_pages:=greatest(coalesce((next_usage->'preview'->>'pages')::integer,0),coalesce((next_usage->'staging'->>'pages')::integer,0),coalesce((next_usage->'production'->>'pages')::integer,0));
  if operation<>'observe' and (
    (greatest(item.page_count,next_pages)>selected.pages_per_project and (operation='publish' or next_pages>item.repository_pages)) or
    (account.registered_bytes+account.repository_bytes-item.repository_bytes+next_bytes>selected.storage_bytes and (operation='publish' or next_bytes>item.repository_bytes)) or
    (operation='publish' and account.project_count>selected.projects)) then
    raise exception using errcode='P0429',message='This website exceeds its current plan. Reduce its pages or files, or ask the billing owner to upgrade';
  end if;
  update builder_project_billing set repository_usage=next_usage,repository_revision=repository_revision+1 where project_id=target;
  return builder_repository_usage_read(target,actor);
end;
$$;

revoke all on function public.builder_repository_usage_access(text,uuid),public.builder_repository_usage_read(text,uuid),public.builder_repository_usage_write(text,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.builder_repository_usage_read(text,uuid),public.builder_repository_usage_write(text,uuid,integer,text,jsonb,text) to service_role;

-- Workspace edits and payer changes still enforce growth here. Only the private
-- measurement RPC changes repository_usage; it checks candidate growth itself,
-- and may also record already-existing physical usage after a downgrade/restart.
create or replace function public.builder_billing_usage_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_account uuid; next_account uuid; account builder_billing_accounts%rowtype; selected builder_plans%rowtype; previous_bytes bigint:=0; previous_repository_bytes bigint:=0; previous_pages integer:=0; added_projects integer:=1;
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
  new.repository_bytes:=coalesce((new.repository_usage->'source'->>'bytes')::bigint,0)+greatest(
    coalesce((new.repository_usage->'preview'->>'bytes')::bigint,0),coalesce((new.repository_usage->'staging'->>'bytes')::bigint,0),coalesce((new.repository_usage->'production'->>'bytes')::bigint,0));
  new.repository_pages:=greatest(coalesce((new.repository_usage->'preview'->>'pages')::integer,0),
    coalesce((new.repository_usage->'staging'->>'pages')::integer,0),coalesce((new.repository_usage->'production'->>'pages')::integer,0));
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
  if account.registered_bytes+account.repository_bytes-previous_bytes-previous_repository_bytes+new.registered_bytes+new.repository_bytes>selected.storage_bytes and (added_projects=1 or new.registered_bytes>previous_bytes) then
    raise exception using errcode='P0429',message='The billing account has reached its storage limit. Remove unused files or ask the billing owner to upgrade';
  end if;
  if tg_op='UPDATE' and old_account<>next_account then
    update builder_billing_accounts set project_count=project_count-1,registered_bytes=registered_bytes-old.registered_bytes,repository_bytes=repository_bytes-old.repository_bytes where user_id=old_account;
  end if;
  update builder_billing_accounts set project_count=project_count+added_projects,registered_bytes=registered_bytes-previous_bytes+new.registered_bytes,repository_bytes=repository_bytes-previous_repository_bytes+new.repository_bytes where user_id=next_account;
  return new;
end;
$$;

create or replace function public.builder_project_plan_check(target text, candidate jsonb default null) returns uuid
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
  if account.project_count>selected.projects or greatest(billing.page_count,billing.repository_pages)>selected.pages_per_project or account.registered_bytes+account.repository_bytes>selected.storage_bytes then
    raise exception using errcode='P0429',message='This website exceeds its current plan. Ask the billing owner to reduce usage or upgrade before publishing';
  end if;
  if candidate is not null then
    usage:=builder_workspace_usage(candidate);
    if (usage->>'pages')::integer>selected.pages_per_project
      or account.registered_bytes+account.repository_bytes+greatest(0,(usage->>'bytes')::bigint-billing.registered_bytes)>selected.storage_bytes then
      raise exception using errcode='P0429',message='The reviewed publication exceeds its current plan. Review a smaller website or ask the billing owner to upgrade';
    end if;
  end if;
  return billing.user_id;
end;
$$;


create or replace function public.builder_project_billing_summary(target text, actor uuid) returns jsonb
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
    'plan',to_jsonb(selected),'pages',greatest(billing.page_count,billing.repository_pages),'registeredBytes',billing.registered_bytes+billing.repository_bytes,
    'accountUsage',case when billing.user_id=actor then jsonb_build_object('projects',account.project_count,'registeredBytes',account.registered_bytes+account.repository_bytes,
      'publications',coalesce((select publications from builder_billing_months where user_id=billing.user_id and month=date_trunc('month',clock_timestamp() at time zone 'UTC')::date),0)) else null end);
end;
$$;
