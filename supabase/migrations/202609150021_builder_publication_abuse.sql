-- Publication abuse controls. Burst limits sit at the authoritative
-- allowance boundary; reports are private and reviewed by an operator; a
-- suspension stops new publication while keeping every website, draft, file,
-- billing and recovery record. Nothing here deletes customer data.

alter table public.builder_publication_allowances add column reserved_at timestamptz not null default clock_timestamp();
create index builder_publication_burst_project on public.builder_publication_allowances(project_id,reserved_at);
create index builder_publication_burst_account on public.builder_publication_allowances(user_id,reserved_at);

-- No cascade: a suspended website cannot be purged while it is under review.
create table public.builder_project_suspensions (
  project_id text primary key references public.builder_projects(id),
  state text not null check(state in ('suspended','taken_down')),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  report_id uuid,
  operator text not null check(operator ~ '^[a-zA-Z0-9_.@-]{1,100}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(project_id<>'kaizen')
);
create table public.builder_abuse_reports (
  id uuid primary key,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  reporter text not null check(reporter ~ '^[a-f0-9]{64}$'),
  project_id text not null,
  origin text not null check(length(origin)<=300 and origin ~ '^https://[a-z0-9.-]+(:[0-9]+)?$'),
  category text not null check(category in ('phishing','malware','spam','illegal','copyright','other')),
  details text not null check(length(details) between 10 and 4000),
  contact text check(contact is null or length(contact)<=254),
  status text not null default 'open' check(status in ('open','dismissed','actioned')),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewer text check(reviewer is null or reviewer ~ '^[a-zA-Z0-9_.@-]{1,100}$'),
  outcome text check(outcome is null or length(outcome)<=1000),
  check((status='open')=(reviewed_at is null))
);
create index builder_abuse_reports_reporter on public.builder_abuse_reports(reporter,created_at);
create index builder_abuse_reports_status on public.builder_abuse_reports(status,created_at desc);
-- Append-only audit. It survives lifting a suspension and closing a report.
create table public.builder_abuse_actions (
  id uuid primary key default gen_random_uuid(),
  project_id text,
  report_id uuid,
  action text not null check(action in ('suspend','takedown','restore','dismiss')),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  operator text not null check(operator ~ '^[a-zA-Z0-9_.@-]{1,100}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.builder_project_suspensions enable row level security;
alter table public.builder_abuse_reports enable row level security;
alter table public.builder_abuse_actions enable row level security;
revoke all on public.builder_project_suspensions,public.builder_abuse_reports,public.builder_abuse_actions from public,anon,authenticated,service_role;

create function public.builder_assert_publishing_allowed(target text) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from builder_project_suspensions where project_id=target) then
    raise exception using errcode='P0423',message='Publishing is paused for this website while Kaizen reviews a report. Your website, drafts and files are kept. Contact Kaizen support to resolve it';
  end if;
end;
$$;

create function public.builder_publication_burst_check(target text, account uuid) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from builder_publication_allowances where project_id=target and reserved_at>clock_timestamp()-interval '1 hour')>=30
    or (select count(*) from builder_publication_allowances where user_id=account and reserved_at>clock_timestamp()-interval '1 hour')>=60 then
    raise exception using errcode='P0429',message='Too many publications in the last hour. Existing work is kept. Wait a while, then publish again';
  end if;
end;
$$;

create or replace function public.builder_reserve_publication(allowance_kind text, request_id uuid, target text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid; selected builder_plans%rowtype; period date:=date_trunc('month',clock_timestamp() at time zone 'UTC')::date; reserved integer;
begin
  account:=builder_project_plan_check(target);
  -- An exact retry keeps its original allowance and is never re-limited.
  if exists(select 1 from builder_publication_allowances where kind=allowance_kind and job_id=request_id) then return; end if;
  perform builder_assert_publishing_allowed(target);
  perform builder_publication_burst_check(target,account);
  selected:=builder_billing_plan(account);
  insert into builder_billing_months(user_id,month) values(account,period) on conflict do nothing;
  update builder_billing_months set publications=publications+1 where user_id=account and month=period and publications<selected.publishes_per_month returning publications into reserved;
  if not found then raise exception using errcode='P0429',message='The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month'; end if;
  insert into builder_publication_allowances(kind,job_id,project_id,user_id,month,state) values(allowance_kind,request_id,target,account,period,'reserved');
end;
$$;

create or replace function public.builder_reserve_native_publication(request_id uuid, target text, source_commit text, artifact text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare payer uuid; period date:=date_trunc('month',clock_timestamp() at time zone 'UTC')::date; selected builder_plans%rowtype; allowance builder_publication_allowances%rowtype;
begin
  payer:=builder_repository_staged_plan_check(target,source_commit,artifact);
  select * into allowance from builder_publication_allowances where kind='repository' and job_id=request_id for update;
  if found and allowance.state<>'returned' then return; end if;
  perform builder_assert_publishing_allowed(target);
  perform builder_publication_burst_check(target,payer);
  selected:=builder_billing_plan(payer);
  insert into builder_billing_months(user_id,month) values(payer,period) on conflict do nothing;
  update builder_billing_months set publications=publications+1 where user_id=payer and month=period and publications<selected.publishes_per_month;
  if not found then raise exception using errcode='P0429',message='The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month'; end if;
  insert into builder_publication_allowances(kind,job_id,project_id,user_id,month,state,reserved_at) values('repository',request_id,target,payer,period,'reserved',clock_timestamp())
    on conflict(kind,job_id) do update set user_id=excluded.user_id,month=excluded.month,state='reserved',reserved_at=clock_timestamp();
end;
$$;

-- Operator takedown jobs use the existing verified unpublication worker path.
-- They have no customer requester, so only their publish-permission recheck
-- is replaced; destination, worker, token and baseline checks are unchanged.
alter table public.builder_client_jobs alter column requested_by drop not null;
alter table public.builder_client_jobs add column operator_takedown boolean not null default false;
alter table public.builder_client_jobs add constraint builder_client_jobs_requester check(
  (operator_takedown and requested_by is null and action='unpublish') or (not operator_takedown and requested_by is not null));

create function public.builder_publication_suspension_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Taking a website offline stays available; new content and restores wait.
  if tg_table_name='builder_client_reviews' then
    if new.action in ('publish','rollback') then perform builder_assert_publishing_allowed(new.project_id); end if;
  elsif tg_table_name='builder_client_jobs' then
    if new.action in ('publish','rollback') and (tg_op='INSERT' or
      (old.phase in ('queued','building') and new.phase in ('building','activating') and new.phase<>old.phase)) then
      perform builder_assert_publishing_allowed(new.project_id); end if;
  elsif tg_table_name='builder_repository_publications' then
    if tg_op='INSERT' or new.attempt is distinct from old.attempt then perform builder_assert_publishing_allowed(new.project_id); end if;
  elsif tg_table_name='builder_repository_output_jobs' then
    if new.phase='reserved' and (tg_op='INSERT' or new.phase is distinct from old.phase) then perform builder_assert_publishing_allowed(new.project_id); end if;
  end if;
  return new;
end;
$$;
create trigger builder_publication_suspension_guard before insert or update on public.builder_client_reviews for each row execute function public.builder_publication_suspension_guard();
create trigger builder_publication_suspension_guard before insert or update on public.builder_client_jobs for each row execute function public.builder_publication_suspension_guard();
create trigger builder_publication_suspension_guard before insert or update on public.builder_repository_publications for each row execute function public.builder_publication_suspension_guard();
create trigger builder_publication_suspension_guard before insert or update on public.builder_repository_output_jobs for each row execute function public.builder_publication_suspension_guard();

create or replace function public.builder_client_claim(job_id uuid, worker text, token uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.builder_client_jobs; d public.builder_client_destinations;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  select * into d from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if worker is distinct from j.worker_id or worker is distinct from d.worker_id or token is null then raise exception 'Worker does not own this destination'; end if;
  if j.owner_token=token and j.phase in ('building','activating','verifying') then return to_jsonb(j); end if;
  if j.phase<>'queued' or j.owner_token is not null then raise exception 'Release already claimed; inspect its worker before recovery'; end if;
  if not (j.operator_takedown or builder_project_access(j.project_id,'publish',j.requested_by)) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
  if d.version<>j.destination_version or d.active_artifact_id<>j.previous_artifact_id or builder_client_destination_public(d) is distinct from j.destination then raise exception 'Destination changed before worker claim'; end if;
  update builder_client_jobs set owner_token=token,phase='building',updated_at=clock_timestamp() where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;

create or replace function public.builder_client_progress(job_id uuid, token uuid, next_phase text, detail text default '') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.builder_client_jobs; d public.builder_client_destinations;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  select * into d from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if token is null or j.owner_token is distinct from token then raise exception 'Release worker ownership required'; end if;
  if j.phase not in ('building','activating','verifying') then raise exception 'This release is no longer pending'; end if;
  if next_phase not in ('building','activating','verifying','failed','rolled_back','recovery_required') then raise exception 'Unsupported release phase'; end if;
  if next_phase in ('building','activating','verifying') then
    if not (j.operator_takedown or builder_project_access(j.project_id,'publish',j.requested_by)) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
    if d.version<>j.destination_version or d.active_artifact_id<>j.previous_artifact_id or builder_client_destination_public(d) is distinct from j.destination then raise exception 'Destination changed during publication'; end if;
    if (j.phase='activating' and next_phase='building') or (j.phase='verifying' and next_phase in ('building','activating')) then raise exception 'Release phase cannot move backwards'; end if;
  end if;
  update builder_client_jobs set phase=next_phase,updated_at=clock_timestamp(),log=right(log||coalesce(detail,'')||E'\n',100000),
    error=case when next_phase in ('failed','rolled_back','recovery_required') then left(detail,2000) else null end where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;

create or replace function public.builder_client_finalize(job_id uuid, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.builder_client_jobs; d public.builder_client_destinations;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  select * into d from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if token is null or j.owner_token is distinct from token then raise exception 'Release worker ownership required'; end if;
  if j.phase='live' and d.active_job_id=j.id and j.evidence=verification then return to_jsonb(j); end if;
  if j.phase<>'verifying' then raise exception 'Verify the served output before finalizing'; end if;
  if not (j.operator_takedown or builder_project_access(j.project_id,'publish',j.requested_by)) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
  if d.version<>j.destination_version or d.active_artifact_id<>j.previous_artifact_id or builder_client_destination_public(d) is distinct from j.destination then raise exception 'Destination changed before finalization'; end if;
  if verification->>'artifactId' is distinct from j.artifact_id or verification->>'projectId' is distinct from j.project_id
    or verification->>'destinationId' is distinct from j.destination_id::text or verification->>'origin' is distinct from d.origin
    or verification->>'environment' is distinct from d.environment or (verification->>'manifestSha256') is null
    or (verification->>'manifestSha256') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid served-output evidence'; end if;
  update builder_client_jobs set phase='live',evidence=verification,error=null,updated_at=clock_timestamp() where id=job_id returning * into j;
  update builder_client_destinations set active_job_id=j.id,active_artifact_id=j.artifact_id where id=d.id;
  -- No workspace write: production baseline is projected from j.snapshot at read time.
  return to_jsonb(j);
end;
$$;

create or replace function public.builder_client_recovery_begin(job_id uuid, worker text, token uuid, selected_artifact text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.builder_client_jobs; d public.builder_client_destinations; committed boolean;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  select * into d from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if token is null or j.owner_token is distinct from token or worker is distinct from j.worker_id or worker is distinct from d.worker_id then raise exception 'Original destination worker ownership required'; end if;
  if j.phase not in ('building','activating','verifying','recovery_required','live','rolled_back','failed') then raise exception 'This job cannot be reconciled'; end if;
  if j.phase='failed' and selected_artifact is distinct from j.previous_artifact_id then raise exception 'A failed job can only restore its previous artifact'; end if;
  if selected_artifact is null or selected_artifact not in (j.artifact_id,j.previous_artifact_id) then raise exception 'Recovery artifact is unrelated to this job'; end if;
  if exists(select 1 from builder_client_jobs other where other.destination_id=d.id and other.id<>j.id and other.phase in ('queued','building','activating','verifying','recovery_required')) then raise exception 'Another release is pending for this destination'; end if;
  committed:=d.active_job_id=j.id;
  if d.active_artifact_id<>j.previous_artifact_id and not (coalesce(committed,false) and d.active_artifact_id=j.artifact_id) then raise exception 'The database baseline changed outside this job'; end if;
  if j.phase='live' and not coalesce(committed,false) then raise exception 'This historical job is no longer the live baseline'; end if;
  if selected_artifact=j.previous_artifact_id and selected_artifact<>j.artifact_id and coalesce(committed,false) then raise exception 'This publication was committed. Reconcile it, then review an ordinary rollback'; end if;
  if selected_artifact=j.artifact_id and not coalesce(committed,false) then
    if not (j.operator_takedown or builder_project_access(j.project_id,'publish',j.requested_by)) or not d.enabled then raise exception 'Publish permission was revoked or destination disabled. Restore the previous artifact'; end if;
    if d.version<>j.destination_version then raise exception 'Destination configuration changed. Restore the previous artifact'; end if;
  end if;
  update builder_client_jobs set phase='recovery_required',recovery_target=selected_artifact,recovery_destination_version=d.version,
    updated_at=clock_timestamp(),error='Operator recovery is checking the served artifact' where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;

create or replace function public.builder_client_recovery_finalize(job_id uuid, worker text, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.builder_client_jobs; d public.builder_client_destinations; committed boolean;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  select * into d from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if token is null or j.owner_token is distinct from token or worker is distinct from j.worker_id or worker is distinct from d.worker_id then raise exception 'Original destination worker ownership required'; end if;
  if j.phase in ('live','rolled_back') and j.recovery_evidence=verification and d.active_artifact_id=j.recovery_target then return to_jsonb(j); end if;
  if j.phase<>'recovery_required' or j.recovery_target is null or d.version<>j.recovery_destination_version then raise exception 'Recovery state or destination changed. Inspect again'; end if;
  committed:=d.active_job_id=j.id;
  if d.active_artifact_id<>j.previous_artifact_id and not (coalesce(committed,false) and d.active_artifact_id=j.artifact_id) then raise exception 'The database baseline changed during recovery'; end if;
  if verification->>'artifactId' is distinct from j.recovery_target or verification->>'projectId' is distinct from j.project_id
    or verification->>'destinationId' is distinct from j.destination_id::text or verification->>'environment' is distinct from d.environment
    or verification->>'origin' is distinct from d.origin or coalesce(verification->>'manifestSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Verified recovery evidence required'; end if;
  if j.recovery_target=j.artifact_id then
    if not coalesce(committed,false) and (not (j.operator_takedown or builder_project_access(j.project_id,'publish',j.requested_by)) or not d.enabled) then raise exception 'Publish permission changed during recovery. Restore the previous artifact'; end if;
    update builder_client_destinations set active_artifact_id=j.artifact_id,active_job_id=j.id where id=d.id;
    update builder_client_jobs set phase='live',evidence=verification,recovery_evidence=verification,error=null,updated_at=clock_timestamp(),
      log=right(log||E'\nOperator recovery verified the selected artifact; drafts were preserved.\n',100000) where id=job_id returning * into j;
  else
    if coalesce(committed,false) then raise exception 'Use ordinary rollback for a committed publication'; end if;
    -- The previous baseline was never committed away; preserve its exact job identity.
    update builder_client_jobs set phase='rolled_back',recovery_evidence=verification,error=null,updated_at=clock_timestamp(),
      log=right(log||E'\nOperator recovery verified the previous artifact; drafts were preserved.\n',100000) where id=job_id returning * into j;
  end if;
  return to_jsonb(j);
end;
$$;

create function public.builder_submit_abuse_report(request_id uuid, request_fingerprint text, reporter_hash text, report jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing builder_abuse_reports%rowtype; site text; kind text; words text; reply text; resolved text;
begin
  if request_id is null or request_fingerprint is null or request_fingerprint !~ '^[a-f0-9]{64}$' or reporter_hash is null or reporter_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(report) is distinct from 'object' or exists(select 1 from jsonb_object_keys(report) k where k not in ('origin','category','details','contact')) then
    raise exception using errcode='22023',message='Invalid report'; end if;
  site:=lower(report->>'origin'); kind:=report->>'category'; words:=trim(report->>'details'); reply:=nullif(lower(trim(coalesce(report->>'contact',''))),'');
  if site is null or length(site)>300 or site !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' or kind is null or kind not in ('phishing','malware','spam','illegal','copyright','other')
    or words is null or length(words) not between 10 and 4000 or (reply is not null and (length(reply)>254 or reply !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$')) then
    raise exception using errcode='22023',message='Invalid report'; end if;
  perform pg_advisory_xact_lock(hashtextextended('builder-abuse-report:'||reporter_hash,0));
  select * into existing from builder_abuse_reports where id=request_id;
  if found then
    if existing.fingerprint<>request_fingerprint or existing.reporter<>reporter_hash then
      raise exception using errcode='P0409',message='Report request conflict'; end if;
    return jsonb_build_object('id',existing.id,'status','received');
  end if;
  if (select count(*) from builder_abuse_reports where reporter=reporter_hash and created_at>clock_timestamp()-interval '1 hour')>=5 then
    raise exception using errcode='P0429',message='Report rate limit'; end if;
  if (select count(*) from builder_abuse_reports where status='open')>=10000 then
    raise exception using errcode='P0429',message='Report intake is full'; end if;
  select project_id into resolved from builder_client_destinations where lower(origin)=site order by id limit 1;
  if resolved is null then
    select project_id into resolved from builder_domains where status<>'removed' and 'https://'||hostname=site order by id limit 1; end if;
  if resolved is null or resolved='kaizen' then
    raise exception using errcode='P0404',message='This website is not hosted by Kaizen'; end if;
  insert into builder_abuse_reports(id,fingerprint,reporter,project_id,origin,category,details,contact)
    values(request_id,request_fingerprint,reporter_hash,resolved,site,kind,words,reply);
  return jsonb_build_object('id',request_id,'status','received');
end;
$$;

create function public.builder_operator_suspend(target text, report uuid, operator text, reason text, takedown boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_suspensions%rowtype; reported builder_abuse_reports%rowtype; d builder_client_destinations%rowtype; job uuid; queued uuid[]:='{}'; waiting uuid[]:='{}';
begin
  if target is null or target='kaizen' or operator is null or operator !~ '^[a-zA-Z0-9_.@-]{1,100}$' or reason is null
    or length(trim(reason)) not between 1 and 1000 or takedown is null then
    raise exception using errcode='22023',message='Invalid suspension request'; end if;
  perform 1 from builder_projects where id=target for update;
  if not found then raise exception using errcode='P0404',message='Website not found'; end if;
  if report is not null then
    select * into reported from builder_abuse_reports where id=report for update;
    if not found or reported.project_id<>target then raise exception using errcode='P0409',message='The report belongs to a different website'; end if;
  end if;
  insert into builder_project_suspensions(project_id,state,reason,report_id,operator)
    values(target,case when takedown then 'taken_down' else 'suspended' end,trim(reason),report,operator)
  on conflict(project_id) do update set
    state=case when excluded.state='taken_down' or builder_project_suspensions.state='taken_down' then 'taken_down' else 'suspended' end,
    reason=excluded.reason,report_id=coalesce(excluded.report_id,builder_project_suspensions.report_id),operator=excluded.operator,updated_at=clock_timestamp()
  returning * into item;
  if report is not null then
    update builder_abuse_reports set status='actioned',reviewed_at=clock_timestamp(),reviewer=operator,outcome=trim(reason) where id=report; end if;
  if takedown then
    for d in select * from builder_client_destinations where project_id=target and enabled order by id for update loop
      if exists(select 1 from builder_client_jobs where destination_id=d.id and phase in ('queued','building','activating','verifying','recovery_required')) then
        waiting:=waiting||d.id; continue; end if;
      if exists(select 1 from builder_client_jobs where id=d.active_job_id and action='unpublish') then continue; end if;
      job:=gen_random_uuid();
      insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,operator_takedown,action,snapshot,previous_artifact_id,artifact_id)
        values(job,target,d.id,builder_client_destination_public(d),d.version,d.worker_id,null,true,'unpublish',null,d.active_artifact_id,job::text);
      queued:=queued||job;
    end loop;
  end if;
  insert into builder_abuse_actions(project_id,report_id,action,reason,operator)
    values(target,report,case when takedown then 'takedown' else 'suspend' end,trim(reason),operator);
  return jsonb_build_object('projectId',target,'state',item.state,'queuedJobs',to_jsonb(queued),'destinationsWithPendingWork',to_jsonb(waiting));
end;
$$;

-- Lifting a suspension never republishes. Serving returns through an owner's
-- ordinary reviewed restore, which rechecks the retained release and destination.
create function public.builder_operator_restore(target text, operator text, reason text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_project_suspensions%rowtype;
begin
  if target is null or operator is null or operator !~ '^[a-zA-Z0-9_.@-]{1,100}$' or reason is null or length(trim(reason)) not between 1 and 1000 then
    raise exception using errcode='22023',message='Invalid restore request'; end if;
  perform 1 from builder_projects where id=target for update;
  delete from builder_project_suspensions where project_id=target returning * into item;
  if not found then raise exception using errcode='P0404',message='This website is not suspended'; end if;
  insert into builder_abuse_actions(project_id,report_id,action,reason,operator) values(target,item.report_id,'restore',trim(reason),operator);
  return jsonb_build_object('projectId',target,'restored',true,'previousState',item.state);
end;
$$;

create function public.builder_operator_dismiss_report(report uuid, operator text, outcome text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_abuse_reports%rowtype;
begin
  if report is null or operator is null or operator !~ '^[a-zA-Z0-9_.@-]{1,100}$' or outcome is null or length(trim(outcome)) not between 1 and 1000 then
    raise exception using errcode='22023',message='Invalid report review'; end if;
  select * into item from builder_abuse_reports where id=report for update;
  if not found then raise exception using errcode='P0404',message='Report not found'; end if;
  if item.status='dismissed' and item.outcome=trim(outcome) then return jsonb_build_object('id',item.id,'status',item.status); end if;
  if item.status<>'open' then raise exception using errcode='P0409',message='This report was already reviewed'; end if;
  update builder_abuse_reports set status='dismissed',reviewed_at=clock_timestamp(),reviewer=operator,outcome=trim(outcome) where id=report returning * into item;
  insert into builder_abuse_actions(project_id,report_id,action,reason,operator) values(item.project_id,item.id,'dismiss',trim(outcome),operator);
  return jsonb_build_object('id',item.id,'status',item.status);
end;
$$;

create function public.builder_operator_reports(report_status text default 'open') returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'projectId',r.project_id,'origin',r.origin,'category',r.category,'details',r.details,
    'contact',r.contact,'status',r.status,'createdAt',r.created_at,'reviewedAt',r.reviewed_at,'reviewer',r.reviewer,'outcome',r.outcome,
    'suspension',(select s.state from builder_project_suspensions s where s.project_id=r.project_id)) order by r.created_at desc),'[]'::jsonb)
  from (select * from builder_abuse_reports where status=report_status order by created_at desc limit 100) r
$$;

-- Members see only that publishing is paused; the report and reason stay private.
create function public.builder_project_suspension_state(target text, actor uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('state',s.state,'since',s.created_at) from builder_project_suspensions s
  where s.project_id=target and exists(select 1 from builder_project_members m where m.project_id=target and m.user_id=actor)
$$;
create function public.builder_project_suspension_summaries(actor uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('projectId',s.project_id,'state',s.state,'since',s.created_at) order by s.project_id),'[]'::jsonb)
  from builder_project_suspensions s join builder_project_members m on m.project_id=s.project_id and m.user_id=actor
$$;

alter table public.builder_function_limits drop constraint builder_function_limits_function_name_check;
alter table public.builder_function_limits add constraint builder_function_limits_function_name_check check(function_name in (
  'builder-projects','builder-account','builder-invite','builder-publish','builder-content','builder-contact','builder-billing','builder-billing-webhook','builder-report'
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
    when 'builder-report' then case when actor_id is null then 60 else 6 end
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

revoke all on function public.builder_assert_publishing_allowed(text),public.builder_publication_burst_check(text,uuid),
  public.builder_publication_suspension_guard(),public.builder_submit_abuse_report(uuid,text,text,jsonb),
  public.builder_operator_suspend(text,uuid,text,text,boolean),public.builder_operator_restore(text,text,text),
  public.builder_operator_dismiss_report(uuid,text,text),public.builder_operator_reports(text),
  public.builder_project_suspension_state(text,uuid),public.builder_project_suspension_summaries(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.builder_submit_abuse_report(uuid,text,text,jsonb),
  public.builder_operator_suspend(text,uuid,text,text,boolean),public.builder_operator_restore(text,text,text),
  public.builder_operator_dismiss_report(uuid,text,text),public.builder_operator_reports(text),
  public.builder_project_suspension_state(text,uuid),public.builder_project_suspension_summaries(uuid)
  to service_role;
