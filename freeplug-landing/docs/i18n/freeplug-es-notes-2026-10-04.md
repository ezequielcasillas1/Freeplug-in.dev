# Freeplug Spanish build: notes (Sable Quinn, Sun Oct 4 2026, CT)

Aria's card: /workspace/aria/freeplug-translation-card.md (R2–R9, §5 C1, §9). Scope is English + Spanish only. These are copy files only: no repo was edited and nothing was sent.

## Source
- Repo: /workspace/owen/ladder-fix-wt/freeplug-landing, branch `ladder-fix-2026-10-03`
- **Commit: ea817ef6180aafe2edd4f9cbcc059f7b294283a1 (ea817ef)**, "Add-ons: lock with switch date, real charge with credit, self-heal + Sable 9:05 strings". The worktree was clean.
  - I started on e3edb88. Owen committed ea817ef during the work, so I re-ran the extraction on ea817ef and diffed the two.
  - The only copy change was my 9:05 AM add-on strings landing word for word, plus "Go to Plans". All line refs now point at ea817ef.
  - The 8:25 and 8:31 AM strings from my round 5 file were already in code. No string in these files is a pending placeholder any more.
- Excluded: src/app/admin and admin-only libs, tests, internal logs and webhook/Stripe internals, and change-plan.ts internal messages (billing-actions maps them to ladder-copy strings).
- The old lock (freeplug-english-source-LOCKED-2026-09-24.txt) was used for format only and was not touched.

## Files
1. `/workspace/copy/freeplug-english-source-LOCKED-2026-10-04.txt`: the English lock, old format, grouped by page, with key= on each line
2. `/workspace/copy/freeplug-en-source-2026-10-04.json` (nested, namespaced) + `/workspace/copy/freeplug-en-source-2026-10-04.keys.tsv` (key, file:line, STRICT, placeholders)
3. `/workspace/copy/freeplug-es-draft-2026-10-04.json`: same 951 keys in Spanish (edited)
4. `/workspace/copy/freeplug-es-review-sheet-2026-10-04.tsv`: key, STRICT, English, Spanish, note
5. this file
- Intermediate: `/workspace/copy/.work/freeplug-es-machine-draft-2026-10-04.json` is the raw machine draft (Argos en→es, offline). My editor pass changed 777 of 951 values. The rest are brand names, cities, short labels and pure placeholders that were already right.

## Counts
| | |
|---|---|
| Strings (keys) | 951 (1,011 code refs, 86 files) |
| English words | 7,597 |
| Spanish words | 8,196 (+8%). Buttons were kept short; long-form copy runs about 10–15% longer |
| [STRICT] | 425 strings, 4,325 English words |
| [COMPOSED] (placeholders) | 158 |
| Lines flagged as stale or wrong English | 28 (in the review sheet notes) |

[STRICT] by namespace: plans 109/109, addons 49/49, cancel 48/48, tips 39/39, buyout 9/9, help 34/114, dashboard 33/114, public 29/143, claim 27/156, email 24/77, errors 21/35, auth 2/50, common 1/8.

Checks run by script on every key:
- Placeholders and tags are identical, including ICU plurals and leading spaces.
- $ amounts and numbers match the English.
- No "donación/donativo", no "en español", no "soporte/atención en español", no "usted" (tú throughout).
- The 33 values identical to English are all intentional, for the R3 CI allow-list: Freeplug, support@freeplug-in.dev, the 9 plan names (including legacy Basic/Plus/Pro), the 3 add-on names, city names, Bootstrap/Cloudflare/Turnstile/Resend, "Legal", "Plan", "Plan {amount}", "Hosting", "{plan} {amount}", "Freeplug · 72 After".

## Glossary (fixed terms)
| English | Spanish |
|---|---|
| plan / hosting plan | plan / plan de hosting |
| hosting | hosting (kept; see Q1) |
| website / site | sitio web / sitio |
| billing period | periodo de facturación |
| billing date / next bill | fecha de cobro / próximo cobro |
| charge (verb / noun) | cobrar / cargo |
| refund | reembolso |
| renewal | renovación |
| invoice | factura |
| account credit | saldo a favor |
| tip (optional) | propina (opcional): "Un extra opcional para apoyar a Freeplug". Never donación |
| small edit | cambio pequeño |
| maintenance / one-time maintenance | mantenimiento / mantenimiento único |
| quote | cotización |
| request (noun) / request (verb) | solicitud / pedir |
| add-on | complemento (names stay English) |
| preview (site preview) | vista previa |
| dashboard | panel |
| Manage billing | Administrar facturación (button and every mention in body text) |
| Billing (section) | Facturación |
| Cancel options | Opciones de cancelación |
| Resume plan / Restart hosting | Reanudar plan / Reactivar hosting |
| Switch to {name} | Cambiar a {name} |
| Turn on / Turn off / Keep it | Activar / Desactivar / Mantenerlo |
| Checking the amount… | Revisando el monto… |
| Sign in / Log in | Iniciar sesión (both) |
| Sign out / Sign up / Create account | Cerrar sesión / Registrarme / Crear cuenta |
| Claim my website | Reclamar mi sitio web (see Q2) |
| Coming soon | Próximamente |
| business day | día hábil |
| support hours | horario de atención |
| Email (field) | Correo |
| {amount}/month | {amount} al mes (compact "/mes" only in the help-center plan guide) |
| on {date} / starting {date} | el {date} / a partir del {date} |
| live / offline | en línea / fuera de línea |
| Privacy Policy | Aviso de privacidad (stays "coming soon") |
| times | "1 a 2 p. m. (hora del Centro)", days "lun–vie" |

Never translated: Starter, Priority, Fast lane, Leads, Get found, Growth partner, Basic, Plus, Pro, +1 small edit, Big change, Visitor snapshot, Freeplug, 72 After, Stripe, Google, Google Business, Thumbtack, Envato, Cloudflare.

## Where the English plan and add-on names read badly in Spanish
- **Get found**: "Todo lo de Get found, más…" is a verb phrase used as a noun, and reads oddly.
- **Fast lane**: in sentences it reads as untranslated English ("Todo lo de Fast lane", "Cambiar a Fast lane ahora").
- **Priority**: it sits next to the Spanish word "prioridad". "¿Qué es Priority?" and "tienes Priority si…" work, but a reader may expect "Prioridad".
- **+1 small edit**: "con el complemento +1 small edit" is the worst one. A Spanish speaker can't parse it without the gloss, which is why the perk lines spell out "un cambio pequeño".
- **Leads / Growth partner** are fine as names, though "Leads" means nothing to a non-English reader.
- My suggestion, not applied: keep the names but add a short Spanish gloss once, on the plan cards only, e.g. "Get found (te encuentran en Google)". Your call or Aria's.
- **Legacy names**: "{tier} add-on" becomes "Add-on {tier}" ("Hospedaje + Add-on Pro"; Sable, Oct 13: "Add-on Pro" is a real tier name and stays English). grandfatheredAlertName builds "hosting plan and Pro add-on" from English pieces in code, so it needs the Spanish pieces ("plan de hosting y complemento Pro").

## Stale or wrong English (for you to fix; Spanish follows the English as written)
- **Approved Sep 24/25 lock lines that never landed:**
  - Login title, heading and subtitle ("Log In", "Freeplug account — hosting and dashboard access.") and the signup subtitle ("Sign up to access your dashboard.")
  - Nav and footer "Get Started" and "Services"
  - The hero pills "Modern Tech / Lightning Fast / Custom Design" ("Lightning Fast" is also a speed promise)
  - The "Outreach = Freeplug · Builds = 72 After" lines (×3)
  - "Freeplug connects the conversation"
  - TechStack Title Case headings
  - The request-website intro ("We evaluate every request in person…")
- **Unapproved claims:** the international outreach section, the footer "Outside the US via partners" and the CTA "Outside the US — … check the network".
- **errors.checkout "Add-ons and custom amounts are no longer offered"**: wrong now that add-ons are back.
- **"Already have an add-on? You keep it at the same price."** (LEGACY_PLAN_NOTE, help.answers.hostingPlans): ambiguous now. It means the old Basic/Plus/Pro add-ons.
- **ALREADY_HAS_PLAN_MESSAGE "Use Manage billing to change it"**: stale. Plan changes are on the Plans page, and ALREADY_HAS_PLAN_SWITCH exists but isn't wired.
- **Maintenance lines that predate "jobs over about an hour":**
  - LANDING_PLANS_INTRO and DASHBOARD_PLANS_INTRO are still marked PLACEHOLDER in code
  - The plans page says "Maintenance stays quote-first"
  - The RequestWebsiteForm hint "(e.g. hours, photos, a section overhaul)"
  - help.answers.requestChanges says "other changes" go to maintenance, which conflicts with Aria's Starter small-edit ruling
  - help.answers.hiddenFees and whatDoIPay don't mention add-ons or tips
- **"cancelled"** in plans.change.unchanged and paymentFailedPendingLost, vs "canceled" everywhere else.
- **Jargon shown to customers:** "Server configuration is incomplete (missing service role)…" and "…after the webhook runs" on the dashboard.
- **Welcome email promises:** "establish and grow your online presence", "professional website hosting and maintenance services", "Watch your online presence grow".
- **Title Case leftovers:** Active Subscriptions, Total Paid, Customer Since, Recent Activity, Need Help?, Email Support, Manage Your Plan, Cancel Your Subscription, View Plans, Request Update, email headings.
- **addons.chargeNote** says "charges {price} now", while the 9:05 confirm lines say "today". Small, but worth aligning.

## Open questions
1. **hosting vs hospedaje.** I kept "hosting" because it's common in US Spanish and matches Stripe receipts. The native reviewer should confirm.
2. **"Reclamar mi sitio web".** This follows Google's Spanish, but "reclamar" can read as "complain". The alternative is "Quiero mi sitio web".
3. **Stripe line item "Maintenance (one-time)".** It's built per session, so it could be localized. R7/C5 say Stripe names stay English. I've drafted "Mantenimiento (único)" in case.
4. **"URGENT" in the email subject.** Kept in English because that's what the inbox filter looks for. Should "URGENTE" be accepted too?
5. **{source} in "From your {source}"** (claim services) is filled from outreach data in English. It needs a mapped Spanish label.
6. **Lists.** common.listAnd/listOr and addonsStayOnLine (", " join) should use Intl.ListFormat('es'), so "y"→"e" and "o"→"u" are handled.
7. **SUPPORT_HOURS.** The Spanish starts lowercase ("de lunes a miércoles…") because it's used mid-sentence. On its own (help page, "Support hours" card) the first letter needs capitalizing.
8. **Outreach placeholders** were renamed to ICU style ({businessName}, {accountEmail}, {expiryDate}, {fileName}, {supportEmail}, {supportPhone}, {max}). Owen's fill() needs to match.
9. **"Welcome back!" and "¡Bienvenido!"** are gendered in Spanish. I used neutral forms ("¡Qué gusto verte!", "Te damos la bienvenida").
10. **Fit for Wren:** "Administrar facturación" (23 characters) on small buttons, the tip total line at 375px, and "/mes" vs "al mes".

## Not done or not resolved
- A native speaker still has to sign off the 425 [STRICT] lines (R2). That doesn't block the local build.
- Terms and Privacy pages are out of scope. Only the "Coming soon" / "(soon)" labels are translated.
- Stripe-hosted pages and receipts stay English (C5). Checkout locale es-419 is Owen's job (R7).
- I didn't check rendered layout. Wren does fit.
