# Freeplug on Cloudflare + owner editing: architecture card (Aria, DRAFT v1, 2026-10-03)
Research and planning only. Nothing was deployed. I didn't log in to or change Cloudflare, Supabase, Stripe, Vercel or DNS. I made no commits and left the working tree alone. Nothing was bought and no one was contacted.
- Repo checked: branch `backup/box-build-2026-10-03` (commit 9345ae0) in `/workspace/freeplug-in-dev`. I exported it with `git archive` into `/workspace/aria/scratch/fp-cf/`. `git status` on the original stays clean.
- Every build and run happened in scratch with placeholder values, no real secrets. I used a portable Node 22 at `/workspace/aria/scratch/node22`, because Wrangler needs Node 22 or later and the box has Node 20.
- Logs: `/workspace/aria/scratch/opennext-build-1..4.log`, `wrangler-dev*.log`, `vinext-check.log`, `npm-ci.log`.
- The scratch copy also has a probe route (`src/app/api/cf-probe`) and scratch-only config files (`wrangler.jsonc`, `open-next.config.ts`, `.dev.vars`, `.env.production.local`). None of these are in the repo.
- Sources were read on 2026-10-03, between about 8:15 and 8:45 AM CT, unless noted.

**Correction to the brief:** the branch runs **Next 16.3.3**, not 16.2.2 (`package.json`, `eslint-config-next` too).

---
# PART A: Cloudflare deploy plan (Owen runs it; Ezequiel approves the gates)

## A0. Recommendation in one paragraph
Run the app as **one Cloudflare Worker using the OpenNext adapter (`@opennextjs/cloudflare` 1.20.8)**, on the **Workers Paid plan ($5/month minimum)**, attached to `freeplug-in.dev` as a **Workers Custom Domain**, with `www` redirected to the apex. Before that works, three code changes are required:
1. Upgrade Next to **16.3.8**. 16.3.3 has a critical security hole no matter where it's hosted.
2. Replace **`sharp`**. It can't load on Workers, and because many routes import it, signup, preview, claim, dashboard and the **Stripe webhook** all return 500.
3. Swap the Netlify visitor-IP header for **`CF-Connecting-IP`**, behind a setting (`TRUST_CF_CONNECTING_IP=true`).

Email should move to Resend's HTTPS API (decision). The app needs no ISR cache store (no R2, KV, D1 or Durable Objects).

## A1. Is Next 16 supported? (research)
| Topic | Finding | Source |
|---|---|---|
| Supported path | OpenNext Cloudflare runs the Next **Node.js runtime** on Workers. "All minor and patch versions of Next.js 16" are supported. Edge runtime isn't supported (we have none). | https://opennext.js.org/cloudflare |
| Cloudflare's own default | Cloudflare now *recommends* **vinext** (a Vite reimplementation of Next, **beta**). OpenNext is listed for apps that can't migrate yet. | https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ (updated Aug 25, 2026) |
| vinext check on our code | 89% compatible. The 2 "issues" were build leftovers in `.open-next/`, not our source. The only partial is `turbopack` loaders, which we don't use. | `/workspace/aria/scratch/vinext-check.log` |
| Version floor | `@opennextjs/cloudflare@1.20.8` (Oct 2, 2026) peer-requires **next ≥16.3.8** "to include the latest security fixes". 1.20.7 notes say **Next 16.2.0–16.3.5 are affected by the critical `next/og` remote code execution CVE-2026-94545**. It also fixed "site-wide 500s on Next.js 16.3.x". | https://github.com/opennextjs/opennextjs-cloudflare/releases |
| `proxy.ts` | Supported since 1.20.3, **experimental**. The build prints "Node.js middleware support is experimental… not officially maintained… Use at your own risk." It works locally: `/dashboard` redirects 307 as intended. | releases page; build-1/4 logs |
| Server actions | Supported. The 6 MB limit works (A6). | tested |
| ISR / incremental cache | Only needed for revalidation. Our build has 5 static routes (`/`, `/faq`, `/robots.txt`, `/sitemap.xml`, `/icon.svg`). Everything else is dynamic. No `revalidate` export, no `unstable_cache`, no `'use cache'`. `revalidatePath` is only called after mutations on dynamic pages. **No R2, KV, D1 or DO needed.** Use the read-only `staticAssetsIncrementalCache` for the prerendered pages. | https://opennext.js.org/cloudflare/caching |
| Image optimization | Needs an `IMAGES` binding (Cloudflare Images) or a custom loader. Without one, OpenNext serves the original image: in my test `/_next/image` returned 200 with the same 134,854 bytes as the source. Only `OutreachSection.tsx` uses `next/image`, with 5 local JPGs. | https://opennext.js.org/cloudflare/howtos/image ; wrangler-dev-2.log |
| Node APIs | `node:crypto`, Buffer, streams, `net`, and http/https are supported. `tls` is **partial**. Node compat is on by default for compatibility dates from 2026-08-04 on. | https://developers.cloudflare.com/workers/runtime-apis/nodejs/ (Aug 12, 2026) ; changelog 2026-08-04 |

## A2. Workers plan, limits, cost
| Limit | Free | Paid ($5/mo minimum) | Our need |
|---|---|---|---|
| CPU per request | **10 ms** | 5 min (default 30 s) | SSR with Supabase auth is "typically 10–20 ms" per Cloudflare, so **Free is too small** |
| Requests | 100,000/day | 10M/month included, then $0.30 per million | small |
| CPU included | n/a | 30M CPU-ms/month, then $0.02 per million ms | small |
| Subrequests | 50 per request | 10,000 | Free is risky (Supabase, Stripe and Turnstile calls) |
| Worker size | 64 MiB uncompressed | 64 MiB | **ours is 21.0 MiB (gzip 4.7 MiB)** per `wrangler deploy --dry-run` |
| Startup | 1 s | 1 s | check `startup_time_ms` on the first `versions upload` |
| Memory | 128 MB per isolate | same | fine with one photo per request |
| Request body | depends on the **zone's** Cloudflare plan: Free zone **100 MB** | same | 6 MB is far below |
| Static asset requests | free, unlimited | free, unlimited | n/a |

Sources: https://developers.cloudflare.com/workers/platform/limits/ (Sep 5, 2026) ; https://developers.cloudflare.com/workers/platform/pricing/ (Oct 2, 2026). The OpenNext index page still says 3 MiB (Free) and 10 MiB (Paid) compressed. Cloudflare's own limits page is newer, so I treat it as authoritative. Ours passes the old Paid limit anyway.
**Cost estimate: $5/month** at our volume. Workers Builds (CI) on Paid includes 6,000 build minutes a month. **Buying the Paid plan is Ezequiel's decision.** Set `limits.cpu_ms` to **10,000** (proposal) to cap runaway CPU bills.

## A3. What actually happened when I built and ran it (scratch)
| Run | Result |
|---|---|
| `npm ci` (Node 20) | OK (595 packages; one engine warning from `camera-controls`) |
| build-1: `opennextjs-cloudflare build`, OpenNext 1.20.6 + Next 16.3.3 | **Build OK**: 25 static-generation steps, `ƒ Proxy (Middleware)`, worker saved. Warning: Node middleware is experimental. |
| `wrangler deploy --dry-run` on the 16.3.8 build (no login, nothing uploaded; `wrangler-dryrun.log`) | Total Upload **21,549.93 KiB / gzip 4,815.50 KiB**, well under the size limit |
| wrangler-dev (local workerd) | `/` 200, `/faq` 200, `/login` 200, `/robots.txt` 200, `/dashboard` 307. **`/signup` 500, `/preview` 500, `/p/abc` 500, probe 500.** |
| build-3 + wrangler-dev-2 (scratch-only lazy import of sharp to isolate the failure) | All of those pages work. The probe results are in the next table. |
| build-4 + wrangler-dev-3: **Next 16.3.8 + OpenNext 1.20.8** (the target versions) | Build OK. Runtime has the same sharp failure: `/signup`, `/preview`, `/p/abc`, `/claim` return 500, and **`POST /api/webhooks/stripe` returns 500**. |

**The actual error, logged 9 times in wrangler-dev-3.log:**
```
Error: Failed to load external module sharp-20c6a5da84e2135f: TypeError: Cannot read properties of undefined (reading 'endsWith')
    at Context.externalImport (.open-next/server-functions/default/handler.mjs:6707:57673)
```
Why it spreads: `src/lib/outreach/image.ts` does a top-level `import sharp from 'sharp'`. It's imported by `src/lib/outreach/server.ts`, which **19 files** import: signup, dashboard, cancel, photos, website, admin/outreach, `api/checkout/hosting`, **`api/webhooks/stripe`**, claim/*, p/[token], and preview/*. On Workers every one of these breaks. A 500 on the webhook means Stripe retries and can eventually disable the endpoint. **This is the launch blocker.**

Probe results (local workerd, wrangler-dev-2.log):
| Check | Result |
|---|---|
| `sharp` direct | fails (same error). `processUploadedImage` returns `unreadable` for every image, so all uploads would be refused. |
| Stripe `constructEvent` (sync, current code) | **Treat as broken.** `stripe@21.0.1` has a `workerd` export that uses `SubtleCryptoProvider`, which throws `"SubtleCryptoProvider cannot be used in a synchronous context."` from a sync call. The bundle contains both crypto providers, and the probe's JSON output wasn't saved, so I can't say from logs which one OpenNext picks. **Switch to `await constructEventAsync`**, which works with both providers. |
| Supabase SSR cookies via `proxy.ts` | session refresh runs, and the dashboard redirect works. A real login hasn't been tested (no real project in scratch). |
| `nodemailer` over plain TCP to a fake SMTP server | EHLO/QUIT **works** through `node:net`. TLS on 465 to Namecheap is **not tested**. |
| `cf-connecting-ip` | present (127.0.0.1 locally). `clientIpFrom` returned `unknown-ip` because the Netlify flag is off, as expected. |
| Preview headers | `/preview` (404 without a token) still sent `x-robots-tag: noindex, nofollow, noarchive`, `referrer-policy: no-referrer`, and `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` |
| Missing Supabase | expected DNS errors for `placeholder.supabase.co`; `rate_check` fails closed |
| Runtime restarts | `wrangler-dev-2.log` ends with "Workers runtime crashed unexpectedly… (crash #1, #2)" right after the image requests and the shutdown. Probably shutdown noise, but **watch for it on preview**. |

## A4. Code audit: Cloudflare blockers and changes (Owen)
| # | Item | Status | Change |
|---|---|---|---|
| 1 | **Next 16.3.3** | **Blocker** (CVE-2026-94545, and below OpenNext's floor) | `next` and `eslint-config-next` to **16.3.8**. Rerun `npm run verify`. |
| 2 | **`sharp`** in `src/lib/outreach/image.ts` | **Blocker** | Replace it behind the same `processUploadedImage()` interface (see A8). Remove `sharp` from dependencies. |
| 3 | Visitor IP (`x-nf-client-connection-ip`) | **Blocker for rate limits** | see A5 |
| 4 | Email: `nodemailer` SMTP (`src/lib/email/smtp.ts`, `src/lib/admin/mail.ts`, `src/lib/email/send.ts`) | Risky | Workers allow outbound TCP except port 25 (https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/, Jun 19, 2026). `node:tls` is partial, so 465 is unproven. **Recommended:** make Resend (HTTPS, `resend` is already a dependency and already the fallback in `sendMail`) primary on Cloudflare. Keep SMTP as an option only after a real test on preview. The Resend MCP is connected, but its **API key is invalid** (`list-domains` returned "API key is invalid"), so I couldn't check whether `freeplug-in.dev` is verified there. Resend domain verification needs DNS records (SPF/DKIM) added in Cloudflare. That's a DNS change and needs approval. |
| 5 | Stripe webhook signature check | **Required change** | `src/app/api/webhooks/stripe/route.ts:34`: `event = await stripe.webhooks.constructEventAsync(body, sig, secret)`. Update the mocks in `route.test.ts` and `route-outreach.test.ts` to `constructEventAsync`. Also recommended: `new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })` in `src/lib/stripe/server.ts`. Raw body via `request.text()` stays the same. |
| 6 | `loadEnvConfig(process.cwd(), …)` in `src/lib/stripe/server.ts` | Harmless (no crash) | Remove it. Next already loads env, and on Workers env comes from bindings. |
| 7 | Webhook raw body | OK in code | `request.text()` keeps the exact bytes. Verify with a real `stripe trigger` on preview. |
| 8 | `runtime = 'nodejs'` exports (5 files) | OK | Keep. There are no `edge` exports. |
| 9 | `next.config.ts` | OK | `bodySizeLimit: '6mb'` and `headers()` are honored. Update the Netlify comment. |
| 10 | **`netlify.toml` security headers** (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on `/*`) | **These disappear on Cloudflare** | Move them into `next.config.ts` `headers()` for `/:path*`, listed *before* the preview rules so the preview `no-referrer` wins. Also add them to `public/_headers` for static files, together with the `/_next/static/*` immutable cache header from the OpenNext docs. |
| 11 | Netlify/Vercel leftovers | Cleanup | Delete `netlify.toml` (repo root) and the devDependency `@netlify/plugin-nextjs`. Fix the Netlify comments in `src/lib/rate-limit/client-ip.ts`, `src/lib/outreach/body-limit.ts`, `src/lib/outreach/limits.ts`, `src/lib/outreach/server.ts:81`, `next.config.ts:12`, `.env.example:69`, and migration `20260927050200_site_details.sql:478` (comment only; don't edit an applied migration, note it in the next one). There's no Vercel code. `punch-list.test.ts` only checks that `vercel.svg` is gone. |
| 12 | New files | Add | `wrangler.jsonc`, `open-next.config.ts`, `custom-worker.ts` (only if we add a cron), `public/_headers`, `.dev.vars.example`, and `.open-next`, `.wrangler` and `.dev.vars*` in `.gitignore`. Scripts: `preview`, `deploy`, `upload`, `cf-typegen`. Devs: `@opennextjs/cloudflare@1.20.8`, `wrangler@^4.147`. CI on **Node 22**. |
| 13 | `src/lib/stripe/config.ts` `includes[]` text | Copy drift (not Cloudflare) | The code still shows "Regular backups", "Downtime alerts" and "One small edit per month (no rollover)". The locked copy has the approved single-string card copy. Flag for Owen and Sable. |

**Env var names** (names only). These were found in `src` and `.env.example`.
- `NEXT_PUBLIC_*`: these are **baked in at build time**, so they must be set in the *build* environment for each env.
  - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - The server code reads `NEXT_PUBLIC_APP_URL` for Stripe and Supabase redirects. A preview built with the production value would send users to production.
- Secrets (`wrangler secret`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `SMTP_PASS` (only if SMTP is kept).
- Plain vars: `TRUST_CF_CONNECTING_IP` (new), `ADMIN_EMAILS`, `ADMIN_ROUTE_ENABLED`, `ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID` (leave unset), `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`.
  - SMTP only: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`.
  - Must stay **unset in production**: `SMTP_TLS_REJECT_UNAUTHORIZED`, `STRIPE_LOCAL_MOCK_URL`.
- Remove after the switch: `TRUST_NETLIFY_IP_HEADER`, `TRUST_PROXY_HEADERS`.
- OpenNext local only: `NEXTJS_ENV` (in `.dev.vars`).
- Legacy names still read by the code: `RESEND_FROM_EMAIL`, `SMTP_FROM`.

## A5. Visitor IP for rate limits (Jace constraint 1)
**Today:** `clientIpFrom()` in `src/lib/rate-limit/client-ip.ts` trusts `x-nf-client-connection-ip` only when `TRUST_NETLIFY_IP_HEADER === 'true'`. It also has a second branch that reads `X-Forwarded-For`/`X-Real-IP` when `TRUST_PROXY_HEADERS === 'true'`. Otherwise it returns `SHARED_IP_BUCKET` (`'unknown-ip'`).

**Change (proposed setting name `TRUST_CF_CONNECTING_IP`):**
1. `src/lib/rate-limit/client-ip.ts`:
   - Add `export const TRUST_CF_CONNECTING_IP_ENV = 'TRUST_CF_CONNECTING_IP'`.
   - Rewrite `clientIpFrom(h, env)`. If `env.TRUST_CF_CONNECTING_IP === 'true'` (exactly that string), read `h.get('cf-connecting-ip')?.trim()`. If `isIP()` from `node:net` (supported on Workers) says it's a valid IPv4 or IPv6 literal, return it. **Anything else returns `SHARED_IP_BUCKET`.**
   - **Delete the `X-Forwarded-For`/`X-Real-IP` branch and `TRUST_PROXY_HEADERS_ENV`**, so no fallback code path is left. Delete the Netlify branch and `TRUST_NETLIFY_IP_HEADER_ENV` too.
   - Proposal: bucket IPv6 by its /64 prefix (`2001:db8:1:2::/64`). One home or phone usually holds a whole /64, so the full address would let a single client rotate through endless buckets.
   - `isTrustedClientIp()` stays the same.
2. Callers keep the same code; only comments change:
   - `src/app/(auth)/actions.ts` `clientIp()` (line ~130, used at ~187 for signup/reset limits)
   - `src/lib/outreach/resend-confirmation.ts` (line ~56; already uses the stricter `RESEND_LIMITS.sharedIp` for the shared bucket)
   - `src/lib/outreach/server.ts` client-IP helper (line ~81–83; fix the comment)
   - `src/lib/outreach/turnstile.ts:46` already sends `remoteip` only for a trusted IP. Keep that.
3. Tests:
   - `src/lib/rate-limit/client-ip.test.ts`: replace the Netlify and XFF cases. New cases:
     - flag on with a valid header gives the IP
     - flag on with no header, an empty one or garbage gives the shared bucket
     - flag on with only `X-Forwarded-For` gives the shared bucket
     - flag off with the header gives the shared bucket
     - the flag values `'1'`, `'TRUE'` and `''` all count as off
     - IPv6 is keyed by /64
   - `src/lib/rate-limit/index.test.ts:69` and `src/app/claim/resend/route.test.ts:127–144`: switch to `cf-connecting-ip` and the new flag.
   - `.env.example`: replace the two lines with `TRUST_CF_CONNECTING_IP=` and a comment saying to set it only on Cloudflare. The test that checks `.env.example` needs the same update.
4. Config:
   - Set `TRUST_CF_CONNECTING_IP=true` as a `vars` entry in the production and preview Workers only.
   - Leave it unset for `next dev` and vitest. Local `wrangler dev` sets the header to 127.0.0.1, so you may set it in `.dev.vars`.
   - In the Cloudflare zone, **leave "Pseudo IPv4" off** (it overwrites CF-Connecting-IP) and **don't enable "Remove visitor IP headers"**. Either setting would quietly put everyone in the shared bucket or behind a fake address.

Why this is safe: Cloudflare sets `CF-Connecting-IP` at its edge from the real connection. Inside a Worker, `X-Forwarded-For` isn't even present yet, because Cloudflare's proxy adds it after Workers run. Sources: https://developers.cloudflare.com/fundamentals/reference/http-headers/ (May 5, 2026) ; https://developers.cloudflare.com/rules/transform/request-header-modification/. The only way to forge the header is a same-zone Worker subrequest that sets `x-real-ip`, and we have no such Worker.

## A6. 6 MB streamed uploads (Jace constraint 2): confirmed
| Layer | Limit | Source / test |
|---|---|---|
| Cloudflare edge request body | **100 MB** on a Free or Pro zone (set by the zone plan, not the Workers plan), 200 MB on Business. Larger bodies get 413. | https://developers.cloudflare.com/workers/platform/limits/ (Sep 5, 2026) |
| Worker memory | 128 MB per isolate, shared by concurrent requests | same. The current design (one photo per request, `uploadConcurrency: 3`, about 3 copies of 6 MB each) stays well under. |
| Next server actions | default **1 MB**. We set `experimental.serverActions.bodySizeLimit: '6mb'`. The limit counts the whole multipart body, so leave room for 10–20 KB of overhead. | https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions |
| OpenNext | no lower limit of its own. Our 6mb setting is honored. | tested |
| Our streaming cap (`src/proxy.ts` → `oversizedActionResponse`, which counts `request.clone().body` as it streams) | **works on workerd** | tested below |

Local workerd tests (wrangler-dev-2.log), POSTing to `/preview` with `Next-Action: <uploadPreviewPhotoAction id>`:
| Body | With Content-Length | Chunked (no length) |
|---|---|---|
| 2 MB | 200, reached the action ("link expired") | 200, reached the action |
| **5.5 MB** | **200, reached the action** | **200, reached the action** |
| 7 MB | **413** with Sable's "That photo is too large…" line | **413**, same line |

Caveat: wrangler dev doesn't apply the edge's own limits, so **rerun this table on the preview deploy** (Vera). If OpenNext's experimental proxy support ever breaks, the fallback is to move the same byte count into a `custom-worker.ts` wrapper in front of the OpenNext handler. That's plain Workers code and doesn't depend on proxy support.

## A7. Replacements for the Netlify-era assumptions
| Assumption | On Cloudflare |
|---|---|
| `x-nf-client-connection-ip` | `cf-connecting-ip` behind `TRUST_CF_CONNECTING_IP`, with no XFF fallback (A5) |
| `@netlify/plugin-nextjs` | `@opennextjs/cloudflare` + Wrangler. Delete the plugin and `netlify.toml`. |
| Netlify ~6 MB body limit | Edge limit 100 MB. Our own 6 MB cap stays the real limit (A6). |
| `sharp` re-encoding | Cloudflare Images binding (A8) |
| next-intl via `src/proxy.ts` | `proxy.ts` runs on Workers (experimental). next-intl isn't installed yet. When it's added, test locale routing under `wrangler dev` and the preview deploy *before* merging, and keep `/dashboard` and `/api` outside the matcher as planned. Fallback: run next-intl without proxy routing, or wait for vinext. |
| `pg_cron` | **Not affected.** It's a Supabase Postgres extension and doesn't depend on the host. It still fits the database-only 90-day chat transcript delete. The photo purge needs Storage API deletes first. For that, keep the admin button, or add a Cloudflare **Cron Trigger** through `custom-worker.ts` that calls the existing purge path. Paid plan: 250 cron triggers, 30 s CPU each. Crons run on UTC: `15 8 * * *` is 3:15 AM CDT. (https://opennext.js.org/cloudflare/howtos/custom-worker) |
| Turnstile | No change in code. The Cloudflare account **already exists**, because DNS is on Cloudflare, so the "create a free Cloudflare account" decision from my earlier cards is settled. Creating the widget is still a Cloudflare change for Ezequiel to approve. Widget hostnames: `freeplug-in.dev`, plus the preview host using Cloudflare's test keys. |
| `Cache-Control: private, no-store` on previews | Still sent (tested). Worker responses aren't stored in Cloudflare's cache unless Workers Cache (`"cache": {"enabled": true}`) is turned on. **Keep it off.** Belt and braces: add a zone Cache Rule set to **Bypass cache** (A9 step 9). |

## A8. Upload images without `sharp`
Requirements: the browser resizes, the server checks magic bytes, a real decode and re-encode rejects fakes, EXIF/GPS is stripped, and files get random names. All of that stays the same; only the codec changes.
| Option | How | Strips EXIF | Cost / limits | Verdict |
|---|---|---|---|---|
| **Cloudflare Images binding** (`images: {binding: "IMAGES"}`), in the same Worker via `getCloudflareContext().env.IMAGES` | `info()` to validate (not billed), then `input(stream).transform({width,height,fit}).output({format})`. A decode failure throws, so the file is rejected. | **WebP/PNG output always discards EXIF.** JPEG keeps the copyright tag by default (`metadata=copyright`). Correction (Owen, 2026-10-03): `metadata: 'none'` is not in the binding's typed output options, so the build strips metadata from the encoded bytes afterwards, and a GPS test gates it. | Free: **5,000 unique transformations a month**. Past that, new transformations return error 9422 with no charge, so uploads fail closed. Paid Images: $0.50 per 1,000 extra. The same binding also powers `next/image`. | **Recommended** |
| jSquash (wasm mozjpeg/png/webp) | Decode and re-encode in wasm | Yes (re-encoded from pixels). Orientation must come from the browser step. | No quota. A few hundred ms of CPU per photo (estimate). | Fallback only. Wasm inside the OpenNext/Turbopack bundle is fragile (OpenNext issues #1317 and #1163). Run it as a **separate small Worker** behind a Service Binding. |
| Supabase image transformations | Resizes on delivery (Pro plan) | Doesn't clean the stored original | Supabase Pro | No: doesn't validate the upload |
| Browser-only resize | n/a | n/a | n/a | No: the server must still decode |

Plan:
1. Keep `detectImageType()` (JPEG, PNG, WebP magic bytes) and the size checks.
2. Swap the body of `processUploadedImage()` to use the Images binding, with the same return type.
3. Output: JPEG, with metadata stripped from the encoded bytes after the binding returns (done on `cf-port-2026-10-03`). WebP output is the fallback if that ever regresses.
4. Vera's existing test ("uploaded photo has no EXIF GPS") becomes the gate.

Binding API reference: https://developers.cloudflare.com/images/transform-images/bindings/ (timed out for me, needs a recheck). Metadata rules: https://developers.cloudflare.com/images/optimization/features/ ; pricing: https://developers.cloudflare.com/images/pricing/ (Jul 8, 2026).

## A9. Deploy steps (Owen executes; ⛔ = Ezequiel's explicit yes needed *at that moment*)
**1. `wrangler.jsonc` shape** (proposal):
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "freeplug",
  "main": ".open-next/worker.js",            // or "custom-worker.ts" if a cron is added
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "freeplug" }],
  "images": { "binding": "IMAGES" },
  "observability": { "enabled": true },
  "limits": { "cpu_ms": 10000 },
  "workers_dev": false,                      // no second public hostname for production
  "preview_urls": false,
  // NO "routes" / custom_domain here (Owen, 2026-10-03): attaching freeplug-in.dev in config would
  // switch the domain on any deploy and skip Gate 2. The domain is attached by hand at Gate 2 only.
  "vars": { "TRUST_CF_CONNECTING_IP": "true", "ADMIN_ROUTE_ENABLED": "true" },
  "env": {
    "preview": {
      "name": "freeplug-preview",
      "workers_dev": true, "preview_urls": false, "routes": [],
      "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "freeplug-preview" }],
      "images": { "binding": "IMAGES" },   // bindings are NOT inherited by env blocks; preview needs its own
      "vars": { "TRUST_CF_CONNECTING_IP": "true" }
    }
  }
}
```
Plus `open-next.config.ts`: `defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache })`. Optionally use Wrangler's `secrets.required` list, so a deploy fails if a secret is missing.

**2. Secrets.**
- Preview: `npx wrangler secret put <NAME> --env preview`. Use **Stripe test keys** and a **separate Supabase project** (recommended; decision).
- Production: careful, because `wrangler secret put` **deploys immediately** (https://developers.cloudflare.com/workers/configuration/secrets/). Before the gate, use `wrangler versions secret put` or `wrangler versions upload --secrets-file …`. Those create a version without making it live.
- Secrets never go into `vars`, git, or chat.

**3. Environments.** `preview` lives on `freeplug-preview.<account>.workers.dev`, with test data. Put **Cloudflare Access** in front of it (free up to 50 users) so it isn't public. `production` lives on the custom domain only.

**4. Rehearse on preview.** Vera's Cloudflare checklist:
- The A6 table.
- Signup with Turnstile, and email or Google login.
- Password reset email arrives.
- Preview, claim, and setup-mode Checkout in Stripe test mode.
- Webhook delivery via `stripe listen` or a test endpoint.
- Photo upload with no GPS in the result.
- Rate limit 429s keyed per IP (check the logs show a real IP, not `unknown-ip`).
- Security headers present.
- Admin pages.

Also run the Arkitect verify step here.

**5. Production build.** `npx opennextjs-cloudflare build`, then `wrangler versions upload` with production build vars and secrets. That creates a version only, with no traffic. Check `startup_time_ms`.

**6. ⛔ GATE 1, production deploy.** Owen shows Ezequiel the preview results and the version ID. Only on his yes does Owen run `wrangler versions deploy <id>` (100%). Because the custom domain isn't attached yet (it is not in `wrangler.jsonc`, and plain `deploy` is disabled in the scripts), nothing public changes.

**7. Stripe live webhook.** In Stripe live mode, the endpoint is `https://freeplug-in.dev/api/webhooks/stripe`.
- Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
- Put its new `whsec_` into `STRIPE_WEBHOOK_SECRET` with `versions secret put`.
- Leave the old endpoint (pointing at the current host, if one exists) in place until the cutover is verified, then disable it.

Changing Stripe is Ezequiel's or Owen's action, with approval.

**8. Supabase Auth URLs** (project `ldlyjoybppmwvvcarewq`, approval needed).
- Site URL: `https://freeplug-in.dev`.
- Redirect URLs: `https://freeplug-in.dev/auth/callback**` and `https://freeplug-in.dev/auth/confirm**`, plus the preview host only if preview shares this project.
- Remove old Vercel/Netlify URLs after the cutover.

Google OAuth: the authorized redirect URI is Supabase's own `https://ldlyjoybppmwvvcarewq.supabase.co/auth/v1/callback`, so **no change is needed for the host move**. Only check that the consent screen's home page or authorized domains don't list the old Vercel URL.

**9. Cache rule (zone).** Create one "Bypass cache" rule.
- Host: `freeplug-in.dev`.
- Paths starting with `/dashboard`, `/admin`, `/api/`, `/auth/`, `/p/`, `/preview`, `/claim`, `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Leave Workers Cache off.
- Source: https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ (Sep 16, 2026).

**10. ⛔ GATE 2, DNS switch.**
- Write down the current apex and `www` records (today they point at Vercel). **Don't touch MX, SPF, DKIM or other mail records.**
- On Ezequiel's yes, delete the apex record, then add a **Custom Domain** `freeplug-in.dev` on the Worker. A Custom Domain can't be created over an existing CNAME. Cloudflare creates the record and certificate itself.
- For `www`: add a proxied `A www 192.0.2.0` placeholder and a **Redirect Rule** sending `www.freeplug-in.dev/*` to `https://freeplug-in.dev/${path}` with a 301 that keeps the query string. Use the apex as canonical: `SITE_URL_FALLBACK` is already `https://freeplug-in.dev`.
- Source: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ (Sep 29, 2026).

Why Custom Domains rather than routes: the Worker *is* the origin, so there's no origin record to maintain, the certificate is automatic, and the apex works.

**11. Smoke test** (production, about 15 minutes):
- the home page, `/faq`, signup and login
- a real password-reset email
- headers
- `curl -I` on `www` gives a 301
- the Stripe webhook test event returns 200 in the Stripe dashboard
- one real small live checkout? Only if Ezequiel wants it. It's a real charge, so his call.

**12. Rollback.**
- (a) For a code problem: `wrangler rollback` to the previous version. It takes seconds and you can go back to any of the last 100 versions (https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/, Jul 15, 2026).
- (b) Correction (Jace, 2026-10-03): there is no Vercel fallback. `freeplug-landing.vercel.app` is the old April build, not this app, and Ezequiel is removing it himself. **Rollback is always to the previous Worker version on Cloudflare**: `wrangler rollback` or `wrangler versions deploy <previous-id>`. Record the version ID that is live before every promote.
- For a problem with the new domain setup itself (certificate, Custom Domain), detach the Custom Domain and restore the saved apex/`www` records while the issue is fixed. The site is down for that window, so keep the first cutover in a quiet hour.

**CI.** Use **Workers Builds** connected to the repo. Production branch: build and `wrangler deploy`; other branches: preview builds. Builds run on Node 22. Set `NEXT_PUBLIC_*` as *build* variables per branch type. Because Ezequiel wants a gate before production, set the production deploy command to **`npx wrangler versions upload`**. Owen then promotes with `wrangler versions deploy` after Ezequiel says yes. Source: https://developers.cloudflare.com/workers/ci-cd/builds/ (Oct 1, 2026); limits: 6,000 minutes a month on Paid, 20-minute timeout. A manual `wrangler deploy` from Owen's machine is the fallback.

## A9b. Image quota note (Owen, 2026-10-03)
`next/image` and uploads share the same free 5,000 Images transformations a month. Past that, new transformations fail (no charge), so uploads would fail closed. Since only `OutreachSection.tsx` uses `next/image`, with 5 local JPGs, set `unoptimized` on those (or pre-size them at build time) so the whole quota goes to uploads. Decision for Ezequiel only if uploads approach the cap; then the Images Paid add-on is $0.50 per 1,000.

## A10. Arkitect structure check (Ezequiel's standard step): RUN 2026-10-03, 9:24 AM CT
- Cause of the earlier failure: the Arkitect MCP server had never been built on the box (`/workspace/Arkitect-MCP.AI/packages/mcp-server/dist/stdio.js` was missing). Aria installed the server's dependencies and built it with `pnpm --filter "@arkitect/mcp-server..."` (dist is gitignored; no source changes), then restarted the connectors. Both `arkitect-box` and `arkitect-mcp` now connect with 18 tools.
- `diagnose_repository` on `/workspace/freeplug-cf-port/freeplug-landing` (Owen's `cf-port-2026-10-03`), architecture locked:
  - Current architecture: **modular monolith, confidence 0.9 (high)**. Policy: continue the healthy architecture, no auto-refactor.
  - Recommended patterns: **Adapter and Strategy** for provider seams (client IP, image codec, mail transport, Stripe webhook), Factory Method to hand out the right one. Decorator for cross-cutting wrappers. Over-engineering risk: low. Warning: avoid Singleton overuse in service layers.
  - That matches the port: each Cloudflare change is an adapter swap behind the existing function (`clientIpFrom`, `processUploadedImage`, `sendMail`, the webhook handler). No structural change is needed before the patches.
  - Caveats: repo health came back "unknown" (the tool doesn't do deep code analysis), and its platform field is stuck on a "desktop" hint even though it auto-detected a Worker, so ignore its `desktop-shell` tag. This is a structure check, not a code review; Vera's tests and the 577-test suite are the real code gate.
- Still owed: the Arkitect **verify step** (`verify_codebase`) before handoff to Vera / before Gate 1.


## A11. Port status notes (Owen, 2026-10-03, branch `cf-port-2026-10-03` in `/workspace/freeplug-cf-port`)
- The Worker entry is now `custom-worker.ts` (set `main` to it). It adds the security headers that OpenNext skips on `/_next/image`, plus noindex there. `proxy.ts`-built redirects and 413s also add the headers now.
- The 7 landing JPGs are `next/image` `unoptimized`, so the 5,000 free Images transformations a month go to uploads only.
- `npm audit`: nodemailer 9.1.1 has 2 high advisories, so verify will fail at threshold `high`. The fix is Resend as primary (already recommended), then drop nodemailer, or a major nodemailer upgrade if SMTP stays.
- Verify-step safety: the box injects the saved live secrets (Stripe secret and webhook secret, Supabase service-role key and DB password, SMTP password) into every process, including the Arkitect servers, and `verify_codebase` runs builds and tests in that environment. A restart can't remove them. Run verify only from a connector launched with an allowlisted environment (`env -i`), pending Ezequiel's OK to add one.

---
# PART B: Owner editing with AI builders, and a support model that scales

## B1. What we're editing today
- Customer sites are **Envato HTML/PHP templates** that we fill in (example: Gracia's Lawn, Garlon template, 7 pages, `sendemail.php` contact form; `/workspace/gracias-lawn/BUILD-REPORT-JACE.md`). The 72 After site itself is a static build on Cloudflare Pages (`/workspace/72after/DEPLOY-CLOUDFLARE.md`).
- The Freeplug dashboard already has the pieces an editor needs: customer details with an admin-review queue (`site_details` / `site_details_submissions`), maintenance requests, and the planned help chat with confirmed change requests (`/workspace/aria/freeplug-chatbot-card.md`).
- Support hours are short: **Mon–Wed 1–2 PM and Thu–Fri 1–3 PM CT, about 7 hours a week** (`src/lib/support-hours.ts`). There's no reply-time promise. **Anything that scales has to be self-serve first.**

## B2. AI-builder options (read 2026-10-03)
| Builder | Can it work on *our* existing site? | Where does it host? | Cost to the owner | Fit |
|---|---|---|---|---|
| **Bolt.new** | **Yes**: imports an existing GitHub repo as a new project and syncs commits back. ZIP export too. | Its own hosting, which is optional. We'd ignore it and deploy from GitHub ourselves. | Free (1M tokens/month, 300K a day), Pro $25/month | Good for static HTML. It **can't run PHP** (browser-based sandbox), so the forms need to move off PHP first (B3). |
| **v0 (Vercel)** | **Yes**: imports a GitHub repo and pushes changes to a working branch, then a PR. | Built around a Vercel project: env, previews and deploys all assume Vercel. | Free (7 messages a day), Plus $30/user/month | Usable only through PRs. It pulls owners toward Vercel hosting, against the Cloudflare decision. Not recommended for owners. |
| **Lovable** | **No**: "You can't import an existing repository… Connecting a project always creates a new repository." | Its own hosting | Free (5 build credits a day), Pro from $25/month | Only fits sites *started* in Lovable. Not for our templates. |
| Wix / Squarespace / Durable / Framer AI | No. The site would have to be rebuilt there and hosted there. | Theirs | Their plans | That means leaving our hosting (lost revenue). Won't support. |
| WordPress + AI plugins | We'd have to rebuild every site and maintain WP security updates for every customer | Needs PHP + MySQL hosting | n/a | Won't build (security load we can't staff in 7 h/week) |
| **Our own in-dashboard AI editor** | Yes: works on our repo and content file directly | **Ours (Cloudflare)** | Inside the plan, with a quota | **Recommended main path** |

Sources: https://docs.lovable.dev/integrations/git-sync-overview ; https://docs.lovable.dev/introduction/subscription-plans ; https://v0.app/docs/git-import ; https://v0.app/docs/pricing ; https://support.bolt.new/integrations/git ; https://bolt.new/pricing.

## B3. Recommended architecture: "edit with AI, publish on our hosting"
**1. One Git repo per customer site** (private, in a 72 After/Freeplug GitHub org). Layout:
- `content/site.json` holds the business facts: name, phone, hours, service area, prices, quote inbox, photo list, page text blocks.
- `template/` holds the HTML/CSS with a tiny build step (`npm run build` → `dist/`) that fills the content into the pages.
- **The form handler moves from `sendemail.php` to a Freeplug endpoint.** Example: a POST to `freeplug-in.dev/api/forms/<siteId>`, with Turnstile, rate limits keyed by `CF-Connecting-IP`, and mail through Resend.
- That makes every site **static**: no PHP to patch, it runs anywhere, and Bolt can edit it.
- This is a one-time conversion per template (estimate: half a day for the first template, about an hour for each later site on the same template).

**2. Hosting:** each site deploys as **Workers Static Assets**. Use one Worker per site; the Freeplug Worker stays separate.
- Static asset requests are free and unlimited, so this costs about $0 extra per site within the $5 Workers Paid plan.
- Deploys come from **our CI** (Workers Builds or a GitHub Action with our token), never from a builder's hosting.
- Per-site preview URLs come from `wrangler versions upload`.
- Custom domains: Workers Custom Domains on the customer's zone. That needs the customer's DNS on Cloudflare or a CNAME setup; decide per customer.

**3. Three ways to edit, all ending in the same safe publish step:**

| Level | Who | How | Goes live |
|---|---|---|---|
| **L1 Quick edits** | every plan | Dashboard form for the facts in `site.json` (hours, phone, prices, photo swap, text blocks). Reuses the photo pipeline and limits from Part A. | Owner checks the preview and clicks **Publish** themselves. Facts the owner confirmed are never overwritten by preview submissions (Vera rule 4 stays). |
| **L2 AI edits in the dashboard** | every plan, monthly quota by tier (B4) | "Tell us what to change" → our model (the same provider and spending limit as the help chat) edits **only** `content/site.json` and approved section snippets → shows a before/after diff and a preview URL. | Owner publishes, or the change goes to us for review when it touches anything outside the content file (layout, new page, scripts). |
| **L3 Bring your own AI builder** | top tier (or paid one-off) | Owner gets Bolt (or v0) access to a **fork/branch** of their site repo. Their changes come back as a **pull request**. | We run the checks below and a person (Owen or Jace) approves before our CI deploys. **The builder's own hosting is never used.** |

**4. Automatic checks on every publish** (CI, all levels), before anything goes live:
- The build passes.
- HTML is sanitized: no new `<script>`, iframe or external form targets unless the change was reviewed.
- Links and images resolve, the page size stays under budget, and there's no `noindex` on live pages.
- The business address only appears where the owner chose it.
- The Arkitect verify step runs (Ezequiel's standard).
- **Rollback:** the previous version is one click away (Workers versions, last 100), and Git keeps the full history.

**5. Guardrails for the AI editor (L2):**
- The model gets the site content and the instruction, nothing else.
- It can't publish, change billing, change DNS, or touch other customers' repos. Its server tool can write to exactly one repo branch.
- Prices, hours and phone numbers are copied from what the owner typed. They're never invented, and the diff highlights them.
- It's the same prompt-injection posture as the help chat: page text isn't instructions.

**Cost estimate (not measured):** one AI edit is about 15–30k tokens in and 2–5k out (the site content plus the diff). On Claude Haiku that's about **3–8¢ per edit**; on gpt-6-luna it's under 1¢. So 500 edits a month costs about $15–40 on Haiku. That stays inside the spending limit from the chat card, and is **approved and bought by Ezequiel**.

## B4. Support model mapped to the hosting tiers
Today the price is a **slider from $35 to $100 a month**, plus an optional add-on: Basic +$5 (backups and down alerts), Plus +$10 (one small edit a month), or Pro +$15 (Google Business Profile). The locked copy promises **no extra attention** for a higher slider amount. "Higher tiers get more attention" therefore needs **bands on the slider**. This is a **pricing and copy change (STRICT, for Sable and Ezequiel)**.

Proposal (numbers are suggestions for Ezequiel to set):

| Band | Hosting | What they get | Who does the work |
|---|---|---|---|
| **Starter** | $35–$49 | L1 quick edits (unlimited, self-serve). L2 AI edits: **5 a month**. Guided help chat (no AI). Email support during support hours, no reply-time promise. | The owner, plus software |
| **Standard** | $50–$74 | Everything in Starter. **15 AI edits a month.** AI help chat. Change requests looked at **ahead of Starter** in the queue (the same queue, sorted by band). | The owner and software; us for reviews |
| **Priority** | $75–$100 | Everything in Standard. **40 AI edits a month.** **L3 bring-your-own builder** (PR reviewed by us). Their requests are looked at first during support hours. One short call a quarter if they ask. | Us, for reviews and calls |

Add-ons stay the same on top: Plus's "one small edit each month" is **done by us**, and stays different from self-serve AI edits. Maintenance stays a one-time $50–$100 quote for bigger work.

**What makes it scale:**
- **Self-serve first.** L1 and L2 handle the common requests (hours, photos, prices, text) with no staff time. Staff time goes to reviews (L2 out-of-scope changes and L3 PRs) and maintenance quotes.
- **One queue sorted by band**, not separate teams. The "attention" difference is *order and scope*, never a promised reply time. There's no SLA because support hours are 7 h a week.
- **Capacity check (estimate):**
  - At about 10 minutes per review, 7 h a week is about **40 reviews a week**.
  - If 1 in 10 AI edits needs a review, that covers about 1,600 AI edits a month before we'd need more support hours or a second reviewer.
  - Plus edits and maintenance quotes come out of the same 7 h. **Watch the queue weekly**, and raise support hours or limit Plus sign-ups when reviews pass about 30 a week.
- **Quotas cap AI costs:** at the proposed quotas and 100 customers, the worst case is about 2,000 edits, roughly $60–160 a month on Haiku or about $10–20 on gpt-6-luna. Any unused allowance lowers that.

## B5. Build order (after Part A is live)
1. Convert one template to static + `site.json` + the Freeplug form endpoint (Gracia's Lawn as the pilot), and host it on Workers Static Assets from CI.
2. L1 quick-edit form + preview + Publish + rollback.
3. CI checks + Arkitect verify.
4. L2 AI editor (after the help chat's AI step: same provider, key and spending limit).
5. Bands in Stripe and in the copy (Sable), plus the quotas in code.
6. L3 GitHub PR flow for Priority (Bolt guide for owners).

---
# Decisions for Ezequiel
1. **Gate 1:** yes or no on the production deploy, at that moment, after you've seen the preview results (A9 step 6).
2. **Gate 2:** yes or no on the DNS switch for `freeplug-in.dev`, at that moment (A9 step 10).
3. Buy **Workers Paid ($5/month)**. Free's 10 ms CPU limit is too small for this app.
4. Approve these Cloudflare changes:
   - the `IMAGES` binding (Cloudflare Images, free for 5,000 transformations a month)
   - the Turnstile widget
   - Cloudflare Access on the preview
   - the cache-bypass rule and the `www` redirect
5. Email: make **Resend the main sender** on Cloudflare (recommended). Add its DNS records (SPF/DKIM) for `freeplug-in.dev`, and give us a working Resend key. The one the Resend MCP has is rejected as invalid.
6. Preview environment: a **separate Supabase project with test data** (recommended), or share the production project.
7. (Withdrawn: no Vercel fallback. Rollback is the previous Worker version; Ezequiel removes the old April Vercel build himself.)
8. Approve the Stripe live webhook endpoint and the Supabase Auth URL changes for the new host.
9. Owner editing: approve **"edit with AI, publish on our hosting"**: one repo per site, static sites, and forms through Freeplug instead of PHP.
10. Set the **bands** ($35–49, $50–74, $75–100) and the **AI edit quotas** (5, 15, 40). Decide whether bring-your-own builder is Priority-only.
11. Who approves L3 pull requests: Owen, Jace, or you?

# Won't custom-build
- Our own drag-and-drop visual site builder (Bolt, plus our AI editor, covers this)
- WordPress hosting or WP-based editing
- Hosting customer sites on Lovable, Bolt, v0, Wix or other builder platforms (we only accept their code through GitHub PRs)
- Lovable support for existing sites (it can't import our repos)
- An ISR cache store (R2, KV or Durable Objects) for Freeplug. Nothing needs it.
- Our own image codec in wasm inside the app bundle (use the Cloudflare Images binding)
- Owners editing raw code directly on the live site, or publishing without the checks
- SLAs, 24/7 support, or reply-time promises
