-- L-2 (base QA phase 1): the SECURITY DEFINER functions from the 9345ae0 snapshot were created with
-- `set search_path = public`. Pin them to an empty search_path, like public.email_sends' prune
-- (20261003160000), so nothing a role can create in schema public can shadow what they resolve.
--
-- Schema qualification: every table, row type and function these bodies use is already written
-- `public.<name>` (or `auth.users`) in their latest definitions:
--   rate_check                            20260927050000_rate_limits.sql
--   claim_outreach_site                   20260927050500_outreach_claim_rpc.sql
--   close_superseded_preview_submissions  20260927050200_site_details.sql
--   reject_site_details_submission        20260927050200_site_details.sql
--   apply_site_details_submission         20260927050200_site_details.sql
--   purge_site_photos                     20260927050200_site_details.sql
--   confirm_customer_details              20260927050800_one_pending_customer_details.sql
-- What remains unqualified is built-in (now, count, coalesce, set_config, jsonb_*, unnest, array_agg,
-- make_interval, pg_advisory_xact_lock, hashtextextended, random, operators), which always resolves
-- through pg_catalog, searched implicitly even with an empty search_path. So only the setting changes;
-- the bodies, grants and owners are untouched.
--
-- Not applied to any hosted project by this change.

alter function public.rate_check(text, text, integer, integer) set search_path = '';
alter function public.claim_outreach_site(uuid, uuid) set search_path = '';
alter function public.close_superseded_preview_submissions(uuid) set search_path = '';
alter function public.reject_site_details_submission(uuid) set search_path = '';
alter function public.apply_site_details_submission(uuid) set search_path = '';
alter function public.purge_site_photos(uuid[], interval) set search_path = '';
alter function public.confirm_customer_details(uuid, uuid, jsonb, jsonb) set search_path = '';
