-- Envato template picker, phase 1 (Aria's prebuild section 6, Oct 12 2026).
-- Server-side catalog cache + Lina's shortlist + her cleaning decisions + the widen log.
-- Service-role only: same lock-down as included_edit_uses (20261003180000_plan_steps.sql):
-- enable + force RLS, revoke all from public/anon/authenticated/service_role, then grant
-- service_role only what the sync and the admin page need. No policies, so anon and
-- authenticated can read or write nothing. No DELETE grants anywhere.
-- Idempotent: IF NOT EXISTS everywhere; re-running changes nothing.

create table if not exists public.envato_sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  complete boolean not null default false,
  partitions jsonb not null default '[]'::jsonb,
  calls integer not null default 0,
  items_seen integer not null default 0,
  items_changed integer not null default 0,
  items_removed integer not null default 0,
  error text
);

create table if not exists public.envato_items (
  id bigint primary key,
  site text not null default 'themeforest.net',
  category text not null,
  platform text not null check (platform in ('html', 'wp')),
  name text not null,
  author text,
  url text,
  price_cents integer,
  extended_price_cents integer,
  rating numeric(3,2),
  rating_count integer,
  sales integer,
  published_at timestamptz,
  updated_at timestamptz,
  live_preview_url text,
  preview_image_url text,
  tags text[] not null default '{}',
  auto_niches text[] not null default '{}',
  cleaning_match text,
  needs_lina boolean not null default false,
  saleable_on_elements boolean,
  content_hash text,
  last_seen_run_id bigint references public.envato_sync_runs (id),
  last_seen_at timestamptz,
  status text not null default 'active' check (status in ('active', 'removed'))
);
create index if not exists envato_items_status_idx on public.envato_items (status);
create index if not exists envato_items_auto_niches_idx on public.envato_items using gin (auto_niches);
create index if not exists envato_items_category_idx on public.envato_items (category);
create index if not exists envato_items_last_seen_idx on public.envato_items (last_seen_at);
create index if not exists envato_items_needs_lina_idx on public.envato_items (needs_lina) where needs_lina;

-- Lina's shortlist. One row per (item, niche). Re-import upserts on that key (idempotent);
-- rows missing from a newer file are set active=false, never deleted.
create table if not exists public.template_shortlist (
  envato_item_id bigint not null,
  niche text not null,
  name text not null,
  url text not null,
  demo_url text,
  platform text,
  verify_status text not null check (verify_status in ('confirmed', 'cut', 'unverified')),
  verify_reason text,
  build_note text,
  note text,
  source_file text,
  raw jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  added_by text,
  regular_price_cents integer,
  extended_price_cents integer,
  prices_checked_at timestamptz,
  imported_at timestamptz not null default now(),
  primary key (envato_item_id, niche)
);

-- Lina's "Cleaning" / "Not cleaning" decisions. The sync never writes here and never
-- re-flags an item that has a row.
create table if not exists public.template_niche_decisions (
  envato_item_id bigint not null,
  niche text not null,
  decision text not null check (decision in ('yes', 'no')),
  matched_tag text,
  decided_by text not null,
  decided_at timestamptz not null default now(),
  primary key (envato_item_id, niche)
);

create table if not exists public.template_widen_log (
  id bigserial primary key,
  niche text not null,
  request_id uuid,
  user_id uuid,
  actor_email text,
  actor_role text not null check (actor_role in ('team', 'client')),
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists template_widen_log_created_idx on public.template_widen_log (created_at desc);

alter table public.envato_sync_runs enable row level security;
alter table public.envato_sync_runs force row level security;
alter table public.envato_items enable row level security;
alter table public.envato_items force row level security;
alter table public.template_shortlist enable row level security;
alter table public.template_shortlist force row level security;
alter table public.template_niche_decisions enable row level security;
alter table public.template_niche_decisions force row level security;
alter table public.template_widen_log enable row level security;
alter table public.template_widen_log force row level security;

revoke all on table public.envato_sync_runs from public, anon, authenticated, service_role;
revoke all on table public.envato_items from public, anon, authenticated, service_role;
revoke all on table public.template_shortlist from public, anon, authenticated, service_role;
revoke all on table public.template_niche_decisions from public, anon, authenticated, service_role;
revoke all on table public.template_widen_log from public, anon, authenticated, service_role;
revoke all on sequence public.envato_sync_runs_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.template_widen_log_id_seq from public, anon, authenticated, service_role;

grant select, insert, update on table public.envato_sync_runs to service_role;
grant select, insert, update on table public.envato_items to service_role;
grant select, insert, update on table public.template_shortlist to service_role;
grant select, insert, update on table public.template_niche_decisions to service_role;
grant select, insert on table public.template_widen_log to service_role;
grant usage on sequence public.envato_sync_runs_id_seq to service_role;
grant usage on sequence public.template_widen_log_id_seq to service_role;

-- service_role bypasses RLS (Supabase sets BYPASSRLS on it), so no policies are needed; with
-- FORCE RLS and no policies, any other role sees zero rows even if a grant slipped in.
