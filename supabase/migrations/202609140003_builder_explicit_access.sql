-- Do not rely on platform default privileges: RLS does not protect TRUNCATE,
-- REFERENCES or TRIGGER. Keep the existing row policies and RPC write paths,
-- and grant browsers only the direct operations used by the application.
revoke all on
  public.builder_editors, public.builder_pages, public.builder_publications,
  public.builder_assets, public.builder_saved, public.builder_site,
  public.builder_contact_requests, public.builder_releases, public.builder_release_head,
  public.builder_previews, public.builder_routes, public.builder_public_redirects,
  public.builder_projects, public.builder_project_members, public.builder_project_workspaces,
  public.builder_project_previews, public.builder_client_destinations,
  public.builder_client_reviews, public.builder_client_jobs, public.builder_client_errors,
  public.builder_invitation_limits, public.builder_account_deletions,
  public.builder_account_deletion_projects, public.builder_function_limits
from public, anon, authenticated;

grant select on public.builder_publications, public.builder_public_redirects to anon, authenticated;
grant select on public.builder_pages, public.builder_site, public.builder_routes to authenticated;
grant select, insert, update on public.builder_assets to authenticated;
grant select, insert, update, delete on public.builder_saved to authenticated;
grant select on public.builder_projects, public.builder_project_members,
  public.builder_project_workspaces, public.builder_project_previews,
  public.builder_client_reviews to authenticated;
grant select(id,project_id,environment,origin,label,enabled,version,active_artifact_id,active_job_id,created_at)
  on public.builder_client_destinations to authenticated;
grant select(id,project_id,destination_id,destination,destination_version,requested_by,action,snapshot,
  previous_artifact_id,artifact_id,rollback_of,phase,evidence,error,log,created_at,updated_at)
  on public.builder_client_jobs to authenticated;

-- Function defaults may also grant EXECUTE directly to anon/authenticated;
-- revoking PUBLIC alone does not remove those grants. Clear browser execution
-- on the builder namespace, then restore only the reviewed browser RPCs.
-- Service-role grants and non-builder objects are unchanged.
do $$ declare target record; begin
  for target in
    select p.oid::regprocedure as signature,p.prosecdef as definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,8)='builder_'
  loop
    execute format('revoke all on function %s from public,anon,authenticated',target.signature);
    -- Listing pg_temp last prevents a caller's temporary relation from
    -- shadowing an unqualified application table in a SECURITY DEFINER RPC.
    if target.definer then
      execute format('alter function %s set search_path=public,pg_temp',target.signature);
    end if;
  end loop;
end $$;

grant execute on function
  public.builder_is_editor(),
  public.builder_save_page(uuid,integer,jsonb,text),
  public.builder_save_site(integer,jsonb),
  public.builder_update_asset_metadata(jsonb),
  public.builder_replace_asset(jsonb),
  public.builder_backup_workspace(),
  public.builder_restore_backup(jsonb),
  public.builder_set_asset_image(jsonb,jsonb),
  public.builder_set_asset_conversion(jsonb,jsonb),
  public.builder_list_releases(),
  public.builder_create_preview(uuid,jsonb,integer),
  public.builder_read_preview(uuid),
  public.builder_list_previews(),
  public.builder_revoke_preview(uuid),
  public.builder_save_routes(integer,jsonb),
  public.builder_project_access(text,text,uuid),
  public.builder_create_project(text),
  public.builder_update_project(text,integer,text,boolean),
  public.builder_set_project_member(text,uuid,text,boolean),
  public.builder_client_history(text,uuid),
  public.builder_legacy_project_id(),
  public.builder_member_directory(text)
to authenticated;
