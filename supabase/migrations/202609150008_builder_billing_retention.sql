-- Processed deliveries only; unresolved billing observations remain available.
select cron.schedule('builder-billing-retention', '17 4 * * *', 'select public.builder_prune_billing_events()');
