-- Merch: Freeplug Font Bundle download tokens (server-only via service_role).
-- Issued after Stripe checkout.session.completed; revoked on refund/dispute.

create table if not exists public.merch_font_bundle_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  stripe_checkout_session_id text not null unique check (length(stripe_checkout_session_id) between 1 and 255),
  stripe_payment_intent_id text,
  buyer_email text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_downloads int not null default 5 check (max_downloads between 1 and 100),
  download_count int not null default 0 check (download_count >= 0),
  created_at timestamptz not null default now(),
  last_download_at timestamptz
);

create index if not exists merch_font_bundle_tokens_expires_at_idx on public.merch_font_bundle_tokens (expires_at);
create index if not exists merch_font_bundle_tokens_revoked_at_idx on public.merch_font_bundle_tokens (revoked_at) where revoked_at is not null;

alter table public.merch_font_bundle_tokens enable row level security;
revoke all on table public.merch_font_bundle_tokens from public;
revoke all on table public.merch_font_bundle_tokens from anon;
revoke all on table public.merch_font_bundle_tokens from authenticated;
grant select, insert, update, delete on table public.merch_font_bundle_tokens to service_role;
