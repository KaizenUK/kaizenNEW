-- Explicit operator recovery runs only after the filesystem lock proves the
-- previous process stopped. Fence its remaining database requests as well.
alter table public.builder_releases
  add column recovery_artifact text,
  add column recovery_baseline_artifact text;

create function public.builder_release_recovery_begin(request_id uuid, expected_owner uuid, recovery_owner uuid,
  selected_artifact text, desired_artifact text, baseline_artifact text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_releases%rowtype; head uuid; previous_artifact text;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id for update;
  if item.id is null or expected_owner is null or recovery_owner is null or recovery_owner=expected_owner
    or selected_artifact is null or desired_artifact is null or baseline_artifact is null
    or selected_artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'
    or desired_artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$'
    or baseline_artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$' then
    raise exception using errcode='P0409',message='Invalid publication recovery identity';
  end if;
  if item.worker_id=recovery_owner then
    if item.recovery_artifact is distinct from desired_artifact or item.recovery_baseline_artifact is distinct from baseline_artifact then
      raise exception using errcode='P0409',message='This recovery already belongs to a different artifact';
    end if;
    return to_jsonb(item);
  end if;
  if item.worker_id is distinct from expected_owner then
    raise exception using errcode='P0409',message='Publication ownership changed. Inspect the current recovery before retrying';
  end if;
  if item.previous_release_id is not null then
    select artifact_id into previous_artifact from builder_releases where id=item.previous_release_id;
    if previous_artifact is distinct from baseline_artifact then
      raise exception using errcode='P0409',message='Recovery must use the recorded previous publication artifact';
    end if;
  end if;
  -- With no database head, the operator supplies the baseline retained in this
  -- release's verified local activation journal, never an arbitrary old build.
  if item.artifact_id is null or baseline_artifact=item.artifact_id
    or selected_artifact not in (item.artifact_id,baseline_artifact)
    or desired_artifact not in (item.artifact_id,baseline_artifact) then
    raise exception using errcode='P0409',message='Recovery does not belong to this publication and its previous artifact';
  end if;
  if exists(select 1 from builder_releases where id<>request_id and status in ('queued','building','activating','verifying','recovery_required')) then
    raise exception using errcode='P0409',message='Another publication is pending. Inspect it before recovering this release';
  end if;
  select release_id into head from builder_release_head where id='site';
  if item.status='live' then
    if head is distinct from item.id or desired_artifact<>item.artifact_id or selected_artifact<>item.artifact_id
      or item.snapshot is distinct from builder_live_snapshot() then
      raise exception using errcode='P0409',message='The publication is already committed. Use a new reviewed rollback to change it';
    end if;
  elsif item.status in ('building','activating','verifying','recovery_required','rolled_back') then
    if head is distinct from item.previous_release_id or item.baseline is distinct from builder_live_snapshot()
      or (item.status='rolled_back' and desired_artifact<>baseline_artifact) then
      raise exception using errcode='P0409',message='The live publication baseline changed. Inspect it before recovery';
    end if;
  else
    raise exception using errcode='P0409',message='This publication is not awaiting recovery';
  end if;
  update builder_releases set worker_id=recovery_owner,recovery_artifact=desired_artifact,recovery_baseline_artifact=baseline_artifact,
    status=case when status in ('building','activating','verifying') then 'recovery_required' else status end,
    error=case when status in ('building','activating','verifying','recovery_required') then 'An operator is verifying this publication and its usage.' else error end,
    updated_at=clock_timestamp() where id=request_id returning * into item;
  return to_jsonb(item);
end;
$$;

-- Publication promotion/refund and output settlement share one transaction.
-- Lost acknowledgements can be retried without publishing or charging twice.
create function public.builder_release_recovery_finish(request_id uuid, recovery_owner uuid, proof jsonb,
  usage_id uuid, source_commit text, sample jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item builder_releases%rowtype; head uuid; outcome text; detail text;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id for update;
  if item.id is null or recovery_owner is null or item.worker_id is distinct from recovery_owner
    or item.recovery_artifact is null or proof->>'artifactId' is distinct from item.recovery_artifact
    or proof->>'manifestSha256' is distinct from sample->>'manifestSha256' then
    raise exception using errcode='P0409',message='This verification does not belong to the current publication recovery';
  end if;
  if exists(select 1 from builder_releases where id<>request_id and status in ('queued','building','activating','verifying','recovery_required')) then
    raise exception using errcode='P0409',message='Another publication is pending. Keep recovery unresolved';
  end if;
  select release_id into head from builder_release_head where id='site';
  outcome:=case when item.recovery_artifact=item.artifact_id then 'live' else 'rolled_back' end;
  if item.status='live' then
    if outcome<>'live' or head is distinct from item.id or item.snapshot is distinct from builder_live_snapshot() or item.evidence is distinct from proof then
      raise exception using errcode='P0409',message='The committed publication no longer matches this recovery';
    end if;
  else
    if head is distinct from item.previous_release_id or item.baseline is distinct from builder_live_snapshot()
      or item.recovery_artifact not in (item.artifact_id,item.recovery_baseline_artifact) then
      raise exception using errcode='P0409',message='The live publication baseline changed during recovery';
    end if;
    if item.status=outcome then
      if item.evidence is distinct from proof then raise exception using errcode='P0409',message='The verified recovery artifact changed'; end if;
    else
      detail:=case when outcome='rolled_back' then 'The previous publication and output usage were restored and verified by the operator.' else null end;
      perform builder_advance_release(request_id,recovery_owner,outcome,proof,detail);
    end if;
  end if;
  perform builder_repository_output_settle('kaizen',usage_id,'production',item.recovery_artifact,source_commit,sample,'live');
  return jsonb_build_object('id',request_id,'status',outcome,'artifactId',item.recovery_artifact,'usageId',usage_id);
end;
$$;

revoke all on function public.builder_release_recovery_begin(uuid,uuid,uuid,text,text,text),
  public.builder_release_recovery_finish(uuid,uuid,jsonb,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.builder_release_recovery_begin(uuid,uuid,uuid,text,text,text),
  public.builder_release_recovery_finish(uuid,uuid,jsonb,uuid,text,jsonb) to service_role;
