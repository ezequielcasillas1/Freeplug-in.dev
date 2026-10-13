-- Phase 4 L-1: event-level idempotency for the Stripe webhook. One row per Stripe event id the route finished
-- (2xx, no redelivery asked). A redelivery of a processed event answers 200 and does nothing.
-- Service role only. Not applied to any hosted project by this change.
create table if not exists public.stripe_webhook_events (
  event_id text primary key check (length(event_id) between 1 and 255),
  event_type text not null check (length(event_type) between 1 and 255),
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert on table public.stripe_webhook_events to service_role;
