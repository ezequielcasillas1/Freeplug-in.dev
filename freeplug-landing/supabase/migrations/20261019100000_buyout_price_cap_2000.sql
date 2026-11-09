-- Oct 19 (Luma QA, Cheke's tiers): the admin buyout override never exceeds the Unlimited tier, $2,000.
-- Local DB only until Cheke says otherwise. Existing rows above $2,000 (if any) make this fail on purpose:
-- check first with: select id, buyout_price_cents from public.website_requests
--   where buyout_price_cents is not null and (buyout_price_cents not between 100 and 200000 or buyout_price_cents % 100 <> 0);
alter table public.website_requests
  drop constraint if exists website_requests_buyout_price_cents_max;
alter table public.website_requests
  add constraint website_requests_buyout_price_cents_max
  check (buyout_price_cents is null or (buyout_price_cents between 100 and 200000 and buyout_price_cents % 100 = 0));
-- Whole dollars $1 to $2,000, matching BUYOUT_PRICE_ERROR "Enter a whole-dollar amount from $1 to $2,000."
