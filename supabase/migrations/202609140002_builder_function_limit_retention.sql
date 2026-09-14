-- pg_cron is already required by the client-error retention migration.
select cron.schedule(
  'builder-function-limit-retention',
  '29 * * * *',
  'select public.builder_prune_function_limits()'
);
