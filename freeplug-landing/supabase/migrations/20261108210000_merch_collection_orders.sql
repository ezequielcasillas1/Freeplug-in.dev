-- Merch collection (non-shirt Printify) orders — service role only; not applied until production launch.

create table if not exists public.merch_collection_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  printify_order_id text,
  status text not null default 'pending_printify',
  items jsonb not null default '[]'::jsonb,
  buyer_email text,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merch_collection_orders_status_idx on public.merch_collection_orders (status);
create index if not exists merch_collection_orders_created_at_idx on public.merch_collection_orders (created_at);

alter table public.merch_collection_orders enable row level security;
revoke all on table public.merch_collection_orders from public;
revoke all on table public.merch_collection_orders from anon;
revoke all on table public.merch_collection_orders from authenticated;
grant select, insert, update, delete on table public.merch_collection_orders to service_role;
