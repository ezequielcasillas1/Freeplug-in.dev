# Preview env: pin ADMIN_ROUTE_ENABLED=false + admin guard tests

## What
- `freeplug-landing/wrangler.jsonc`: `env.preview.vars` now sets `ADMIN_ROUTE_ENABLED: "false"` explicitly and keeps `TRUST_CF_CONNECTING_IP: "true"`. Wrangler does not inherit top-level `vars` into environments, so every top-level var is repeated. No secrets added.
- `freeplug-landing/src/lib/admin/guard.test.ts` (new): in production mode, with an allowlisted signed-in admin mocked, `ADMIN_ROUTE_ENABLED="false"` and unset both make `isAdminAccessAllowed()` false and `assertAdminAccess()` call `notFound()` (404) without touching Supabase. A control case shows `"true"` allows access.

## Verification
- `vitest run`: 159 files, 1964 tests, all passed.
- `wrangler deploy --dry-run --env preview` (no upload): bindings show `TRUST_CF_CONNECTING_IP ("true")` and `ADMIN_ROUTE_ENABLED ("false")`, no warnings.
- gitleaks on the diff: no leaks.

## Not done
No push, deploy, or merge. Based on 4aaa0b5 (security-headers).
