-- Existing source websites publish through Git rather than the static-site job
-- queue. Bind their quota reservation to the helper's durable publication review.
alter table public.builder_publication_allowances drop constraint builder_publication_allowances_kind_check;
alter table public.builder_publication_allowances add constraint builder_publication_allowances_kind_check check(kind in ('client','legacy','repository'));
create table public.builder_repository_publications (
  id uuid primary key,
  project_id text not null references public.builder_projects(id),
  requested_by uuid not null references auth.users(id),
  repository_binding text not null check(repository_binding ~ '^[a-f0-9]{64}$'),
  commit_hash text not null check(commit_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  base_hash text not null check(base_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  staging_artifact text not null check(staging_artifact ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'),
  attempt integer not null default 1 check(attempt>0),
  phase text not null default 'reserved' check(phase in ('reserved','sent','live','failed')),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index builder_repository_one_pending on public.builder_repository_publications(project_id) where phase in ('reserved','sent');
alter table public.builder_repository_publications enable row level security;
revoke all on public.builder_repository_publications from public,anon,authenticated,service_role;

create function public.builder_repository_billing_access(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=target for update;
  if not exists(select 1 from builder_project_members m join builder_projects p on p.id=m.project_id
    join auth.users u on u.id=m.user_id where m.project_id=target and m.user_id=actor and m.can_publish and not p.archived
      and u.deleted_at is null and u.email_confirmed_at is not null)
    or exists(select 1 from builder_account_deletions where user_id=actor and status in ('processing','completed')) then
    raise exception using errcode='P0403',message='Current website publishing permission is required';
  end if;
end;
$$;

create function public.builder_repository_publish_begin(target text, actor uuid, request_id uuid, binding text, commit_hash text, base_hash text, expected_attempt integer, staged_artifact text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_repository_publications%rowtype;
begin
  perform builder_repository_billing_access(target,actor);
  if request_id is null or binding is null or binding !~ '^[a-f0-9]{64}$' or commit_hash is null or commit_hash !~ '^([a-f0-9]{40}|[a-f0-9]{64})$'
    or base_hash is null or base_hash !~ '^([a-f0-9]{40}|[a-f0-9]{64})$' or staged_artifact is null or staged_artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$' or commit_hash=base_hash or expected_attempt is null or expected_attempt<1 then
    raise exception using errcode='22023',message='Invalid repository publication identity';
  end if;
  select * into item from builder_repository_publications where id=request_id for update;
  if found then
    if item.project_id<>target or item.requested_by<>actor or item.repository_binding<>binding or item.commit_hash<>commit_hash or item.base_hash<>base_hash or item.staging_artifact<>staged_artifact then
      raise exception using errcode='P0409',message='This publication review belongs to different website changes';
    end if;
    if expected_attempt=item.attempt then
      -- Retrying a lost reserve response never adds an allowance. A current
      -- reservation still rechecks entitlement immediately before a Git push.
      if item.phase='reserved' then perform builder_repository_staged_plan_check(target,commit_hash,staged_artifact); end if;
      return jsonb_build_object('attempt',item.attempt,'phase',item.phase);
    end if;
    if item.phase<>'failed' or expected_attempt<>item.attempt+1 then
      raise exception using errcode='P0409',message='Refresh this publication before retrying its billing allowance';
    end if;
    -- A definitely failed attempt was refunded. An explicit retry is charged
    -- to today's payer/month, not an expired month's unused allowance.
    perform builder_reserve_native_publication(request_id,target,commit_hash,staged_artifact);
    update builder_repository_publications set attempt=expected_attempt,phase='reserved',updated_at=clock_timestamp() where id=request_id returning * into item;
  else
    if expected_attempt<>1 then raise exception using errcode='P0409',message='Start with a new publication review'; end if;
    if exists(select 1 from builder_repository_publications where project_id=target and phase in ('reserved','sent')) then
      raise exception using errcode='P0409',message='Check the pending repository publication before publishing again';
    end if;
    perform builder_reserve_native_publication(request_id,target,commit_hash,staged_artifact);
    insert into builder_repository_publications(id,project_id,requested_by,repository_binding,commit_hash,base_hash,staging_artifact)
      values(request_id,target,actor,binding,commit_hash,base_hash,staged_artifact) returning * into item;
  end if;
  return jsonb_build_object('attempt',item.attempt,'phase',item.phase);
end;
$$;

create function public.builder_repository_publish_settle(target text, actor uuid, request_id uuid, binding text, commit_hash text, base_hash text, expected_attempt integer, outcome text, staged_artifact text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_repository_publications%rowtype;
begin
  perform builder_repository_billing_access(target,actor);
  select * into item from builder_repository_publications where id=request_id for update;
  if not found and outcome='failed' and expected_attempt=1 then
    -- The helper can prove it never started Git even when the reserve response
    -- was lost. A tombstone fences an earlier HTTP request that arrives late.
    insert into builder_repository_publications(id,project_id,requested_by,repository_binding,commit_hash,base_hash,phase,staging_artifact)
      values(request_id,target,actor,binding,commit_hash,base_hash,'failed',staged_artifact) returning * into item;
  end if;
  if item.id is null or item.project_id<>target or item.requested_by<>actor or item.repository_binding is distinct from binding or item.commit_hash is distinct from commit_hash or item.base_hash is distinct from base_hash
    or item.staging_artifact is distinct from staged_artifact or item.attempt is distinct from expected_attempt or outcome is null or outcome not in ('sent','live','failed') then
    raise exception using errcode='P0409',message='This publication billing observation is stale or belongs to different changes';
  end if;
  if item.phase=outcome then return jsonb_build_object('attempt',item.attempt,'phase',item.phase); end if;
  if item.phase='live' or (item.phase='failed' and outcome<>'live') then
    raise exception using errcode='P0409',message='This publication attempt has already finished';
  end if;
  -- Only a trusted helper's definitive outcome reaches this RPC. A Git host
  -- outage or lost acknowledgement keeps the reservation; time cannot refund it.
  perform builder_settle_publication('repository',request_id,outcome);
  update builder_repository_publications set phase=outcome,updated_at=clock_timestamp() where id=request_id returning * into item;
  return jsonb_build_object('attempt',item.attempt,'phase',item.phase);
end;
$$;

create or replace function public.builder_take_project_billing(target text, actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from builder_projects where id=target for update;
  if not exists(select 1 from builder_project_members where project_id=target and user_id=actor and role='owner') then
    raise exception using errcode='P0403',message='Only a website owner can take over its billing';
  end if;
  if exists(select 1 from builder_project_billing where project_id=target and user_id=actor) then return; end if;
  if exists(select 1 from builder_client_jobs where project_id=target and phase in ('queued','building','activating','verifying','recovery_required'))
    or exists(select 1 from builder_repository_publications where project_id=target and phase in ('reserved','sent'))
    or (target='kaizen' and exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required'))) then
    raise exception using errcode='P0409',message='Finish the pending publication or recovery before changing website billing';
  end if;
  perform builder_billing_account(actor);
  update builder_project_billing set user_id=actor where project_id=target;
  if not found then raise exception using errcode='P0409',message='The website billing record needs to be checked'; end if;
end;
$$;
revoke all on function public.builder_repository_billing_access(text,uuid),public.builder_repository_publish_begin(text,uuid,uuid,text,text,text,integer,text),
  public.builder_repository_publish_settle(text,uuid,uuid,text,text,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.builder_repository_publish_begin(text,uuid,uuid,text,text,text,integer,text),public.builder_repository_publish_settle(text,uuid,uuid,text,text,text,integer,text,text) to service_role;
