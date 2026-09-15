-- Apply with the verified upload worker, projects function and browser transport.
-- Service-role Storage API writes remain available; browser uploads must reserve
-- their allowance through /editor-uploads before any provider bytes are written.
drop policy if exists builder_storage_insert on storage.objects;
drop policy if exists project_files_insert on storage.objects;

-- Limit only the builder's buckets. Restrictive policies also prevent another
-- bucket's permissive policy from accidentally restoring direct builder writes.
create policy builder_storage_verified_insert on storage.objects as restrictive
  for insert to anon, authenticated with check (
    bucket_id not in ('builder-media','builder-source','builder-project-files')
  );
create policy builder_storage_verified_update on storage.objects as restrictive
  for update to anon, authenticated using (
    bucket_id not in ('builder-media','builder-source','builder-project-files')
  ) with check (
    bucket_id not in ('builder-media','builder-source','builder-project-files')
  );
create policy builder_storage_verified_delete on storage.objects as restrictive
  for delete to anon, authenticated using (
    bucket_id not in ('builder-media','builder-source','builder-project-files')
  );

-- Keep existing public/media and membership-scoped read policies unchanged.
-- Provider-owned storage.objects is never modified directly by the application.
