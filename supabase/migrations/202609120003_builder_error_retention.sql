-- Required, not best-effort: migration fails if scheduling cannot be installed.
-- Supabase hosts pg_cron; a self-hosted database must provide it before migration.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'builder-client-error-retention',
  '17 * * * *',
  'select public.builder_prune_client_errors()'
);
