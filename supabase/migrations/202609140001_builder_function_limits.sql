-- Shared across Edge Function instances. Neither caller headers nor browser
-- state can reset a bucket; authenticated subjects come from verified Auth users.
create table public.builder_function_limits (
  function_name text not null check (function_name in (
    'builder-projects','builder-account','builder-invite',
    'builder-publish','builder-content','builder-contact'
  )),
  subject text not null check (subject='global' or subject ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 3601),
  primary key(function_name,subject)
);
alter table public.builder_function_limits enable row level security;
revoke all on public.builder_function_limits from public,anon,authenticated,service_role;
create index builder_function_limits_expiry on public.builder_function_limits(window_start);

create function public.builder_consume_function_limit(target_function text, actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  maximum integer;
  observed_at timestamptz := statement_timestamp();
  period_start timestamptz := date_trunc('minute',observed_at);
  bucket_subject text := coalesce(actor_id::text,'global');
  used integer;
begin
  maximum := case target_function
    when 'builder-projects' then case when actor_id is null then 3600 else 360 end
    when 'builder-account' then case when actor_id is null then 300 else 30 end
    when 'builder-invite' then case when actor_id is null then 120 else 12 end
    when 'builder-publish' then case when actor_id is null then 120 else 12 end
    when 'builder-content' then case when actor_id is null then 300 else 30 end
    when 'builder-contact' then case when actor_id is null then 120 else 12 end
    else null end;
  if maximum is null then raise exception 'Unknown builder function' using errcode='22023'; end if;
  insert into builder_function_limits(function_name,subject,window_start,attempts)
    values(target_function,bucket_subject,period_start,1)
  on conflict(function_name,subject) do update set
    attempts=case when builder_function_limits.window_start<>period_start then 1
      else least(builder_function_limits.attempts+1,maximum+1) end,
    window_start=period_start
  returning attempts into used;
  return jsonb_build_object('allowed',used<=maximum,'retryAfter',
    case when used<=maximum then 0 else greatest(1,ceil(extract(epoch from period_start+interval '1 minute'-observed_at))::integer) end);
end;
$$;
revoke all on function public.builder_consume_function_limit(text,uuid) from public,anon,authenticated;
grant execute on function public.builder_consume_function_limit(text,uuid) to service_role;

create function public.builder_prune_function_limits() returns integer
language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
  delete from builder_function_limits where window_start<clock_timestamp()-interval '1 day';
  get diagnostics removed=row_count;
  return removed;
end;
$$;
revoke all on function public.builder_prune_function_limits() from public,anon,authenticated;
grant execute on function public.builder_prune_function_limits() to service_role;
