-- Release history states whether a verified release can still be restored.
-- Retirement records stay private: history exposes only retained, removing or
-- removed. Audit rows are never deleted or rewritten by this projection.
create function public.builder_release_retention_phase(target text, release_scope text, artifact text) returns text
language sql stable security definer set search_path=public,pg_temp as $$
  select case when artifact is null then null else coalesce(
    (select case r.phase when 'pending' then 'retained' else r.phase end from builder_release_retirements r
      where r.project_id=target and r.scope=release_scope and r.artifact_id=artifact),'retained') end
$$;

-- Browser history is a security-invoker function, so it needs this narrow wrapper.
create function public.builder_release_availability(target text, release_scope text, artifact text) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if target='kaizen' or release_scope !~ '^client:' or not builder_project_access(target,'read') then
    raise exception using errcode='42501',message='Project access required'; end if;
  return builder_release_retention_phase(target,release_scope,artifact);
end;
$$;

create or replace function public.builder_client_history(target text, before_job uuid default null) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare anchor_time timestamptz; result jsonb;
begin
  if not builder_project_access(target,'read') then raise exception 'Project access required'; end if;
  if before_job is not null then
    select created_at into anchor_time from builder_client_jobs where project_id=target and id=before_job;
    if not found then raise exception 'Invalid release history cursor. Open the latest releases'; end if;
  end if;
  with visible as not materialized (
    select id,project_id,destination_id,destination,action,phase,previous_artifact_id,artifact_id,rollback_of,error,log,created_at,updated_at
      from builder_client_jobs where project_id=target
  ), page as (
    select * from visible where before_job is null or (created_at,id)<(anchor_time,before_job)
      order by created_at desc,id desc limit 51
  ), current_jobs as (
    select * from visible where phase in ('queued','building','activating','verifying','recovery_required')
      or id in (select active_job_id from builder_client_destinations where project_id=target and enabled and domain_ready)
  ), destinations as (
    select id,project_id,environment,origin,label,(enabled and domain_ready) as enabled,version,active_artifact_id,active_job_id
      from builder_client_destinations where project_id=target
  )
  select jsonb_build_object(
    'destinations',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from destinations d),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('availability',
      builder_release_availability(target,'client:'||p.destination_id::text,p.artifact_id)) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'currentRows',coalesce((select jsonb_agg(to_jsonb(j)||jsonb_build_object('availability',
      builder_release_availability(target,'client:'||j.destination_id::text,j.artifact_id)) order by j.created_at desc,j.id desc) from current_jobs j),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.builder_release_summary(item public.builder_releases) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',item.id,'action',item.request->>'action','status',item.status,
    'createdAt',item.created_at,'updatedAt',item.updated_at,'artifactId',item.artifact_id,
    'previousReleaseId',item.previous_release_id,'rollbackOf',item.rollback_of,'error',item.error,
    'live',exists(select 1 from builder_release_head where release_id=item.id),
    'availability',public.builder_release_retention_phase('kaizen','repository:production',item.artifact_id));
$$;

revoke all on function public.builder_release_retention_phase(text,text,text),public.builder_release_availability(text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.builder_release_summary(public.builder_releases) from public,anon,authenticated;
grant execute on function public.builder_release_availability(text,text,text) to authenticated;
