# Arkitect MCP — `arkitect-freeplug` (Freeplug-in.dev only)

Dedicated [Arkitect MCP](https://github.com/ezequielcasillas1/Arkitect-MCP.AI) instance for **this repository**. It is separate from Arkitect connectors used on App Studio / PasteCraft apps.

## What it is

- **Server name in Cursor:** `arkitect-freeplug`
- **Package:** `@arkitect/mcp-server` **v2.1.1** (prebuilt portable from [GitHub release v2.1.1](https://github.com/ezequielcasillas1/Arkitect-MCP.AI/releases/tag/v2.1.1); **not published on public npm**)
- **App scope:** `freeplug-landing/` (default `ARKITECT_DEFAULT_REPO_PATH`)
- **Repo scope:** whole `Freeplug-in.dev` checkout (`ARKITECT_HOST_REPO_PATH`)
- **State:** `.arkitect/reports/` and `.arkitect/vendor/` (gitignored)

## Config

- `.cursor/mcp.json` — MCP entry `arkitect-freeplug`
- `.cursor/run-arkitect-freeplug-mcp.sh` — downloads the v2.1.1 portable zip on first run, then starts `dist/stdio.js`

### Env (no secrets)

Only public build-time values are set for `verify_codebase`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Placeholder unless you set the real public project URL in MCP env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Placeholder anon JWT for build-only checks |
| `NEXT_PUBLIC_APP_URL` | Local placeholder origin for Next build |

Do **not** add Stripe, Printify, Envato, Cloudflare, service-role Supabase, or SMTP secrets to this MCP block.

Optional Arkitect vars: `ARKITECT_AUDIT_FAIL_THRESHOLD` (default `high` here), `ARKITECT_REPORT_DIR`, `ARKITECT_ANALYZER` (default `mock`).

## How cloud agents should use it

1. **Before structural changes** — call `diagnose_repository` on `freeplug-landing/` (or pass `repoPath`). Follow `cursorGuidance`; respect `ArchiGuide/` and `.cursor/rules/`.
2. **Before handoff / merge** — call `verify_codebase` on `freeplug-landing/` (`lint`, `build`, `typecheck`, `test`, `npm audit`). Reports land in `.arkitect/reports/`.
3. **Security-sensitive PRs** (payments, database, uploads, hosting) — run `diagnose_repository` plus `verify_codebase`, and use `analyze_refactoring_opportunities` only when intentionally refactoring; re-verify after edits.

Reload MCP after changing `.cursor/mcp.json` or upgrading the portable zip.

## First-time / VM bootstrap

The launcher fetches the portable zip into `.arkitect/vendor/`. Requires **Node.js 22+** on `PATH`.

Manual check:

```bash
bash .cursor/run-arkitect-freeplug-mcp.sh
# (stdio server — Ctrl+C to stop)
```

## TODO

- **npm:** `@arkitect/mcp-server@2.1.1` is not on npm; when published, consider replacing the zip bootstrap with `npx -y @arkitect/mcp-server@2.1.1` (or newer) in `.cursor/mcp.json`.
- **Supabase URL:** replace `YOUR_PROJECT` placeholders in `.cursor/mcp.json` with this app’s real public project URL when you want builds to match production CSP origins.
