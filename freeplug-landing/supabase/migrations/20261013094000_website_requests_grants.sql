-- website_requests table grants (Aria's ruling, Oct 13). Follow-up to 20261003220000_revoke_client_writes.sql,
-- which deliberately left this table alone (that file stays byte-identical to the r13 copy).
--
-- Evidence (PR body: /workspace/owen/website-requests-grants.md):
--   * anon: no code path reads or writes website_requests without a signed-in user -> nothing.
--   * authenticated keeps SELECT, INSERT, UPDATE, all under RLS:
--       - SELECT: dashboard pages read the user's own rows with the user's session (website_requests_select_own).
--       - INSERT + UPDATE: the request form's server action (dashboard/request-website/actions.ts,
--         saveWebsiteRequest) writes with the user's session, not the service role
--         (website_requests_insert_own forces status 'submitted'; website_requests_update_own_open only
--         touches the user's own open row; guard triggers protect status/price/source/due_by).
--         The Envato template picker (envato-picker-client branch, lib/templates/server.ts) also
--         updates the user's own row with the user's session.
--   * authenticated loses DELETE and TRUNCATE (no path uses them; RLS does not cover TRUNCATE), and
--     REFERENCES and TRIGGER (no client use).
-- service_role is untouched. Idempotent: revoking a privilege that is not held is a no-op.
-- Not applied to any hosted project by this change.

revoke all on table public.website_requests from anon;
revoke delete, truncate, references, trigger on table public.website_requests from authenticated;
