-- Failed hosting payment cases (Cheke, Oct 23 2026); rules in src/lib/billing/dunning.ts:
-- day 0-13 grace (not past due), day 14-16 past_due, day 17+ paused (site kept, never deleted here).
-- One OPEN case per subscription (partial unique index); a paid invoice sets resolved_at (history kept).
-- Service role writes (webhook + cron); a client reads only their own rows. Additive only.
create table if not exists public.hosting_dunning (
  id uuid primary key default gen_random_uuid(),
  subscription_id text not null check (length(subscription_id) between 1 and 200),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  first_failed_at timestamptz not null,
  state text not null default 'grace' check (state in ('grace', 'past_due', 'paused')),
  paused_at timestamptz null,
  domain_expires_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hosting_dunning_one_open_idx on public.hosting_dunning (subscription_id) where resolved_at is null;
create index if not exists hosting_dunning_profile_idx on public.hosting_dunning (profile_id);
alter table public.hosting_dunning enable row level security;
revoke all on table public.hosting_dunning from public, anon, authenticated;
grant select on table public.hosting_dunning to authenticated;
grant select, insert, update on table public.hosting_dunning to service_role;
drop policy if exists "hosting_dunning_select_own" on public.hosting_dunning;
create policy "hosting_dunning_select_own" on public.hosting_dunning
  for select to authenticated using (profile_id = (select auth.uid()));
