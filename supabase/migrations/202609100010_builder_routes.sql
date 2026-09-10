-- Redirects have their own drafts and join the verified publication snapshot.
do $$ begin
  if exists(select 1 from public.builder_releases where status in ('queued','building','activating','verifying','recovery_required')) then
    raise exception 'Finish or reconcile the pending release before installing redirect support'; end if;
end $$;
create table public.builder_routes(id text primary key check(id='site'),payload jsonb not null);
insert into public.builder_routes values('site','{"version":0,"draft":[],"published":[],"revisions":[]}');
alter table public.builder_routes enable row level security;
revoke all on public.builder_routes from public,anon,authenticated;
grant select on public.builder_routes to authenticated,service_role;
create policy builder_routes_read on public.builder_routes for select to authenticated using(public.builder_is_editor());
create view public.builder_public_redirects with(security_barrier=true) as select id,payload->'published' as rules from public.builder_routes;
revoke all on public.builder_public_redirects from public;
grant select on public.builder_public_redirects to anon,authenticated,service_role;

create function public.builder_redirect_path(input text) returns text language plpgsql immutable set search_path=public as $$
declare result text;
begin
  result := trim(input);
  if result is null or result='' then raise exception 'Add a redirect path'; end if;
  if left(result,1)<>'/' then result:='/'||result; end if;
  if length(result)>200 or result !~ '^/[a-zA-Z0-9/_.-]*$' or result like '%//%' or result ~ '(^|/)(\.|\.\.)(/|$)' then raise exception 'Use a valid internal path of at most 200 characters'; end if;
  result:=rtrim(result,'/');
  if result='' then return '/'; end if;
  if result !~* '\.[a-z0-9]+$' then result:=result||'/'; end if;
  return result;
end;
$$;
revoke all on function public.builder_redirect_path(text) from public,anon,authenticated;

create function public.builder_validate_redirects(rules jsonb) returns jsonb language plpgsql immutable set search_path=public as $$
declare item jsonb; normalized jsonb:='[]'; source text; destination text; visited text[]; target text;
begin
  if jsonb_typeof(rules) is distinct from 'array' or jsonb_array_length(rules)>200 or length(rules::text)>200000 then raise exception 'Use at most 200 redirects'; end if;
  for item in select value from jsonb_array_elements(rules) loop
    if item->>'id' is null or item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'status') is distinct from 'number' or item->>'status' not in ('301','302') then raise exception 'Each redirect needs a unique ID and a 301 or 302 status'; end if;
    source:=public.builder_redirect_path(item->>'source'); destination:=public.builder_redirect_path(item->>'destination');
    if source='/' or source ~* '^/(builder|studio|api|editor-api|_astro|builder-media|__builder[^/]*|\.well-known|\.kaizen-builder|\.git|\.env[^/]*|blog|blogdetail|insights|services|products|case-studies|about|contact|thank-you|index|home|review|pledge|contract-product-owner|performance-scanner|get-started|privacy-policy|cookie-policy|gdpr-policy|terms-and-conditions|web-design[^/]*|digital-transformation|agile-coaching|project-rescue|product-owner)(/|$)' then raise exception 'This source belongs to the existing site or editor: %',source; end if;
    if destination ~* '^/(builder|studio|api|editor-api|_astro|builder-media|__builder[^/]*|\.well-known|\.kaizen-builder|\.git|\.env[^/]*)(/|$)' then raise exception 'Redirect visitors to a public page'; end if;
    if source=destination or exists(select 1 from jsonb_array_elements(normalized) r where r->>'id'=item->>'id' or r->>'source'=source) then raise exception 'Redirect source is repeated or points to itself: %',source; end if;
    normalized:=normalized||jsonb_build_array(jsonb_build_object('id',item->>'id','source',source,'destination',destination,'status',(item->>'status')::integer));
  end loop;
  for item in select value from jsonb_array_elements(normalized) loop
    visited:=array[item->>'source']; target:=item->>'destination';
    loop
      if target=any(visited) then raise exception 'Redirect cycle at %',item->>'source'; end if;
      visited:=array_append(visited,target);
      select r->>'destination' into target from jsonb_array_elements(normalized) r where r->>'source'=target;
      exit when target is null;
    end loop;
  end loop;
  return normalized;
end;
$$;
revoke all on function public.builder_validate_redirects(jsonb) from public,anon,authenticated;

create function public.builder_save_routes(expected_version integer,rules jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare old jsonb; result jsonb; history jsonb; normalized jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select payload into old from builder_routes where id='site';
  if (old->>'version')::integer is distinct from expected_version then raise exception 'Redirects changed in another window. Reopen them before saving.'; end if;
  normalized:=public.builder_validate_redirects(rules);
  history:=old->'revisions'||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',clock_timestamp(),'rules',normalized));
  result:=old||jsonb_build_object('version',expected_version+1,'draft',normalized,'revisions',public.builder_backup_history(history,30));
  update builder_routes set payload=result where id='site';
  return result;
end;
$$;
revoke all on function public.builder_save_routes(integer,jsonb) from public,anon;
grant execute on function public.builder_save_routes(integer,jsonb) to authenticated;

create or replace function public.builder_live_snapshot() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('schemaVersion',1,
    'pages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'document',document) order by id) from builder_publications),'[]'::jsonb),
    'site',coalesce((select payload->'published' from builder_site where id='site'),'null'::jsonb),
    'redirects',coalesce((select payload->'published' from builder_routes where id='site'),'[]'::jsonb));
$$;

create function public.builder_release_routes_snapshot() returns trigger language plpgsql security definer set search_path=public as $$
declare rules jsonb;
begin
  -- Old retained artifacts predate builder redirects; their missing field means an empty set.
  rules:=public.builder_validate_redirects(coalesce(NEW.snapshot->'redirects','[]'::jsonb));
  if exists(select 1 from jsonb_array_elements(rules) r,jsonb_array_elements(NEW.snapshot->'pages') p
    where r->>'source'=public.builder_redirect_path(p->'document'->>'slug')) then raise exception 'A published page already uses this redirect source. Publish its new URL first.'; end if;
  if exists(select 1 from jsonb_array_elements(rules) r,builder_pages p
    where r->>'source'=public.builder_redirect_path(p.payload->'draft'->>'slug')) then raise exception 'A current draft uses this redirect source. Change that page URL before publishing redirects.'; end if;
  NEW.snapshot:=jsonb_set(NEW.snapshot,'{redirects}',rules);
  return NEW;
end;
$$;
revoke all on function public.builder_release_routes_snapshot() from public,anon,authenticated;
create trigger builder_release_redirect_snapshot before insert on public.builder_releases for each row execute function public.builder_release_routes_snapshot();

create function public.builder_release_routes_commit() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update builder_routes set payload=jsonb_set(payload,'{published}',coalesce(NEW.snapshot->'redirects','[]'::jsonb)) where id='site';
  return NEW;
end;
$$;
revoke all on function public.builder_release_routes_commit() from public,anon,authenticated;
create trigger builder_release_redirect_commit after update of status on public.builder_releases
  for each row when(NEW.status='live' and OLD.status<>'live') execute function public.builder_release_routes_commit();

create function public.builder_queue_routes_release(request_id uuid,editor_id uuid,expected_version integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.builder_releases; routes jsonb; baseline jsonb; current_head uuid; input jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if editor_id is null or not exists(select 1 from builder_editors where user_id=editor_id) then raise exception 'Builder editor access required'; end if;
  input:=jsonb_build_object('action','redirects','version',expected_version);
  select * into item from builder_releases where id=request_id;
  if found then
    if item.request is distinct from input or item.requested_by is distinct from editor_id then raise exception 'Release request ID was already used for different content'; end if;
    return public.builder_release_summary(item);
  end if;
  if exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required')) then raise exception 'Another release is pending. Inspect its status before publishing again.'; end if;
  select payload into routes from builder_routes where id='site';
  if (routes->>'version')::integer is distinct from expected_version then raise exception 'Save the latest redirects before publishing'; end if;
  baseline:=public.builder_live_snapshot();
  select release_id into current_head from builder_release_head where id='site';
  insert into builder_releases(id,requested_by,request,snapshot,baseline,previous_release_id)
    values(request_id,editor_id,input,jsonb_set(baseline,'{redirects}',routes->'draft'),baseline,current_head) returning * into item;
  return public.builder_release_summary(item);
end;
$$;
revoke all on function public.builder_queue_routes_release(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.builder_queue_routes_release(uuid,uuid,integer) to service_role;

create function public.builder_page_redirect_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare source text; live_rules jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  source:=public.builder_redirect_path(NEW.payload->'draft'->>'slug');
  select snapshot->'redirects' into live_rules from builder_releases where id::text=current_setting('kaizen.release_commit',true) and status in ('verifying','recovery_required');
  if live_rules is null then select payload->'published' into live_rules from builder_routes where id='site'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(live_rules,'[]'::jsonb)) r where r->>'source'=source)
    or exists(select 1 from builder_releases,jsonb_array_elements(coalesce(snapshot->'redirects','[]'::jsonb)) r where status in ('queued','building','activating','verifying','recovery_required') and r->>'source'=source) then
    raise exception 'This URL has a published or pending redirect. Remove and publish that redirect first.'; end if;
  return NEW;
end;
$$;
revoke all on function public.builder_page_redirect_guard() from public,anon,authenticated;
create trigger builder_page_redirect_reservation before insert or update on public.builder_pages for each row execute function public.builder_page_redirect_guard();

-- Wrap the existing atomic editable backup transaction; redirect restoration remains draft-only.
alter function public.builder_backup_workspace() rename to builder_backup_workspace_without_routes;
revoke all on function public.builder_backup_workspace_without_routes() from public,anon,authenticated;
create function public.builder_backup_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  return public.builder_backup_workspace_without_routes()||jsonb_build_object('routes',(select payload from builder_routes where id='site'));
end;
$$;
revoke all on function public.builder_backup_workspace() from public,anon;
grant execute on function public.builder_backup_workspace() to authenticated;

alter function public.builder_restore_backup(jsonb) rename to builder_restore_backup_without_routes;
revoke all on function public.builder_restore_backup_without_routes(jsonb) from public,anon,authenticated;
create function public.builder_restore_backup(plan jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare routes jsonb; result jsonb; restored jsonb; revision jsonb;
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select payload into routes from builder_routes where id='site';
  if plan->'routes' is not null and plan->'routes'<>'null'::jsonb then
    if (routes->>'version')::integer is distinct from (plan->'expected'->>'routeVersion')::integer then raise exception 'Redirects changed. Review the backup again.'; end if;
    if jsonb_typeof(plan->'routes'->'revisions') is distinct from 'array' or jsonb_array_length(plan->'routes'->'revisions')>30 then raise exception 'Invalid redirect history'; end if;
    perform public.builder_validate_redirects(plan->'routes'->'published');
    for revision in select value from jsonb_array_elements(plan->'routes'->'revisions') loop perform public.builder_validate_redirects(revision->'rules'); end loop;
  end if;
  result:=public.builder_restore_backup_without_routes(plan);
  if plan->'routes' is not null and plan->'routes'<>'null'::jsonb then
    restored:=public.builder_save_routes((routes->>'version')::integer,plan->'routes'->'draft');
    restored:=jsonb_set(restored,'{revisions}',public.builder_backup_history(plan->'routes'->'revisions'||routes->'revisions'||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',clock_timestamp(),'rules',routes->'draft'))||jsonb_build_array(restored->'revisions'->-1),30));
    update builder_routes set payload=restored where id='site';
  end if;
  return result||jsonb_build_object('routes',(select payload from builder_routes where id='site'));
end;
$$;
revoke all on function public.builder_restore_backup(jsonb) from public,anon;
grant execute on function public.builder_restore_backup(jsonb) to authenticated;
