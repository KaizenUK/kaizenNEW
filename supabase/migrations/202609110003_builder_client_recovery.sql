-- Recovery is operator-only and keeps the original claim token. The host must
-- prove that token's recorded process has stopped before invoking these RPCs.
alter table public.builder_client_jobs add column recovery_target text;
alter table public.builder_client_jobs add column recovery_destination_version integer;
alter table public.builder_client_jobs add column recovery_evidence jsonb;

create function public.builder_client_recovery_begin(job_id uuid, worker text, token uuid, selected_artifact text) returns jsonb
language plpgsql security definer set search_path=public as $$
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
    if not builder_project_access(j.project_id,'publish',j.requested_by) or not d.enabled then raise exception 'Publish permission was revoked or destination disabled. Restore the previous artifact'; end if;
    if d.version<>j.destination_version then raise exception 'Destination configuration changed. Restore the previous artifact'; end if;
  end if;
  update builder_client_jobs set phase='recovery_required',recovery_target=selected_artifact,recovery_destination_version=d.version,
    updated_at=clock_timestamp(),error='Operator recovery is checking the served artifact' where id=job_id returning * into j;
  return to_jsonb(j);
end;
$$;
revoke all on function public.builder_client_recovery_begin(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.builder_client_recovery_begin(uuid,text,uuid,text) to service_role;

create function public.builder_client_recovery_finalize(job_id uuid, worker text, token uuid, verification jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
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
    if not coalesce(committed,false) and (not builder_project_access(j.project_id,'publish',j.requested_by) or not d.enabled) then raise exception 'Publish permission changed during recovery. Restore the previous artifact'; end if;
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
revoke all on function public.builder_client_recovery_finalize(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.builder_client_recovery_finalize(uuid,text,uuid,jsonb) to service_role;

create function public.builder_client_recovery_error(job_id uuid, token uuid, detail text) returns void
language plpgsql security definer set search_path=public as $$
begin
  update builder_client_jobs set error=left(detail,2000),updated_at=clock_timestamp() where id=job_id and owner_token=token and phase='recovery_required';
  if not found then raise exception 'Recovery ownership or state changed'; end if;
end;
$$;
revoke all on function public.builder_client_recovery_error(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.builder_client_recovery_error(uuid,uuid,text) to service_role;
