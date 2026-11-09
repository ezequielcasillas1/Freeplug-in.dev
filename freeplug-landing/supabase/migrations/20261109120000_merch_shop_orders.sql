-- Buyer merch shop orders + custom upload bucket (NOT applied until production launch).

create table if not exists public.merch_shop_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  status text not null default 'pending_review',
  items jsonb not null default '{}'::jsonb,
  buyer_email text,
  failure_detail text,
  moderation_result text,
  moderation_detail jsonb,
  rights_accepted_at timestamptz,
  rights_accepted_locale text,
  cancel_until timestamptz,
  held_until timestamptz,
  approved_at timestamptz,
  approved_by text,
  printify_order_id text,
  paid_at timestamptz,
  chicago_day_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merch_shop_orders_status_idx on public.merch_shop_orders (status);
create index if not exists merch_shop_orders_created_at_idx on public.merch_shop_orders (created_at);
create index if not exists merch_shop_orders_paid_at_idx on public.merch_shop_orders (paid_at);
create index if not exists merch_shop_orders_chicago_day_idx on public.merch_shop_orders (chicago_day_key);

alter table public.merch_shop_orders enable row level security;
revoke all on table public.merch_shop_orders from public;
revoke all on table public.merch_shop_orders from anon;
revoke all on table public.merch_shop_orders from authenticated;
grant select, insert, update, delete on table public.merch_shop_orders to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merch-shop-uploads',
  'merch-shop-uploads',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "merch_shop_uploads_server_only" on storage.objects;
create policy "merch_shop_uploads_server_only"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'merch-shop-uploads')
  with check (bucket_id <> 'merch-shop-uploads');
