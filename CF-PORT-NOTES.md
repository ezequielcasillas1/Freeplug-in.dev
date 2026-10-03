# Freeplug → Cloudflare Workers port (LOCAL ONLY), Owen, Sat Oct 3 2026 (~8:56–9:35 AM CT, follow-ups ~9:26–9:45, ~9:49–10:10 and ~10:11–10:45, ~10:45–11:05, ~11:02–11:20 and ~11:21–11:55 AM CT)

Worktree `/workspace/freeplug-cf-port` on branch `cf-port-2026-10-03` (from `9345ae0`). App: `freeplug-landing/`.
**Nothing was committed, pushed, deployed or uploaded.** No Cloudflare, Stripe, Supabase-hosted or email contact. No `wrangler login`,
`wrangler deploy`, `--dry-run` or `versions upload`. Every command ran through `/workspace/owen/cfport-safe.sh`, which clears PGDATABASE/PG*, the
Stripe, Supabase, Resend, SMTP and Cloudflare keys. Builds used dummy `NEXT_PUBLIC_*` values (`/workspace/owen/cfport-dummy-build.env`,
pointing at 127.0.0.1:9). `.env.local` wasn't copied. `.dev.vars` (gitignored) holds the dummy values from `.dev.vars.example`.
`/workspace/freeplug-in-dev` still has a clean tree at 9345ae0. The only effect on it is the new worktree entry and branch ref.
Node 22 is Aria's portable `/workspace/aria/scratch/node22`, because Wrangler needs Node 22 or later.

## Arkitect
- **First pass (~8:57 / 9:33 AM CT):** not run. Both servers reported "failed during live tool discovery".
- **Follow-up (~9:40 AM CT):** both `user-arkitect-box` and `user-arkitect-mcp` are now **ready**.
  - **diagnose_repository** (box) on `/workspace/freeplug-cf-port/freeplug-landing`: current architecture **modular-monolith, confidence 0.9**.
    Foundation is modular-monolith (internal vertical-slice, edge clean-architecture). The provider-integration step fired on "cloudflare" (ports and module seams).
    Suggested patterns: Strategy, Decorator, Facade, Factory Method. No structural change, which matches Aria's run.
    The port's seams fit that: `ImageCodec` is the Strategy/Adapter seam, and `custom-worker.ts` is a Decorator around the OpenNext handler.
    `recommendedAction: guide-new-foundation` with "confidence not high enough to continue automatically" is about the low-confidence
    workload and health signals, not a request to restructure. Platform shows "desktop" only because that's the intake default.
  - **verify_codebase (round 3, ~10:01–10:04 AM CT), through `user-arkitect-clean` ONLY** (launched via `env -i`; I checked the
    process's variables by name: only `ARKITECT_ANALYZER`, `ARKITECT_HOST_REPO_PATH`, `ARKITECT_SKIP_DESKTOP_BRIDGE`, `HOME`, `PATH`).
    `auditFailThreshold: 'high'`, report in `/workspace/owen/arkitect-reports/verify-2026-10-03T10-03-39-05-00.{md,json}`.
    **Result: 4/5. FAIL on the audit, as expected.**
    | step | result |
    |---|---|
    | lint (`npm run lint`) | **success**, 0 errors, 5 warnings (the same pre-existing unused vars) |
    | build (`npm run build` = next build) | **success** |
    | typecheck (`npm run typecheck`) | **success** |
    | test (`npm run test`) | **success**, 66 files / 604 tests |
    | audit (`npm audit --json`, threshold high) | **failure**: 6 high, 0 critical (nodemailer 9.1.1, fix 10.0.14 `isSemVerMajor: true`; plus the braces chain via eslint-config-next). It did reach the registry. I didn't lower the threshold. |
    - The build used a scratch `freeplug-landing/.env.local` with placeholder `NEXT_PUBLIC_*` values only (the same ones as
      `cfport-dummy-build.env`; the guard passed on it). It's gitignored, and I **deleted it right after the run**.
    - The first call timed out on the client (MCP -32001) but kept running on the server until ~10:04:00 AM CT, and its report
      (`verify-2026-10-03T10-01-53-05-00`) has the identical 4/5 result. The retry overlapped it for ~20 s. Both passed, but the two
      runs shared `.next`, so treat the retry as the record.
  - **Round 2: verify_codebase NOT run, on purpose.** It runs the lint/build/typecheck/test scripts plus an audit inside the MCP server's own
    process environment. That environment (all 4 Arkitect node processes, checked by variable **name** only) has `STRIPE_SECRET_KEY`,
    `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SMTP_PASS` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set.
    Running it would build and test with the live keys present, which breaks the "every command runs with live keys cleared" rule.
    So I ran the same five checks myself through `cfport-safe.sh` (table below): **lint, typecheck, test and build pass. The audit
    has 6 high, all pre-existing at 9345ae0** (the baseline also had 1 critical: next 16.3.3, which the port fixes).
    To get a real 5/5 from Arkitect, the connectors need restarting with those variables unset (e.g. `env -u ...` in the MCP launch
    command), and then the audit items below need a decision.

## Changes, and why
1. **Next 16.3.3 → 16.3.8** (`next`, `eslint-config-next`, `@next/*` all 16.3.8) fixes CVE-2026-94545 and meets OpenNext 1.20.8's peer floor (`>=16.3.8`).
   Lockfile v3 is consistent (`npm ls` OK): 394 packages added (OpenNext and Wrangler), `@netlify/plugin-nextjs` removed, sharp 0.35.4 → 0.35.5 (dev).
2. **sharp → Cloudflare Images binding**. `processUploadedImage()` keeps the same signature and return type.
   - `src/lib/outreach/image.ts` keeps the size cap, magic bytes and random names. It re-encodes through an injectable `ImageCodec` (`setImageCodec()` is for tests),
     then always runs `stripJpegMetadata()`. The default codec is loaded lazily from `image-codec-cloudflare.ts`.
   - `image-codec-cloudflare.ts` uses `getCloudflareContext({async:true}).env.IMAGES`:
     - `info()` validates the image (free). It refuses SVG and images over 60M (photo) or 120M (screenshot) pixels.
     - `input().transform({width:2560,height:2560|width:1600, fit:'scale-down'}).output({format:'image/jpeg', quality:85|82, background:'#ffffff'})`
     - `info()` on the output gives the stored width and height. If the binding is missing, the upload fails closed as `unreadable`.
   - Behaviour mapping:
     - auto-rotate: Cloudflare applies EXIF rotation even when metadata is discarded
     - max 2560 with no enlargement: `scale-down`
     - flatten: JPEG on white
     - JPEG output: unchanged
   - **Metadata (Privacy Policy fact):** Cloudflare's docs say JPEG output defaults to `metadata=copyright`, which discards everything except the EXIF copyright tag.
     `metadata=none` discards all of it. WebP and PNG output always discard all of it. However, the binding's typed `transform()` and `output()` options
     (`@cloudflare/workers-types` 5.20261003.1) have no `metadata` field, so I didn't rely on it. `jpeg-metadata.ts` strips the bytes after any codec:
     - **removed:** APP1 (EXIF/GPS/XMP), APP2 other than ICC (MPF), APP3–13 (IPTC), APP15, JFXX, COM, and anything after EOI
     - **kept:** JFIF, ICC and Adobe
     - Net result: there's no EXIF or GPS data, not even the copyright tag. That's what sharp produced before.
   - **No sharp in the Worker:**
     - sharp is a devDependency, used only by `test/image-codec-sharp.ts`.
     - An ESLint `@typescript-eslint/no-restricted-imports` rule blocks `sharp` in `src/` (I confirmed it errors).
     - A guard test scans `src/`.
     - The built bundle has no sharp module references. Aria's build had 13 `sharp-20c6a5da84e2135f` external refs.
3. **Stripe webhook:** `await stripe.webhooks.constructEventAsync(body, sig, secret)` (route.ts:34-36). `route-outreach.test.ts` has no call of its own,
   only a mock, so I updated the mocks in both test files. The new `signature.test.ts` uses the real stripe library offline (dummy key): valid passes, tampered or wrong secret rejects.
4. **client-ip.ts:**
   - CF-Connecting-IP is trusted only when `TRUST_CF_CONNECTING_IP` is exactly `"true"`, and only if `node:net isIP` accepts it (IPv6 zone ids are refused).
   - The XFF, X-Real-IP and Netlify branches are deleted, along with their env constants.
   - Anything else goes to `'unknown-ip'`.
   - Tests updated: client-ip, rate-limit index, claim/resend.
   - `.env.example`: `TRUST_CF_CONNECTING_IP=` replaces `TRUST_NETLIFY_IP_HEADER=` and `TRUST_PROXY_HEADERS=`.
5. **Security headers:**
   - The three `netlify.toml` headers moved to `next.config.ts` `headers()` as `/:path*`, listed **before** the preview rules so preview keeps `no-referrer`.
   - They're also in `public/_headers` for static files, plus `/_next/static/*` immutable.
   - The preview rules (X-Robots-Tag noindex, no-referrer, no-store on `/p`, `/preview`, `/claim`) are unchanged.
   - **Extra fix:** on OpenNext, responses that `proxy.ts` builds itself (the `/dashboard` 307 and the 413) didn't get `next.config` headers, while `next start` did.
     `withTerminalResponseHeaders()` now adds them to terminal proxy responses only. Pass-through responses are untouched.
   - `netlify.toml` and `@netlify/plugin-nextjs` are removed. I fixed the Netlify comments in client-ip, body-limit, limits, server.ts and next.config.
     Migration `20260927050200_site_details.sql:478` is untouched, since it's applied and its comment is the only change needed.
6. **OpenNext setup:**
   - `@opennextjs/cloudflare` 1.20.8 and `wrangler` ^4.147.0 (dev).
   - `open-next.config.ts` uses `staticAssetsIncrementalCache`.
   - `wrangler.jsonc` defines one Worker `freeplug`, compatibility date 2026-10-01, `nodejs_compat` + `global_fetch_strictly_public`, ASSETS, WORKER_SELF_REFERENCE,
     **IMAGES**, observability, `cpu_ms` 10000, no workers.dev, and vars `TRUST_CF_CONNECTING_IP`/`ADMIN_ROUTE_ENABLED`. It also has a `preview` env.
     **`account_id` is an invalid placeholder on purpose**, and there are **no routes or custom domain** (that's Gate 2).
   - Scripts:
     - `cf:build`
     - `preview` = `opennextjs-cloudflare build && opennextjs-cloudflare preview`
     - `upload:preview` and `cf:upload:production` (guarded, `wrangler versions upload` only; see "Upload guard" below). Plain `upload` refuses.
     - `deploy` **refuses and exits 1**
     - `cf-typegen`
   - `.dev.vars.example` added. `.gitignore` adds `.open-next`, `.wrangler`, `.dev.vars*` (the example stays tracked). ESLint and tsconfig ignore the build output.
   - Resend isn't switched. A comment in `src/lib/email/smtp.ts` `sendMail()` marks where the switch goes. (Superseded: round 4 made Resend primary and deleted smtp.ts.)

7. **Follow-ups (Oct 3, ~9:26 AM CT)**
   - **next/image quota:** both `<Image>` tags in `src/features/landing/components/OutreachSection.tsx` are `unoptimized`. They cover
     **7** JPGs (austin, kyle, new-braunfels, san-antonio, san-marcos, international-1, international-2; 78–156 KB each, already small),
     so `/` now links `/images/outreach/*.jpg` directly. There are 0 `/_next/image` URLs in the page.
     **There are no other next/image uses** (OutreachSection is the only importer). A test in `src/lib/worker-headers.test.ts` keeps it
     that way: every `next/image` importer must mark every `<Image>` `unoptimized`.
   - **Private photos never touch /_next/image (Vera):** customer and outreach photos (claim step 2 grid `PhotoUploadBox.tsx:274`, admin
     row `AdminOutreachRow.tsx:276`, preview/dashboard screenshots `ScreenshotPicture.tsx`) are plain `<img>`/`<picture>` with
     short-lived Supabase signed URLs from `server.ts` `createSignedUrl(s)`. None of them uses next/image.
   - **`images.remotePatterns`:** next.config has **no `images` block**. The built config is `remotePatterns: []`, `domains: []`,
     `localPatterns: [{pathname:'**'}]`, `qualities: [75]`, SVG off. OpenNext's handler checks `hasRemoteMatch` before any fetch, so every
     absolute or protocol-relative URL (Supabase storage included) gets **400 "url" parameter is not allowed**. Checked locally with
     `https://example.invalid/storage/v1/object/sign/...` and `//example.invalid/a.jpg`. A test asserts no remotePatterns or domains.
   - **/_next/image header gap: fixed.** It was missing **X-Frame-Options, X-Content-Type-Options and Referrer-Policy** (all three) and
     X-Robots-Tag. Cause: OpenNext's `worker.js` answers `/_next/image` and `/cdn-cgi/image/*` **before** the middleware and Next's
     `headers()` run. Fix: a new `custom-worker.ts` is now wrangler's `main` (the OpenNext custom-worker pattern). It wraps the OpenNext
     handler and runs `withWorkerResponseHeaders()` (`src/lib/worker-headers.ts`) on every response. That adds the three site headers
     **only when missing** (preview's `no-referrer` still wins) and sets `X-Robots-Tag: noindex, nofollow, noarchive` on `/_next/image` and
     `/cdn-cgi/image/*`. This also covers anything else OpenNext answers early (skew protection). The proxy.ts fix stays, because `next start` uses it.
   - **Remaining /_next/image quota exposure:** the endpoint still exists (OpenNext routes it regardless of usage). Anyone can request
     the 7 public JPGs at the 15 allowed widths × quality 75, which is at most **105 unique transformations a month**, and only of
     public marketing photos. If we'd rather spend zero, the custom worker could answer `/_next/image` with 404. I didn't do that
     because it wasn't asked for.
   - **Upload guard (Jace): `scripts/cf-upload-guard.mjs`.** `upload` and `upload:preview` are now
     `opennextjs-cloudflare build && node scripts/cf-upload-guard.mjs && wrangler versions upload [--env preview]` (round 2; round 3 split
     them into `upload:preview` and `cf:upload:production`, see below). `npm run cf:guard` runs it alone.
     - It scans: the process env, `.env`/`.env.local`/`.env.production(.local)`, `.dev.vars`, wrangler.jsonc `vars` (top level and every `env.*.vars`),
       and every file in `.open-next/` (Worker and static assets).
     - It trips on: `sk_live_`/`rk_live_` keys; `pk_live_`; the live ref `ldlyjoybppmwvvcarewq`; any `service_role` JWT (decoded,
       "(live project)" when the ref matches); an anon JWT for the live ref; `RESEND_API_KEY`/`SMTP_PASS` set to a non-placeholder value;
       a `whsec_` next to a live Stripe key ("likely live mode"); any secret name placed in plain wrangler `vars`; a `whsec_` or Resend key
       anywhere in the bundle; any env secret value found verbatim in the bundle; and a missing bundle.
     - A whsec_ on its own can't be classed as test or live mode, so it isn't flagged (a test pins this).
     - Output is the check name plus where it fired (source:VARIABLE or bundle file path). **Values are never printed** (a test asserts no
       fake value appears in stdout/stderr). Exit code 1 means nothing is uploaded.
     - **Production override (round 3: Jace OK'd it with Vera's condition):** see "Upload guard: production override" below.
     - Tested with fake live-looking values (10 tests, `scripts/cf-upload-guard.test.ts`), covering every source and every marker.
       It passes on the real dummy-env bundle (1,598 files).
     - **First real finding:** on its first run, the guard tripped on `env:__CURSOR_SANDBOX_ENV_RESTORE`. That's a sandbox env snapshot that
       still carries the **live service-role JWT for ldlyjoybppmwvvcarewq**, and `cfport-safe.sh` didn't clear it. I've added
       `-u __CURSOR_SANDBOX_ENV_RESTORE` to the wrapper. Earlier builds ran with it present, but the guard's bundle scan finds no
       service-role JWT and no live ref in `.open-next/` (next build only inlines `NEXT_PUBLIC_*`).

## Upload guard: production override (round 3)
- **Targets are explicit:**
  - `npm run upload:preview` = build → `cf-upload-guard.mjs --target=preview` → `wrangler versions upload --env preview`
  - `npm run cf:upload:production` = `scripts/cf-upload-production.mjs`: guard pre-flight (before building) → build → full guard
    (`target: production`) → `wrangler versions upload` with **no `--env`**, i.e. the top-level `freeplug` Worker, which is production.
    `CLOUDFLARE_ENV` is removed from its env. It accepts no argument except the flag, so `--env preview` is refused.
  - `npm run upload` refuses ("pick a target"). `deploy` still refuses. `cf:guard` = guard, preview target (the strictest).
- **The flag** `FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes` relaxes ONLY the public markers (`pk_live_`, the live ref `ldlyjoybppmwvvcarewq`,
  the live anon JWT), and only when the target is production. A preview target with the flag is refused
  (`override-only-for-production`), and its live public markers are still reported. Secret markers (sk/rk_live, any service_role JWT,
  whsec/Resend key in bundle, real RESEND_API_KEY/SMTP_PASS, env secret values in bundle, secrets in plain vars) are never relaxed.
- **"On the one command only": how I made that reliable.** A child process **can't** tell `FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes npm run ...`
  (inline) from an `export` left in the shell: both arrive as the same environment variable. So the flag is taken as a **command argument**,
  which a shell can't leave behind:
  `npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes`.
  If the name shows up as a *variable* anywhere (process env with any value including empty, `.env`, `.env.local`, `.env.production(.local)`,
  `.dev.vars`, wrangler `vars`), the guard refuses with "set it on the command only: npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes".
  The variable alone never relaxes anything. The production runner runs this check **before** building.
- **Also refused on production:** `CLOUDFLARE_ENV` set in the env or a .env file, because wrangler would pick that environment
  instead of the top level.
- **Tests (19 in `scripts/cf-upload-guard.test.ts`, all fake values):** preview + flag + live markers = refuse; production + no flag +
  live public = refuse; production + flag on the command + public only = pass; production + flag + secret marker = refuse; flag in a .env
  file = refuse; flag in .dev.vars / wrangler vars = refuse; flag in the process env (yes/no/empty) = refuse; CLOUDFLARE_ENV and unknown
  target = refuse; CLI argument form (production passes, preview refuses, unknown argument exits 2, no values printed); the runner refuses
  before building when the flag is in the env, and refuses extra arguments; package.json scripts as above.
- On the real (dummy-env) bundle: guard OK for both `--target=preview` and `--target=production` (1,598 files).

## City photos (round 3, Lina + Jace)
- `public/images/outreach/*.jpg`: 7 files, all **800×600** (checked from the JPEG headers). **Not resized, re-encoded or converted to WebP**
  (that waits for Jace's speed check on the preview).
- Both `<Image>` tags in OutreachSection.tsx: `fill` + `sizes` replaced with **`width={800} height={600}` + explicit `loading="lazy"`**, and
  `absolute inset-0 h-full w-full object-cover` inside the existing `aspect-[16/10]` / `aspect-[4/5]` boxes, so the rendered size is unchanged.
  There's **no above-the-fold city photo**, so nothing stays eager. The first one starts at y≈3,241 px on 375×812 and y≈2,248 px on 1440×900
  (below Hero and About). `OutreachSection.images.test.ts` pins the attributes (no fill/priority/preload) and that the files really are 800×600.
- **Bytes** (headless Chrome against the local preview on 3340, cache off, every host except 127.0.0.1 blocked; script `/workspace/owen/cfport-pagecheck.mjs`):
  | | before | after |
  |---|---|---|
  | city JPGs on disk | 827,045 B (7 files) | 827,045 B (unchanged) |
  | image bytes on first screen, 375×812 / 1440×900 | 0 B / 0 B | 0 B / 0 B |
  | image bytes after scrolling the whole page | 829,073 B (7 requests, 200) | 829,073 B (7 requests, 200) |
  | layout shift (CLS) before / after scrolling, both viewports | 0 / 0 | 0 / 0 |
  next/image was already emitting `loading="lazy"` by default, so the byte numbers don't move. The change makes lazy explicit and adds
  real `width`/`height` attributes (the browser knows the 4:3 ratio before CSS). Element positions and box sizes are identical before
  and after at both widths.

## Images binding: is a copy kept? Are originals stored? (Sable)
- **Code:** the port calls only `env.IMAGES.info()` and `env.IMAGES.input(bytes).transform().output()` (`image-codec-cloudflare.ts`).
  It never calls `env.IMAGES.hosted` (the storage API) and never uses Cloudflare's cache API on the result. The bytes go in, the JPEG
  comes back in the same request, and our code keeps nothing at Cloudflare.
- **Cloudflare docs** (https://developers.cloudflare.com/images/transform-images/bindings/, now also at
  https://developers.cloudflare.com/images/optimization/binding/, "Last updated Sep 2, 2026"):
  - *"The Images binding lets you optimize and manipulate images directly in a Worker. Unlike the URL interface, which requires images
    to be accessible through a URL, the binding works with raw image bytes."*
  - *"Responses from the Images binding are not automatically cached. Every uncached call performs a full decode and re-encode of the
    source image"*
  - Storage is a separate, opt-in API: *"Hosted image operations require a paid Images plan with storage."*
    (https://developers.cloudflare.com/images/storage/binding/). We don't use it.
  - Contrast with URL transformations (the `/cdn-cgi/image` interface), which *"caches the transformed result ... The original image is
    also cached"* (https://developers.cloudflare.com/images/optimization/transformations/overview/). We don't use that for uploads.
    `/cdn-cgi/image` only reaches the zone if Image Transformations is enabled there, so keep it off.
- **Honest limit:** the docs say binding results aren't cached, but they don't state a retention policy for the bytes in flight. Billing
  counts *"each unique combination of source image and parameters ... once per calendar month"*, so Cloudflare tracks some fingerprint per
  month for billing. If the Privacy Policy needs a stronger claim than "processed by Cloudflare, not stored by us there", that needs
  Cloudflare's DPA / sub-processor terms, not these docs.
- **Originals in Supabase: no, only the processed JPEG.** `processUploadedImage()` has two callers, and both upload
  `checked.image.data`, the re-encoded, metadata-stripped JPEG:
  - photos: `server.ts:252` (`checkPhoto`) → `storeProcessedImage()` → `server.ts:272` `upload(path, checked.image.data, {contentType:'image/jpeg'})`
    to `{outreach/<site>|users/<user>}/photos/<random>.jpg`
  - admin screenshots: `server.ts:901` → `server.ts:907` `upload(path, checked.image.data, ...)`
  - Those are the only two `storage.upload` calls in `src/`. There's no signed-upload URL, and the raw `File` bytes are never written anywhere.
    Same as before the port.

## Preview-deploy checklist note (Lina)
Screenshots at **375px and desktop** of: **the landing page** (round 3; includes the city photo grid), claim step 2's photo grid,
the preview page, the dashboard, and the Cancel page. Name them like the
r12 ones with a **`-cf`** suffix. These can only be taken on the preview deploy (they need real Supabase data), so none were taken locally.

## git diff --stat 9345ae0 (tracked + new files, excluding ignored build output)
```
 43 files changed, 14998 insertions(+), 6918 deletions(-)   (incl. this file; package-lock.json alone: 13058+/6765-)
 A .dev.vars.example, open-next.config.ts, wrangler.jsonc, public/_headers, test/image-codec-sharp.ts, custom-worker.ts,
   scripts/cf-upload-guard.{mjs,test.ts}, scripts/cf-upload-production.mjs, src/lib/worker-headers{,.test}.ts,
   src/features/landing/components/OutreachSection.images.test.ts,
   src/lib/outreach/{image-codec-cloudflare,jpeg-metadata,image.test}.ts, src/app/api/webhooks/stripe/signature.test.ts
 D netlify.toml (repo root)
 M .env.example .gitignore eslint.config.mjs next.config.ts package.json package-lock.json tsconfig.json src/proxy.ts
   src/features/landing/components/OutreachSection.tsx
   src/lib/outreach/{image,headers,headers.test,body-limit,limits,server,server.test,primitives.test}.ts src/lib/email/smtp.ts
   src/lib/rate-limit/{client-ip,client-ip.test,index.test}.ts src/app/api/webhooks/stripe/{route,route.test,route-outreach.test}.ts
   src/app/claim/resend/route.test.ts
```

## Checks (round 3, ~9:58–10:00 AM CT; all through cfport-safe.sh, which also clears __CURSOR_SANDBOX_ENV_RESTORE, with the dummy build env)
tsc pass · eslint 0 errors / 5 warnings · vitest **66 files, 604 tests** · next build pass · opennextjs-cloudflare build pass ·
guard OK `--target=preview` and `--target=production` (1,598 files) · local preview smoke (3340): `/`, `/faq`, `/signup` 200, `/p/x` 303
(no-referrer + noindex), `/dashboard` 307, `/_next/image` 200 with noindex; XFO/nosniff/Referrer-Policy on all of them; the 7 city
JPGs load 200 image/jpeg; CLS 0. Preview stopped, ports 3340–3349 closed. Arkitect verify_codebase (clean connector): 4/5, see above.

### Round 2 checks (~9:35–9:45 AM CT)
| Check | Result |
|---|---|
| tsc --noEmit | pass |
| eslint | 0 errors, 5 warnings (unused vars in faq/page.tsx and TechStackSection.tsx, existing files I didn't touch) |
| vitest | **65 files, 593 tests pass** (first pass: 63/577; baseline at 9345ae0: 61/560). +6 worker headers/next-image, +10 upload guard |
| next build (16.3.8) | pass |
| opennextjs-cloudflare build | pass (warning: Node middleware is experimental, as Aria saw) |
| upload guard on the built bundle | OK (1,598 files, no live credentials) |
| npm audit | 6 high, 0 critical. **All 6 were already at 9345ae0**, which also had 1 critical (next 16.3.3, fixed by the port). See open items. |
| `opennextjs-cloudflare preview` on 127.0.0.1:3340 | Ready, entry `custom-worker.js`, local IMAGES binding, "Parsed 2 valid header rules", 0 errors in log. Stopped afterwards; ports 3340–3349 closed |
| Worker bundle (wrangler dev bundle: custom-worker.js + 2 wasm, no maps) | **21,332 KiB raw / 4,725 KiB gzip (~20.8 MiB)**, under 64 MiB. First pass 21,331 / 4,764. Aria's dry-run with sharp: 21,550 / 4,816. Measured from `.wrangler/tmp` (no `deploy --dry-run`). |
| sharp in bundle | **none** |

**Local workerd smoke (3340):**
- `/` 200, `/faq` 200, `/signup` 200, `/login` 200, `/forgot-password` 200, `/robots.txt` 200, `/sitemap.xml` 200
- `/dashboard` 307 → `/login?next=%2Fdashboard`
- `/p/<bad>` and `/p/abc` 303 → `/preview` (by design, good and bad tokens look the same). `/preview` 404, `/claim` 404, unknown path 404.
- Aria's 500s on `/signup`, `/preview`, `/p/abc` and `/claim` are gone.
- `POST /api/webhooks/stripe`: a bad signature gets 400. A valid locally signed event (dummy whsec) gets **200** under workerd, so constructEventAsync works there.
- The 6 MB cap: 5.5 MB reaches the action, both with Content-Length and chunked. 7 MB gets 413 with Sable's line and the preview headers.
- No sharp or "external module" errors and no runtime crashes in the log.

**IMAGES binding in workerd** (scratch probe outside the repo, `/workspace/owen/cf-images-probe`, the real `processUploadedImage()`):
- GPS/camera/copyright-tagged 3200×1800 photo → 2560×1440, no metadata segments, no "SecretCam", "Exif" or "Jane Owner" bytes.
- Screenshot → 1600×900. Transparent PNG → JPEG. A fake JPEG → `unreadable`.
- The local simulator does **not** auto-rotate (an orientation-6 photo stayed 64×48). It's low-fidelity: width, height, rotate and format only.
  Production applies EXIF rotation per Cloudflare's docs. **Check on the preview deploy.**

**Header comparison** (netlify.toml `/*`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin):
| path | XFO | nosniff | Referrer-Policy | X-Robots-Tag | Cache-Control |
|---|---|---|---|---|---|
| / , /faq | DENY | nosniff | strict-origin-when-cross-origin | – | s-maxage=31536000 |
| /signup, /login, 404 | DENY | nosniff | strict-origin-when-cross-origin | – | private, no-cache, no-store… |
| /dashboard (307) | DENY | nosniff | strict-origin-when-cross-origin | – | – |
| /p/x (303), /preview, /claim (404) | DENY | nosniff | **no-referrer** | **noindex, nofollow, noarchive** | private, no-store |
| /_next/static/*.js | DENY | nosniff | strict-origin-when-cross-origin | – | public, max-age=31536000, immutable |
| /images/outreach/kyle.jpg, /icon.svg | DENY | nosniff | strict-origin-when-cross-origin | – | public, max-age=0, must-revalidate |
| /_next/image (200, and the 400/404 errors) | DENY | nosniff | strict-origin-when-cross-origin | **noindex, nofollow, noarchive** | (from OpenNext) |
| /cdn-cgi/image/... (local only) | DENY | nosniff | strict-origin-when-cross-origin | **noindex, nofollow, noarchive** | – |

Before the follow-up fix, `/_next/image` had **none** of XFO, nosniff, Referrer-Policy or X-Robots-Tag.
Follow-up smoke (3340): `/`, `/faq`, `/signup` 200; `/dashboard` 307; `/p/not-a-real-token` 303 → `/preview`; `/preview` and `/claim` 404 with noindex;
`/favicon.ico` 200; all 7 `/images/outreach/*.jpg` 200 image/jpeg (78–156 KB); `/_next/image?url=/images/outreach/kyle.jpg&w=640&q=75` 200 image/jpeg;
w=641 or q=90 400; remote URLs 400. Every row has the headers above.
`next start` on 3342 gave the same values for `/`, `/dashboard` and `/p/abc` (first pass). `public/_headers` isn't served as a file (404).

## What Aria's plan got wrong or left out
- **A8 metadata:** the binding has no typed `metadata` option, so "`metadata=none`" can't be requested as she described. I strip the bytes ourselves instead (above).
  Her "JPEG if Owen's spike confirms the binding drops GPS" is answered: GPS goes either way, and the copyright tag goes too because of our strip.
- **A9 wrangler.jsonc:**
  - Her proposal puts the `custom_domain` route in the production config. Any `wrangler deploy` or `triggers deploy` would then attach freeplug-in.dev,
    which skips Gate 2 and contradicts her own step 6. I left it out.
  - Her `env.preview` omitted `images`. Bindings aren't inherited, so preview uploads would have failed closed. I added it.
- **Header gap she didn't catch:** OpenNext doesn't apply `next.config` headers to proxy-built responses (fixed in proxy.ts), or to anything
  its worker.js answers before Next (`/_next/image`, `/cdn-cgi/image`; fixed by `custom-worker.ts`).
- **A4 #12 `deploy` script:** under the gate rules it refuses instead.
- **A4 #5 extras not done** (they weren't in this task): `Stripe.createFetchHttpClient()` and removing `loadEnvConfig` in `src/lib/stripe/server.ts`.
  stripe@21 already resolves to its workerd/fetch build, and the signed webhook returned 200 locally.
- Using `IMAGES` also makes `next/image` (`/_next/image`) go through Cloudflare Images. Every unique variant counts toward the 5,000/month free transformations,
  shared with uploads. Now moot for the app: OutreachSection is `unoptimized`, with at most 105 variants/month reachable by someone probing the endpoint.

## Resend primary, nodemailer removed (round 4, ~10:11–10:45 AM CT; Jace's pick, approved by Aria: no nodemailer 10.x)
Built to be easy to undo. Two patches at the repo root, both forward diffs of `freeplug-landing/`:
- `resend-primary.patch`: **cumulative** (rounds 4 + 5 + 5b + 6) from the round-3 state, 56 files (+2946/−395). Earlier versions are in `/workspace/owen/`: `resend-primary.round4.patch`, `.round5a.patch` and `.round5b.patch`.
- `resend-round5.patch`: rounds 5 + 5b + 6 (from the round-4 tree), 34 files (+2255/−189). Earlier versions are `/workspace/owen/resend-round5.round5a.patch` and `.round5b.patch`. Single rounds: `/workspace/owen/resend-round5b-only.patch` (13 files, +631/−72) and `/workspace/owen/resend-round6-only.patch` (19 files, +1078/−60).
- **Revert everything:** `git apply -R resend-primary.patch`, then `npm ci` (via cfport-safe.sh) so node_modules has nodemailer again.
- **Revert round 5 only:** `git apply -R resend-round5.patch` (no `npm ci` needed).
- **Re-apply:** `git apply resend-primary.patch`, then `npm ci`.
- The revert also restores `smtp.ts`, the SMTP `.env.example` block and the old tests, and drops the nodemailer ESLint ban and guard tests.
- Trees: pre `9513234711957b3318f9e4400d7963b60b3948d8`, after round 4 `d8ffda61d0933965000f9ccc5acbfe9d8b7776f6`, after round 5 `5b56996fe10f142f269045beea721e069ef6e18f`, after round 5b `7df424bde1305b07d03e0e970b7019323e7dc3c9`, after round 6 `dee611ea2d470d6bb5a409ffeace9021eff8be89`. All were built with a throwaway index; the real index is untouched.

### Email path inventory
| Email | Who sends it | Code |
|---|---|---|
| Password reset link ("Reset your Freeplug password") | **App → Resend** when RESEND_API_KEY + service-role key are set (`generateLink` recovery + our template); otherwise, or if our send fails, **Supabase Auth** (`resetPasswordForEmail`, hosted mailer) | `src/app/(auth)/actions.ts` `deliverPasswordReset` |
| "How to sign in to Freeplug" (Google-only account asks for a reset) | App → Resend | same |
| Cancellation notice ("Your Freeplug hosting is canceled") | App → Resend, from the Stripe webhook (`customer.subscription.updated`) | `src/lib/email/cancel-notice.ts` |
| Admin "Send email" box (free text to a customer) | App → Resend | `src/app/admin/actions.ts` `adminSendCustomerEmail` → `src/lib/admin/mail.ts` |
| Test-email gate `/api/test-email?to=` (admin only, 404 otherwise) | App → Resend | `src/app/api/test-email/route.ts` |
| Welcome, payment received (receipt), request status update, billing reminder | App → Resend, but **no caller today** (defined helpers only) | `src/lib/email/send.ts` |
| Sign-up confirmation (incl. the claim flow's sign-up) | **Supabase Auth** | `auth.signUp` in `actions.ts` |
| Claim "send it again" | **Supabase Auth** (`auth.resend({type:'signup'})`) | `src/lib/outreach/resend-confirmation.ts` |
| Magic links / invites / email change | **Supabase Auth** only if triggered from Supabase (no app code requests them; `/auth/confirm` accepts those token types) | `src/app/auth/confirm/route.ts` |
| Google OAuth | no email | |
| Contact forms | none in the app (owner-site forms are a future Freeplug endpoint) | |

Supabase Auth emails were **not changed in code** (Aria). Note for Aria: the password reset is app-sent through Resend in the normal case, with Supabase only as the fallback. That was already the behaviour before this round and was kept as is.

### What changed
- `src/lib/email/mailer.ts` (new): the only transport.
  - Same `sendMail(MailParams): Promise<MailResult>`, `getEmailFrom()` and `getDefaultReplyTo()`, plus `isMailConfigured()`, `MAIL_NOT_CONFIGURED`, `MAIL_GENERIC_ERROR` and `publicMailError()`.
  - New optional `idempotencyKey` (passed as Resend's request option).
  - Renders the same React Email templates (HTML plus a plain-text part). Never throws, and has **no SMTP fallback**.
- `resend.ts` only builds the client, rebuilding it if the key changes. `index.ts` exports from `mailer`. `send.ts` takes the same arguments, plus an optional `idempotencyKey` in options. `smtp.ts` is deleted.
- **Fail closed:** without RESEND_API_KEY every send returns `{success:false}`, logs `[email] Email is not configured: RESEND_API_KEY is not set; not sent: "<subject>"` (no recipient in the log), and sends nothing.
  - Users see `MAIL_GENERIC_ERROR` in production (admin box, test route); outside production they see the detail.
  - Forgot-password always shows the neutral "sent" page.
- **Stripe webhook:** the claim write (subscription metadata marker) happens first. The email is sent inside try/catch, both in `cancel-notice.ts` and in the route, so an email failure never makes the webhook non-2xx.
  - Resend idempotency key: `<event.id>:subscription-cancelled`.
- **Sender:** From = `EMAIL_FROM_NAME` + `EMAIL_FROM`, default `Freeplug <no-reply@freeplug-in.dev>` since round 5 (round 4 had `"Freeplug" <support@freeplug-in.dev>`), on the main domain per Aria/Rio's correction. `send.freeplug-in.dev` is only Resend's return path and never appears in From.
  - Reply-To: `EMAIL_REPLY_TO`, default `support@freeplug-in.dev`.
  - Legacy `RESEND_FROM_EMAIL` still works when EMAIL_FROM is unset.
  - Behaviour change: the From address no longer falls back to `SMTP_USER`, and legacy `SMTP_FROM` isn't read.
- **Admin UI:**
  - `smtpConfigured` prop → `mailConfigured`; "Send via SMTP" → "Send email".
  - `AdminSmtpBanner` → `AdminMailBanner` (it says RESEND_API_KEY).
  - `isSmtpConfigured`/`sendSmtpMail` → `isMailConfigured`/`sendAdminMail` (same `{ok}` shape).
- **Test-email route:** 500 with `publicMailError(...)` when no key; copy says Resend.
- **Removed:** `nodemailer` ^9.1.1 and `@types/nodemailer` ^7.0.12, from package.json and package-lock.json (`npm uninstall`; the lock diff is just those 2 packages).
- **SMTP env vars removed** from the code and `.env.example`: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM and SMTP_TLS_REJECT_UNAUTHORIZED. The upload guard still treats `SMTP_PASS` as a secret on purpose.
- `.env.example` has a Resend block: `# RESEND_API_KEY=re_...`, EMAIL_FROM_NAME, EMAIL_FROM and `# EMAIL_REPLY_TO`.
- `.dev.vars.example`: RESEND_API_KEY stays unset locally, so a local preview can't reach api.resend.com.
- **Blocking nodemailer from coming back:**
  - ESLint `@typescript-eslint/no-restricted-imports` for `nodemailer`, `nodemailer/*` and `@types/nodemailer` in src app code, merged with the sharp ban.
  - `no-restricted-imports` for tests, `test/**`, `scripts/**` and root config files.
  - `no-restricted-syntax` for `require()` and dynamic `import()`, in any file.
  - `src/lib/email/no-nodemailer.test.ts`:
    - package.json and the lockfile have no nodemailer;
    - no source file imports or requires it;
    - app code reads no `SMTP_*`;
    - ESLint really reports errors on 6 sample files;
    - `wrangler.jsonc` never names RESEND_API_KEY;
    - the fetch guard works.
- **Resend key never in wrangler config:** the guard now refuses `RESEND_API_KEY` anywhere in `wrangler.jsonc` (vars, env.*.vars, even a comment), whatever the value, plus the existing secret-in-plain-vars check. 4 new guard test cases.
- `vitest.setup.ts`: any fetch to `*.resend.com` rejects in tests. All tests use a fake `resend` class.

### Keys (plan: two sending-only, domain-scoped Resend keys, both from Ezequiel)
1. **Worker key → `RESEND_API_KEY`**, set ONLY as a Worker secret:
   - production: `npx wrangler versions secret put RESEND_API_KEY`;
   - preview: `--env preview`, ideally its own key.
   
   Never in wrangler `vars`, `wrangler.jsonc`, `.dev.vars` or `.env*` that a build reads (the guard refuses it).
2. **Supabase Auth key:** used only as the SMTP password in the hosted Supabase project.
   - Auth → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`, password = this key, sender `no-reply@freeplug-in.dev`, name Freeplug.
   - This is a hosted-setting change for Ezequiel; nothing here touched it.
   - Also check the Auth Site URL and redirect allowlist for the new host, and the email templates if they should match.

Non-secret vars, which can go in wrangler `vars`: `EMAIL_FROM` (default no-reply@freeplug-in.dev), `EMAIL_FROM_NAME` (default Freeplug) and `EMAIL_REPLY_TO` (default support@freeplug-in.dev). Remove any SMTP_* from hosted envs.

### DNS item (nothing touched here)
**Status (round 5): live per Aria.** `freeplug-in.dev` is set up in Resend on the apex and all records are live. **Rio's recheck is still to confirm.**
The records Resend uses (exact values in the Resend dashboard), with the return path on `send.freeplug-in.dev`:
- DKIM: TXT `resend._domainkey.freeplug-in.dev`, value from the Resend dashboard.
- Return path: MX `send.freeplug-in.dev` → Resend's `feedback-smtp.<region>.amazonses.com` (priority 10).
- SPF: TXT `send.freeplug-in.dev` `v=spf1 include:amazonses.com ~all`.
- DMARC: TXT `_dmarc.freeplug-in.dev`, e.g. `v=DMARC1; p=none; rua=mailto:…` to start.

Earlier blockers (round 4): a CNAME on `send.freeplug-in.dev` blocking the MX/SPF records, and no DMARC record. Aria reports both resolved; Rio's recheck should confirm the CNAME is gone, the MX/SPF/DKIM/DMARC records resolve, and Resend shows the domain as verified.

### Checks (round 4, final code, ~10:36–10:45 AM CT, all via cfport-safe.sh, which also clears CLOUDFLARE_API_TOKEN)
- tsc pass. eslint 0 errors and the same 5 pre-existing warnings.
- vitest **68 files / 638 tests** pass (round 3: 66 / 604): `email-paths.test.ts` 24, `no-nodemailer.test.ts` 7, plus 2 cancel-notice tests and 1 guard test (4 cases); 2 webhook tests gained assertions.
- next build pass; opennextjs-cloudflare build pass; guard OK for preview and production (1589 bundle files). 0 nodemailer files in `.open-next`.
- Local smoke (wrangler dev on 3340, then 3341 after the From correction; both closed):
  - `/` and `/forgot-password` 200; `/api/test-email` 404 (not admin);
  - forgot-password POST without a key: 303 to `/forgot-password?sent=1`, Supabase fallback to a dummy URL, no resend.com.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities (hard gate, pass)**.
- Arkitect `verify_codebase` (user-arkitect-clean, threshold high): lint, build, typecheck and test pass. The audit fails with 5 high, all the braces chain (accepted, see open item 7).
  - Report: `/workspace/owen/arkitect-reports/verify-2026-10-03T10-38-07-05-00.{md,json}`, with an accepted-item addendum in the .md.
  - The 10:32 report predates the From correction (same result).

### Round 5 (Aria, ~10:45–11:05 AM CT): no-reply sender, loud password-reset fallback, Sable's copy
- **Sender:** default From `Freeplug <no-reply@freeplug-in.dev>`; the display name is quoted only when it needs it. Reply-To stays `support@freeplug-in.dev`.
  - Tests assert From is exactly `Freeplug <no-reply@freeplug-in.dev>` and never `@send.`.
  - Updated `.env.example` (`EMAIL_FROM=no-reply@freeplug-in.dev`) and the `wrangler.jsonc` comment.
- **Generic user message (Sable), exact:** "We couldn't send that email right now. Please try again in a few minutes. If it still doesn't work, email support@freeplug-in.dev."
  - Used for the admin box and the test route in production.
  - The forgot-password neutral "sent" message (`RESET_NEUTRAL_MESSAGE`) is unchanged.
- **`sendMail` failure reasons:** each failure now carries a `reason`:
  - `not_configured`
  - `local_error` (render or no content; nothing reached Resend)
  - `http` with `status` (Resend 4xx/5xx; the SDK's `statusCode`)
  - `network` (the SDK's `statusCode: null` "Unable to fetch data", or a throw)
  - `timeout` (optional `timeoutMs`)
  
  Logs carry the status and error name only, never Resend's message (it can echo an address) and never the recipient.
- **Password reset** (`deliverPasswordReset` in `src/app/(auth)/actions.ts` and `src/lib/email/reset-fallback.ts`): the fallback to Supabase `resetPasswordForEmail` is kept but runs ONLY when Resend clearly didn't accept the email:
  - `missing_key`, `missing_service_role` (or both);
  - `resend_http` (any 4xx/5xx, with the status);
  - `resend_network` (no response);
  - `resend_timeout` (no answer in 8 s; a late success may mean a duplicate, acceptable for reset);
  - `resend_local_error` (the template failed before any request; my call: nothing reached Resend, so no duplicate is possible).
  
  A returned id, or any 2xx, never falls back.
  - Every fallback logs `console.warn('[password-reset] FALLBACK to Supabase Auth mailer (resetPasswordForEmail): reason=… [status=…]')`, with no recipient.
  - Unchanged: the Google-only notice never falls back (a Supabase reset link would let a Google-only account set a password), and unknown accounts get nothing.
- **Admin degraded indicator:** `AdminMailBanner`, on /admin/requests and /admin/customers, adds "Email degraded: N password reset(s) fell back to the Supabase mailer in the last 24 h (last: reason, time)".
  - It works across Workers isolates: each fallback inserts a row into the existing `public.rate_limit_hits` table (bucket `mail_reset_fallback`, key = the reason label, no personal data) through the allowlisted service-role module `src/lib/rate-limit/event-log.ts`.
  - No migration is needed: the service role already has select/insert, and `rate_check()` purges rows after 2 days.
  - If the service role is missing or the DB is unreadable, it shows an in-memory count for that instance, labelled as such.
- **Rate limit first, verified:** `requestPasswordReset` checks the per-email limit (1/min) and the per-IP limit (5 per 10 min, only for a trusted CF-Connecting-IP) before `deliverPasswordReset`. A throttled request reaches neither Resend, Supabase `generateLink`, Supabase `resetPasswordForEmail`, nor the counter. There are tests for both limits.
  - ~~Caveat: that limiter is in memory per isolate.~~ **Superseded in round 5b:** the reset now uses the DB-backed limiter, failing open to the in-memory one (below).
- **Identical response:** every case (accepted, each fallback reason, unknown account, Google-only, throttled, the fallback itself throwing) redirects to `/forgot-password?sent=1`.
  - Tested, and smoke-checked: the same status, Location and body hash for a first request, a throttled one and another address.
  - ~~Timing still differs between "account exists" and "unknown".~~ **Fixed in round 5b:** the lookup and send run after the response (below).
- **Tests added (14):**
  - the fallback matrix, 7 cases: accepted / no key / no service role / 5xx / 4xx / network null / network throw;
  - fallback-decision unit test;
  - failure classification incl. timeout and log hygiene;
  - counter → banner (database);
  - instance fallback + DB down;
  - no banner when healthy;
  - Google-only failure has no fallback;
  - unknown email;
  - throttled by email;
  - throttled by IP;
  - identical responses (13 cases);
  - quoted display name.

### Checks (round 5, ~10:50–11:00 AM CT, all via cfport-safe.sh; the real RESEND_API_KEY is now in the box env and was confirmed absent inside the wrapper)
- tsc pass. eslint 0 errors and the same 5 pre-existing warnings (one interim lint error was fixed by moving the DB access into the allowlisted rate-limit module, without widening the allowlist).
- vitest **68 files / 652 tests** pass (round 4: 638). `email-paths.test.ts` now has 38.
- next build pass; opennextjs-cloudflare build pass; guard OK for preview and production (1589 bundle files); 0 nodemailer in `.open-next`.
- `npm audit --omit=dev --audit-level=high`: **0 (hard gate, pass)**.
- Local smoke (wrangler dev on 3342, closed afterwards):
  - `/` and `/forgot-password` 200; `/api/test-email` 404;
  - forgot-password POSTs: first, throttled (same email) and another email were all `303 /forgot-password?sent=1` with an identical empty body;
  - 2 `reason=missing_key` fallback warnings (the throttled one ran nothing);
  - no recipient and no resend.com in the log.
- Arkitect `verify_codebase` (user-arkitect-clean, threshold high): lint, build, typecheck and test pass; the audit fails with 5 high, all the accepted braces chain.
  - Report `/workspace/owen/arkitect-reports/verify-2026-10-03T10-57-30-05-00.{md,json}`, with the addendum.

### Round 5b (Aria, ~11:02–11:20 AM CT): template errors, shared reset limit, equal timing
**email_sends:** not received in this round; it arrived and was done in round 6 (below).

1. **Template errors (reset fallback kept, now loud and counted separately)**
   - `src/lib/email/locales.ts`: `EMAIL_LOCALES = ['en']`, `DEFAULT_EMAIL_LOCALE`. The app has no i18n, so every template is English-only. Adding a locale here makes the CI test render it too.
   - `sendMail` takes `template` + `locale` (the `send.ts` helpers set them). A render failure returns `reason: 'template_error'` and logs `console.error('[email] TEMPLATE ERROR: render failed: template=<name> locale=<locale>')`, with no recipient.
   - Password reset: a `template_error` still falls back to Supabase `resetPasswordForEmail`. It's logged at **ERROR** (`[password-reset] TEMPLATE ERROR … template=password-reset locale=en; FALLBACK …`) and recorded as `template_error:password-reset:en` in the same cross-isolate counter.
   - Other reasons stay at WARN.
   - `AdminMailBanner` adds a separate red line: "Template errors: N password reset(s) could not be rendered (template password-reset/en, last …)". The "Email degraded" count stays alongside it.
   - The Google-only notice (`google-sign-in`) still never falls back.
   - **CI:** `src/lib/email/templates/edge-cases.test.tsx` renders **every** template (welcome, payment-received, request-status-update × 3 statuses, subscription-cancelled, billing-reminder × 0/1/−1/365 days, password-reset × 2 links, google-sign-in) for each enabled locale. Inputs:
     - missing optional fields, and empty or blank names;
     - a 10,000-character name;
     - accented and CJK text, RTL Arabic/Hebrew with a RLM, emoji with ZWJ;
     - `<script>`, `&`, quotes, `${x}`, `{{x}}`, `<b>`;
     - a 512-character token link with encoded characters.
   - It asserts a full HTML document containing "Freeplug", escaped markup and a non-empty plain-text part. It also fails if a new `*Email` template file isn't covered.
     - 100 render cases + 2 coverage tests.
     - Mutation-checked: a throwing `welcome.tsx` fails 8 cases (the file was restored byte-for-byte).
     - It runs in `npm test`/vitest. `next build` itself doesn't run tests, so CI needs vitest before build (as it does now).
2. **Shared reset rate limit, fail open for reset only**
   - `src/lib/rate-limit/index.ts`: new `rateDecision()` → `'allowed' | 'limited' | 'error'`. `rateCheck()` is exactly `rateDecision(...) === 'allowed'`, so it still **fails closed** for every other caller:
     - `resend-confirmation.ts`;
     - `outreach/server.ts`;
     - `dashboard/request-website/actions.ts`.
   - `src/lib/auth/reset-rate-limit.ts` (new): `RESET_LIMITS` are per email (`reset_email`, 1 per 60 s, hashed key) and per IP (`reset_ip`, 5 per 600 s, only for a trusted CF-Connecting-IP). The check goes through the Supabase `rate_check()` RPC, so it holds across isolates.
   - On a DB error or throw it logs `console.warn('[password-reset] rate limit database unavailable (<bucket>); using the in-memory limit (fail open)')` and uses the old in-memory limiter.
   - Tests:
     - DB buckets and hashed keys;
     - fail open on DB error;
     - `rateDecision` allowed/limited/error, with `rateCheck` → false on error or throw;
     - a source scan proving only `reset-rate-limit.ts` calls `rateDecision` and the 3 other callers still call `rateCheck`.
3. **Equal timing (no sleep or padding)**
   - `requestPasswordReset` validates the email, reads the client IP and the link base URL, then runs the rate-limit check.
   - Then, unless throttled, it schedules `deliverPasswordReset` (account lookup + send + fallback) with `runAfterResponse` and immediately redirects to `/forgot-password?sent=1`.
   - `src/lib/background.ts` (new): `runAfterResponse(label, task)` uses `getCloudflareContext().ctx.waitUntil`.
     - Local and test fallback: if there's no Cloudflare context, the promise just runs on its own.
     - It always catches, and logs `[label] background task failed: …`.
   - A throttled request does no lookup and schedules nothing.
   - Tests:
     - the handler resolves before a stubbed send resolves (real account), and before a stubbed lookup resolves (unknown email);
     - a send that throws inside waitUntil is logged;
     - the no-context fallback;
     - a throttled request gets the same response with no lookup.
   - **Fallback client:** inside `waitUntil` there's no request to set cookies on, so the Supabase fallback now uses `src/lib/supabase/anon.ts` `createAnonClient()` (supabase-js, no cookies, `flowType: 'implicit'`). It can't store a PKCE verifier.
   - **⚠ Hosted change needed (Ezequiel):** in Supabase Auth → Email Templates → "Reset password", change the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
     - `/auth/confirm` already verifies `token_hash`.
     - Until that change, a **fallback** reset email's link won't sign the user in. The normal Resend path is unaffected, because it already uses `generateLink` + `/auth/confirm`.
     - The alternative is to run the fallback synchronously, which brings back the timing difference. That's Aria's call.
4. **Local smoke (wrangler dev on 3343, closed afterwards):**
   - `/` and `/forgot-password` 200; `/api/test-email` 404.
   - The three forgot-password POSTs (first, same email throttled, another email) all returned `303 /forgot-password?sent=1` with an identical empty body (35 / 15 / 15 ms).
   - The dummy Supabase is unreachable, so each POST logged the expected "rate limit database unavailable … (fail open)" warnings.
   - The two non-throttled POSTs logged the `reason=missing_key` FALLBACK warning, and their background errors were logged *after* the 303. The throttled POST ran nothing.
   - No recipient and no resend.com in the log (`/workspace/owen/cfport-wrangler-dev-3343.log`).

### Checks (round 5b, ~11:08–11:18 AM CT, all via cfport-safe.sh)
- tsc pass. eslint 0 errors and the same 5 pre-existing warnings (`faq/page.tsx`, `TechStackSection.tsx`).
- vitest **69 files / 762 tests** pass (round 5: 68 / 652). `email-paths.test.ts` has 46, the template test 102, and `rate-limit/index.test.ts` 2 new.
- next build pass; opennextjs-cloudflare build pass; guard OK for preview and production (1589 bundle files).
- `npm audit --omit=dev --audit-level=high`: **0 (hard gate, pass)**.
- Arkitect `verify_codebase` (user-arkitect-clean, threshold high): lint, build, typecheck and test pass. The audit fails with 5 high, re-confirmed as exactly the accepted braces chain.
  - Report `/workspace/owen/arkitect-reports/verify-2026-10-03T11-15-34-05-00.{md,json}`, with the addendum.

### Round 6 (~11:21–11:55 AM CT): email_sends ledger, /auth/confirm allowlists, Supabase Auth checklist
**A. email_sends (Aria's spec): webhook emails at most once, past Resend's 24 h window and under concurrent deliveries**
- **Migration** `freeplug-landing/supabase/migrations/20261003160000_email_sends.sql` (174 lines), sha256 `e5316579f8f7e5d79950e634fe87b5dfa0b85fe46541c05a239ed34b3a69205b`.
  - **Table `public.email_sends`:**
    - `id uuid pk default gen_random_uuid()`;
    - `stripe_event_id text not null`, `template text not null`;
    - `status text not null default 'pending' check in (pending, sent, failed)`;
    - `resend_id text null`, `attempts int not null default 1`, `last_error text null` (≤ 200 chars, PII-free);
    - `created_at`, `updated_at timestamptz default now()`;
    - `unique (stripe_event_id, template)` and an index on `created_at`;
    - no recipient or personal-data columns.
  - **Locked down:**
    - RLS enabled **and forced**; no policies for anon or authenticated.
    - `revoke all` from PUBLIC, anon, authenticated and service_role, then `grant select, insert, update` to service_role (no DELETE).
    - Guarded policies: `service_role` ALL (it has BYPASSRLS on Supabase anyway), plus an owner delete/select policy limited to rows older than 30 days, because FORCE applies RLS to the owner too.
  - **Functions** (all `SET search_path = ''`; EXECUTE revoked from PUBLIC, anon and authenticated, granted to service_role only):
    - `email_send_claim(text, text)` (invoker): `INSERT … ON CONFLICT (stripe_event_id, template) DO NOTHING RETURNING id`. If nothing comes back, one conditional `UPDATE … WHERE (status='failed' OR (status='pending' AND updated_at < now() - interval '15 minutes')) RETURNING id` bumps attempts. Zero rows back = skip.
    - `email_send_finish(uuid, text, text, text)` (invoker): marks `sent` + resend_id, or `failed` + error.
    - `prune_email_sends()`: **SECURITY DEFINER**, deletes rows with `created_at` older than 30 days. The repo has no pg_cron, so it follows `rate_check()`'s pattern: 1% of claims call it, and the service role can call it directly.
- **App:** `src/lib/email/webhook-email-ledger.ts` (`sendWebhookEmailOnce`, added to the ESLint service-role allowlist) is the path for every webhook-driven email.
  - Today that's only the cancellation notice; a test scans the route and the modules it calls for any other sender.
  - `cancel-notice.ts`:
    - The Stripe metadata marker now also records the claiming event (`freeplug_cancel_email_event`). Another event for the same cancellation, such as the `updated` event our own metadata write causes, skips without touching the ledger; a redelivery of the claiming event goes to the ledger. A pre-ledger marker without an event key counts as already sent.
    - The marker is written after a successful claim and before the send.
    - The Resend idempotency key `<event.id>:subscription-cancelled` is kept.
  - A claim error (DB error, or a throw such as a missing service role) is logged as `[email-ledger] claim failed; not sending: event=… template=… sub_…`, nothing is sent, and the webhook stays 2xx.
  - The ledger and logs never hold the recipient or Resend's error text. `last_error` is e.g. `http 503`.
- **Throwaway Postgres 17.11 run** (`/workspace/owen/email-sends-pgtest/run-throwaway.sh`, output in `run-output.txt`):
  - Own initdb in `/tmp/owen-email-sends-pg.*`, Unix socket only, port 55440, torn down afterwards. fp-localdb, its `run.sh`, `db-guard.sh` and its 55432 cluster were not used.
  - Supabase-like roles: `postgres` as a non-superuser owner without BYPASSRLS (stricter than hosted), anon / authenticated, service_role with BYPASSRLS, and Supabase's default "grant all" privileges.
  - **Apply 1:** clean.
  - **Apply 2:** only `NOTICE: relation "email_sends" already exists, skipping` and the same for the index. A diff of schema, constraints, indexes, policies, function ACLs/config/body md5 and row count before vs after apply 2 is **empty**.
  - **Grants:**
    - anon and authenticated: no select/insert/update/delete and no execute on any of the 3 functions (14 statements, all 42501);
    - service_role: select/insert/update and execute, but **no delete** (42501 on a direct DELETE).
  - **Protocol:**
    - claim, then a duplicate skips; a sent replay skips;
    - failed → re-claimed with attempts 2 → sent;
    - fresh pending skips, 14 min skips, 16 min is re-claimed;
    - the prune removed only the 31-day row;
    - errors are capped at 200 chars and bad arguments are rejected.
  - **Concurrency:** session A held its claim transaction for 3 s, session B waited 2.0 s and got 0 rows; 20 parallel claims gave exactly 1 winner and 1 row.
- **Tests:**
  - `route-email-ledger.test.ts` (7), through the real route, cancel-notice and ledger:
    - replay after 25 h → one send;
    - two concurrent deliveries → one send;
    - crash after the claim: 5/14 min skip, 16 min re-claim + one send, no second marker write;
    - Resend 503 then Stripe retry → failed row re-claimed, attempts 2, sent once, with the same idempotency key both times;
    - the claim erroring, and throwing → 2xx, no send, logged, then the next retry sends once;
    - the source scan.
  - `cancel-notice.test.ts` 8 (2 new: the legacy marker; no PII in the ledger).
  - `email-sends-migration.test.ts` 5 static checks, so CI catches a regression in the SQL without a DB.
  - The shared in-memory fake `test/fake-email-sends.ts` follows the SQL.

**B. /auth/confirm (Aria picked option A: cookieless fallback + token_hash templates)**
- **Type allowlist** `CONFIRM_OTP_TYPES = recovery, email, invite, email_change`. These are the types our links use: `email` is Supabase's non-deprecated type for both sign-up and magic link. `signup` / `magiclink` are no longer accepted.
- **`next`**: an exact path on a per-type allowlist, otherwise the type default:
  - recovery: `/reset-password`;
  - email: `/dashboard`, `/claim`;
  - invite and email_change: `/dashboard`.
- **`safeNext`** (shared by login, `/auth/callback` and `/auth/confirm`), hardened:
  - after up to 3 decode rounds, refuses `//`, `/\`, backslashes, control characters and whitespace, `://`, undecodable input, and anything over 512 chars;
  - requires the same origin.
- **Failures:** any failure (expired or used token, bad type, missing parameters, verify errors) goes to the new neutral page `/link-expired` with the exact copy "This link has expired. Request a new one.".
  - The back link is `/forgot-password` (reset links), `/login?next=/claim` (claim) or `/login`.
  - The log line names only the type and error code, never the token.
- **Sign-up:** a claim sign-up (`next=/claim`) now sets user metadata `freeplug_claim: true`, so the Confirm signup template can return it to `/claim` with `{{ if .Data.freeplug_claim }}` (a missing key is just false). Users who signed up earlier land on `/dashboard`.
- **Route inventory** (no `supabase/templates` and no `config.toml` in the repo, so Supabase's default `{{ .ConfirmationURL }}` links are assumed):

| Flow | Who sends | Default link works on the Worker? | Change |
|---|---|---|---|
| Confirm signup (`signUp`) | Supabase | same browser only (PKCE `?code` → /auth/callback) | token_hash link |
| Claim "send it again" (`auth.resend`) | Supabase | **no**: resend sends no PKCE challenge, so the session arrives in the URL fragment and /auth/callback can't read it | token_hash link |
| Reset Password fallback (`resetPasswordForEmail`, cookieless since 5b) | Supabase | **no** (no verifier cookie) | token_hash link |
| Reset Password, normal path | App → Resend (`generateLink` → /auth/confirm) | yes | none |
| Magic Link / Invite / Change Email | Supabase, only if triggered from the dashboard (no app code requests them) | **no** (implicit fragment to the Site URL root) | token_hash links |
| Reauthentication | Supabase (6-digit code) | n/a, unused | none |

- **Tests:**
  - `auth/confirm/route.test.ts` (60):
    - each valid type, including the reset cookie only for recovery;
    - 11 bad types;
    - 34 open-redirect variants, each for email and recovery;
    - expired, used and other verify errors, for each back-link kind;
    - 6 missing-parameter cases.
  - `safe-next.test.ts` 28; `link-expired/page.test.tsx` 6; `signup-metadata.test.ts` 2.
- **Checklist:** `/workspace/freeplug-cf-port/SUPABASE-AUTH-CHECKLIST.md` for Ezequiel's one visit:
  - (a) custom SMTP;
  - (b) the 5 link lines;
  - (c) the Site URL: **current value UNKNOWN**, must become `https://freeplug-in.dev` at Gate 2;
  - (d) the redirect allowlist (apex, www, the preview Worker and its version URLs), each with a read-only check.

### Checks (round 6, ~11:30–11:55 AM CT, all via cfport-safe.sh)
- tsc pass. eslint 0 errors and the same 5 pre-existing warnings.
- vitest **75 files / 872 tests** pass (round 5b: 69 / 762).
- next build pass (new routes `/auth/confirm` and `/link-expired`); opennextjs-cloudflare build pass; guard OK for preview and production (1596 bundle files).
- `npm audit --omit=dev --audit-level=high`: **0 (hard gate, pass)**.
- Local smoke (wrangler dev on 3344, closed): `/auth/confirm` without a token → 307 to `/link-expired?for=reset|claim|account` (bad type, `//evil` next and missing params included); `/link-expired` 200 with the exact copy and the right back links; `/` 200.
- Arkitect `verify_codebase` (user-arkitect-clean, threshold high): lint, build, typecheck and test pass. The audit fails with 5 high, re-confirmed as exactly the accepted braces chain.
  - Report `/workspace/owen/arkitect-reports/verify-2026-10-03T11-41-34-05-00.{md,json}`, with the addendum.

### Vera's fresh email pass (test inbox, after Ezequiel's new key; preview only)
- **Password reset:** subject, link works once, 15-minute reset cookie, `/reset-password` flow.
- **Reset fallback (round 5):**
  - With a deliberately bad key on preview: a Supabase-sent reset arrives (with the hosted SMTP settings);
  - one `[password-reset] FALLBACK … reason=resend_http status=4xx` warning per request, with no address in the log;
  - the admin banner shows "Email degraded: N password resets fell back…".
  - With the good key: one email only, no fallback warning, no banner warning.
  - The second request for the same address within a minute sends nothing, **even when it lands on another isolate** (round 5b: DB-backed limit). Two quick requests from different networks are enough to check.
  - The forgot-password response is identical for a real account, an unknown address and a throttled request, **in timing too** (round 5b: the lookup and send run in `waitUntil`). Compare a few `curl -w %{time_total}` runs, and check the email still arrives.
  - **Fallback link (round 5b):** only after Ezequiel's hosted "Reset password" template switch (open item 3), check that a Supabase-sent fallback reset link signs in and reaches `/reset-password`. Before the switch it's expected to fail.
  - **Template-error line:** can't be forced on preview without a code change, so it's covered by tests. Just check the banner shows no red "Template errors" line normally.
- **Google-only account reset:** the "How to sign in" notice.
- **Cancellation notice:** cancel in the Stripe test portal, one email per cancellation; replay the same event → no second email (marker + idempotency key); resume and cancel again → a new email. Check the webhook stays 2xx with a bad key.
  - **Round 6 (needs the email_sends migration on the preview DB):**
    - Each cancellation leaves one `email_sends` row (`sent`, `resend_id` set).
    - `stripe events resend <evt>` → a 2xx and no second email.
    - With a bad key: the row is `failed` (`http 4xx`) and the next Stripe retry with the good key sends once (attempts 2).
    - Two `stripe events resend` at once → one email.
- **Admin "Send email":** arrives, Reply-To support@freeplug-in.dev.
- **`/api/test-email?to=` as admin:** arrives; 404 for non-admin.
- **Supabase-sent emails** (after the hosted SMTP switch): sign-up confirmation, claim "send it again", the fallback reset.
  - Round 6, after the template switch:
    - each link is `…/auth/confirm?token_hash=…&type=…&next=…` and works when opened in another browser;
    - a claim sign-up lands on `/claim`, a normal one on `/dashboard`;
    - clicking a used link shows "This link has expired. Request a new one." with the right link back.
- **Headers on every email:**
  - From `Freeplug <no-reply@freeplug-in.dev>` (never send.…), Reply-To support@freeplug-in.dev (replying reaches support, not no-reply);
  - SPF, DKIM and DMARC pass and alignment, Return-Path on send.freeplug-in.dev;
  - a plain-text part, links pointing at the preview host, not spam-foldered.
- **Missing key on preview:** the clear log line; users see the generic message ("We couldn't send that email right now. Please try again in a few minutes. If it still doesn't work, email support@freeplug-in.dev."); forgot-password still shows its neutral "sent" message.
- Nothing goes out from local or dev.

## Open items
1. **Cloudflare account id** in `wrangler.jsonc` (placeholder) and Ezequiel's yes to the Workers Paid plan.
2. **Secrets.** Production uses `wrangler versions secret put` only. Preview may use `secret put --env preview`, with Stripe **test** keys:
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - SUPABASE_SERVICE_ROLE_KEY (after the planned rotation)
   - TURNSTILE_SECRET_KEY
   - RESEND_API_KEY (Worker secret only; the guard refuses it anywhere in wrangler.jsonc). Plan: a sending-only, domain-scoped key
     for the Worker and a second one for Supabase Auth SMTP (round 4 section)
   - SMTP_PASS: no longer used by the app (nodemailer removed). Don't set it.
   
   Build-time vars per env: the `NEXT_PUBLIC_*` set.
3. **Resend: done in code (round 4).** Still needed:
   - Ezequiel's two new keys;
   - the hosted Supabase Auth SMTP switch to smtp.resend.com:465;
   - DNS: live per Aria (apex set up in Resend, all records live); Rio's recheck still to confirm (see the DNS item).
   
   - **Hosted email templates (round 5b → round 6):** Aria picked option A. All 5 link lines are in `SUPABASE-AUTH-CHECKLIST.md` (b). The Reset Password one is required for the fallback reset link to sign in.
   - **Optional, Cloudflare WAF rate-limit rule on the forgot-password route (Free plan):** a backstop in front of the app's limiter. Not configured here; it's a hosted dashboard change for Ezequiel.
     - The Free plan allows **1** rate-limiting rule, counted per IP, with a 10 s period, the Block action and a 10 s block duration.
     - The expression can match on the URI path (not the method). Suggested: `http.request.uri.path eq "/forgot-password"`, about **10 requests / 10 s** per IP, Block.
     - This also counts page loads, so keep it loose. The app's own 1/min per email and 5/10 min per IP stay the real limit.
     - Security → WAF → Rate limiting rules. Test on preview first.

   Also update the privacy policy draft: Owen's check says "Mailer is SMTP (Namecheap Private Email default)", and it should now name Resend as the email processor.
   Easy to undo: `git apply -R resend-primary.patch` + `npm ci` (everything), or `git apply -R resend-round5.patch` (round 5 only).
4. **Preview deploy checks** (Vera):
   - the 6 MB upload table on the real edge
   - EXIF auto-rotate on a real phone photo
   - exiftool on a stored upload (should be no EXIF)
   - Images quota and 9422 behaviour
   - CF-Connecting-IP showing up in rate-limit keys
   - Vera's email pass against a test inbox (checklist in the round 4 section, updated in round 5)
   - a real `stripe listen` webhook delivery
4b. **email_sends migration (round 6):** `supabase/migrations/20261003160000_email_sends.sql` must be applied to the hosted project through the normal migration process **before** the Worker with the ledger takes webhooks. Without the table, every claim errors, so cancellation emails are skipped (logged; the webhook stays 2xx). Nothing hosted was touched here.
4c. **Supabase Auth settings:** one visit, using `SUPABASE-AUTH-CHECKLIST.md` (SMTP, the 5 template link lines, Site URL, which is currently UNKNOWN, and the redirect allowlist).
5. **Ezequiel's yes at the moment** for Gate 1 (`wrangler versions deploy <id>`) and Gate 2 (custom domain / DNS). Neither is configured here.
6. **Arkitect verify_codebase:** 4/5 on the clean connector (round 4). The audit fails at `high` only on the accepted braces chain (item 7).
   nodemailer is gone. It becomes 5/5 once eslint-config-next stops pulling a vulnerable braces.
7. **npm audit:** the production hard gate (`npm audit --omit=dev --audit-level=high`) is 0. Full tree after round 4: 5 high, all the braces chain.
   - ~~`nodemailer` 9.1.1~~ **resolved in round 4 by removing nodemailer**. It was: `nodemailer` 9.1.1 (direct, SMTP email path): 2 high (addressparser O(n²) DoS: GHSA-v53p-9fqp-m79j, GHSA-prgh-xp8r-p3m5) and 3 moderate
     (including GHSA-6vj9-mwq6-2f5v, TLS servername reuse across transports). The fix is **nodemailer 10.0.14 (a major bump)**. That's out of scope
     for the port and touches the primary email path, so it needs a decision (or goes away if Resend becomes primary and nodemailer is dropped).
   - `braces` ≤3.0.3 via eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch (GHSA-vfj7-8cjw-p6xm; all 5 "high" entries):
     - **Accepted known item (Aria, Oct 3):** lint tooling only; it's a devDependency and isn't in the Worker (`--omit=dev` audit 0, none of it in `.open-next`).
     - No patched braces release exists (3.0.3 is the latest). npm's suggested "fix" is a downgrade to eslint-config-next 14, so ignore it.
     - **Recheck** at the next eslint-config-next release after 16.3.8 (Sep 30; 16.4.0 is canary), backstop Oct 17, 2026.
8. **Production override:** done per Jace + Vera (above). Remaining: the first real production run only after Ezequiel's yes.
9. **Sandbox env:** `__CURSOR_SANDBOX_ENV_RESTORE` (and the default shell and the Arkitect processes) carry the live service-role JWT and other live keys.
   Anything not run through `cfport-safe.sh` sees them. Worth telling whoever owns the box env, and it's another reason for the planned key rotation.
10. Lina's `-cf` screenshots on the preview deploy (above, now including the landing page). Jace's speed check on the preview decides
    whether the city JPGs get re-encoded or converted to WebP.
11. Small follow-ups:
   - Optional: return 404 from `custom-worker.ts` for `/_next/image` so the Images quota is spent on uploads only.
   - Bucketing IPv6 by /64 (Aria's proposal, not done).
   - The secret-key change for stored visitor addresses waits for Ezequiel's go.
