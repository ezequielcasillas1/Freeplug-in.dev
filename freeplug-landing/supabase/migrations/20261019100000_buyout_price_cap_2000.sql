-- Oct 19 (Luma QA, Cheke's tiers): the admin buyout override never exceeds the Unlimited tier, $2,000.
-- Local DB only until Cheke says otherwise. Existing rows above $2,000 (if any) make this fail on purpose:
-- check first with: select id, buyout_price_cents from public.website_requests where buyout_price_cents > 200000;
alter table public.website_requests
  drop constraint if exists website_requests_buyout_price_cents_max;
alter table public.website_requests
  add constraint website_requests_buyout_price_cents_max
  check (buyout_price_cents is null or buyout_price_cents <= 200000);
