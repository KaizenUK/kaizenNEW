-- Client destinations are provisioned by the server operator after Nginx setup.
-- Browser users cannot choose filesystem paths, worker routing or service secrets.
create or replace function public.builder_project_access(target text, capability text default 'read', actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(exists(select 1 from public.builder_project_members m join public.builder_projects p on p.id=m.project_id
    where m.project_id=target and m.user_id=actor and (actor=auth.uid() or
      coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('request.jwt.claim.role',true))='service_role')
    and case capability when 'read' then true when 'edit' then not p.archived
      when 'owner' then m.role='owner' when 'publish' then not p.archived and m.can_publish else false end),false);
$$;
create table public.builder_client_destinations (
  id uuid primary key,
  project_id text not null references public.builder_projects(id),
  environment text not null check (environment in ('staging','production')),
  origin text not null unique check (origin ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'),
  label text not null check (length(trim(label)) between 1 and 100),
  worker_id text not null check (worker_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  active_artifact_id text not null check (active_artifact_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$'),
  active_job_id uuid,
  created_at timestamptz not null default now(),
  check (project_id <> 'kaizen'),
  unique(project_id,environment), unique(id,project_id)
);
create table public.builder_client_reviews (
  id uuid primary key,
  project_id text not null,
  destination_id uuid not null,
  actor uuid not null references auth.users(id),
  action text not null check (action in ('publish','rollback','unpublish')),
  snapshot jsonb,
  workspace_version integer not null,
  destination_version integer not null,
  previous_artifact_id text not null,
  artifact_id text not null,
  rollback_of uuid,
  expires_at timestamptz not null default now()+interval '15 minutes',
  foreign key(destination_id,project_id) references public.builder_client_destinations(id,project_id),
  check (snapshot is null or octet_length(snapshot::text)<=55000000)
);
create table public.builder_client_jobs (
  id uuid primary key,
  project_id text not null,
  destination_id uuid not null,
  destination jsonb not null,
  destination_version integer not null,
  worker_id text not null,
  requested_by uuid not null references auth.users(id),
  action text not null check (action in ('publish','rollback','unpublish')),
  snapshot jsonb,
  previous_artifact_id text not null,
  artifact_id text not null,
  rollback_of uuid references public.builder_client_jobs(id),
  phase text not null default 'queued' check (phase in ('queued','building','activating','verifying','live','failed','rolled_back','recovery_required')),
  owner_token uuid,
  evidence jsonb,
  error text,
  log text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(destination_id,project_id) references public.builder_client_destinations(id,project_id),
  unique(id,destination_id),
  check (snapshot is null or octet_length(snapshot::text)<=55000000)
);
alter table public.builder_client_destinations add foreign key(active_job_id,id) references public.builder_client_jobs(id,destination_id);
create unique index builder_client_one_pending on public.builder_client_jobs(destination_id)
  where phase in ('queued','building','activating','verifying','recovery_required');
create index builder_client_history on public.builder_client_jobs(project_id,created_at desc,id);
alter table public.builder_client_destinations enable row level security;
alter table public.builder_client_reviews enable row level security;
alter table public.builder_client_jobs enable row level security;
create policy client_destinations_read on public.builder_client_destinations for select to authenticated using(public.builder_project_access(project_id));
create policy client_reviews_read on public.builder_client_reviews for select to authenticated using(public.builder_project_access(project_id) and actor=auth.uid());
create policy client_jobs_read on public.builder_client_jobs for select to authenticated using(public.builder_project_access(project_id));
revoke all on public.builder_client_destinations,public.builder_client_reviews,public.builder_client_jobs from public,anon,authenticated;
grant select(id,project_id,environment,origin,label,enabled,version,active_artifact_id,active_job_id,created_at) on public.builder_client_destinations to authenticated;
grant select on public.builder_client_reviews to authenticated;
grant select(id,project_id,destination_id,destination,destination_version,requested_by,action,snapshot,previous_artifact_id,artifact_id,rollback_of,phase,evidence,error,log,created_at,updated_at) on public.builder_client_jobs to authenticated;
grant all on public.builder_client_destinations,public.builder_client_reviews,public.builder_client_jobs to service_role;

create function public.builder_client_destination_version() returns trigger language plpgsql set search_path=public as $$
begin
  if (new.project_id,new.environment,new.origin) is distinct from (old.project_id,old.environment,old.origin) then raise exception 'Destination identity is immutable. Provision a new destination'; end if;
  if (new.label,new.worker_id,new.enabled) is distinct from (old.label,old.worker_id,old.enabled) then new.version:=old.version+1; end if;
  return new;
end;
$$;
create trigger builder_client_destination_version before update on public.builder_client_destinations for each row execute function public.builder_client_destination_version();

create function public.builder_client_destination_public(d public.builder_client_destinations) returns jsonb
language sql immutable set search_path=public as $$
  select jsonb_build_object('projectId',d.project_id,'destinationId',d.id,'environment',d.environment,'origin',d.origin,'label',d.label);
$$;
revoke all on function public.builder_client_destination_public(public.builder_client_destinations) from public,anon,authenticated;
grant execute on function public.builder_client_destination_public(public.builder_client_destinations) to service_role;

create function public.builder_client_provision(target text, destination_id uuid, environment text, origin text, label text, worker text, baseline_artifact text, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.builder_client_destinations;
begin
  perform 1 from builder_projects where id=target and id<>'kaizen' and not archived for update;
  if not found then raise exception 'Provision an active client project'; end if;
  if verification->>'artifactId' is distinct from baseline_artifact or verification->>'projectId' is distinct from target
    or verification->>'destinationId' is distinct from destination_id::text or verification->>'environment' is distinct from environment
    or verification->>'origin' is distinct from origin or coalesce(verification->>'manifestSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Verified destination baseline evidence required'; end if;
  select * into d from builder_client_destinations where id=destination_id for update;
  if found then
    if (d.project_id,d.environment,d.origin,d.worker_id,d.active_artifact_id) is distinct from (target,environment,origin,worker,baseline_artifact) then raise exception 'Existing destination differs. Operator reconciliation is required'; end if;
    return builder_client_destination_public(d);
  end if;
  insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id)
    values(destination_id,target,environment,origin,label,worker,baseline_artifact) returning * into d;
  return builder_client_destination_public(d);
end;
$$;
revoke all on function public.builder_client_provision(text,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.builder_client_provision(text,uuid,text,text,text,text,text,jsonb) to service_role;

-- All mutations are service-only: the Edge API first verifies the JWT and validates
-- the complete workspace. Permission and version checks are repeated under locks.
create function public.builder_client_review(request_id uuid, target text, actor uuid, destination_id uuid,
  expected_workspace_version integer, expected_destination_version integer, release_action text, candidate jsonb default null, rollback_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.builder_client_destinations; w public.builder_project_workspaces; prior public.builder_client_jobs; r public.builder_client_reviews;
begin
  perform 1 from builder_projects where id=target for update;
  if not builder_project_access(target,'publish',actor) then raise exception 'Project publish permission required'; end if;
  select * into d from builder_client_destinations where id=destination_id and project_id=target for update;
  if not found or not d.enabled then raise exception 'Destination is not enabled for this project'; end if;
  if d.version<>expected_destination_version then raise exception 'Destination changed. Review it again'; end if;
  select * into w from builder_project_workspaces where project_id=target;
  if release_action='publish' then
    if w.version<>expected_workspace_version then raise exception 'Saved drafts changed during review'; end if;
    if candidate->>'schemaVersion' is distinct from '1' or candidate->>'projectId' is distinct from target
      or candidate->'workspace' is distinct from w.payload or jsonb_array_length(w.payload->'pages')=0 then raise exception 'Invalid publication snapshot'; end if;
  elsif release_action='rollback' then
    select * into prior from builder_client_jobs where id=rollback_id and project_id=target and builder_client_jobs.destination_id=d.id and phase='live';
    if not found or prior.artifact_id=d.active_artifact_id then raise exception 'Choose a retained verified release for this destination'; end if;
    candidate:=prior.snapshot;
  elsif release_action='unpublish' then candidate:=null;
  else raise exception 'Unsupported publication action'; end if;
  delete from builder_client_reviews where builder_client_reviews.actor=builder_client_review.actor and expires_at<now();
  if (select count(*) from builder_client_reviews where builder_client_reviews.actor=builder_client_review.actor)>=30 then raise exception 'Too many active publication reviews'; end if;
  insert into builder_client_reviews(id,project_id,destination_id,actor,action,snapshot,workspace_version,destination_version,previous_artifact_id,artifact_id,rollback_of)
    values(request_id,target,d.id,actor,release_action,candidate,w.version,d.version,d.active_artifact_id,
      case when release_action='rollback' then prior.artifact_id else request_id::text end,case when release_action='rollback' then rollback_id end)
    returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.builder_client_review(uuid,text,uuid,uuid,integer,integer,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.builder_client_review(uuid,text,uuid,uuid,integer,integer,text,jsonb,uuid) to service_role;

create function public.builder_client_start(target text, actor uuid, review_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.builder_client_destinations; r public.builder_client_reviews; j public.builder_client_jobs;
begin
  perform 1 from builder_projects where id=target for update;
  if not builder_project_access(target,'publish',actor) then raise exception 'Project publish permission required'; end if;
  select * into j from builder_client_jobs where id=review_id and project_id=target and requested_by=actor;
  if found then return to_jsonb(j); end if;
  select * into r from builder_client_reviews where id=review_id and project_id=target and builder_client_reviews.actor=builder_client_start.actor;
  if not found or r.expires_at<=now() then raise exception 'Publication review expired. Review it again'; end if;
  select * into d from builder_client_destinations where id=r.destination_id for update;
  if not d.enabled or d.version<>r.destination_version or d.active_artifact_id<>r.previous_artifact_id then raise exception 'Destination or live baseline changed. Review again'; end if;
  if r.action='publish' and r.workspace_version<>(select version from builder_project_workspaces where project_id=target) then raise exception 'Saved drafts changed after review'; end if;
  if exists(select 1 from builder_client_jobs where destination_id=d.id and phase in ('queued','building','activating','verifying','recovery_required')) then raise exception 'This destination has a pending release or recovery'; end if;
  insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id,rollback_of)
    values(r.id,target,d.id,builder_client_destination_public(d),d.version,d.worker_id,actor,r.action,r.snapshot,r.previous_artifact_id,r.artifact_id,r.rollback_of) returning * into j;
  delete from builder_client_reviews where id=r.id;
  return to_jsonb(j);
end;
$$;
revoke all on function public.builder_client_start(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.builder_client_start(text,uuid,uuid) to service_role;

-- Claim ownership is never transferred on a timer. A stopped worker requires
-- explicit recovery coordinated with the destination's process/activation locks.
create function public.builder_client_claim(job_id uuid, worker text, token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
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
  if not builder_project_access(j.project_id,'publish',j.requested_by) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
  if d.version<>j.destination_version or d.active_artifact_id<>j.previous_artifact_id or builder_client_destination_public(d) is distinct from j.destination then raise exception 'Destination changed before worker claim'; end if;
  update builder_client_jobs set owner_token=token,phase='building',updated_at=clock_timestamp() where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;
revoke all on function public.builder_client_claim(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.builder_client_claim(uuid,text,uuid) to service_role;

create function public.builder_client_fail_queued(job_id uuid, worker text, detail text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.builder_client_jobs;
begin
  select * into j from builder_client_jobs where id=job_id;
  if not found then raise exception 'Release job not found'; end if;
  perform 1 from builder_projects where id=j.project_id for update;
  perform 1 from builder_client_destinations where id=j.destination_id for update;
  select * into j from builder_client_jobs where id=job_id for update;
  if worker is distinct from j.worker_id or j.owner_token is not null or j.phase not in ('queued','failed') then raise exception 'A claimed release cannot be cancelled as queued'; end if;
  update builder_client_jobs set phase='failed',error=left(detail,2000),updated_at=clock_timestamp() where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;
revoke all on function public.builder_client_fail_queued(uuid,text,text) from public,anon,authenticated;
grant execute on function public.builder_client_fail_queued(uuid,text,text) to service_role;

create function public.builder_client_progress(job_id uuid, token uuid, next_phase text, detail text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
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
    if not builder_project_access(j.project_id,'publish',j.requested_by) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
    if d.version<>j.destination_version or d.active_artifact_id<>j.previous_artifact_id or builder_client_destination_public(d) is distinct from j.destination then raise exception 'Destination changed during publication'; end if;
    if (j.phase='activating' and next_phase='building') or (j.phase='verifying' and next_phase in ('building','activating')) then raise exception 'Release phase cannot move backwards'; end if;
  end if;
  update builder_client_jobs set phase=next_phase,updated_at=clock_timestamp(),log=right(log||coalesce(detail,'')||E'\n',100000),
    error=case when next_phase in ('failed','rolled_back','recovery_required') then left(detail,2000) else null end where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;
revoke all on function public.builder_client_progress(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.builder_client_progress(uuid,uuid,text,text) to service_role;

create function public.builder_client_finalize(job_id uuid, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
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
  if not builder_project_access(j.project_id,'publish',j.requested_by) or not d.enabled then raise exception 'Project publish permission was revoked or destination disabled'; end if;
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
revoke all on function public.builder_client_finalize(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.builder_client_finalize(uuid,uuid,jsonb) to service_role;
