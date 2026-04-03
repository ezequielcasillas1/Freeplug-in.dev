-- Profiles (1:1 auth.users). Evaluation / website value fields updated by service role (webhooks, admin).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  website_value_target_cents integer,
  cumulative_website_value_paid_cents integer not null default 0,
  evaluation_status text not null default 'none'
    check (evaluation_status in ('none', 'requested', 'in_review', 'evaluated', 'agreed')),
  evaluation_progress integer not null default 0
    check (evaluation_progress >= 0 and evaluation_progress <= 100),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- No INSERT/UPDATE/DELETE for authenticated — inserts via trigger; updates via service role only.

-- Website intake requests
create table if not exists public.website_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  contact_phone text,
  google_business_url text,
  notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_requests_user_id_idx on public.website_requests (user_id);
create index if not exists website_requests_created_at_idx on public.website_requests (created_at desc);

-- At most one "open" request per user (submitted or in_review)
create unique index if not exists website_requests_one_open_per_user
  on public.website_requests (user_id)
  where status in ('submitted', 'in_review');

alter table public.website_requests enable row level security;

drop policy if exists "website_requests_select_own" on public.website_requests;
create policy "website_requests_select_own"
  on public.website_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "website_requests_insert_own" on public.website_requests;
create policy "website_requests_insert_own"
  on public.website_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "website_requests_update_own_open" on public.website_requests;
create policy "website_requests_update_own_open"
  on public.website_requests for update
  to authenticated
  using (auth.uid() = user_id and status = 'submitted')
  with check (auth.uid() = user_id);

-- New auth users get a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Idempotent invoice attribution (webhook only via service role)
create table if not exists public.billing_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stripe_invoice_id text not null unique,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

create index if not exists billing_ledger_profile_id_idx on public.billing_ledger (profile_id);

alter table public.billing_ledger enable row level security;

-- Allow authenticated users to backfill their own profile row (no direct INSERT policy on profiles)
create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (auth.uid())
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_own_profile() to authenticated;
