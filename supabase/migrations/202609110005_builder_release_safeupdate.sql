-- Supabase enables pg_safeupdate for PostgREST sessions. Replace the whole verified
-- publication snapshot with an explicit predicate, retaining the transaction and locks.
create or replace function public.builder_advance_release(request_id uuid, owner_id uuid, phase text, proof jsonb default null, detail text default null) returns jsonb
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
    delete from builder_publications where id is not null;
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
