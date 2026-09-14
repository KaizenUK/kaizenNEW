select cron.schedule('builder-privacy-retention', '43 3 * * *', 'select public.builder_prune_privacy_records()');
