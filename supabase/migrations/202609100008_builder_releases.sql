-- One Supabase builder workspace corresponds to one independently deployed site.
-- Apply with the coordinated publishing function/worker, not as a standalone rollout.
-- Candidate snapshots and worker ownership are private. No elapsed-time takeover is allowed.
create table public.builder_releases (
  id uuid primary key,
  requested_by uuid references auth.users(id),
  request jsonb not null,
  snapshot jsonb not null,
  baseline jsonb not null,
  previous_release_id uuid references public.builder_releases(id),
  rollback_of uuid references public.builder_releases(id),
  status text not null default 'queued' check (status in ('queued','building','activating','verifying','live','failed','rolled_back','recovery_required')),
  worker_id uuid,
  artifact_id text,
  evidence jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index builder_one_pending_release on public.builder_releases ((true))
  where status in ('queued','building','activating','verifying','recovery_required');
create table public.builder_release_head (
  id text primary key check (id='site'),
  release_id uuid references public.builder_releases(id)
);
insert into public.builder_release_head(id) values('site');
alter table public.builder_releases enable row level security;
alter table public.builder_release_head enable row level security;
revoke all on public.builder_releases,public.builder_release_head from public,anon,authenticated;
grant select on public.builder_releases,public.builder_release_head to service_role;

create function public.builder_live_snapshot() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('schemaVersion',1,
    'pages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'document',document) order by id) from builder_publications),'[]'::jsonb),
    'site',coalesce((select payload->'published' from builder_site where id='site'),'null'::jsonb));
$$;
revoke all on function public.builder_live_snapshot() from public,anon,authenticated;
grant execute on function public.builder_live_snapshot() to service_role;

-- Public metadata to editors only; snapshot/worker credentials never appear in status responses.
create function public.builder_release_summary(item public.builder_releases) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',item.id,'action',item.request->>'action','status',item.status,
    'createdAt',item.created_at,'updatedAt',item.updated_at,'artifactId',item.artifact_id,
    'previousReleaseId',item.previous_release_id,'rollbackOf',item.rollback_of,'error',item.error,
    'live',exists(select 1 from builder_release_head where release_id=item.id));
$$;
revoke all on function public.builder_release_summary(public.builder_releases) from public,anon,authenticated;

create function public.builder_list_releases() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.builder_is_editor() then raise exception 'Builder editor access required'; end if;
  return coalesce((select jsonb_agg(public.builder_release_summary(r) order by r.created_at desc,r.id) from
    (select * from builder_releases order by created_at desc,id limit 50) r),'[]'::jsonb);
end;
$$;
revoke all on function public.builder_list_releases() from public,anon;
grant execute on function public.builder_list_releases() to authenticated;

create function public.builder_queue_release(request_id uuid, editor_id uuid, input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare existing public.builder_releases; candidate jsonb; baseline jsonb; site_state jsonb;
  versions jsonb; assets jsonb; change jsonb; page jsonb; current_head uuid; action text;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if editor_id is null or not exists(select 1 from builder_editors where user_id=editor_id) then
    raise exception 'Builder editor access required'; end if;
  select * into existing from builder_releases where id=request_id;
  if found then
    if existing.request is distinct from input or existing.requested_by is distinct from editor_id then
      raise exception 'Release request ID was already used for different content'; end if;
    return public.builder_release_summary(existing);
  end if;
  if exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required')) then
    raise exception 'Another release is pending. Inspect its status before publishing again.'; end if;
  action := input->>'action';
  if input->>'schemaVersion' is distinct from '1' or action is null or action not in ('page','site','unpublish','deploy')
    or jsonb_typeof(input->'expected') is distinct from 'object' or jsonb_typeof(input->'changes') is distinct from 'array'
    or length(input::text)>50000000 then raise exception 'Invalid or oversized release request'; end if;
  select coalesce(jsonb_object_agg(id::text,(payload->>'version')::integer),'{}'::jsonb) into versions from builder_pages;
  select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) into assets from builder_assets;
  select payload into site_state from builder_site where id='site';
  if versions is distinct from input->'expected'->'pages' or assets is distinct from input->'expected'->'assets'
    or coalesce(site_state,'null'::jsonb) is distinct from input->'expected'->'site' then
    raise exception 'The workspace changed while preparing publication. Review it and try again.'; end if;
  if action='site' then
    if site_state is null or input->'site' is distinct from site_state->'draft' then raise exception 'Review the latest site design'; end if;
  elsif input->'site' is distinct from coalesce(site_state->'published','null'::jsonb) then
    raise exception 'A page release cannot publish shared draft changes';
  end if;
  if (action in ('page','unpublish') and jsonb_array_length(input->'changes')<>1)
    or (action='deploy' and jsonb_array_length(input->'changes')<>0)
    or (select count(distinct value->>'id') from jsonb_array_elements(input->'changes'))<>jsonb_array_length(input->'changes') then
    raise exception 'Invalid release page selection'; end if;
  baseline := public.builder_live_snapshot();
  candidate := baseline || jsonb_build_object('site',input->'site');
  for change in select value from jsonb_array_elements(input->'changes') loop
    select payload into page from builder_pages where id=(change->>'id')::uuid;
    if page is null then raise exception 'Release page no longer exists'; end if;
    if action='unpublish' then
      if change->'document' is distinct from 'null'::jsonb or not exists(select 1 from builder_publications where id=(change->>'id')::uuid) then
        raise exception 'Page has no published version'; end if;
    elsif change->'document'->>'schemaVersion' is distinct from '1'
      or change->'document'->>'slug' is distinct from page->'draft'->>'slug'
      or change->'document'->>'title' is distinct from page->'draft'->>'title'
      or jsonb_typeof(change->'document'->'data'->'content') is distinct from 'array'
      or length((change->'document')::text)>2000000 then raise exception 'Invalid release page snapshot';
    end if;
    candidate := jsonb_set(candidate,'{pages}',coalesce((select jsonb_agg(value order by value->>'id')
      from jsonb_array_elements(candidate->'pages') where value->>'id'<>change->>'id'),'[]'::jsonb));
    if action<>'unpublish' then candidate := jsonb_set(candidate,'{pages}',candidate->'pages'||jsonb_build_array(change)); end if;
  end loop;
  candidate := jsonb_set(candidate,'{pages}',coalesce((select jsonb_agg(value order by value->>'id') from jsonb_array_elements(candidate->'pages')),'[]'::jsonb));
  if jsonb_array_length(candidate->'pages')>500 or length(candidate::text)>50000000
    or (select count(distinct value->'document'->>'slug') from jsonb_array_elements(candidate->'pages'))<>jsonb_array_length(candidate->'pages') then
    raise exception 'Release is oversized or contains conflicting URLs'; end if;
  select release_id into current_head from builder_release_head where id='site';
  insert into builder_releases(id,requested_by,request,snapshot,baseline,previous_release_id)
    values(request_id,editor_id,input,candidate,baseline,current_head) returning * into existing;
  return public.builder_release_summary(existing);
end;
$$;
revoke all on function public.builder_queue_release(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.builder_queue_release(uuid,uuid,jsonb) to service_role;

create function public.builder_queue_rollback(request_id uuid, editor_id uuid, target_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare target public.builder_releases; existing public.builder_releases; current_head uuid;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if editor_id is null or not exists(select 1 from builder_editors where user_id=editor_id) then raise exception 'Builder editor access required'; end if;
  select * into existing from builder_releases where id=request_id;
  if found then
    if existing.rollback_of is distinct from target_id or existing.requested_by is distinct from editor_id then raise exception 'Release request ID was already used for different content'; end if;
    return public.builder_release_summary(existing);
  end if;
  if exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required')) then raise exception 'Another release is pending. Inspect its status before publishing again.'; end if;
  select release_id into current_head from builder_release_head where id='site';
  select * into target from builder_releases where id=target_id;
  if target.status is distinct from 'live' or target.artifact_id is null or target.id=current_head then raise exception 'Select an earlier verified release'; end if;
  if target.artifact_id=(select artifact_id from builder_releases where id=current_head) then raise exception 'That artifact is already live'; end if;
  if exists(select 1 from jsonb_array_elements(target.snapshot->'pages') p where not exists(select 1 from builder_pages where id=(p->>'id')::uuid)) then raise exception 'A rollback page was removed from the workspace'; end if;
  if exists(select 1 from jsonb_array_elements(target.snapshot->'pages') p, builder_pages b
    where b.id<>(p->>'id')::uuid and b.payload->'draft'->>'slug'=p->'document'->>'slug') then
    raise exception 'A current draft uses a rollback URL. Change that draft URL before rolling back.'; end if;
  insert into builder_releases(id,requested_by,request,snapshot,baseline,previous_release_id,rollback_of,artifact_id)
    values(request_id,editor_id,jsonb_build_object('action','rollback','target',target_id),target.snapshot,public.builder_live_snapshot(),current_head,target_id,target.artifact_id) returning * into existing;
  return public.builder_release_summary(existing);
end;
$$;
revoke all on function public.builder_queue_rollback(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.builder_queue_rollback(uuid,uuid,uuid) to service_role;

-- Code/CMS-triggered builds use the same queue and the current verified publications only.
create function public.builder_queue_deployment(request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_releases; baseline jsonb; current_head uuid;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id;
  if found then
    if item.request is distinct from '{"action":"deploy"}'::jsonb or item.requested_by is not null then raise exception 'Release request ID conflict'; end if;
    return public.builder_release_summary(item);
  end if;
  if exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required')) then raise exception 'Another release is pending. This deployment has not changed the live site.'; end if;
  baseline := public.builder_live_snapshot();
  select release_id into current_head from builder_release_head where id='site';
  insert into builder_releases(id,request,snapshot,baseline,previous_release_id)
    values(request_id,'{"action":"deploy"}',baseline,baseline,current_head) returning * into item;
  return public.builder_release_summary(item);
end;
$$;
revoke all on function public.builder_queue_deployment(uuid) from public,anon,authenticated;
grant execute on function public.builder_queue_deployment(uuid) to service_role;

-- Claim retries use the same worker ID. A second worker cannot take over an uncertain deployment.
create function public.builder_claim_release(request_id uuid, owner_id uuid, artifact text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_releases;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id;
  if item.id is null or owner_id is null or artifact is null or artifact !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$' then raise exception 'Invalid release claim'; end if;
  if item.worker_id=owner_id and item.artifact_id=artifact then return to_jsonb(item); end if;
  if item.status<>'queued' or item.worker_id is not null then raise exception 'Another worker owns this release'; end if;
  if item.rollback_of is not null and item.artifact_id is distinct from artifact then raise exception 'Rollback must use the original retained artifact'; end if;
  if item.baseline is distinct from public.builder_live_snapshot() then raise exception 'Published data changed outside the release coordinator'; end if;
  update builder_releases set worker_id=owner_id,artifact_id=artifact,status='building',updated_at=clock_timestamp() where id=request_id returning * into item;
  return to_jsonb(item);
end;
$$;
revoke all on function public.builder_claim_release(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.builder_claim_release(uuid,uuid,text) to service_role;

create function public.builder_fail_queued_release(request_id uuid, detail text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_releases;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id;
  if item.id is null or coalesce(length(trim(detail)),0) not between 1 and 2000 then raise exception 'Invalid release failure'; end if;
  if item.status='failed' and item.error=detail and item.worker_id is null then return public.builder_release_summary(item); end if;
  if item.status<>'queued' or item.worker_id is not null then raise exception 'A worker already claimed this release. Inspect its status.'; end if;
  update builder_releases set status='failed',error=detail,updated_at=clock_timestamp() where id=request_id returning * into item;
  return public.builder_release_summary(item);
end;
$$;
revoke all on function public.builder_fail_queued_release(uuid,text) from public,anon,authenticated;
grant execute on function public.builder_fail_queued_release(uuid,text) to service_role;

-- Service-only observations come from the worker after retained-file and actual HTTP checks.
-- The database cannot observe Nginx; never call live merely because a build or dispatch succeeded.
create function public.builder_advance_release(request_id uuid, owner_id uuid, phase text, proof jsonb default null, detail text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.builder_releases; page record; document jsonb; revisions jsonb; stamp text; current_head uuid;
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  select * into item from builder_releases where id=request_id;
  if item.id is null or owner_id is null or item.worker_id is distinct from owner_id then raise exception 'Release worker ownership mismatch'; end if;
  if item.status=phase then
    if item.evidence is distinct from proof or item.error is distinct from detail then raise exception 'Changed release status retry'; end if;
    return public.builder_release_summary(item);
  end if;
  if not ((item.status='building' and phase in ('activating','failed'))
    or (item.status='activating' and phase in ('verifying','rolled_back','recovery_required'))
    or (item.status='verifying' and phase in ('live','rolled_back','recovery_required'))
    or (item.status='recovery_required' and phase in ('live','rolled_back'))) then raise exception 'Invalid release status transition'; end if;
  if phase in ('failed','rolled_back','recovery_required') and coalesce(length(trim(detail)),0) not between 1 and 2000 then raise exception 'Add an actionable failure message'; end if;
  if phase in ('live','rolled_back') and (jsonb_typeof(proof) is distinct from 'object'
    or proof->>'artifactId' is null or proof->>'manifestSha256' is null or proof->>'manifestSha256' !~ '^[a-f0-9]{64}$'
    or (proof->>'checkedResponses')::integer<2 or (proof->>'checkedResponses')::integer is null) then raise exception 'Verified release evidence is required'; end if;
  if phase='rolled_back' and (proof->>'artifactId' is not distinct from item.artifact_id or
    (item.previous_release_id is not null and proof->>'artifactId' is distinct from (select artifact_id from builder_releases where id=item.previous_release_id))) then raise exception 'Verify the previous live artifact before reporting recovery'; end if;
  if phase='live' then
    if proof->>'artifactId' is distinct from item.artifact_id then raise exception 'Verification belongs to another artifact'; end if;
    select release_id into current_head from builder_release_head where id='site';
    if current_head is distinct from item.previous_release_id or item.baseline is distinct from public.builder_live_snapshot() then raise exception 'The live publication baseline changed; reconcile the serving release before retrying'; end if;
    -- Slug swaps are valid in a complete snapshot. Replace the publication table in this transaction.
    perform set_config('kaizen.release_commit',request_id::text,true);
    delete from builder_publications;
    insert into builder_publications(id,slug,document)
      select (p->>'id')::uuid,p->'document'->>'slug',p->'document' from jsonb_array_elements(item.snapshot->'pages') p;
    stamp := to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    for page in select id,payload from builder_pages loop
      select p->'document' into document from jsonb_array_elements(item.snapshot->'pages') p where p->>'id'=page.id::text;
      if coalesce(page.payload->'published','null'::jsonb) is distinct from coalesce(document,'null'::jsonb) then
        revisions := coalesce(page.payload->'revisions','[]'::jsonb);
        if document is not null then
          revisions := revisions || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',stamp,'label',case when item.rollback_of is null then 'Verified live release' else 'Rolled back live release' end,'document',document));
        end if;
        select coalesce(jsonb_agg(value order by n),'[]'::jsonb) into revisions from jsonb_array_elements(revisions) with ordinality r(value,n) where n>jsonb_array_length(revisions)-50;
        -- Version is the draft concurrency token. Promotion must not invalidate an open editor's next autosave.
        update builder_pages set payload=page.payload || jsonb_build_object('published',document,'publishedAt',case when document is null then null else stamp end,'revisions',revisions) where id=page.id;
      end if;
    end loop;
    update builder_site set payload=payload || jsonb_build_object('published',item.snapshot->'site')
      where id='site' and payload->'published' is distinct from item.snapshot->'site';
    update builder_release_head set release_id=request_id where id='site';
  end if;
  update builder_releases set status=phase,evidence=proof,error=detail,updated_at=clock_timestamp() where id=request_id returning * into item;
  return public.builder_release_summary(item);
end;
$$;
revoke all on function public.builder_advance_release(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.builder_advance_release(uuid,uuid,text,jsonb,text) to service_role;

-- Prevent legacy publication functions from leaking a pending request through another build.
create function public.builder_guard_release_publication() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if TG_TABLE_NAME='builder_site' then
    if coalesce(NEW.payload->'published','null'::jsonb) is not distinct from
      (case when TG_OP='INSERT' then 'null'::jsonb else coalesce(OLD.payload->'published','null'::jsonb) end) then return NEW; end if;
  end if;
  if exists(select 1 from builder_releases where status in ('queued','building','activating','verifying','recovery_required')
    and id::text is distinct from current_setting('kaizen.release_commit',true)) then raise exception 'Publication is owned by a pending release'; end if;
  if TG_TABLE_NAME='builder_site' then return NEW; end if;
  return null;
end;
$$;
revoke all on function public.builder_guard_release_publication() from public,anon,authenticated;
create trigger builder_publication_release_guard before insert or update or delete on public.builder_publications
  for each statement execute function public.builder_guard_release_publication();
create trigger builder_site_release_guard before insert or update on public.builder_site
  for each row execute function public.builder_guard_release_publication();

-- A frozen route must not be taken by a different page while deployment is in progress.
create function public.builder_reserve_release_routes() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-pages'));
  if exists(select 1 from builder_releases r, jsonb_array_elements(r.snapshot->'pages') p
    where r.status in ('queued','building','activating','verifying','recovery_required')
    and p->>'id'<>NEW.id::text and p->'document'->>'slug'=NEW.payload->'draft'->>'slug') then
    raise exception 'This URL is reserved by a pending release'; end if;
  return NEW;
end;
$$;
revoke all on function public.builder_reserve_release_routes() from public,anon,authenticated;
create trigger builder_release_route_reservation before insert or update on public.builder_pages
  for each row execute function public.builder_reserve_release_routes();
