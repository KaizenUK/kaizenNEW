-- Stripe identifiers and processing leases are private. The browser receives
-- an account-scoped summary through the JWT-verifying billing function only.
create table public.builder_plans (
  id text primary key check(id in ('free','plus','agency','beta')),
  name text not null,
  projects integer not null check(projects between 1 and 1000),
  pages_per_project integer not null check(pages_per_project between 1 and 10000),
  storage_bytes bigint not null check(storage_bytes > 0),
  publishes_per_month integer not null check(publishes_per_month > 0)
);
insert into public.builder_plans values
  ('free','Free',1,5,104857600,10),
  ('plus','Plus',3,50,2147483648,100),
  ('agency','Agency',20,200,21474836480,1000),
  ('beta','Private beta',100,1000,107374182400,10000);

create table public.builder_billing_accounts (
  user_id uuid primary key references auth.users(id),
  customer_id text unique check(customer_id ~ '^cus_[A-Za-z0-9]{1,120}$'),
  customer_attempt uuid not null unique default gen_random_uuid(),
  customer_attempt_at timestamptz,
  override_plan text references public.builder_plans(id) check(override_plan='beta'),
  sync_token uuid,
  sync_until timestamptz,
  sync_delivery text,
  verified_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check((sync_token is null) = (sync_until is null) and (sync_token is null) = (sync_delivery is null))
);
-- Preserve explicitly granted private-beta access without inventing a paid
-- subscription. New accounts always start on Free.
insert into public.builder_billing_accounts(user_id,override_plan)
  select distinct user_id,'beta' from public.builder_project_members where role='owner';

create table public.builder_subscriptions (
  id text primary key check(id ~ '^sub_[A-Za-z0-9]{1,120}$'),
  user_id uuid not null references public.builder_billing_accounts(user_id),
  status text not null check(status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  plan_id text references public.builder_plans(id) check(plan_id in ('plus','agency')),
  price_id text not null check(price_id ~ '^price_[A-Za-z0-9]{1,120}$'),
  period_end timestamptz not null,
  cancel_at_period_end boolean not null,
  verified_at timestamptz not null default clock_timestamp()
);
create index builder_subscriptions_account on public.builder_subscriptions(user_id);

create table public.builder_billing_events (
  id text primary key check(id ~ '^(evt_[A-Za-z0-9]{1,120}|refresh_[a-f0-9-]{36})$'),
  user_id uuid not null references public.builder_billing_accounts(user_id),
  customer_id text not null,
  kind text not null check(kind in ('customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed','checkout.session.expired','refresh')),
  received_at timestamptz not null default clock_timestamp(),
  processed_at timestamptz
);
create index builder_billing_events_retention on public.builder_billing_events(processed_at);

create table public.builder_billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.builder_billing_accounts(user_id),
  plan_id text not null references public.builder_plans(id) check(plan_id in ('plus','agency')),
  price_id text not null check(price_id ~ '^price_[A-Za-z0-9]{1,120}$'),
  session_id text unique check(session_id ~ '^cs_[A-Za-z0-9_]{1,160}$'),
  state text not null default 'pending' check(state in ('pending','open','complete','expired')),
  expires_at timestamptz not null default clock_timestamp()+interval '1 hour',
  created_at timestamptz not null default clock_timestamp()
);
create unique index builder_billing_one_checkout on public.builder_billing_checkouts(user_id) where state in ('pending','open');

alter table public.builder_plans enable row level security;
alter table public.builder_billing_accounts enable row level security;
alter table public.builder_subscriptions enable row level security;
alter table public.builder_billing_events enable row level security;
alter table public.builder_billing_checkouts enable row level security;
revoke all on public.builder_plans,public.builder_billing_accounts,public.builder_subscriptions,public.builder_billing_events,public.builder_billing_checkouts from public,anon,authenticated,service_role;

create function public.builder_billing_account(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype;
begin
  -- Keep deletion, customer creation and Checkout under the account lock used
  -- by the existing account-removal workflow.
  perform pg_advisory_xact_lock(hashtextextended('builder-account:'||actor::text,0));
  perform 1 from auth.users where id=actor and deleted_at is null and email_confirmed_at is not null and nullif(email,'') is not null for share;
  if not found then raise exception using errcode='P0401',message='A confirmed, active account is required'; end if;
  if exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0409',message='Account deletion has started';
  end if;
  insert into builder_billing_accounts(user_id) values(actor) on conflict do nothing;
  select * into account from builder_billing_accounts where user_id=actor;
  return to_jsonb(account);
end;
$$;

create function public.builder_billing_bind_customer(actor uuid, stripe_customer text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing_customer text;
begin
  perform builder_billing_account(actor);
  select customer_id into existing_customer from builder_billing_accounts where user_id=actor for update;
  if stripe_customer is null or stripe_customer !~ '^cus_[A-Za-z0-9]{1,120}$' then raise exception using errcode='22023',message='Invalid billing customer'; end if;
  if existing_customer is not null and existing_customer<>stripe_customer then raise exception using errcode='P0409',message='Billing customer already linked'; end if;
  update builder_billing_accounts set customer_id=stripe_customer where user_id=actor;
end;
$$;

create function public.builder_billing_customer_begin(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype;
begin
  perform builder_billing_account(actor);
  update builder_billing_accounts set customer_attempt_at=coalesce(customer_attempt_at,clock_timestamp()) where user_id=actor returning * into account;
  return to_jsonb(account);
end;
$$;

create function public.builder_billing_plan(actor uuid) returns public.builder_plans
language sql stable security definer set search_path=public,pg_temp as $$
  select p.* from builder_plans p where p.id=coalesce(
    (select override_plan from builder_billing_accounts where user_id=actor),
    (select s.plan_id from builder_subscriptions s where s.user_id=actor and s.status in ('active','trialing') and s.period_end>statement_timestamp()
      and s.plan_id is not null order by case s.plan_id when 'agency' then 2 else 1 end desc,s.id limit 1),'free');
$$;

-- Serialize all provider reads for the same customer. Event timestamps are not
-- used for ordering: they are not a total order and deliveries can be delayed.
-- Only a current lease may commit the subsequently fetched provider snapshot.
create function public.builder_billing_claim(stripe_customer text, delivery_id text, delivery_kind text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype; event builder_billing_events%rowtype; lease uuid:=gen_random_uuid();
begin
  select * into account from builder_billing_accounts where customer_id=stripe_customer for update;
  if not found then return jsonb_build_object('status','unrelated'); end if;
  insert into builder_billing_events(id,user_id,customer_id,kind) values(delivery_id,account.user_id,stripe_customer,delivery_kind) on conflict do nothing;
  select * into event from builder_billing_events where id=delivery_id;
  if event.user_id<>account.user_id or event.customer_id<>stripe_customer or event.kind<>delivery_kind then
    raise exception using errcode='P0409',message='Billing event identity changed';
  end if;
  if event.processed_at is not null then return jsonb_build_object('status','done'); end if;
  if account.sync_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  update builder_billing_accounts set sync_token=lease,sync_until=clock_timestamp()+interval '90 seconds',sync_delivery=delivery_id where user_id=account.user_id;
  return jsonb_build_object('status','claimed','accountId',account.user_id,'token',lease,
    'pendingCheckout',(select to_jsonb(c) from builder_billing_checkouts c where c.user_id=account.user_id and c.state in ('pending','open')));
end;
$$;

create function public.builder_billing_finish(actor uuid, stripe_customer text, lease uuid, delivery_id text, subscriptions jsonb, checkouts jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype; item jsonb;
begin
  select * into account from builder_billing_accounts where user_id=actor for update;
  if not found or account.customer_id is distinct from stripe_customer or account.sync_token is distinct from lease or lease is null or account.sync_until<=clock_timestamp() or account.sync_delivery is distinct from delivery_id then
    raise exception using errcode='P0409',message='Billing refresh expired; retry with a fresh provider read';
  end if;
  if not exists(select 1 from builder_billing_events where id=delivery_id and user_id=actor and customer_id=stripe_customer and processed_at is null) then
    raise exception using errcode='P0409',message='Billing delivery unavailable';
  end if;
  if jsonb_typeof(subscriptions) is distinct from 'array' or jsonb_array_length(subscriptions)>100 or jsonb_typeof(checkouts) is distinct from 'array' or jsonb_array_length(checkouts)>100 then
    raise exception using errcode='22023',message='Invalid billing snapshot';
  end if;
  -- Validate ownership before deleting old rows, including IDs known to another
  -- account. The entire reconciliation commits or rolls back atomically.
  if exists(select 1 from jsonb_array_elements(subscriptions) s join builder_subscriptions b on b.id=s->>'id' where b.user_id<>actor)
    or (select count(*)<>count(distinct s->>'id') from jsonb_array_elements(subscriptions) s) then
    raise exception using errcode='P0409',message='Subscription identity changed';
  end if;
  delete from builder_subscriptions where user_id=actor;
  for item in select value from jsonb_array_elements(subscriptions) loop
    if item->>'customerId' is distinct from stripe_customer then raise exception using errcode='22023',message='Subscription customer mismatch'; end if;
    insert into builder_subscriptions(id,user_id,status,plan_id,price_id,period_end,cancel_at_period_end)
      values(item->>'id',actor,item->>'status',item->>'planId',item->>'priceId',(item->>'periodEnd')::timestamptz,(item->>'cancelAtPeriodEnd')::boolean);
  end loop;
  for item in select value from jsonb_array_elements(checkouts) loop
    if item->>'customerId' is distinct from stripe_customer then raise exception using errcode='22023',message='Checkout customer mismatch'; end if;
    perform builder_billing_checkout_record(actor,(item->>'attemptId')::uuid,item->>'id',item->>'status');
  end loop;
  update builder_billing_events set processed_at=clock_timestamp() where id=delivery_id;
  update builder_billing_accounts set sync_token=null,sync_until=null,sync_delivery=null,verified_at=clock_timestamp() where user_id=actor;
end;
$$;

create function public.builder_billing_release(actor uuid, lease uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
  update builder_billing_accounts set sync_token=null,sync_until=null,sync_delivery=null where user_id=actor and sync_token=lease;
$$;

create function public.builder_billing_checkout_begin(actor uuid, selected_plan text, stripe_price text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype; attempt builder_billing_checkouts%rowtype;
begin
  perform builder_billing_account(actor);
  select * into account from builder_billing_accounts where user_id=actor for update;
  if account.override_plan is not null then raise exception using errcode='P0409',message='Your private beta access does not need a subscription'; end if;
  if selected_plan is null or selected_plan not in ('plus','agency') or stripe_price is null or stripe_price !~ '^price_[A-Za-z0-9]{1,120}$' then
    raise exception using errcode='22023',message='Choose an available plan';
  end if;
  if account.customer_id is null then raise exception using errcode='P0409',message='Billing customer is not linked yet'; end if;
  if account.sync_until>clock_timestamp() or account.verified_at is null or account.verified_at<clock_timestamp()-interval '5 minutes' then
    raise exception using errcode='P0409',message='Refresh billing before opening Checkout';
  end if;
  if exists(select 1 from builder_subscriptions where user_id=actor and status not in ('canceled','incomplete_expired')) then
    raise exception using errcode='P0409',message='Use Manage billing to change your existing subscription';
  end if;
  if not exists(select 1 from builder_legal_acceptances a join builder_legal_versions v on v.version=a.version and v.active where a.user_id=actor) then
    raise exception using errcode='P0403',message='Accept the current documents before subscribing';
  end if;
  select * into attempt from builder_billing_checkouts where user_id=actor and state in ('pending','open') for update;
  if found then
    if attempt.plan_id<>selected_plan or attempt.price_id<>stripe_price then raise exception using errcode='P0409',message='Close your current Checkout before choosing another plan'; end if;
    return to_jsonb(attempt);
  end if;
  insert into builder_billing_checkouts(user_id,plan_id,price_id) values(actor,selected_plan,stripe_price) returning * into attempt;
  return to_jsonb(attempt);
end;
$$;

create function public.builder_billing_checkout_record(actor uuid, attempt_id uuid, stripe_session text, next_state text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare attempt builder_billing_checkouts%rowtype;
begin
  perform 1 from builder_billing_accounts where user_id=actor for update;
  select * into attempt from builder_billing_checkouts where user_id=actor and id=attempt_id for update;
  if not found or stripe_session is null or stripe_session !~ '^cs_[A-Za-z0-9_]{1,160}$' or next_state is null or next_state not in ('open','complete','expired') then
    raise exception using errcode='22023',message='Invalid Checkout update';
  end if;
  if attempt.session_id is not null and attempt.session_id<>stripe_session then raise exception using errcode='P0409',message='Checkout identity changed'; end if;
  if attempt.state in ('complete','expired') and next_state<>attempt.state then raise exception using errcode='P0409',message='Checkout already finished'; end if;
  update builder_billing_checkouts set session_id=stripe_session,state=next_state where id=attempt_id;
end;
$$;

create function public.builder_billing_summary(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype; selected builder_plans%rowtype; pending jsonb;
begin
  perform builder_billing_account(actor);
  select * into account from builder_billing_accounts where user_id=actor;
  selected:=builder_billing_plan(actor);
  select jsonb_build_object('planId',plan_id,'state',state) into pending from builder_billing_checkouts where user_id=actor and state in ('pending','open');
  return jsonb_build_object('plan',to_jsonb(selected),'hasCustomer',account.customer_id is not null,'verifiedAt',account.verified_at,
    'pendingCheckout',pending,'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('planId',plan_id,'status',status,'periodEnd',period_end,'cancelAtPeriodEnd',cancel_at_period_end) order by id)
      from builder_subscriptions where user_id=actor and status not in ('canceled','incomplete_expired')),'[]'::jsonb),
    'plans',(select jsonb_agg(to_jsonb(p) order by p.projects) from builder_plans p where id<>'beta'));
end;
$$;

create function public.builder_billing_pending_checkout(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform builder_billing_account(actor);
  return (select to_jsonb(c) from builder_billing_checkouts c where user_id=actor and state in ('pending','open'));
end;
$$;

-- Called only after a fresh, complete provider listing has no matching session.
-- A previous request uses the fixed expires_at, so it cannot create a still-open
-- session after this deadline. Concurrent binding prevents abandonment.
create function public.builder_billing_checkout_expire_empty(actor uuid, attempt_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_billing_accounts where user_id=actor for update;
  update builder_billing_checkouts set state='expired' where id=attempt_id and user_id=actor and state='pending' and session_id is null and expires_at<clock_timestamp();
  if not found then raise exception using errcode='P0409',message='Refresh billing before closing this Checkout'; end if;
end;
$$;

create function public.builder_prune_billing_events() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare removed integer;
begin
  delete from builder_billing_events where processed_at<clock_timestamp()-interval '90 days';
  get diagnostics removed=row_count;
  return removed;
end;
$$;

create function public.builder_billing_deletion_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare account builder_billing_accounts%rowtype;
begin
  if new.status<>'processing' or old.status='processing' then return new; end if;
  select * into account from builder_billing_accounts where user_id=new.user_id for update;
  if not found or account.customer_id is null then return new; end if;
  if account.sync_until>clock_timestamp() or account.verified_at is null or account.verified_at<clock_timestamp()-interval '5 minutes' then
    raise exception using errcode='P0409',message='Refresh billing before completing account deletion';
  end if;
  if exists(select 1 from builder_subscriptions where user_id=new.user_id and status not in ('canceled','incomplete_expired'))
    or exists(select 1 from builder_billing_checkouts where user_id=new.user_id and state in ('pending','open')) then
    raise exception using errcode='P0409',message='Close unfinished Checkout and end paid subscriptions before completing account deletion';
  end if;
  return new;
end;
$$;
revoke all on function public.builder_billing_deletion_guard() from public,anon,authenticated,service_role;
create trigger builder_billing_deletion_guard before update on public.builder_account_deletions
  for each row execute function public.builder_billing_deletion_guard();

revoke all on function public.builder_billing_account(uuid),public.builder_billing_customer_begin(uuid),public.builder_billing_bind_customer(uuid,text),public.builder_billing_plan(uuid),
  public.builder_billing_claim(text,text,text),public.builder_billing_finish(uuid,text,uuid,text,jsonb,jsonb),public.builder_billing_release(uuid,uuid),
  public.builder_billing_checkout_begin(uuid,text,text),public.builder_billing_checkout_record(uuid,uuid,text,text),public.builder_billing_summary(uuid),public.builder_billing_pending_checkout(uuid),public.builder_billing_checkout_expire_empty(uuid,uuid),public.builder_prune_billing_events()
  from public,anon,authenticated,service_role;
grant execute on function public.builder_billing_account(uuid),public.builder_billing_customer_begin(uuid),public.builder_billing_bind_customer(uuid,text),
  public.builder_billing_claim(text,text,text),public.builder_billing_finish(uuid,text,uuid,text,jsonb,jsonb),public.builder_billing_release(uuid,uuid),
  public.builder_billing_checkout_begin(uuid,text,text),public.builder_billing_checkout_record(uuid,uuid,text,text),public.builder_billing_summary(uuid),public.builder_billing_pending_checkout(uuid),public.builder_billing_checkout_expire_empty(uuid,uuid),public.builder_prune_billing_events()
  to service_role;

-- Reuse durable function request limits for the two new server endpoints.
alter table public.builder_function_limits drop constraint builder_function_limits_function_name_check;
alter table public.builder_function_limits add constraint builder_function_limits_function_name_check check(function_name in (
  'builder-projects','builder-account','builder-invite','builder-publish','builder-content','builder-contact','builder-billing','builder-billing-webhook'
));
create or replace function public.builder_consume_function_limit(target_function text, actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  maximum integer;
  observed_at timestamptz := statement_timestamp();
  period_start timestamptz := date_trunc('minute',observed_at);
  bucket_subject text := coalesce(actor_id::text,'global');
  used integer;
begin
  maximum := case target_function
    when 'builder-projects' then case when actor_id is null then 3600 else 360 end
    when 'builder-account' then case when actor_id is null then 300 else 30 end
    when 'builder-invite' then case when actor_id is null then 120 else 12 end
    when 'builder-publish' then case when actor_id is null then 120 else 12 end
    when 'builder-content' then case when actor_id is null then 300 else 30 end
    when 'builder-contact' then case when actor_id is null then 120 else 12 end
    when 'builder-billing' then case when actor_id is null then 300 else 30 end
    when 'builder-billing-webhook' then case when actor_id is null then 600 else 30 end
    else null end;
  if maximum is null then raise exception 'Unknown builder function' using errcode='22023'; end if;
  insert into builder_function_limits(function_name,subject,window_start,attempts)
    values(target_function,bucket_subject,period_start,1)
  on conflict(function_name,subject) do update set
    attempts=case when builder_function_limits.window_start<>period_start then 1
      else least(builder_function_limits.attempts+1,maximum+1) end,
    window_start=period_start
  returning attempts into used;
  return jsonb_build_object('allowed',used<=maximum,'retryAfter',
    case when used<=maximum then 0 else greatest(1,ceil(extract(epoch from period_start+interval '1 minute'-observed_at))::integer) end);
end;
$$;
revoke all on function public.builder_consume_function_limit(text,uuid) from public,anon,authenticated;
grant execute on function public.builder_consume_function_limit(text,uuid) to service_role;
