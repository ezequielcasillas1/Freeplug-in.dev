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

-- Aria's ruling (Oct 13): every other SECURITY DEFINER function still on search_path = public (or
-- pg_catalog, public) gets the same treatment. Their latest bodies already use only public.<name>,
-- auth.uid() / auth.users and built-ins:
--   handle_new_user                    20260402120000_profiles_and_website_requests.sql (auth.users trigger)
--   ensure_own_profile                 20260402120000_profiles_and_website_requests.sql
--   acknowledge_website_transfer       20260404100000_close_website_request_rpcs.sql (replaces 20260403120001, formerly 20260403120000_website_transfer_handoff)
--   cancel_own_website_request         20260404100000_close_website_request_rpcs.sql
--   cancel_website_request_for_user    20260924210000_cancel_website_request_service_role_only.sql
--   outreach_site_events_apply         20260927050100_outreach_sites.sql (trigger)
--   edit_uses_request_once             20261004091000_addon_edit_uses.sql (trigger)
--   change_requests_enforce_caps       20261010160000_change_request_caps.sql (trigger; was pg_catalog, public)
alter function public.handle_new_user() set search_path = '';
alter function public.ensure_own_profile() set search_path = '';
alter function public.acknowledge_website_transfer() set search_path = '';
alter function public.cancel_own_website_request() set search_path = '';
alter function public.cancel_website_request_for_user(uuid) set search_path = '';
alter function public.outreach_site_events_apply() set search_path = '';
alter function public.edit_uses_request_once() set search_path = '';
alter function public.change_requests_enforce_caps() set search_path = '';
