-- READ-ONLY pre-check for migration 20261019120000. Run BEFORE applying. Lists every existing
-- domain_requests row that a re-added CHECK would reject. Expect 0 rows; fix any before migrating.
select id, kind, domain, status, array_remove(array[
  case when kind not in ('have_domain','buy_for_me','buy_self','need_domain') then 'kind' end,
  case when not (kind in ('need_domain','buy_self') or domain is not null) then 'domain_required' end,
  case when status not in ('pending','connecting','live','done') then 'status' end,
  case when domain is not null and not (length(domain) between 3 and 253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$') then 'domain_format' end
], null) as fails
from public.domain_requests
where kind not in ('have_domain','buy_for_me','buy_self','need_domain')
   or not (kind in ('need_domain','buy_self') or domain is not null)
   or status not in ('pending','connecting','live','done')
   or (domain is not null and not (length(domain) between 3 and 253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$'));
-- The other re-added checks only cover columns this migration adds (all null on old rows).
