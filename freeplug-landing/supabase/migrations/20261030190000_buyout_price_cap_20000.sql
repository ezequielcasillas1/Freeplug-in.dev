-- Oct 30 (Cheke, 7:11 PM CT): Custom enterprise (21-35 pages) quotes can go above $2,000, so the admin
-- buyout override cap rises from $2,000 to $20,000 (Cheke, Oct 30, 7:33 PM CT). Replaces the CHECK from 20261019100000.
-- Whole dollars, $1 to $20,000 (buyout_price_cents 100..2000000, multiple of 100), still > 0.
-- Matches BUYOUT_PRICE_ERROR "Enter a whole-dollar amount from $1 to $20,000." (src/lib/buyout/buyout.ts).
-- Only loosens the rule, so no existing row can fail it.
alter table public.website_requests
  drop constraint if exists website_requests_buyout_price_cents_max;
alter table public.website_requests
  add constraint website_requests_buyout_price_cents_max
  check (buyout_price_cents is null or (buyout_price_cents between 100 and 2000000 and buyout_price_cents % 100 = 0));
