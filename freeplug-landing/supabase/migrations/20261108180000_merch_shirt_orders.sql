-- Merch: physical t-shirt orders (Printify fulfillment). Server-only via service_role.

create table if not exists public.merch_shirt_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique check (length(stripe_checkout_session_id) between 1 and 255),
  printify_order_id text,
  status text not null check (length(status) between 1 and 64),
  items jsonb not null default '[]'::jsonb,
  buyer_email text,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merch_shirt_orders_status_idx on public.merch_shirt_orders (status);
create index if not exists merch_shirt_orders_created_at_idx on public.merch_shirt_orders (created_at);

alter table public.merch_shirt_orders enable row level security;
revoke all on table public.merch_shirt_orders from public;
revoke all on table public.merch_shirt_orders from anon;
revoke all on table public.merch_shirt_orders from authenticated;
grant select, insert, update, delete on table public.merch_shirt_orders to service_role;
