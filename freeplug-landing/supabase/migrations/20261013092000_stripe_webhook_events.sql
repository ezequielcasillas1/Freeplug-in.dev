-- Phase 4 L-1: event-level idempotency for the Stripe webhook. One row per Stripe event id the route finished
-- (2xx, no redelivery asked). A redelivery of a processed event answers 200 and does nothing.
-- Not applied to any hosted project by this change.
--
-- Access (Aria, Oct 13): event_id is the PRIMARY KEY, RLS on with no policies, nothing granted here.
-- anon and authenticated are revoked explicitly; only the server's service role (Supabase's default
-- privileges, which bypass RLS) reads and writes it.
--
-- Retention: keep rows 90 days. Stripe retries a delivery for up to 3 days and a manual resend uses the
-- same event id, so 90 days is well past any redelivery. Cleanup is a manual or later scheduled job
-- (not part of this migration):
--   delete from public.stripe_webhook_events where processed_at < now() - interval '90 days';
create table if not exists public.stripe_webhook_events (
  event_id text primary key check (length(event_id) between 1 and 255),
  event_type text not null check (length(event_type) between 1 and 255),
  processed_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_processed_at_idx on public.stripe_webhook_events (processed_at);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon;
revoke all on table public.stripe_webhook_events from authenticated;
