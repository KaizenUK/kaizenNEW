-- Read-only keyset pagination; the cursor is resolved inside the caller's RLS scope.
create function public.builder_client_history(target text, before_job uuid default null) returns jsonb
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
      or id in (select active_job_id from builder_client_destinations where project_id=target)
  ), destinations as (
    select id,project_id,environment,origin,label,enabled,version,active_artifact_id,active_job_id
      from builder_client_destinations where project_id=target
  )
  select jsonb_build_object(
    'destinations',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from destinations d),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'currentRows',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc,j.id desc) from current_jobs j),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.builder_client_history(text,uuid) from public,anon;
grant execute on function public.builder_client_history(text,uuid) to authenticated;
create index builder_client_history_page on public.builder_client_jobs(project_id,created_at desc,id desc);
