-- "Set up my domain" requests from the dashboard (customer buys and owns the domain; admin
-- handles each request by hand). Customers can insert and read their own rows; only the
-- server changes status.

create table if not exists public.domain_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('have_domain', 'need_domain')),
  domain text check (domain is null or (length(domain) between 3 and 253 and domain ~ '^[A-Za-z0-9.-]+$')),
  notes text check (notes is null or length(notes) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  check (kind = 'need_domain' or domain is not null)
);

create index if not exists domain_requests_user_idx on public.domain_requests (user_id, created_at desc);

alter table public.domain_requests enable row level security;
revoke all on table public.domain_requests from public, anon, authenticated;
grant select, insert on table public.domain_requests to authenticated;
grant select, insert, update on table public.domain_requests to service_role;

drop policy if exists "domain_requests_select_own" on public.domain_requests;
create policy "domain_requests_select_own"
  on public.domain_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "domain_requests_insert_own" on public.domain_requests;
create policy "domain_requests_insert_own"
  on public.domain_requests for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');
