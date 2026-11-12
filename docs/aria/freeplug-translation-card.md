# Freeplug in Spanish (freeplug-in.dev): decision card (Aria, DRAFT v4, Sun Oct 4 2026, ~9:05 AM CT)
Research and drafting only. No code changes, commits, Stripe calls or hosted anything. Nothing is built until Ezequiel approves; he reviews it on localhost:3000 (my desktop).
- Code read: `/workspace/freeplug-ladder/freeplug-landing`, branch `hosting-ladder-2026-10-03` (HEAD `706f812`). Paths are relative to it. It already carries the Cloudflare port (`open-next.config.ts`, `wrangler.jsonc`).
- Data: Rio's **8-county Central Texas brief** `/workspace/rio/central-texas-languages-2026-10-04.md`: ACS 2020–2024 5-year, table C16001, the sum of the published estimates for Bexar, Comal, Guadalupe, Hays, Travis, Williamson, Caldwell and Bastrop. It replaces the 9-city brief used in v1.
- v4: Ezequiel's decision (Oct 4): **English and Spanish only, for now.** The other 14 named languages move to a short "Later, if needed" list with their counts (§0). Right-to-left, extra fonts and the multi-language email hook are out of scope. Kept: the logged-in section (§0b), the website-text question (Q6), and a Spanish-only cost question (Q5).
- This **replaces** my Sep 24 card (`/workspace/freeplug-qa/ARIA-I18N-CARD-2026-09-24.md`), which was never built. Changes: 2 languages, not 3; no auto-detection; the whole customer dashboard is in scope; a missing key fails CI instead of falling back.
- **(est.)** = my estimate. **(unsure)** = needs checking.

---
## 0. Target: English + Spanish (Ezequiel, Oct 4)
Ezequiel's decision: **English and Spanish only, for now.** Source: Rio's brief, 8 counties, people 5+ = 4,567,793 (brief line 27).
- **Spanish: 1,140,018 speakers** (25.0% of people 5+), of whom **369,580 (32.4%) speak English less than "very well"** (brief line 31). No other language reaches 2% (brief line 7).
- Spanish is fully human-reviewed (R2) before it goes live. Texas/Mexican Spanish (`es`, Stripe `es-419`).
- Caveat: home language isn't preferred website language, and our buyers are business owners, not all residents.

**Later, if needed** (not in scope; counts from Rio's brief):
- 5-year C16001, 8-county sum (brief lines 34-42):
  - Chinese 29,187
  - Vietnamese 21,187
  - Arabic 19,972
  - German 15,534
  - Tagalog 14,350
  - Russian 13,727
  - French 12,850
  - Korean 12,701
- 2024 1-year detail. Bexar/Travis/Williamson top 10s only, so these are lower bounds from a different year (brief lines 240-295):
  - Hindi ≥22,788
  - Telugu ≥21,995
  - Urdu ≥10,062
  - Tamil ≥5,691
  - Gujarati ≥5,100
  - Portuguese ≥3,846 (UNRELIABLE)
- The catch-all "Other…" groups can't be translated as one language and aren't listed.

**The setup lets a language be added with strings only:**
- add its code to the next-intl locales list
- add `messages/<code>.json`
- run the same review chain (machine draft → native reviewer → Wren → Vera → Ezequiel)
- Exceptions: right-to-left scripts (Arabic, Urdu) would need a layout pass, and non-Latin scripts would need fonts (Geist loads only `latin`, `layout.tsx:5-13`). Neither is in this card's scope.

## 0b. What customers see once they log in
- In the dashboard header there's a **language picker** ("English" / "Español").
- Pick Español and **every dashboard screen, button, message and email** switches to Spanish: Plans, the tip slider, billing, help chat, the cancel and buyout cards, and the emails we send.
- The choice is **saved to their account** (`profiles.locale`), so it sticks on every device and browser they sign in from.
- Stripe's checkout, receipts and billing portal follow it too.
- Before they log in, the public pages also have a Spanish version at **/es** (e.g. `/es/faq`), with the same picker in the header and footer.

---
## 1. Today (from code)
| Topic | What the code does | Ref |
|---|---|---|
| i18n | **None.** No i18n library. `<html lang="en">` is hard-coded. The one hook is `EMAIL_LOCALES = ['en']`, and the email CI test renders every locale listed there | `package.json`; `src/app/layout.tsx:32`; `src/lib/email/locales.ts:1-8` |
| Strings | **Hard-coded English**: in JSX, plus exported constants in `ladder-copy.ts` (109), `outreach/copy.ts` (135), `buyout.ts` (17), `priority.ts` (4). Help chat is **scripted, no AI**, and tested word-for-word against the locked English source (`/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt`, 948 lines, ~13.4k words, partial and older than the ladder) | `src/lib/help/help-chat-content.ts:12-18` |
| Dates and money | `'en-US'` hard-coded in 7 places, plus one default `toLocaleString()` | `subscription-dates.ts:76`; `active-subscription.ts:25,39`; `billing-activity.ts:12`; `outreach/copy.ts:242`; `RecentActivity.tsx:22`; `buyout.ts:78`; `QuickStats.tsx:35` |
| Proxy (Next 16.3.8) | `src/proxy.ts`: body-size 413 guard, then Supabase `updateSession`, wrapped in `withTerminalResponseHeaders` (OpenNext skips `next.config` headers on proxy redirects). `updateSession` matches the literal paths `/dashboard`, `/login`, `/signup` | `src/proxy.ts:6-19`; `src/lib/supabase/middleware.ts:34-45` |
| Metadata / SEO | Static `metadata` per layout. **No canonical, no `alternates` anywhere.** Sitemap = `/`, `/faq`, `/signup`. Robots disallow `/dashboard`, `/admin`, `/api`, `/auth` | `layout.tsx:15-23`; `sitemap.ts:5-11`; `robots.ts:4-12` |
| Resend emails | 7 React templates (welcome, payment received, request update, cancelled, billing reminder, password reset, Google sign-in), English subjects | `src/lib/email/templates/*`; subjects at `src/lib/email/send.ts:28,52,73,94,116,136` |
| Supabase Auth emails | **Not in the repo** (dashboard-only, per the checklist). They **already branch on user metadata** (`{{ if .Data.freeplug_claim }}`), set at sign-up. Password reset is our Resend template, with Supabase's mailer as fallback | `/workspace/freeplug-ladder/SUPABASE-AUTH-CHECKLIST.md:26-34`; `src/app/(auth)/actions.ts:79-95,188,218` |
| Stripe | 3 Checkout Sessions, **none sets `locale`** (so Stripe uses the browser locale): hosting `api/checkout/hosting/route.ts:196`, maintenance `api/checkout/maintenance/route.ts:42`, outreach setup `lib/outreach/server.ts:691`. 1 customer create, **no `preferred_locales`**: `lib/stripe/checkout-customer.ts:42-48`. Outreach publish creates the subscription directly: `lib/outreach/billing.ts:248`. 2 portal sessions, no `locale`: `dashboard/billing-actions.ts:74,100` | — |
| Cache (OpenNext) | Static-assets incremental cache only. `/` and `/faq` are prerendered; there's no ISR, R2 or KV. No HTML edge-cache rules (only `_next/static` immutable) | `open-next.config.ts:4-10`; `public/_headers:14` |
| Legal | **No Terms page and no Privacy page.** Both footer links are `href: null` | `src/features/landing/components/Footer.tsx:17-18` |
| "Spanish" anywhere | No mention of Spanish or bilingual support in `src` | grep |

**Rough user-facing string count** (est., heuristic count of JSX text + sentence-like literals, tests excluded):
| Area | Files | Strings (est.) |
|---|---|---|
| Public pages (landing, FAQ, request form, preview) | 30 | ~140 |
| Sign-up / login / claim / checkout cards | 26 | ~210 |
| Customer dashboard (Plans, tip slider, buyout, cancel) | 43 | ~360 |
| Help chat (13 questions, 11 answers) | 2 | ~35 (long answers) |
| Emails (7 templates + subjects) | 16 | ~70 |
| Admin (stays English) | 22 | ~150 |
| **In scope** | | **~800 strings (~10–12k words, est.)** |

---
## 2. Recommendations
**R1. Languages:** English + Spanish only, for now. The others stay on the §0 "Later, if needed" list. Any of them is a strings-only addition with its own native reviewer.

**R2. Human-reviewed strings only. No live machine-translation widget.**
- *Why:* quality, SEO (a widget's text isn't indexable or reviewable), and the legal risk on prices, tips, cancel and buyout terms.
- Flow:
  1. Sable finalizes the English.
  2. Machine draft of the Spanish, for speed.
  3. A **native reviewer** fixes it, aiming for **Texas/Mexican Spanish (es-US style)**, not Spain's.
  4. Wren copy-fits it (Spanish runs ~20–30% longer: buttons, plan cards, slider labels, the nudge).
  5. Vera QAs both locales.
  6. Ezequiel reviews it on :3000.
- Strings marked [STRICT] in the locked file (pricing, billing, cancel) get the reviewer's sign-off line by line.

**R3. Tech: next-intl 4.14.9.**
- npm `latest` as of Oct 2, 2026 UTC. Peer `next ^16.0.0`, and its docs use `src/proxy.ts`.
- URLs: English stays **unprefixed**; Spanish under **`/es`** with the same slugs (`/es`, `/es/faq`, `/es/signup`, `/es/request-website`). No translated slugs. *(There's no `/pricing` page; plans live on `/` and `/dashboard/plans`.)*
- **Only indexable public pages get the prefix.** Noindex app pages (`/dashboard/*`, `/claim`, `/login`, auth) stay unprefixed and read the locale from `profiles.locale`, then the cookie. *Why:* Supabase redirect URLs, the Auth allow-list and `updateSession`'s path checks don't change. Pages behind sign-in don't need hreflang.
- `messages/en.json` + `messages/es.json`, with namespaces (`pricing.*`, `legal.*`, `help.*`, `email.*`). A **CI test fails** on a missing or extra key, a placeholder mismatch (`{amount}`, `<a>`), or a Spanish value identical to English (allow-list for brand names).
- **Scope:** public pages, sign-up/claim/checkout, the whole customer dashboard incl. Plans and the tip slider, help chat, emails. **Admin stays English.**
- Prices and dates go through `Intl` per locale (es-US: "$35.00", "3 de octubre de 2026"). Prices stay **USD**, and every hard-coded `'en-US'` above is replaced.

**R4. Switcher and memory.**
- Public header and footer **and the dashboard header** (§0b), labeled **"English" / "Español"** in their own language. No flags.
- Choice saved in a **`NEXT_LOCALE` cookie** (1 year, functional, `SameSite=Lax`) and, when signed in, in **`profiles.locale`**, which also drives emails and Stripe.
- **No automatic redirect** from the browser language: next-intl `localeDetection: false`, and the switcher sets the cookie itself. A browser preferring Spanish on an English page gets a small dismissible **"¿Prefieres español?"** banner instead. Dismissing it sets the cookie to `en`.
- **Cache:** the language is in the URL, so the cache never varies by cookie. `/es` and `/es/faq` stay prerendered (`generateStaticParams` + `setRequestLocale`), so they're still served from static assets. The banner is client-side only, so the HTML stays identical for everyone.

**R5. SEO.**
- `alternates.languages` = `en`, `es`, `x-default` (→ English) in each public page's metadata **and** in the sitemap.
- Self-canonical per locale, translated titles and descriptions, `<html lang>` per locale, and robots allowing `/es`.
- **Launch gate:** `/es` routes, hreflang and the sitemap entries switch on only when every public page is fully reviewed. No half-translated pages indexed.

**R6. Emails.**
- Resend templates in both languages, picked by `profiles.locale` with English as fallback. Add `'es'` to `EMAIL_LOCALES` so the existing render test covers it.
- **Supabase Auth emails: doable.** Supabase's docs show `{{ if eq .Data.locale "es" }}…{{ else }}…{{ end }}` on user metadata, and we already use `.Data.freeplug_claim` that way. Sign-up sets `data.locale`; switching language updates the metadata via `updateUser`.
- **(unsure)** whether the **subject** field accepts the same template logic. If not: a two-language subject ("Confirm your email · Confirma tu correo"), or later a Send Email Hook.
- Google sign-ups have no `locale` until their first switch, so they default to English.
- The one-visit `SUPABASE-AUTH-CHECKLIST.md` gains step (b2): paste the two-language bodies.

**R7. Stripe.**
- Pass Checkout **`locale: 'es-419'`** (Latin American Spanish is in Stripe's enum; `es` is Spain) or `'en'` on all 3 sessions.
- Set **`preferred_locales: ['es-419']`** on the customer, at create and on switch, so receipts and invoice emails/PDFs follow (Stripe Invoicing supports Spanish, Latin America).
- Portal sessions: `locale` from `profiles.locale`.
- Product and plan names in Stripe stay **English** (single-language fields). The app shows Spanish plan copy. **Flag:** Checkout line items, receipts and invoices will show the English name ("Freeplug Hosting: Starter", "Tip"). Sable decides whether step names are translated in the app or kept as brand names (Q3).

**R8. Legal pages.**
- Terms + Privacy: **English governs**. The Spanish is a reviewed translation with "Traducción para su conveniencia; la versión en inglés prevalece."
- Wording needs Ezequiel's approval.
- **Neither page exists yet** (footer `href: null`). The buyout card already needs Terms, so write the English first and translate after.

**R9. Support promise.** Nowhere says "support in Spanish" / "atención en español" unless Ezequiel confirms someone answers calls, texts and email in Spanish (Q2). Support hours copy (`src/lib/support-hours.ts`) is translated as-is.

**R10. Out of scope.** Bilingual websites **for our clients** (their own sites in English and Spanish) is a separate product decision, possibly a ladder perk. It gets its own card.

---
## 3. Database
- `profiles.locale text not null default 'en' check (locale in ('en','es'))`. Adding a language later widens this list.
  - The owner may update **only this column**, via a small SECURITY DEFINER RPC `set_own_locale(text)`, because profiles has no client UPDATE (`20260402120000_profiles_and_website_requests.sql:25`).
  - Migration numbered after `20261003210000` (the buyout card's migrations, if approved, go first). Scratch first, Vera checks.
- Optional: `website_requests.locale`, so admin knows which language to reply in (stays English in admin, shown as a badge).
- Nothing else: no translated copy in the DB.

---
## 4. Size of the work (est., agent time)
| Area | Work | Est. |
|---|---|---|
| Setup | next-intl, `[locale]` public routes, compose with `proxy.ts`, switcher, banner, cookie, `profiles.locale` + RPC | 1.5–2 days |
| Extraction | ~800 strings → `en.json`; move the copy constants; Intl dates and money | 2–3 days |
| Help chat | message keys + re-point the locked-source test | 0.5 day |
| Emails | 7 templates + subjects ×2; Supabase bodies | 1 day |
| Stripe | `locale`, `preferred_locales`, portal | 0.5 day |
| SEO | metadata, alternates, sitemap, robots, gate flag | 0.5 day |
| Spanish copy | machine draft (hours) + **native review ~10–12k words** + Wren fit | 2–4 reviewer days |
| QA | Vera, both locales, layout checks with Lina | 1.5–2 days |
| Legal | Terms + Privacy in English first (new), then translation | Ezequiel's call |

---
## 5. Conflicts
- **C1. The locked English source and its tests.** Help chat and several copy tests compare strings to `/workspace/freeplug-qa/…LOCKED-2026-09-24.txt` (`help-chat-content.ts:15-18`). Moving copy into `messages/*.json` means `en.json` becomes the lock and those tests re-point. The lock file is also stale: it's from Sep 24, before the ladder, tips and buyout copy. Sable re-extracts it before translation starts.
- **C2. The proxy has two jobs already.** next-intl's middleware must run **inside** the existing 413 guard and before `updateSession`. Its rewrites and redirects must also go through `withTerminalResponseHeaders`, or they lose the security headers on OpenNext (`proxy.ts:11`). `updateSession`'s `/signup` check (`middleware.ts:44`) must also match `/es/signup`.
- **C3. Strings are spread across ~140 files**, many as exported constants that tests import (`ladder-copy.ts`, `outreach/copy.ts`, `buyout.ts`). Server actions return English error text (e.g. `buyout.ts:136`, `outreach/errors.ts`) and need message keys instead. That's the bulk of the 2–3 days.
- **C4. Supabase subjects (unsure)** may not branch. Worst case is a two-language subject line.
- **C5. Stripe-hosted text stays English** where it comes from our product names (line items, receipts), even with `es-419`.
- **C6. No Terms or Privacy to translate.** R8 waits on new English legal pages.
- **C7. Sep 24 card conflicts:** it had "default detection on" and English fallback for missing keys. This card overrides both.

---
## 6. QA cases for Vera (local :3000, test mode)
1. `/` and `/es` render fully, with no English left on `/es` (CI key test + a visual pass). `<html lang>` is correct.
2. View-source on `/es/faq`: self-canonical, hreflang en/es/x-default, Spanish title and description. The sitemap lists both locales. Robots allow `/es`.
3. Spanish browser on `/` → **no redirect**, banner shown. Dismiss → stays hidden for a year. Googlebot-like request → no banner HTML.
4. The switcher keeps the same page (`/faq` ↔ `/es/faq`). A signed-in switch writes `profiles.locale`. Another user can't write it (RLS/RPC).
5. Dashboard, Plans, tip slider, cancel and buyout cards in Spanish at 320 px: no overflow on buttons, plan cards, slider labels or the nudge.
6. Prices are "$35.00" with no conversion. Dates are Spanish. The tip math is identical in both locales.
7. Checkout (hosting, maintenance, outreach setup) opens in Spanish. A test-mode receipt arrives in Spanish (`preferred_locales`). The portal opens in Spanish.
8. Each Resend template renders in `es` (CI) and a real test email reads correctly. Missing locale → English.
9. Supabase Confirm signup / Magic Link / Change email in Spanish for a `locale: 'es'` user, and the claim link still goes to `/claim`.
10. The help chat answers match the reviewed Spanish exactly.
11. Admin stays English and shows the request's language badge (if chosen).
12. Feature gate off → no `/es` routes, no hreflang, no switcher.
13. The string "español" in support claims appears nowhere unless Q2 = yes.

---
## 7. Only Ezequiel can do
- Approve the method and this card (languages: English + Spanish, decided Oct 4). Name and pay (or be) the **native Spanish reviewer**.
- Approve Terms + Privacy (English, and the Spanish "English controls" line).
- Paste the Spanish Supabase Auth template bodies (checklist visit), or say yes to Owen doing it.
- Decide whether to promise Spanish support.

## 8. Questions for Ezequiel
1. **Reviewer:** you, or someone we pay (budget)? They must be a native es-US/Mexican-Spanish speaker who signs off on [STRICT] pricing lines.
2. **Spanish support:** does anyone answer calls, texts and email in Spanish? If not, we never say so.
3. **Plan names:** translate the step names in the app ("Prioridad", "Vía rápida"…) or keep them as English brand names to match Stripe receipts? (Sable leads.)
4. **Legal:** approve the "English controls" approach, and who drafts Terms + Privacy first?
5. **Cost (Spanish):** a native reviewer for **every screen and email** (~800 strings, ~10–12k words in scope, est.; §1 table), about 2–4 reviewer days, plus 1.5–2 QA days. Every later copy change needs a Spanish re-review. Budget?
6. **(Open; asked, not decided)** Should the dashboard have a tool that translates the customer's **own website text** (services, about, etc.) into Spanish for their site? That's separate from translating Freeplug itself, and it overlaps the bilingual-client-sites idea (R10).

---
## 9. BUILD GO (Ezequiel: "build it please", Sun Oct 4, 9:09 AM CT). Aria's default rulings on Q1–Q6
- **Scope:** English + Spanish. Public pages at `/es` + a language picker for logged-in customers, saved to `profiles.locale`. Every dashboard screen, email, Checkout and portal switches language. Feature gate stays **OFF** by default. Local only, its own branch `i18n-es`, local commits only, no push, PR or deploy.
- **Q1 / Q5 Reviewer + cost:** for now Sable writes the Spanish (from a machine draft + her own pass), and Wren checks fit. No paid reviewer yet. **Go-live gate:** a native speaker (Ezequiel or someone he names) signs off on every [STRICT] pricing line before the gate turns on in production.
- **Q2 Spanish support:** treat it as NO. Nowhere says "support in Spanish" or "atención en español" (QA case 13).
- **Q3 Plan names:** keep the English brand names so they match Stripe receipts. Sable can override if she has a strong reason.
- **Q4 Legal:** out of this build. Terms/Privacy stay "coming soon" in both languages.
- **Q6 Website-text translator:** NOT in this build. It gets its own card later.
- **Supabase Auth Spanish templates:** Owen prepares the bodies locally (local Supabase only). Hosted paste waits for Ezequiel.
- **Order:** Owen finishes the add-ons fixes (a)–(d) and the Workers numbers first, then starts i18n. Sable starts re-extracting the lock + the Spanish draft now (C1).
- **Done =** Arkitect structure check before patches, `verify_codebase` on arkitect-clean, all tests green, then Vera QA §6 (cases 1–13), then my go to show it on :3000 for Ezequiel.
