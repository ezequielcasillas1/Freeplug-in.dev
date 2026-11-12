# Envato picker: pre-build research (Oct 12, 2026, 12:0x PM CT)
Spec: `/workspace/aria/freeplug-envato-picker-card.md` (APPROVED). Order: the Lina admin page (`/admin/templates` on localhost:3000) first, then the client picker.

**Research only:**
- I read code, git history and public docs.
- I made a few read-only Envato GETs (about 15, token kept server-side and never printed) and ran Arkitect `diagnose_repository`.
- I made read-only Cloudflare MCP calls; one failed with an authentication error.
- I didn't edit, push, deploy, sign in, register, or contact anyone. All times are CT.

## TL;DR
- **GO, with 4 conditions:**
  1. Pick the base branch (see §1b). `origin/FP0.5` is the **April 3** code and is missing the whole Cloudflare port.
  2. Store the catalog in **Supabase** instead of D1. This changes the card, so it needs Ezequiel's OK.
  3. No Cron goes live until Ezequiel's deploy gate. Use a manual "Sync now" on localhost first.
  4. Ezequiel registers the Envato app himself.
- **The 6,000-result cap is solved.** Splitting by category, then by price band where needed, keeps every query under the cap. This was confirmed with live counts.
- **Cleaning:** the 5 new keywords work, but only "maid service" and "housekeeping" return mostly dedicated templates. Tag by name and tags, not by search hits.

## 1. Repo and structure
### 1a. Location and branches
- **Repo:** `/workspace/freeplug-ladder` (git root). The app is in `freeplug-landing/`.
- **Remote:** `origin` = `github.com/ezequielcasillas1/Freeplug-in.dev`.
- **Current checkout here:** `review-heldround-089dc11`. Owen's worktrees are in `/workspace/owen/{cf-preview-wt,change-req-wt,i18n-es-wt,ladder-fix-wt}`. They are the same repo.
- **There is no `origin/main`.** The remote heads are `FP0.5` (the default; `origin/HEAD -> origin/FP0.5`) and `backup/box-build-2026-10-03`.
- **`origin/FP0.5` = `7fac2bf`, dated 2026-04-03.** It has only 4 migrations, no `wrangler.jsonc`, no `open-next.config.ts` and no `custom-worker.ts`. Everything since (the Cloudflare port, plans ladder, change requests, i18n) exists **only in local branches and is not pushed**.

### 1b. Base-branch check (for Jace)
- Every local branch is **0 behind** `origin/FP0.5`. They stack: `cf-preview-089dc11` = `review-heldround-089dc11` (the same commit, `089dc11`, Oct 4), and that commit is inside all of `ladder-fix-2026-10-03`, `change-requests` and `i18n-es`.

| Branch | Head | Commits beyond cf-preview | Last commit | Picker-relevant files it touches (vs cf-preview) | Last migration |
|---|---|---|---|---|---|
| origin/FP0.5 | 7fac2bf | (base, April) | 2026-04-03 | (lacks the Cloudflare port entirely) | 20260404100000 |
| cf-preview-089dc11 | 089dc11 | 0 | 2026-10-04 | Cloudflare port, admin, wrangler, custom-worker | 20261003210000_plan_change_locks |
| ladder-fix-2026-10-03 | 915391e | 18 | 2026-10-10 | admin/AdminRequestRow, admin/actions; migrations plan_addons, addon_edit_uses, addon_removals_owed | 20261004092000 |
| change-requests | f186a7f | 18 (16 shared with ladder-fix, 2 its own) | 2026-10-10 | the same, plus **AdminNav**, `admin/change-requests/*`, request-website actions; migrations change_requests, change_request_caps | **20261010160000_change_request_caps** |
| i18n-es | 258e897 | 14 (not pushed) | 2026-10-12 | **next.config, app/layout, admin/layout, proxy.ts, lib/supabase/middleware**, request-website pages, `[locale]` routes, messages/*.json; migration profiles_locale | 20261004120000 |

- **ladder-fix only (2 commits):** Plans sticky bar, and the dashboard billing reminder. These are UI only.
- **change-requests only (2 commits):** change requests.
- **Merge checks** (read-only `git merge-tree`, no branch changed):
  - `change-requests` + `ladder-fix`: **clean** (exit 0).
  - `change-requests` + `i18n-es`: **conflicts**, in billing-actions, dashboard pages, request-website/actions.ts, plans components and ladder-copy.
- **Recommendation:** base the picker on **`change-requests` with `ladder-fix-2026-10-03` merged in first** (clean). Do **not** base it on `origin/FP0.5` alone, which is April code without the Cloudflare port or admin changes. Do **not** include `i18n-es` yet: it conflicts, it rewrites the layout, proxy and admin layout, and it is unpushed and gate-held.
  - Phase 1 (admin page) touches only `src/app/admin/templates/*`, `AdminNav.tsx`, `src/lib/envato/*` and one new migration, so it rebases easily onto whatever lands later.
  - Phase 3 (client picker on request-website) **will** collide with i18n-es's request-website and messages changes. Plan to rebase it after i18n is merged, or put picker strings in next-intl from day one.
- **Migration numbering:** the newest across all branches is `20261010160000_change_request_caps.sql`. A new picker migration must sort after it, e.g. **`20261012170000_envato_catalog.sql`**. No collision with any branch.
- **Website request schema:** none of the branches alter `website_requests` in their new migrations, so adding the template and license columns later (Phase 3) has no schema conflict.
- **Pushing:** the whole stack is unpushed. A PR against `origin/FP0.5` would contain about 100 unrelated commits. Ezequiel needs to decide whether `change-requests` (or a merged base) gets pushed first, so the picker PR diff is reviewable. **Question for Ezequiel/Jace.**

### 1c. App structure (cf-preview / current checkout)
- **Next.js 16.3.8, app router:** `src/app` with groups `(auth)` and `(dashboard)`, plus `admin/`, `api/`, `claim/`, `p/[token]`, `preview/`. Middleware is `src/proxy.ts` (Next 16 naming).
- **Admin:** `src/app/admin/{page,requests,customers,accounts,outreach}`. On change-requests, `admin/change-requests` is added.
  - **Gate:** `src/app/admin/layout.tsx` calls `assertAdminAccess()` from `src/lib/admin/guard.ts`.
    - **In dev,** the host must be `localhost` or `127.0.0.1`.
    - **In production,** `ADMIN_ROUTE_ENABLED` must be `"true"`.
    - **Always,** the signed-in Supabase user's email must be in `ADMIN_EMAILS` (fails closed if that is empty). Failure returns `notFound()`.
    - Admin APIs use `isAdminAccessAllowed()`.
  - **Note:** `wrangler.jsonc` sets `ADMIN_ROUTE_ENABLED: "true"` for production, so `/admin` is reachable in production for allowlisted emails. The card wants the widen log and digest on localhost only, so those pages need an **extra localhost-only check**, even in production.
- **Supabase** (`src/lib/supabase/`):
  - `server.ts` and `client.ts`: `@supabase/ssr` with the anon key, under RLS.
  - `admin.ts`: `createAdminClient()` with `SUPABASE_SERVICE_ROLE_KEY`, server-only, bypasses RLS.
  - Also `anon.ts`, `middleware.ts` and `ensure-profile.ts`.
- **Migrations:** `supabase/migrations/`, 23 on cf-preview and 28 on change-requests. Named `YYYYMMDDHHMMSS_name.sql`.
- **RLS pattern** (e.g. `20261003180000_plan_steps.sql`):
  - `enable row level security` plus `force row level security`.
  - `revoke all … from public, anon, authenticated, service_role`, then grant back the minimum (authenticated SELECT on own rows via policy; service_role only what it needs).
  - No UPDATE or DELETE through the API unless needed.
  - **Follow this exactly** for the new tables.
- **Env and secrets:**
  - `.env.local` (not committed) and `.env.example` (names only). Secrets are server-only, never `NEXT_PUBLIC_*`.
  - On Cloudflare: `wrangler versions secret put …`; `.dev.vars.example` exists for wrangler dev.
  - `ENVATO_API_TOKEN` is **not** in `.env.example` yet. Add the name only.
- **Review server on :3000:** `next dev -p 3000` running from **`/workspace/owen/i18n-es-wt/freeplug-landing`** (pid 907265). **:3000 currently shows the i18n-es branch, not this repo checkout.** Other `next start` servers run on :3361 and :3381.
  - The card fixes port 3000 as the permanent admin port. To review the picker there, Owen must stop the i18n review server or serve the picker worktree on :3000. Coordinate with whoever owns the i18n review (**question**).
  - `next dev` on :3000 does **not** run the Worker, so no D1/KV/Cron bindings. This matters for §4.
- **OpenNext / wrangler** (`wrangler.jsonc`):
  - One Worker, `freeplug`, with `main: custom-worker.ts`, which wraps `.open-next/worker.js` to add security headers.
  - `nodejs_compat`; assets; `WORKER_SELF_REFERENCE`; Images binding; `limits.cpu_ms: 10000`.
  - `workers_dev:false`; vars `TRUST_CF_CONNECTING_IP`, `ADMIN_ROUTE_ENABLED`; an `env.preview` Worker.
  - **No D1, KV, R2, Durable Objects or `triggers.crons` today.** `open-next.config.ts` uses the read-only static-assets incremental cache and its comment says "no R2, KV, D1 or Durable Objects are needed".
  - `account_id` is still the placeholder `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`, so it has **never been uploaded**.
  - **Deploy gates:** only `versions upload` is allowed. Promotion is Gate 1 (Ezequiel). The domain is Gate 2.

## 2. Arkitect `diagnose_repository` (user-arkitect-box, 17:02 UTC = 12:02 PM CT)
- **Decision:** `guide-new-foundation`, mode `guided`, `autoContinue: false`, required permission `generate-plan`.
- **Recommended structure:** **Modular Monolith** foundation, **Vertical Slice** inside, **Clean/Onion** at the edges (remix "AI-Native Stack").
- **Rejected:** microservices, SOA, event sourcing and saga, as too heavy for a balanced budget.
- **Repo health:** `unknown` (confidence 0.48). Arkitect inspected `freeplug-landing/` and saw `hasGit: false`, because the git root is the parent folder. It also mis-detected the platform as "desktop".
- **Tag suggestions:** `cloudflare-edge` (0.98).
- **Pattern warning:** avoid Singleton overuse in service layers.
- **Practical read:** the existing app already is a modular monolith. Build the picker as a **vertical slice**:
  - `src/lib/envato/*` as the edge adapter (Envato client behind a small interface).
  - `src/app/admin/templates/*` as the slice UI.
  - A catalog store module.
  - This matches Arkitect's recommendation, with no restructure needed.
- **Before coding:** confirm the architecture with `recommend_architecture` (Arkitect's next step). Run diagnose again from the git root, or pass the base branch's worktree, so repo health isn't "unknown".

## 3. Getting past the 60-page / ~6,000 cap
**Search parameters** (`GET /v1/discovery/search/search/item`; the build.envato.com page is JS-rendered, so these are cross-checked against the community OpenAPI spec and the `envato` npm client types, **UNVERIFIED as official**):
- `term`, `site`, `category`, `tags`
- `platform`, `compatible_with`
- `price_min` / `price_max` (whole dollars), `rating_min`, `sales` (bucket)
- `date` / `date_updated` (`this-year|this-month|this-week|this-day`)
- `sort_by` (relevance, rating, sales, price, date, updated, category, name, trending), `sort_direction`
- `page` (**max 60**), `page_size` (**max 100**)
- `username`, `attribute_key` / `attribute_value`

**Confirmed live today:**
- `page=61` returns **HTTP 400 "page must be less than or equal to 60"**, so the cap is 6,000 results per query.
- `site-templates/corporate/business` has 6,042 results, **over the cap**. Split by price:
  | Price band | Count |
  |---|---|
  | ≤ $15 | 2,084 |
  | $16–20 | 2,436 |
  | ≥ $21 | 1,522 |
  | **Sum** | **6,042 ✓** (exact, no gaps or overlap) |
- `date_updated=this-month` on that category returns 144, which is useful for spot updates.
- **Bonus:** `GET /v1/market/item-prices:{id}.json` returns **both** license prices. Example: an HTML item showed Regular $9.00 and **Extended $800.00**. This resolves the card's unknown Extended price (per item; sample of 1).

**Partition plan for the job:**
1. For each core category path (10 paths, about 12,650 items), make one `page_size=1` call to read `total_hits`.
2. If ≤ 6,000, page through it with `page_size=100`.
3. If > 6,000 (today only `site-templates/corporate/business`), split into the price bands above. If a band ever exceeds 6,000, split it further, e.g. $16–17 and $18–20, or by `sort_by=date` halves.
4. Use `sort_by=date&sort_direction=asc` within each partition so paging is stable while the sweep runs.

- **Incremental refresh:** the 6-hour freshness rule plus removed-item detection needs a **full sweep every 3 hours** (DECIDED cadence). That's about 130–140 calls per sweep, about 1,100 a day, the same as the card.
  - `date_updated=this-day` can't replace the sweep: removed items never show up as "updated", and `last_seen_at` must be under 6 hours old on every row shown.
  - Use it only for a cheap mid-cycle check, if wanted.

**Cleaning keywords** (priority type; "clean" alone is not used). Top 100 by sales per keyword, HTML + WordPress only; "dedicated" = name or tags contain cleaning, maid, housekeep or janitor:
| Keyword | Total hits | HTML | WP | Dedicated in top 100 (HTML+WP) |
|---|---|---|---|---|
| maid service | 275 | 82 | 69 | **87 / 89** |
| housekeeping | 156 | 46 | 32 | **66 / 67** (note: may include hotel housekeeping) |
| house cleaning | 722 | 238 | 131 | 43 / 93 |
| cleaning service | 8,869 | 3,029 | 1,063 | 14 / 94 (match too broad) |
| home cleaning | 7,158 | 3,010 | 518 | 8 / 90 (match too broad) |

**How the job should tag `cleaning`:**
1. Use the 5 keywords only to **find candidates** (recall).
2. **Assign** `auto_niches += cleaning` only if `name` or `tags` matches the whole-word regex `\b(cleaning|cleaners?|maid|maids|housekeeping|janitorial|carpet cleaning|window cleaning|pressure washing)\b`. Never match `clean` alone.
3. Exclude it if the only match is design wording (`clean design`, `clean code`, `clean layout`).
4. Flag `housekeeping`-only items whose tags mention hotel or hostel for Lina's review instead of auto-tagging.
5. Lina's manual tags override, as in the card.

Estimated pool after the filter: well over 100 dedicated templates, enough for the minimum of 6 (est.).

## 4. Cloudflare fit
- **Account:** Cloudflare MCP `whoami` returns user `ezequielcasillas1@gmail.com` (user id d3130e…).
- **Plan: UNVERIFIED.** A read-only account call (`GET /accounts`, subscriptions, D1, KV and Workers lists) returned **"Authentication error" (10000)**. The token can identify the user but not read the account. The only evidence is a `wrangler.jsonc` comment: "Workers Paid plan (Ezequiel's decision to buy)". `account_id` is still a placeholder.
- **Limits that matter** (Cloudflare docs: https://developers.cloudflare.com/workers/platform/limits/ and /workers/platform/pricing/):
  | Limit | Workers Free | Workers Paid |
  |---|---|---|
  | Cron Triggers per account | 5 | 250 |
  | CPU per Cron invocation | **10 ms** | 30 s (interval < 1 h) / **15 min (interval ≥ 1 h)** |
  | Wall time per Cron invocation | 15 min | 15 min |
  | Subrequests per invocation | **50** | 10,000 (default) |
  | D1 rows written | **100,000/day** | 50 M/month included, then $1/M |
  | D1 rows read | 5 M/day | 25 B/month included |
  | D1 storage | 5 GB total | 5 GB included, then $0.75/GB-mo |

  - D1 Free daily limits are **enforced since Sept 1, 2026**: queries fail until midnight UTC.
  - KV (from memory, not re-checked today, **UNVERIFIED**): Free is 1,000 writes/day and 100k reads/day; Paid includes 1 M writes/month.
- **Does a 3-hour sweep fit?**
  - **On Free: NO.** A sweep makes about 140 Envato fetches plus storage calls, far over 50 subrequests and 10 ms CPU. Rewriting about 12,650 rows 8 times a day is about 101k D1 writes a day, over the 100k limit.
  - **On Paid: YES.** About 140 subrequests (limit 10,000). CPU is small, since the work is mostly waiting on network. The **wall time is the constraint**: 140 calls at the card's 3–5 s spacing is 7–12 minutes, inside the 15-minute limit but tight. Use about 2.5 s spacing (about 6 minutes), or split the sweep across 2 Cron entries (e.g. HTML at :00 and WordPress at :30), or use Workflows.
  - The Worker's own `limits.cpu_ms: 10000` applies to the scheduled handler too; that's fine.
- **D1 or Supabase for the catalog? Recommend Supabase** (a change from the card, which said D1; **needs Ezequiel's OK**):
  1. The widen log, shortlist, `website_requests` and admin auth are already in Supabase. One store means joins (shortlist ⋈ catalog ⋈ request niche) and **one RLS model**.
  2. **Localhost review:** `next dev` on :3000 has no D1 binding. D1 would need `initOpenNextCloudflareForDev` / wrangler's local proxy and a *local* SQLite copy, so Lina's admin page on :3000 would not show the real catalog. Supabase works the same on :3000 and in production.
  3. It avoids adding the first D1 binding and migration track to a Worker that has never been uploaded.
  4. **Size:** about 12,650 rows × about 2 KB is about 25 MB, small for any Supabase plan. The Supabase plan is not checked (**UNVERIFIED**; Free is 500 MB).
  - **Write budget:** don't rewrite every row each sweep. Write one `envato_sync_runs` row per sweep, upsert only changed items (compare a hash of price, rating, sales, updated_at, preview), and record "seen" by bulk-updating `last_seen_run_id` in batches of about 500.
  - **Cron stays on the Worker:** a `scheduled()` export in `custom-worker.ts` calls the same `syncCatalog()` with the Supabase service-role client. **Not enabled until Ezequiel's upload and promote gate.** Before then, run it from the admin page's "Sync now" or a local script.

## 5. Envato app registration (Ezequiel signs in himself)
Source: https://build.envato.com/api/ (fetched Oct 12) and https://build.envato.com/terms/.
1. Ezequiel signs in at build.envato.com, goes to **My Apps** ("Manage your apps"), then **Register a new app**.
2. **Info asked for:** "the name and a description of your app, as well as the permissions that the user will need to grant", plus a **Confirmation URL** (OAuth redirect). It "must use https://"; plain http is rejected.
   - **Suggested name:** "Freeplug template picker". The terms forbid "Envato" in the app name; "Envato" may appear in the description.
   - **Confirmation URL:** e.g. `https://freeplug-in.dev/api/envato/callback`. Needed only for OAuth.
3. **Permissions:** the picker needs only public catalog search and item reads. Choose the **minimum**, i.e. no purchase, sales, account, email or download scopes. Exact scope names are shown only inside the form (**UNVERIFIED**).
4. **What you receive:** an **OAuth client ID and secret** ("application key"), shown on My Apps. Store them as Worker secrets (`wrangler versions secret put`) and in `.env.local`. Never `NEXT_PUBLIC_`, never logged.

**OAuth vs. personal token:**
- The docs describe only: (a) a **personal token** for "access the API directly yourself… public data", and (b) **OAuth authorization-code** for acting on a logged-in user's behalf. Access tokens last 1 hour, with a refresh token.
- **No client-credentials (app-only) flow is documented.** So a registered app reading public data would either:
  - (i) have Ezequiel log in once via OAuth, then store the **refresh token** as a server secret and refresh hourly; or
  - (ii) keep using a personal token *alongside* the registered app, so the app is registered as the terms require.
- Which one Envato expects is **UNVERIFIED**. Option (i) is the cleaner match to "app registered + no personal token in production". Build the client behind an interface so either works.

**Attribution:** "All your Applications must acknowledge your use of the API… including the "Powered by Envato API" logo in the Application" (Terms §15).
- Don't use "Envato" or its logos in the app name, and don't imply endorsement (§16).
- Show the logo on `/admin/templates` and on the client picker.
- Where to get the official logo file isn't in the public pages read (**UNVERIFIED**; likely on the My Apps or branding page after sign-in).

## 6. Go / no-go and first build steps for Owen
**GO for Phase 1 (admin page on localhost:3000)** once these are settled:
- **A. Base branch:** Jace/Ezequiel approve the base recommended in §1b.
- **B. Catalog store:** Ezequiel OKs Supabase instead of D1 (§4).
- **C. Review port:** whoever owns the i18n review on :3000 agrees to hand the port over during picker review.

**Build Phase 1 with the existing personal token server-side on localhost.** Switch to the registered app when Ezequiel completes §5. **No Cron and no deploy** without Gate 1.

**Steps** (each ends with a checkpoint):
0. **Arkitect first:** run `diagnose_repository` and `analyze_refactoring_opportunities` on the base worktree.
   - If `/workspace/Arkitect-MCP.AI` `dist` is missing, rebuild with `pnpm -r --filter "./packages/**" build` and restart the MCP servers.
   - **Checkpoint:** a structure report saved, with no blockers.
1. **Branch:** create `envato-picker-admin` from `change-requests`, merge `ladder-fix-2026-10-03` (clean per merge-tree), then `npm run verify`. Keep it local and don't push without Ezequiel.
   - **Checkpoint:** verify is green on the base.
2. **Migration `supabase/migrations/20261012170000_envato_catalog.sql`:**
   - Tables:
     - `envato_items`: id bigint pk, site, category, platform html/wp, name, price_cents, rating, rating_count, sales, published_at, updated_at, live_preview_url, preview_image_url, tags text[], auto_niches text[], saleable_on_elements bool, content_hash, last_seen_run_id, last_seen_at, status active/removed.
     - `envato_sync_runs`: id, started_at, finished_at, partitions, calls, items_seen, items_changed, items_removed, error.
     - `template_shortlist`: envato_item_id, niches text[], note, added_by, added_at, active.
     - `template_widen_log`: request_id, user_id, actor_role team/client, reason, created_at.
   - Indexes on (status, auto_niches gin), category, last_seen_at.
   - **RLS exactly like `plan_steps`:** enable + force; revoke all from public/anon/authenticated/service_role; grant service_role only what the sync and admin need. Phase 1 gives **no** authenticated access at all, since the admin page uses the service-role client behind `assertAdminAccess`.
   - `website_requests` template and license columns are **not** in this migration (Phase 3).
   - **Checkpoint:** the migration applies cleanly on a local or dev Supabase. A test asserts anon and authenticated can't select from `envato_items`.
3. **Envato client** (`src/lib/envato/`):
   - `client.ts`: imports `server-only`; reads `ENVATO_API_TOKEN` (later the OAuth secret); 15 s timeout; on 429 honors `Retry-After` with exponential backoff up to 10 minutes; never logs the token or the full URL with auth.
   - `partitions.ts`: the category list, plus price-band splitting when `total_hits` > 6,000.
   - `niche-tags.ts`: the 20 types, including the **cleaning rule from §3**.
   - `sync.ts`: `syncCatalog({maxCalls, delayMs})`. One worker; pacing 2.5 s; content-hash upsert; batched seen-marks; removed-marking only after a *complete* sweep.
   - Add `ENVATO_API_TOKEN=` to `.env.example`, name only.
   - **Checkpoint:** unit tests with mocked fetch cover the partition split, 429 backoff, the cleaning tagger (positive "maid service"; negative "clean design") and removed-marking. A grep test fails if the token name appears in client bundles (`.next/static`).
4. **Admin page** `src/app/admin/templates/page.tsx` (+ `actions.ts`), plus a link in `AdminNav.tsx`:
   - The niche picker is required, with no "all" view. Filters: category, HTML/WP, price, rating, sales, updated date.
   - Shortlist toggle; coverage counter (min 6 per type, warning below); "Widen to general" with a required reason, logged.
   - "Sync now" (admin-only server action). Last-sync status. The "Powered by Envato API" logo.
   - Hides rows with `last_seen_at` older than 6 h.
   - Widen-log and digest pages get an extra **localhost-only** host check, even in production.
   - **Checkpoint:** on **localhost:3000**, Lina can sign in, pick "cleaning", see real items, shortlist 6, and widen with a logged reason. Screenshots go to the review.
5. **First real sync, run by hand from the admin page:** one complete sweep at polite pacing.
   - **Checkpoint:** about 12,650 active rows. Every partition under 6,000. No 429s (or handled). A coverage report per business type, flagging any under 6.
6. **Cron (prepare, don't enable):** add a `scheduled()` export in `custom-worker.ts` that calls `syncCatalog`, with `"triggers": {"crons": ["0 */3 * * *"]}` **commented out** in `wrangler.jsonc` and a note that it is Gate 1.
   - **Checkpoint:** `npm run verify` and `cf:build` pass; nothing uploaded.
7. **Handoff:** run Arkitect `verify_codebase` and `npm run verify`, then send the review link (localhost:3000) plus a PR to Ezequiel. **Nothing goes to main or live, and nothing is purchased, without Ezequiel.**
   - **Checkpoint:** Ezequiel's review.

Then Phase 2/3 (client picker): rebase after the i18n decision, add the `website_requests` columns migration, and put picker strings in next-intl.

## Open questions
1. **Base branch and push order:** OK to base on change-requests + ladder-fix? Should that stack be pushed to origin first, so the picker PR is reviewable?
2. **Catalog store:** Supabase instead of D1 (recommended)?
3. **Port :3000:** it currently serves the i18n-es review. Who frees it for the picker review?
4. **Cloudflare plan:** confirm Workers Paid (the MCP token couldn't read the account). A 3-hour Cron does not work on Free.
5. **Envato auth after registration:** a one-time OAuth login with a stored refresh token, or a personal token alongside the registered app?
6. **Extended price** is now readable per item (`item-prices`). Show it to the team on the admin page?

## Unverified
- **Search API:** the parameter list is from a community spec and npm types, not the official page.
- **Cloudflare:** the plan; KV limits; whether Free applies (wrangler says Paid).
- **Envato app:** the scope names in the registration form; the OAuth vs. personal token expectation; the official logo file.
- **Supabase:** the plan and its limits.
- **Coverage:** the cleaning dedicated-pool estimate. "Housekeeping" overlaps with hotels.
- **Arkitect:** repo health came back "unknown" (it ran on the subfolder, not the git root).

## DECIDED Oct 12, 1:21 PM CT: the catalog stays in Cloudflare D1 (Cheke declined Supabase)
- These live in **D1** (binding `ENVATO_DB`): `envato_items` (the catalog) and `envato_sync_runs`. On localhost this is the local D1 that wrangler stores on disk, reached through OpenNext's dev bindings (`initOpenNextCloudflareForDev`). The hosted D1 database is created only with Cheke's OK.
- These stay in **Supabase**: the shortlist, the widen log, and the request links. They point at a catalog item by its Envato `item_id`. There are no cross-database joins; the app combines the two in its server code.
- **Writes**: sync only rows that changed (compare a hash of each row), never rewrite all rows. That keeps a 3-hour sweep far under D1's daily write limits.
- **Cron needs Workers Paid**: on the Free plan it's capped at 50 subrequests per run, while a sweep needs about 312 calls. The plan is unconfirmed, and the job stays off until Cheke confirms it and OKs a deploy.
- **Rework**: Owen moves the catalog tables and the sync writer from the Supabase migration to a D1 migration in `migrations-d1/`, keeps the same tests, and adds a test that a no-change sync writes 0 rows.
