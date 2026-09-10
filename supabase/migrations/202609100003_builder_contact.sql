-- Reuses the existing contact_form_submissions table and its notification workflow.
-- Only the trusted receiver can reserve/deduplicate submissions or inspect this ledger.
create table if not exists public.builder_contact_requests (
  id uuid primary key,
  fingerprint text not null,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists builder_contact_requests_created on public.builder_contact_requests(created_at);
create index if not exists builder_contact_requests_email on public.builder_contact_requests(email_hash,created_at);
alter table public.builder_contact_requests enable row level security;
revoke all on public.builder_contact_requests from public,anon,authenticated;

create or replace function public.builder_submit_contact(request_id uuid, request_fingerprint text, sender_hash text, contact jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare existing_hash text;
begin
  if request_id is null or request_fingerprint is null or sender_hash is null
    or request_fingerprint !~ '^[a-f0-9]{64}$' or sender_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(contact) is distinct from 'object'
    or (contact->'consent_to_gdpr') is distinct from 'true'::jsonb
    or length(coalesce(contact->>'name','')) not between 1 and 100
    or length(coalesce(contact->>'email','')) not between 3 and 254
    or length(coalesce(contact->>'message','')) not between 1 and 5000
  then raise exception 'Invalid contact request'; end if;
  -- One short transaction: retries cannot insert another enquiry or trigger another notification.
  perform pg_advisory_xact_lock(hashtext('kaizen-builder-contact'));
  select fingerprint into existing_hash from public.builder_contact_requests where id = request_id;
  if found then
    if existing_hash <> request_fingerprint then raise exception 'Contact request conflict'; end if;
    return;
  end if;
  delete from public.builder_contact_requests where created_at < now() - interval '7 days';
  if (select count(*) from public.builder_contact_requests where email_hash = sender_hash and created_at > now() - interval '10 minutes') >= 5
    or (select count(*) from public.builder_contact_requests where created_at > now() - interval '1 minute') >= 100
  then raise exception 'Contact rate limit'; end if;
  insert into public.contact_form_submissions(name,last_name,email,phone,website,message,marketing_consent,consent_to_gdpr,source_page,user_agent)
  values(contact->>'name',contact->>'last_name',contact->>'email',contact->>'phone',contact->>'website',contact->>'message',coalesce((contact->>'marketing_consent')::boolean,false),true,contact->>'source_page',contact->>'user_agent');
  insert into public.builder_contact_requests(id,fingerprint,email_hash) values(request_id,request_fingerprint,sender_hash);
end;
$$;
revoke all on function public.builder_submit_contact(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.builder_submit_contact(uuid,text,text,jsonb) to service_role;
