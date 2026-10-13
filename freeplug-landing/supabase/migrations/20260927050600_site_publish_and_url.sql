-- Billing and publish state for outreach sites (Stripe option (a), Aria section 9).
--
--   * Claim step 3 stores the chosen plan (hosting cents + add-on tier). The amount is recomputed
--     on the server at publish from ADDON_TIERS and the $35-$100 clamp; the stored value is a
--     choice, never a price to trust.
--   * Setup-mode Checkout saves the card (setup_session_id -> setup_completed_at, customer and
--     payment method ids, filled by the webhook or the verified return-URL sync).
--   * Admin Publish creates the subscription off-session; publish_status goes
--     none -> processing -> live (first invoice paid) or failed (card declined / 3D Secure).
--   * live_url is the address "View my website" opens once the site is live.
-- All columns are covered by the outreach_sites service-role guard (customers can't write any).

alter table public.outreach_sites
  add column if not exists plan_hosting_cents integer,
  add column if not exists plan_addon_tier text,
  add column if not exists setup_session_id text,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists publish_status text not null default 'none',
  add column if not exists publish_error text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists published_at timestamptz,
  add column if not exists live_url text,
  add column if not exists claimer_verified_at timestamptz;

alter table public.outreach_sites drop constraint if exists outreach_sites_plan_hosting_cents_check;
alter table public.outreach_sites add constraint outreach_sites_plan_hosting_cents_check
  check (plan_hosting_cents is null or plan_hosting_cents between 3500 and 10000);

alter table public.outreach_sites drop constraint if exists outreach_sites_plan_addon_tier_check;
alter table public.outreach_sites add constraint outreach_sites_plan_addon_tier_check
  check (plan_addon_tier is null or plan_addon_tier in ('none', 'basic', 'plus', 'pro'));

alter table public.outreach_sites drop constraint if exists outreach_sites_publish_status_check;
alter table public.outreach_sites add constraint outreach_sites_publish_status_check
  check (publish_status in ('none', 'processing', 'failed', 'live'));

alter table public.outreach_sites drop constraint if exists outreach_sites_live_url_check;
alter table public.outreach_sites add constraint outreach_sites_live_url_check
  check (live_url is null or (live_url ~ '^https?://' and length(live_url) <= 2000));

alter table public.outreach_sites drop constraint if exists outreach_sites_published_requires_live_check;
alter table public.outreach_sites add constraint outreach_sites_published_requires_live_check
  check ((published_at is null) = (publish_status <> 'live'));

create unique index if not exists outreach_sites_stripe_subscription_key
  on public.outreach_sites (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists outreach_sites_setup_session_idx
  on public.outreach_sites (setup_session_id) where setup_session_id is not null;
