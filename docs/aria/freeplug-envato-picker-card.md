# Decision card: "Pick a look" with Envato templates in Freeplug (rev 5)
> **APPROVED (Oct 12, 11:19 AM CT) for build of phases 1 to 4 (about 11 to 14 agent-days, est.).**
>
> **Standing rules for the build:**
> - Lina shortlists **at least 6 templates per business type across all 20 types**, and **approves every pick before any license is bought**.
> - The widen log and the weekly digest stay at **localhost:3000** (admin-only, not on any live URL).
> - **Arkitect** runs before changes and before handoff (see the Arkitect section).
> - **Delivery:** a review localhost plus a PR. **Nothing goes to main, goes live, or is purchased without Ezequiel's approval.**
> - Client-pasted ThemeForest templates are **still paid by the client** (in their own name; purchase code recorded).
> - **Current setup:** Ezequiel's **personal Envato account**. The Teams switch is **on hold**.
> - **Catalog refresh:** every **3 hours** (DECIDED). 6 hours remains Envato's maximum age, never the refresh cadence.
Revised 2026-10-12, 7:2x AM CT. Research only: nothing was built, bought, signed up for, or sent, and Envato was not contacted. All API calls were read-only GETs, and the token was never printed.

## Summary (plain English)
- **Market:** the business types are ranked from Census data for the San Antonio–Austin corridor (§6c). Each type needs at least 6 good templates (**approved Oct 12**).
- **STANDING RULE (Ezequiel, Oct 12, 2026): port 3000 is the permanent admin port on our computer.** All admin tooling, including the widen log at `localhost:3000/admin/templates/widen-log` and every future admin page, uses port 3000. Never change this without Ezequiel asking.
- **Licenses (approved Oct 12):** 72 After's Envato subscription funds template licenses; clients never buy templates themselves. The Envato API connection should pull templates from the subscription catalog. **Caveat to verify before build (UNVERIFIED):** an Envato subscription is Envato Elements, which is a separate catalog from ThemeForest (only a subset of ThemeForest items are on Elements), uses a per-project license (register each client site as its own project), and the public Envato API covers the ThemeForest marketplace, not Elements; an Elements catalog API may not exist. If so, the import must be limited to items confirmed on Elements, or the plan falls back to ThemeForest purchases. **Still OPEN and flagged:** who pays if a client switches templates after the license is bought (with Elements this may cost nothing extra beyond registering a new project, but it is undecided).
- **Two template paths (approved Oct 12):** (1) **Envato subscription templates** from the catalog (above). (2) **Client-pasted ThemeForest link**: a client may paste any ThemeForest item URL. The only requirement is that the team can use and integrate it into the site; it does not need to be in the Envato catalog or API, and a ThemeForest item bought and downloaded on its own is fine. The team reviews each pasted link before buying (buildable on our stack, mobile-first, room for Spanish, quote form, click-to-call), and it follows the same approve/reject flow. **OPEN:** who pays for a pasted ThemeForest item, since the subscription does not cover separate ThemeForest purchases.
- **Quinceañeras (Rio, Oct 12, /workspace/briefs/quinceanera-template-research.md):** no quinceañera-specific templates found (unconfirmed). For venue/planner businesses, use event/party-planner templates with a dedicated Quinceañeras page (Home, Quinceañeras, Packages, Gallery, Reviews, FAQ, About, Contact/Book a tour with call, text, WhatsApp). Wedding templates restyle well for packages, gallery, FAQ, RSVP; court, padrinos, traditions program and split Mass/reception RSVP must be built. Single-event "XV" sites are an optional extra only. Rio suggested full Spanish under /es/; the approved rule stays room for Spanish only unless Ezequiel changes it.
- **Target area (approved Oct 12):** San Antonio, New Braunfels, San Marcos, Kyle, Buda, Austin, and every town in between along the I-35 corridor (e.g. Schertz, Cibolo, Selma, Live Oak, Universal City, Converse, Garden Ridge, Seguin, Wimberley, Dripping Springs, Pflugerville, Round Rock, Georgetown). All of these sit inside the 6 counties already counted (Bexar, Comal, Guadalupe, Hays, Travis, Williamson), so the current ranking covers them. **Decided Oct 12:** rural areas count equally. No ZIP-level re-weighting; the full six-county business data stands as is.
- **The business type filters everything.** Clients, Lina in option A, and the team page opened from a request all see only templates that match the client's business type. The full list of about 12,650 templates is **background data only** (import and refresh). It is never shown in full. Looking wider means an explicit, **logged** "widen to general local business" step.
- **Clients choose how to pick:**
  - **(A) "Let 72 After pick for me"**: today's flow. Lina picks.
  - **(B) "I'll choose my own"**: the client browses and picks a template.
- **Recommendation:** in option B, clients browse **only shortlisted templates for their own business type**. If there are too few, they see general local-business templates alongside them first, and only if that is still not enough are they sent to option A (order **approved Oct 12**). The team always confirms the template fits before buying the license.
- Clients **do not get a license** by browsing. 72 After buys one Regular license for each client site.
- **Estimated effort:** about **11–14 agent-days (est.)** for phases 1–4. Running cost is about $0, plus the licenses we already buy.

## 1. Local-business categories (found with read-only calls today)
The counts come from the API's own `total_hits` and `aggregations.category` fields, read on 2026-10-12. Only ThemeForest's **HTML** (`site-templates`) and **WordPress** (`wordpress`) sections are included.

**Core (recommended):**
| Category path | Count |
|---|---|
| site-templates/corporate/business | 6,041 |
| site-templates/retail/health-beauty | 1,070 |
| site-templates/retail/food | 451 |
| site-templates/entertainment/restaurants-cafes | 254 |
| wordpress/corporate/business | 3,020 |
| wordpress/retail/health-beauty | 913 |
| wordpress/retail/food | 266 |
| wordpress/entertainment/restaurants-cafes | 242 |
| wordpress/real-estate | 208 |
| wordpress/corporate/directory-listings | 184 |
| **Core total** | **≈12,650** (an item may appear in more than one category; overlap is unverified) |

**Optional, to decide:**
| Category path | Count |
|---|---|
| site-templates/entertainment/events | 210 |
| wordpress/entertainment/events | 141 |
| wordpress/education | 322 |
| site-templates/entertainment/nightlife | 15 |
| wordpress/entertainment/nightlife | 21 |
| site-templates/retail/shopping | 706 |
| wordpress/retail/shopping | 36 |

**Section totals for context:** site-templates 24,871; wordpress 12,953; site-templates/corporate 7,969; site-templates/retail 3,713; wordpress/corporate 3,679; wordpress/retail 1,825.

**Niches with no category of their own:** trades, fitness, medical/dental, legal and auto have no ThemeForest category. They sit inside "business" or "health-beauty". We would tag them with keywords from the `tags` field, or Lina tags them by hand. Keyword matching is unverified for accuracy.

## 2. How to pull the full list
- **Endpoint:** `GET https://api.envato.com/v1/discovery/search/search/item?site=themeforest.net&category=<path>&page_size=100&page=N`
- **Each result includes:** id, name, url, classification, price_cents, rating (rating_count is shown on item detail), number_of_sales, published_at, updated_at, tags, previews/image_urls, author_username.
- **Paging:** `links.next_page_url` and `links.last_page_url` are provided. `page_size=100` worked (100 items came back).
- **Paging limit (observed):** the last page never goes past **60**. That caps each query at about 6,000 items (60 × 100). For example, site-templates/corporate has 7,969 items, but its last page was still 60. **`site-templates/corporate/business` (6,041) goes over this cap**, so it must be split into smaller queries, for example by sort order or date range. Which split parameters work is **UNVERIFIED** and needs testing.
- **Import size:** about 130–140 pages for the core set.

## 3. Slow first import, polite pace
- Envato doesn't publish its rate limits ("dynamic", https://build.envato.com/api/). I saw no rate-limit headers in about 11 calls today.
- **One worker, one request at a time, about one call every 3–5 seconds.** The core import should take roughly 10–12 minutes.
- **On a 429:** wait `Retry-After` seconds, then back off further (×2 each time, up to 10 minutes), then resume from the saved page. Store the last page reached in D1 so the import can restart where it stopped.
- Keep each Cron run short and process pages in chunks, because Workers have CPU and time limits. Cloudflare Queues could handle the chunks, but that is optional.
- Send a `User-Agent` that names Freeplug. **Send no client data.**

## 4. Automatic refresh (≤6 h old, per Envato Terms (f))
- **Cron Trigger every 3 hours.** A full core refresh is about 140 calls, so 8 runs a day means about 1,100 calls a day. This is a polite load, but it's unknown how Envato will treat it (**UNVERIFIED**).
- **Store in Cloudflare D1** (SQL, filterable), table `envato_items`:
  - `id`, `category`, `platform` (html/wp), `name`, `price_cents`, `rating`, `rating_count`, `sales`, `updated_at`, `preview_url`, `tags`, `last_seen_at`, `status` (active/removed)
  - KV is a poor fit for filtering 12,000 rows. Supabase would also work, but D1 keeps Envato data next to the Worker.
- **Mark removed items:** after a full pass, any item not seen in that pass gets `status=removed`. Hide it everywhere and show it as "no longer available" if it was shortlisted or chosen.
- **Refresh cadence is every 3 hours (DECIDED Oct 12).** **6-hour safety check (Envato's maximum, not the cadence):** the app hides any row with `last_seen_at` older than 6 hours. If the refresh fails, we show "temporarily unavailable" rather than stale data.
- **Images:** we don't store them. Load Envato's preview URLs directly (lazy-loaded).
- **The shortlist and client choices stay in Supabase**, because they are our own data.

## 5. Team page filters (`/admin/templates`)
**Rev 4 rule: the team page never shows the whole catalog.**
- **Opened from a client's request** (`/admin/templates?request=<id>`): locked by default to that request's `business_type`. This covers option A, where Lina picks for the client, and reviewing an option B pick.
- **Opened on its own** (shortlist upkeep): Lina must pick one niche first. There is no "all" view.
- **Widen to general local business:** a button that also shows `general`/`other_local` items, never the whole catalog. Each use writes a row to a Supabase `template_widen_log` table (request_id, user, reason, time). A reason is required.
- **Server enforced:** the admin API route needs a niche, or a request id it can read the niche from. It refuses unfiltered queries.
- The filters below then apply within that niche.

- **Filters:** category (from the list above), HTML or WordPress, price range, minimum rating, sales, updated date (e.g. "updated in last 12 months"), keyword/tag, niche tag
- **Sort options:** sales, rating, newest, recently updated
- **Shortlist toggle on each card:** writes to the Supabase `template_shortlist` table (envato_item_id, niche, note, added_by). Only shortlisted, active items reach the client view.
- Show the "Powered by Envato API" logo (Terms §15) on the team page and the client page.

## 6. Client choice: (A) team picks vs. (B) I'll choose
**Recommendation: option B browses the shortlist only.**
| | Shortlist (recommended) | Full list (~12,650) |
|---|---|---|
| Client experience | Quick, and every option is good | Overwhelming, and many poor or old templates |
| Fit with 72 After | Only templates the team can build well | Picks that are often rejected, so more back-and-forth |
| Load and rules | Small, cached set | Bigger load and more 6-hour exposure |
| Downside | Less choice | — |

Option: a client who finds a template elsewhere can paste a ThemeForest link. The team then reviews it (phase 4, optional).

**After a client picks (B):**
1. The request is saved with the template marked "pending team review". The client sees: "We'll confirm this fits your business. No license is bought yet, and browsing doesn't give you one."
2. Lina checks that it fits the niche, is still for sale, is updated, and that the license type is right. Then she either **approves** it, which means 72 After buys a Regular license for that client site, or **suggests an alternative** with a note.
3. The client is notified of the outcome. Notification wording would be drafted later, and nothing is sent in this research.

**Where the choice is stored** (`website_requests` table in Supabase; new columns, proposed):
| Column | Purpose |
|---|---|
| `template_choice` | enum `team` \| `client` (default `team`) |
| `envato_item_id` | bigint, null until chosen |
| `template_status` | enum `none` \| `pending_review` \| `approved` \| `rejected` \| `licensed` |
| `template_review_note` | text |
| `template_chosen_at`, `template_reviewed_by` | When it was chosen and who reviewed it |

These columns need row-level security (RLS): a client may set only `template_choice` and `envato_item_id` on their own request while its status is `none`/`pending_review`/`rejected`. Only the team or service role sets `approved`/`licensed`.

**Switching options later:**
- A client can switch A↔B at any time **until the license is bought** (`template_status` ≠ `licensed`).
- Switching to A clears `envato_item_id`.
- After the license is bought, a switch becomes a change request handled by the team, because a new template means a new license cost. It also needs a rule on who pays (a question for Ezequiel).

**Placement:**
- The choice goes in `/dashboard/request-website`, with a status card on `/dashboard/website`.
- Pending picks appear in `/admin/requests`.

## 6b. Business type filters every view (rev 3–4)
**Where the business type comes from:** the repo has **no existing field** for it. I searched `src/` and `supabase/migrations` for business_type, industry and niche and found nothing. `website_requests` has only `business_name`, `contact_phone`, `google_business_url`, `notes` and `status`, and `profiles` has none either.
- **Proposal:** add a **required** column `website_requests.business_type`, an enum from the fixed list below. The client picks it in `/dashboard/request-website` before choosing A or B.
- The team can correct it in `/admin/requests`.
- Existing requests stay null, and the team fills them in.

**Fixed niche list and how each maps to Envato:** Category paths were checked today. The tag and keyword rules are proposals, and their accuracy is **UNVERIFIED**.
Rev 5: the niche list was rebuilt for the San Antonio–Austin corridor. See §6c for the list and its Envato mapping.

(`*` = both `site-templates` and `wordpress`.)

**How niche tags get set:**
- **Automatic tags:** when the refresh runs, each `envato_items` row gets `auto_niches[]` from the rules above.
- **Lina's tags (also the safety net if a template is in the wrong niche):** on the team page she can add or remove niches for each template. These go in Supabase `template_shortlist.niches[]`, and **her tags always override the automatic ones**.
- A template can belong to more than one niche. Only Lina's final tags on shortlisted templates reach clients.

**What option B shows:**
- Shortlisted, active templates where `niches` contains the client's `business_type`.
- **APPROVED by Ezequiel, Oct 12, 2026: each business type needs at least 6 good templates.**
  - **Under 6 dedicated (shortlisted) matches:** the client also sees general local-business templates (shortlisted items Lina tags `general`), labeled "Also suits most local businesses".
  - **Still under 6 in total:** option B is hidden, and the client is routed to "Let 72 After pick for me" (`template_choice=team`).
- The same minimum of 6 is used in the coverage check (§6c).
- The server enforces this, so a client cannot fetch other niches by editing the request. The API route reads `business_type` from their own request and ignores any niche sent from the browser.
- If a client changes their business type, any pick that hasn't been licensed yet is cleared.

**Option A uses the same filter:** when Lina picks for a client, she starts from that client's niche on the team page. Widening is the logged step in §5. When the team is choosing for the client, the client never sees templates.

**The full catalog (D1 `envato_items`)** is used only by the import and refresh job and to compute niche tags. No screen lists it unfiltered.

**Team page addition:** a niche picker (required) and a coverage counter (shortlisted per niche, with a warning under 6), so Lina can see where the gaps are.

## 6c. San Antonio–Austin corridor market (rev 5)
**Area:** Bexar, Comal, Guadalupe, Hays, Travis and Williamson counties, plus nearby areas. San Marcos (Hays County) is the home base.

**Source:**
- U.S. Census Bureau, County Business Patterns **2023**, county file `cbp23co.zip` (https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip). Downloaded and summed for the 6 counties on 2026-10-12.
- The Census API now needs a key, so the bulk file was used instead.
- **Caveats:**
  - CBP counts only businesses with employees. Solo operators (many trades, cleaners, pet sitters, food trucks) are **not counted**, so those niches are under-ranked (**UNVERIFIED** size of the gap; the Census Nonemployer Statistics were not pulled).
  - The "nearby areas" outside the 6 counties are not counted.
  - Mapping NAICS codes to niches is my own judgment.

**Ranked niches by establishments (6 counties; Hays in brackets):**
| # | Niche | NAICS (CBP 2023 establishments) | Total |
|---|---|---|---|
| 1 | Restaurants (incl. Tex-Mex) | 722513 limited-service 3,717 [198]; 722511 full-service 3,352 [145] | 7,069 |
| 2 | Medical clinics | 621111 physicians 3,489 [133]; 621340 therapy 611; 621310 chiropractors 455; 621320 optometrists 338 | 4,893 |
| 3 | Plumbing, HVAC & electrical | 238220 plumbing/HVAC 1,429 [111]; 238210 electrical 1,064 [83] | 2,493 |
| 4 | Real estate | 531210 agents 2,794 [166] | 2,794 |
| 5 | Legal | 541110 lawyers 2,631 [64] | 2,631 |
| 6 | Home remodel, roofing & painting | 236118 remodelers 1,236; 238160 roofing 398 [21]; 238320 painting 319 | 1,953 |
| 7 | Dental | 621210 dentists 1,941 [78] | 1,941 |
| 8 | Salon, barber & nails | 812112 beauty 1,256 [50]; 812113 nails 408; 812111 barbers 128 | 1,792 |
| 9 | Insurance & tax offices | 524210 insurance 1,803 [81]; 541213 tax prep 371 | 2,174 (optional niche) |
| 10 | Churches | 813110 religious orgs 1,708 [94] | 1,708 |
| 11 | Auto repair, body & car wash | 811111 repair 906 [66]; 811121 body 432; 811192 car wash 299 | 1,637 |
| 12 | Landscaping & lawn | 561730 1,038 [68] | 1,038 |
| 13 | Child care | 624410 905 [52] | 905 |
| 14 | Pet care & vet | 541940 vets 516; 812910 pet care 423 | 939 |
| 15 | Cleaning & pest control | 561720 janitorial 746; 561710 pest 241; 561740 carpet 86 | 1,073 |
| 16 | Fitness | 713940 716 [44]; 611620 sports instruction 370 | 1,086 |
| 17 | Event venues & party (weddings, quinceañeras) | 531120 nonresidential lessors 525 (includes many non-venues); 812990 other personal services 437 | ≈ (**UNVERIFIED**: no clean NAICS code) |
| 18 | Food trucks | 722330 mobile food 401 [28] | 401 |

Order is roughly by total. I listed some split niches separately where Ezequiel asked for them, even though they're smaller. Counts are establishments, not businesses that need a website.

**APPROVED by Ezequiel, Oct 12, 2026: this 20-type list is the current business-type list; it replaces the earlier 9-type list.**

**Revised niche list (`business_type`) and how each maps to Envato** (`*` = site-templates and wordpress; keywords match `tags`/`name`):
| business_type | Envato categories | Keywords |
|---|---|---|
| restaurant_texmex | */entertainment/restaurants-cafes, */retail/food | restaurant, mexican, taqueria, tex-mex, bbq, cafe, bakery |
| food_truck | */retail/food, */entertainment/restaurants-cafes | food truck, street food, catering |
| medical_clinic | */retail/health-beauty, */corporate/business | medical, clinic, doctor, chiropractor, physiotherapy, optometrist |
| dental | */retail/health-beauty | dental, dentist, orthodontist |
| hvac | */corporate/business | hvac, air conditioning, heating, ac repair |
| plumbing_electrical | */corporate/business | plumber, plumbing, electrician, electrical |
| roofing_remodel | */corporate/business | roofing, roofer, construction, remodel, renovation, painting |
| landscaping_lawn | */corporate/business | landscaping, lawn, garden, tree service |
| cleaning | */corporate/business | cleaning service, maid, janitorial, pest control, carpet cleaning |
| auto_repair | */corporate/business, */retail/shopping | auto repair, mechanic, car service, body shop, car wash |
| salon_barber | */retail/health-beauty | salon, barber, nail, hair, spa |
| fitness | */retail/health-beauty, */corporate/business | gym, fitness, yoga, crossfit, martial arts |
| legal | */corporate/business | lawyer, attorney, law firm |
| real_estate | wordpress/real-estate, */corporate/business | real estate, realtor, property |
| insurance_tax | */corporate/business | insurance, tax, accounting |
| church | */nonprofit, */corporate/business | church, ministry, worship |
| child_care | */corporate/business, */nonprofit | child care, daycare, kindergarten, preschool |
| pet_care | */corporate/business, */retail/shopping | pet, veterinary, grooming, dog |
| event_venue | */entertainment/events | event venue, wedding, quinceañera, party, banquet |
| other_local | */corporate/business | — (general set only) |

**Lina's tags:** these always override the automatic keyword tags. Lina can also add a `corridor_fit` flag (below) and the `general` tag.

**Templates aren't location-based.** Coverage means every common corridor niche has enough good templates. A template counts as a good fit (Lina checks this before shortlisting) if it:
- has a bilingual-friendly layout, with room for longer Spanish text and no text baked into images, so Spanish can be added later without a redesign (**APPROVED Oct 12: room for Spanish only, no full Spanish versions required**, for cost and scaling across all price tiers);
- is mobile-first;
- has a prominent click-to-call / tap-to-text button;
- has a quote or appointment form;
- has a spot for a Google Map and service area, and for reviews.

**Shortlist target (APPROVED minimum of 6):** at least **6 shortlisted templates per niche**. The goal is 8–10 for the top 8 niches.

**Coverage check:** raw ThemeForest keyword hits from read-only searches on 2026-10-12, HTML + WordPress only (Elementor kits excluded). Keyword hits are broad: they include templates that only mention the word, so the number of truly dedicated templates is lower (**UNVERIFIED**).
| Niche | Keyword | HTML | WP | Status vs. min 6 |
|---|---|---|---|---|
| Restaurants | restaurant | 1,161 | 716 | OK |
| Tex-Mex | mexican restaurant | 37 | 12 | **THIN**: few truly Mexican-themed templates; plan to restyle general restaurant templates |
| Food trucks | food truck | 17 | 28 | **THIN** (fewer than 50 hits; dedicated ones likely under 15) |
| Medical | medical | 1,150 | 840 | OK |
| Dental | dental | 320 | 165 | OK |
| HVAC | hvac | 42 | 48 | **THIN** (plan to reuse plumbing/electrical templates) |
| Plumbing | plumber | 412 | 244 | OK |
| Electrical | electrician | 404 | 217 | OK |
| Roofing | roofing | 175 | 128 | OK |
| Landscaping | landscaping | 214 | 196 | OK |
| Cleaning | cleaning | 13,298 | 3,602 | OK, but the number is **unreliable** ("clean" design matches); real count unknown |
| Auto repair | auto repair | 207 | 181 | OK |
| Car wash | car wash | 143 | 105 | OK |
| Salon | salon | 257 | 327 | OK |
| Barber | barber | 126 | 113 | OK |
| Legal | lawyer | 445 | 287 | OK |
| Real estate | real estate | 1,038 | 381 | OK |
| Fitness | fitness | 2,410 | 1,342 | OK |
| Church | church | 228 | 211 | OK |
| Insurance/tax | insurance | 946 | 527 | OK |
| Child care | child care | 72 | 95 | Watch (enough hits, but quality is unknown) |
| Pet care | pet care | 93 | 90 | Watch |
| Veterinary | veterinary | 100 | 96 | OK |
| Event venues | event venue | 42 | 52 | **THIN** |
| Quinceañeras | quinceanera | 0 | 0 | **NONE**: use wedding/event templates (wedding: 416 HTML, 285 WP) restyled by Lina |

**Thin niches to watch:**
- **Thin:** Tex-Mex, food trucks, HVAC, event venues and quinceañeras.
- **Watch:** child care and pet care.

For thin niches, Lina may shortlist close matches, for example plumbing templates for HVAC and wedding templates for quinceañeras. If she still can't reach 6, the approved fallback applies: general templates are added, then the client is routed to option A.

## 7. Terms and licensing (rev 1; **superseded where it differs by "Envato terms check (Oct 12)" below**, especially Regular vs. Extended for hosted sites; sources: https://build.envato.com/terms/, https://build.envato.com/api/, Envato Affiliate Terms help article 42293429394329)
- Personal tokens are for public data. Showing that data to clients is not explicitly addressed (**UNVERIFIED**). Registering an app is the safer route.
- The "Powered by Envato API" logo is required.
- Don't show item info or images more than 6 hours older than on Envato Market.
- **Licenses:**
  - **Regular:** one end product, with end users not charged. This fits local sites.
  - **Extended:** needed when end users are charged.
  - 72 After buys one license for each client site. **Partly UNVERIFIED**, including whether a hosting subscription affects this.
- **Affiliate:** don't join for now. Clients don't buy the template themselves.

## 8. Security (unchanged in spirit)
- The token is a Worker secret, used only in the Cron worker and server routes. It is never sent to the browser or written to logs.
- Validate all filter inputs against allow-lists and ranges.
- Send no client details to Envato.
- The team page sits behind the existing admin check.
- **Website data (`website_requests`):** clients reach D1 data only through a server route that returns shortlisted items.

## 9. Phases (est. = agent-days, estimates)
| Phase | What | Est. |
|---|---|---|
| 0 | Ezequiel answers questions; test how to get past the 60-page cap; optional app registration with Envato (needs his OK) | 0.5 |
| 1 | D1 `envato_items`, Cron import and refresh, polite pacing and 429 backoff, removed-item marking, 6-hour check | 2.5–3 |
| 2 | `/admin/templates` niche-locked views (from a request or a chosen niche), filters, Shortlist toggle (Supabase `template_shortlist`), logged widen step (`template_widen_log`), server refuses unfiltered queries | 2.5 |
| 2b | Corridor niche list (20 types), `business_type` column (required pick), auto-niche keyword rules, Lina's niche, `general` and `corridor_fit` tags, coverage counter against the min of 6 | 2–2.5 |
| 2c | Lina builds the first shortlist (6–10 per niche, checked for corridor fit). This is team time, not build time; the build only supports it | team est. 2–3 days |
| 3 | Client A/B choice in `/dashboard/request-website`, niche-filtered shortlist with general fallback and route to A, `website_requests` columns and RLS, status card, switching rules | 2.5–3 |
| 4 | Team review in `/admin/requests` (approve, suggest alternative, mark licensed) and notifications (drafts only until approved) | 1–1.5 |
| 5 (optional) | "Paste a ThemeForest link" for option B | 1 |
| **Total** | Phases 1–4 | **≈11–14 (est.)** |

**Costs:**
- API: free.
- D1 and Cron: the free tier or the current Workers paid plan should cover it (**UNVERIFIED** against the current plan).
- Licenses: one Regular license for each site, as today.

## 10. Risks
- **Polling volume:** about 1,100 calls a day could trip Envato's unpublished limits. If it does, we fall back to "temporarily unavailable" and slow down.
- **The 60-page cap** may hide part of the "business" category until splitting is solved.
- **Unclear terms:** the terms may not allow a personal token for a client-facing feature.
- **Removed items:** a shortlisted template can be pulled from sale.
- **License confusion:** clients may believe they own a license.
- **Envato changes:** search API fields or categories could change.

## 11. Questions for Ezequiel
1. Within the client's niche, should option B show only shortlisted templates (recommended) or every template in that niche?
2. ~~Register an Envato app?~~ DECIDED Oct 12: 72 After may **register an app with Envato** instead of using the personal token. Registration needs **Ezequiel to sign in himself** (agents don't sign in or register).
3. ~~Who pays for a switch after licensing?~~ DECIDED Oct 12: **the client pays for the new license** if they switch templates after the license is bought.
4. ~~License cost as its own line?~~ DECIDED Oct 12: the license cost is **built into the plan price**, not shown as a separate line.
5. ~~Refresh cadence?~~ DECIDED Oct 12: the catalog **refreshes every 3 hours**. 6 hours stays Envato's maximum age, not the cadence.
6. Should clients be able to paste a link to a template that isn't shortlisted (phase 5)? (Who pays is DECIDED; see below.)
7. ~~Is the 20-type list right?~~ DECIDED Oct 12: the 20-type corridor list in §6c is APPROVED as the current list (insurance/tax and food trucks stay separate). It replaces the earlier 9-type list.
9. ~~Clients widen?~~ DECIDED Oct 12: yes, clients can widen too (option B). For clients it adds the general local-business templates only, never the whole catalog; the reason is a quick pick from a short list (e.g. "None fit my style", "My business type isn't listed right", "Other"), and every use is logged the same way.
9. Should widening also be allowed for clients, or only for the team? (Proposed: team only.)
10. ~~Who can widen~~ DECIDED Oct 12: anyone on the team (any admin/team account), regardless of headcount (35 to 100+ in the scaling plan). Weekly digest: **APPROVED Oct 12** (one weekly summary of all presses: who, which client, reason).
11. ~~Full Spanish or room for Spanish?~~ DECIDED Oct 12: room for Spanish text only, not full Spanish versions, for cost and scaling across all price tiers (under $50 and up). Templates must have flexible layouts and space so Spanish can be added later without a redesign.
12. ~~Restyle close matches for thin niches?~~ DECIDED Oct 12: yes, 72 After may **restyle close-match templates** for Tex-Mex, food trucks, HVAC, event venues and quinceañeras.

**Decided (Ezequiel, Oct 12, 2026), pasted ThemeForest items:** the client buys the license themselves, in their own name. 72 After doesn't cover it and records the client's purchase code on the request (`market_purchase_code`, `license_holder=client`). The Envato subscription covers only templates pulled through the subscription.

**Decided (APPROVED by Ezequiel, Oct 12, 2026):** at least 6 templates for each business type. Under 6 dedicated matches, general local-business templates are added. If that is still under 6, the client is routed to "Let 72 After pick for me". **Order approved by Ezequiel, Oct 12, 2026:** general templates are shown alongside the dedicated ones FIRST; routing to "Let 72 After pick for me" happens only if the widened list is still under 6. This is decided, not an open question.

**Decided (APPROVED by Ezequiel, Oct 12, 2026): widen rules.** The team page always opens to one business type and never shows the whole catalog. The widen button only adds general local-business templates to the view. Every use requires a reason and is logged (who, which request, reason, time) in `template_widen_log` so the team can review it. Who can widen: **anyone on the team, approved Oct 12** (headcount does not matter, 35 to 100+). Clients can widen too: **approved Oct 12** (general templates only, quick reason pick, logged). Weekly digest: **approved Oct 12** (one summary a week of all presses: who, which client, reason; reads `template_widen_log`, starts once the feature is live). **Access (approved Oct 12):** the digest and the widen log are admin-only and viewable only on localhost on our computer (the box), not on the public site and not exposed on any live URL. **Port:** the page is not built yet, so it has no port today. Planned location: the existing Freeplug review server on our computer, `http://localhost:3000/admin/templates/widen-log` (admin login required).

## Envato terms check (Oct 12)
**Method:** I read the public pages on 2026-10-12. The API terms and docs, plus the ThemeForest license pages, were fetched with curl. The Elements pages blocked curl with a 403, so I read them through the web fetch tool. Quotes are exact. I didn't contact Envato, sign up for anything, or browse templates. **This is not legal advice.**

**Sources:**
- [A] API Terms: https://build.envato.com/terms/
- [B] API docs: https://build.envato.com/api/
- [C] Elements License (revised Oct 6, 2026): https://elements.envato.com/license-terms
- [D] Elements User Terms (revised Sep 2, 2026): https://elements.envato.com/user-terms
- [E] Market Regular License (revised Mar 11, 2025): https://themeforest.net/licenses/terms/regular
- [F] Market Extended License: https://themeforest.net/licenses/terms/extended
- [G] Market Licensing FAQ: https://themeforest.net/licenses/faq

**Mismatch to fix first:** 72 After's **Elements subscription** and the **ThemeForest (Market) catalog** are two different products with different licenses.
- The API covers Market: [A] is titled for Envato Market, and [B] lists "Envato Market Catalog". The Elements terms [D] limit automated and API access.
- So if the picker shows ThemeForest items, each one must be **bought on ThemeForest**, unless the same item is also on Elements and is licensed there instead.
- The search API returns a `saleable_on_elements` field, which looked like a per-item flag (observed in today's API calls). Whether it reliably means "available in our Elements subscription" is **UNVERIFIED**.

### Q1. API terms: may a personal token power a feature that third parties see?
**Quotes:**
- [B] "It may be that your app doesn't require to assume the role of a third-party user to access the Envato API - for example, if your app just accesses public data, such as performing searches for items on Envato Market. In this situation, rather than the complication of implementing OAuth … you can simply generate a personal token…"
- [B] "If you're not going to build an app that requires useres to log in, and want to access the API directly yourself, you can simply create a personal token."
- [A] "API Key required: All your Applications must be registered with us and you will require an API Key to access any part of the API."
- [A] "Your use of information: Some of the information that can be accessed through use of the API is publicly available information, which you can generally get through the use of a personal token."
- [A] Restrictions: "share your API Key with anyone else, or use someone else's key to access the API;"
- [A] Restrictions: "cache or store any information or content other than for reasonable periods and in order to develop and provide your Application or display item information or product information and/or related images which are more than six (6) hours older than they are on Envato Market (as this could be misleading to Users);"
- [A] Restrictions: "use any data mining, robots, or other similar data and/or image gathering and extraction methods in connection with the API or Envato Market, or the Items available on Envato Market;"
- [A] "Attribution: All your Applications must acknowledge your use of the API, and we require that you give us a shout-out by including the "Powered by Envato API" logo in the Application."
- [A] "You can't however include the word 'Envato' or its logos in the Application name itself. We do not endorse your Application … so please don't suggest we made it, have any endorsement, partnership, sponsorship or association with it, or that it's official in any way."
- [A] "Commercial use: You may want to charge people a fee to use your Application. It's okay if you do… All paid Applications must be made available for purchase through CodeCanyon…"
- [A] "Use of your data: By using the API, you grant Envato a non-exclusive, royalty-free, perpetual, and worldwide right to collect, analyse, and utilise data derived from your use of the API for its own commercial purposes."
- [A] Definitions: "Third Party Content: all Member or other third party generated material, like items, usernames, email addresses, product descriptions, avatars, and related images or information made available as part of the API."

**Verdict: ALLOWED WITH CONDITIONS, with one UNCLEAR point.**
- **Public catalog data:** using the token to search Market items is the use the docs describe for personal tokens.
- **The unclear point:** [A] says "All your Applications must be registered", while [B] says a personal token is for accessing the API "directly yourself". A client-facing feature is arguably an "Application", so **registering the app** (a free form at build.envato.com) is the safe reading. Whether a personal token alone is enough is **UNCLEAR**.
- **Conditions:**
  - Show the "Powered by Envato API" logo, and don't use "Envato" in the feature's name or imply endorsement.
  - Never show data or images more than 6 hours older than on Envato Market.
  - Never share the token.
  - **Bulk import:** the full-catalog import should stay a modest, rate-respecting API use. Whether a bulk import of about 12,650 items could count as "data mining … extraction" is **UNCLEAR**.
  - **Commercial-use rule:** this only applies if we charge a fee "to use your Application". Freeplug charges for hosting, not for the picker, so this probably doesn't apply (**UNVERIFIED** interpretation).
  - **Images:** the terms have no hotlinking rule. Item images are "Third Party Content", and the 6-hour rule covers "related images". Show previews only as API-provided links, never as downloaded or re-hosted copies (**UNVERIFIED** that hotlinking is approved).

### Q2. Elements license and user terms
**Quotes:**
- [C] §4: "When you download an Item, a license is created. This license grants you a non-exclusive, commercial, worldwide and revocable right to use the Item for: a. Use for a Specific Project - use of the Item in one project to create a specific End Product… To license and use an Item, you must have a valid and active subscription for Envato Elements. If you want to use the same Item for separate projects, you will need to create a new license for each end-use."
- [C] §6a: "for an Item that is a template, the End Product is a customized implementation of the Item;"
- [C] §8: "the license is only valid if you complete the End Product while your subscription is active. Once the Item has been incorporated into a completed End Product during an active subscription term, the license becomes perpetual, which means that it continues for the life of the End Product, even after your subscription ends. If you cancel your subscription and have not completed your End Product, the license for the Item is terminated…"
- [C] §10a(i): "You can use an Item to create an End Product for yourself or for a client of yours. If you use an Item to create an End Product for a client, then you can transfer the final End Product to your client as long as you have followed the requirements in sections 5 and 6 and your subscription remains active."
- [C] §10a(ii): "If you transfer an End Product to a client, you do so by sublicensing these license rights… It is important that you inform your client of the conditions of this Elements License and the sublicense. If you or your client wishes to use the same Item for another project, a new license must be created for that separate project."
- [C] §12a: "You can't use an Item to create an End Product after your Envato Elements subscription ends."
- [C] §12c: "You can't use an Item in any application allowing an end user to customize a digital or physical product to their specific needs, such as an "on demand", "made to order" or "build it yourself" application."
- [D] §14b: "access Envato Elements or its content through any unauthorized means, including through scripts, bots, automated tools, APIs not authorised or made available by Envato…"
- [D] §14d: "use Envato Elements to provide, or incorporate the matters contemplated by Envato Elements into, any product or service provided to a third party;"
- [D] §14h: "copy, republish, frame, link to, download, transmit, modify, adapt, … distribute, display … any part of Envato Elements (including any component of the website) or any Envato Intellectual Property;"
- [D] §14m: "…using any means whatsoever to scrape/download the entire library and/or database of Envato Assets from Envato Elements"
- [D] §44: "Preview files … No rights or license is are granted … to use preview files for any other purposes, and you are not permitted to use preview files in any End Product."
- [D] §60: after cancellation you cannot "use any Items as part of new project or unfinished End Product (even if you have downloaded the Item prior to cancellation)"

**Verdicts:**
- **Building a client site with an Elements template: ALLOWED WITH CONDITIONS.**
  - One license (a "registered project") for each client site.
  - Finish the site while the subscription is active.
  - Tell the client the license conditions, since the client gets a sublicense limited to using the site.
- **Client as end user / transfer: ALLOWED WITH CONDITIONS** (§10a). Note the wording "and your subscription remains active". It conflicts with §8's perpetual license, so it's **UNCLEAR** whether a transfer after cancellation is covered. Transfer while subscribed.
- **After cancellation: ALLOWED** for completed sites, which stay licensed "for the life of the End Product". **NOT ALLOWED** for unfinished sites or new ones.
- **One item for many clients: ALLOWED ONLY WITH A NEW LICENSE FOR EACH CLIENT/PROJECT.** Each license is a fresh registration, at no extra cost within the subscription (cost **UNVERIFIED**).
- **Elements catalog through the public API: NOT AVAILABLE / NOT ALLOWED.** The API docs [B] list only the Envato Market catalog. I found no Elements endpoint (**UNVERIFIED** that none exists privately). [D] §14b/d/h/m forbids automated access, showing Elements content to third parties, and scraping. **Don't build the picker on the Elements catalog.**
- **Freeplug's hosting model and clause 12c:** the "build it yourself" ban (and Market Regular clause 9) is a risk only if clients customize the template themselves. Here, 72 After builds each site by hand, so it's likely fine (**UNVERIFIED** interpretation).

### Q3. ThemeForest (Market) Regular vs. Extended
**Quotes:**
- [E] §2: "You are licensed to use the Item to create one single End Product for yourself or for one client (a "single application"), and the End Product can be distributed for Free."
- [E] §3a: "For an Item that is a template, the End Product is a customised implementation of the Item. For example: the item is a website theme and the end product is the final website customised with your content."
- [E] §4: "You can create one End Product for a client, and you can transfer that single End Product to your client for any fee. This license is then transferred to your client."
- [E] §7: "You can't Sell the End Product, except to one client. (If you or your client want to Sell the End Product, you will need the Extended License.)"
- [E] §8 example: "You can't purchase an HTML template, convert it to a WordPress theme and sell or give it to more than one client."
- [E] §9: "You can't use the Item in any application allowing an end user to customise a digital or physical product to their specific needs, such as an "on demand", "made to order" or "build it yourself" application… Examples …: website builders…"
- [E] Definitions, **Free**: "No fee is paid by the end user to access the End Product. The End Product is not sold. No fee is paid to subscribe to a service that includes the End Product (eg a website subscription fee)."
- [E] Definitions, **Sell**: "Sell, license, sub-license or distribute for any type of fee or charge."
- [F] §2: "…one single End Product for yourself or for one client (a "single application"), and the End Product may be Sold." [F] §4: "You can create the End Product for a client, and this license is then transferred from you to your client."
- [G] "I'm a freelancer/agency. Can I use the item for an end product I'm doing for a client? Yes. You're essentially buying the file on your client's behalf. Whether a regular or Extended License is needed will depend on your client's use of the end product. With both the regular and Extended License you are allowed to charge your client for creating the End Product. Once you transfer the end product to the client …, be sure to link your client to our licenses and delete the item itself from your computer."
- [G] "Is my license transferable? Generally, your license is not transferable. There are a few exceptions: If you are a freelancer / agency using the item for a single end product for one client. The license would in effect be transferred to the client."
- [G] "Can I use a website template or theme in a website hosting service where my customers can customize and create their own websites? Please contact us through Support…"
- [G] "I have a paid service where users can customize their own web pages… You need the Extended License, because your users are charged to access your service."
- [G] "You would need one license per unique end product and for each different client."

**Verdicts:**
- **Buy a template and build a client site: ALLOWED** [E §2, §4; G].
  - **Who buys:** 72 After buys it ("on your client's behalf"), and the license transfers to the client.
  - **One license per end product and per client:** YES [E §2, §8; G].
- **Hosted subscription (Freeplug's monthly hosting): UNCLEAR, and leaning toward needing Extended or written confirmation.**
  - The Regular definition of "Free" says "No fee is paid to subscribe to a service that includes the End Product (eg a website subscription fee)." Freeplug's monthly hosting plan is plausibly "a service that includes the End Product".
  - **Counter-reading:** the client is the licensee, not the "end user". §4/§7 allow selling the End Product to one client "for any fee", and the site's visitors pay nothing.
  - **Until Envato confirms in writing,** treat Freeplug-hosted sites as needing the **Extended** license, or bill the build as a one-time fee separate from hosting and get confirmation.
- **(Superseded by Ezequiel's Oct 12 ruling: the client buys the license in their own name.)** **Client pastes a ThemeForest link: ALLOWED WITH CONDITIONS.**
  - 72 After buys a separate license for that client's site, through 72 After's account and in its name, "on your client's behalf".
  - The license then "in effect" transfers to the client.
  - Lina must check the item's license type (Regular vs. Extended) and any third-party or GPL parts [E §13–14].
- **Transfer to client: ALLOWED** for the single End Product [E §4; F §4; G]. On handoff, give the client the license links and delete the item files from 72 After's machines [G].
- **Website builder risk (clause 9):** ALLOWED as long as 72 After builds each site. It would **NOT be allowed** without a license per site if clients could build or customize templates themselves in Freeplug.

### Conditions summary for the card
1. Register the app and show the "Powered by Envato API" logo. Keep "Envato" out of the feature name.
2. Data and images no more than 6 hours old. Hotlink previews only, never re-host.
3. The picker shows **Market (ThemeForest)** data only. Never pull or show the Elements catalog.
4. **One license per client site.** For a Market item, 72 After buys it on the client's behalf. For an Elements item, register a new project and finish the site while subscribed.
5. Decide Regular vs. Extended for Freeplug-hosted sites with Envato in writing. Until then, budget for Extended, or keep the build fee separate from the hosting subscription (**UNCLEAR**).
6. Clients pick; 72 After builds. No client self-customization of templates (Market §9 / Elements §12c).
7. At handoff, link the client to the license terms (Market FAQ; Elements §10a(ii)).

### Unverified / unclear from this check
- Whether a personal token is enough for a client-facing feature, or app registration is required.
- Whether a bulk import counts as "data mining".
- Whether showing Envato's preview images directly (hotlinking) is approved.
- Whether Freeplug hosting means Extended is needed.
- Whether an Elements transfer is valid after cancellation (§10a vs. §8).
- What `saleable_on_elements` means, and whether a matching Elements item can be licensed through the subscription.
- Whether any Elements API exists.
- My reading of the commercial-use rule.

## Cheapest options (Oct 12)
**DECIDED (Ezequiel, Oct 12): stay on the personal account for now.** Don't switch to Elements Teams yet. Ezequiel keeps his **personal Envato account** active ($60/mo Plus normal, $30/mo fallback), paid out of pocket until more personal income comes in. This is the **current setup**.

**Research only.** I didn't pick templates, write copy, code, buy anything, or contact anyone.
**Sources:**
- Elements pricing page: https://elements.envato.com/pricing (fetched Oct 12)
- 21 read-only Envato API searches on ThemeForest, sorted by sales, top 100 per search, token never printed
- The terms check above

**DECIDED (Ezequiel, Oct 12): who pays for a client-pasted ThemeForest item.**
- The **client buys the license themselves, in their own name**. 72 After doesn't pay for it.
- 72 After records the client's **purchase code** on the request.
- The Envato subscription covers only templates 72 After pulls through the subscription.

### 1. Elements subscription cost
| Plan (pricing page, Oct 12) | Shown price | Notes |
|---|---|---|
| Core | **$16.50** | "Unlimited downloads"; 20 AI credits/mo |
| Plus | $39 | adds 200 AI credits; not needed for templates |
| Ultimate | $168 | AI-heavy; not needed |
| Enterprise | Contact sales | Companies with more than 50 employees |

- **UNVERIFIED pricing details:**
  - The page didn't say whether $16.50 is per month on annual billing or the monthly price. My assumption: annual billed monthly-equivalent, about **$198 a year**.
  - The month-to-month price isn't shown. It's probably higher, about $33 (**UNVERIFIED**).
  - **Teams** pricing per seat isn't shown.
- **Seats:** Individual is one seat. User Terms §18a: "single seat usage by a company with less than fifty employees. You are not permitted to share the seat." If Lina and a builder both download, that needs **Teams** (price **UNVERIFIED**).
- **Who pays (Ezequiel, Oct 12):** Ezequiel pays the Envato subscription **personally, out of pocket**. Freeplug and 72 After do not pay it as a business. All subscription and per-site figures below are **Ezequiel's personal cost**, not a Freeplug cost or a client-facing price. Elements licenses (registered projects) are created under **Ezequiel's personal Envato account**.
- **Actual plan cost (Ezequiel, Oct 12): $60 a month = $720 a year (normal plan).** This is the figure used for the comparison below. **Fallback tier if budget is tight: $30 a month = $360 a year.**
- **What $30 vs. $60 includes** (from the Oct 12 pricing page; not refetched):
  - The page shows Core $16.50, Plus $39 and Ultimate $168. **Neither $30 nor $60 appears**, so which tier each price matches is **UNKNOWN**. Billing period, currency or team seats could explain the difference.
  - **Template access:** every listed plan says "Unlimited downloads of 29+ million creative stock assets". If both prices are one of these plans, both likely give the same template access.
  - **Commercial license:** the pricing FAQ says "All stock items available through our subscription have the same simple license terms for commercial use, including client work & monetization."
  - **Differences:** the page shows the plans differ mainly in AI credits (Core 20/mo, Plus 200/mo, Ultimate 500–2000). Ultimate also lists "Lifetime commercial license for all stock assets & AI generations". Whether that changes anything for template use beyond the standard license is **UNKNOWN**.
  - **Bottom line:** the $30 tier **likely** has the same templates and the same commercial license as the $60 tier, but this is **unverified**. Confirm on Ezequiel's account billing page before downgrading.
- **Ezequiel's personal cost per client site** (not a Freeplug or client cost):
| Sites a month | 5 | 20 | 50 |
|---|---|---|---|
| Ezequiel's personal cost per site ($60/mo, normal plan) | **$12** | **$3** | **$1.20** |
| Ezequiel's personal cost per site ($30/mo, fallback if budget is tight; $360/yr) | **$6** | **$1.50** | **$0.60** |
- **Rules that still apply:**
  - One registered project (license) per site.
  - The site must be **finished while subscribed** (License §8).
  - Hand the site over while still subscribed (§10a).
  - There's a fair-use ban on "excessively high downloads in a short period". 50 sites a month is a low number of downloads, so it's likely fine (**UNVERIFIED**).
  - **Plus:** the Elements license has **no Regular/Extended split**. It allows "commercial use, including client work & monetization" (pricing FAQ), which removes the Freeplug hosting-fee Extended risk for subscription items (**UNVERIFIED** that Envato agrees for a hosted subscription site).
- **Not interchangeable:** the pricing FAQ says "an Envato subscription cannot be used to download or purchase assets from Envato Market… some items are exclusive to either platform."

### 2. ThemeForest per-item cost (Regular price from the API `price_cents`)
- **Method:** the top 100 results by sales for each keyword, split into HTML (`site-templates/*`) and WordPress (`wordpress/*`). Prices are the current Regular price.
- **Sample limits:** the HTML samples are small (7–30 per niche), because the top sellers for most keywords are WordPress. Keyword samples include near-misses.
| Corridor type (keyword) | HTML n / low / median | WP n / low / median |
|---|---|---|
| Restaurants / Tex-Mex (restaurant) | 22 / $9 / $17.50 | 76 / $29 / $59 |
| Food trucks | 17 / $9 / $19 | 27 / $39 / $59 |
| Medical clinic | 12 / $7 / $19 | 83 / $16 / $59 |
| Dental | 26 / $9 / $17 | 70 / $19 / $59 |
| HVAC | 27 / $9 / $17 | 43 / $33 / $59 |
| Plumbing/electrical (plumber) | 21 / $14 / $18 | 77 / $28 / $59 |
| Roofing/remodel (roofing) | 24 / $11 / $18 | 68 / $27 / $59 |
| Landscaping | 23 / $10 / $18 | 72 / $19 / $59 |
| Cleaning (cleaning service) | 17 / $14 / $25 | 77 / $29 / $59 |
| Auto repair | 17 / $12 / $18 | 77 / $39 / $59 |
| Salon/barber (salon) | 8 / $5 / $18 | 85 / $24 / $59 |
| Fitness | 7 / $14 / $24 | 85 / $16 / $59 |
| Legal (lawyer) | 13 / $14 / $17 | 87 / $17 / $59 |
| Real estate | 28 / $9 / $18 | 67 / $19 / $60 |
| Insurance/tax (insurance) | 14 / $12 / $18 | 86 / $16 / $59 |
| Church | 16 / $5 / $18 | 82 / $29 / $69 |
| Child care | 24 / $8 / $17 | 67 / $29 / $59 |
| Pet care | 23 / $8 / $17 | 60 / $29 / $59 |
| Event venue | 30 / $9 / $16.50 | 49 / $29 / $69 |
| Quinceañera (wedding, closest) | 22 / $5 / $18.50 | 76 / $31 / $66.50 |
| Other local (business) | 10 / $7 / $15.50 | 82 / $19 / $59 |

- **Summary:** HTML runs about **$5–$49, with a median around $17–$25**. WordPress runs about **$16–$199, with a median of $59–$69**. One WordPress outlier was $1,000.
- **Extended license price is UNVERIFIED.** The API search returns only the Regular price, and I stopped before scraping item pages. As a rough guide (est., not checked), Extended licenses usually cost many times the Regular price, often in the hundreds to low thousands of dollars per item.
- Prices change with sales and discounts, and the `discounts` field exists. Treat these as Oct 12 snapshots.

### 3. Side by side
| | Elements ($60/mo plan) | ThemeForest bought by 72 After | ThemeForest pasted by client (DECIDED) |
|---|---|---|---|
| Cost per site | $1.20–$12 at 5–50 sites/mo ($60/mo plan), **paid personally by Ezequiel**, not by 72 After | about $18 HTML / $59 WP median Regular | **$0**: the client pays |
| Extended risk from Freeplug hosting | Low: no Regular/Extended split (**UNVERIFIED** for hosted sites) | **Real**: Extended may be required, at an unknown, much higher price | The client's choice, but we must tell them which license to buy, which is still **UNCLEAR** |
| In the client picker? | **No.** The Elements catalog can't be shown (User Terms §14) | Yes, via the API | Yes, via a pasted link |
| Who is the licensee | Registered under **Ezequiel's personal Envato account**, then sublicensed to the client (§10a) | 72 After buys "on client's behalf" and the license transfers | **Client, in their own name** |
| Catch | Must stay subscribed until the site is finished and handed over | Pay per site | We rely on the client's purchase code, and Extended vs. Regular is their responsibility |

- **Break-even** (Elements at $720 a year vs. ThemeForest Regular):
  - **WordPress ($59 median):** Elements is cheaper after about **12 sites a year**.
  - **HTML ($18 median):** Elements is cheaper after about **40 sites a year**.
  - **$30/mo fallback ($360 a year):** about **6 WordPress** or **20 HTML** sites a year.
- Counting the Extended risk, Elements wins after **1 site** if ThemeForest Extended would be needed.
- At 5 or more sites a month (60+ a year), Elements is cheaper than either.

### 4. Free or cheaper legitimate alternatives (not re-fetched today, so license details are **UNVERIFIED**)
| Source | License | Fit for client and hosted sites |
|---|---|---|
| Start Bootstrap templates | MIT (per its site, unverified today) | Good: commercial use, client sites and hosting allowed; keep the MIT notice in the code |
| HTML5 UP | CC BY 3.0 (unverified today) | OK, but **a credit link is required** on the site unless their paid option is used, which looks less polished for clients |
| WordPress.org free theme directory (e.g. Astra, Kadence free) | GPL | Good for commercial or hosted use; quality and niche fit vary; paid upsells exist |
| Tailwind UI / paid kits | Per-seat paid license | Not cheapest; skip |

**Fit:** free options suit an **"other local" or general fallback set**. They don't suit niche variety, because they have few local-business niche designs. Lina would vet each one.

### 5. Freeplug integration (no hosting of template files)
- **Previews:** the API returns `previews.live_site` (the author's live demo URL) and `previews.landscape_preview` (an image).
  - Link the demo in a new tab. Don't iframe it (author sites may block frames, and the terms are silent).
  - Hotlink the preview image.
  - Data stays no more than 6 hours old.
  - **Never** download or host template zip files in Freeplug.
- **How a chosen template moves into the build:**
  1. The client picks from the shortlist (ThemeForest items via the API), or pastes a link.
  2. Lina confirms it fits.
  3. The license is obtained:
     - **(a) Elements route:** Lina checks whether the same design exists on Elements (team-only, manual check in the Elements site). If so, she registers a project there and downloads it in 72 After's build environment, outside Freeplug.
     - **(b) ThemeForest bought by 72 After:** only if Ezequiel approves the cost and the Extended question is settled.
     - **(c) Client-pasted:** the client buys it in their own name and gives us the purchase code.
  4. The builder works from the licensed download, outside Freeplug.
- **License record on `website_requests`** (proposed columns, alongside `template_choice`/`envato_item_id`):
  - `license_source`: `elements` | `market_72after` | `market_client`
  - `elements_project_name`: the registered project name, e.g. "<business name> website"
  - `elements_license_code`: the code from Elements' license certificate
  - `market_purchase_code`: the purchase code, for client or 72 After purchases
  - `market_license_type`: `regular` | `extended`
  - `license_holder`: `72after` | `client`
  - `licensed_at`
  - These need RLS: the client may write `market_purchase_code` only on their own request. Codes are shown masked in the UI and never logged.
  - **Purchase-code check: UNVERIFIED.** Envato's sale-verification endpoint is for authors, and a buyer's code may not be checkable with Ezequiel's personal token. Plan for a manual check: Lina asks for the license certificate PDF.
- **The Elements catalog can't be in the picker.** It is team-picked only, through Elements' own website by Lina (User Terms §14d/h/m). The picker shows ThemeForest data, and Lina maps the chosen design to an Elements equivalent when one exists. The picker should flag items where the API's `saleable_on_elements` is true (field meaning **UNVERIFIED**).

### 6. Recommended cheapest plan
1. **Default (current setup, DECIDED Oct 12):** Ezequiel's existing **personal Envato account, Elements plan at $60 a month ($720 a year), paid by him personally**. No Teams switch for now (not a Freeplug or 72 After expense; licenses register under his personal account). **Fallback:** $30 a month ($360 a year, $0.60–$6 per site) if budget is tight, once it's confirmed to include the same templates and license.
   - It covers every template 72 After sources, at **$1.20–$12 per site** (50 down to 5 sites a month), with no Regular/Extended risk.
   - Upgrade to Teams only if two or more people must download (price **UNVERIFIED**).
2. **Client picker:**
   - Prefer shortlist items where `saleable_on_elements` is true, so the team can license them through the subscription.
   - Lina shortlists mainly Elements-available designs, plus some free MIT/GPL designs for the general set.
3. **Client-pasted ThemeForest items (DECIDED):** the client buys the license in **their own name** and gives us the purchase code, which is recorded on the request. The cost to 72 After is $0. Our copy tells them a Regular license is typical but that their hosting setup may need Extended, so they should check with Envato. Final wording is pending.
4. **ThemeForest purchases by 72 After:** none, unless an item is needed that isn't on Elements, and only with Ezequiel's OK.
5. **Estimated monthly cost (Ezequiel's personal cost, not Freeplug's):**
   - **$60 a month** at 5, 20 or 50 sites a month (flat), or **$30 a month** on the fallback tier.
   - Plus Teams seats if needed (**UNVERIFIED**).

**Risks:**
- Lapsing the subscription before sites are finished or handed over.
- Elements wording for hosted sites, unconfirmed.
- `saleable_on_elements` may not mean "the same item on Elements".
- Elements and ThemeForest versions of an item may differ.
- A client buys the wrong license type (Regular vs. Extended).
- Purchase codes can't be verified automatically.
- Free templates need attribution or have thin niche coverage.
- Fair-use limits on downloads.

### Unverified in this section
- Whether $16.50 is monthly or annual-equivalent, the month-to-month price, and Teams pricing.
- Extended license prices.
- Free template licenses (not re-fetched today).
- Whether Elements commercial use covers a hosted subscription site.
- The meaning of `saleable_on_elements`.
- Whether purchase codes can be verified with a personal token.
- Fair-use thresholds.

## Business account option (Oct 12)
**DECIDED (Ezequiel, Oct 12): stay on the personal account for now.** Don't switch to Elements Teams yet. Ezequiel keeps his **personal Envato account** active ($60/mo Plus normal, $30/mo fallback), paid out of pocket until more personal income comes in. This is the **current setup**.

**Research only:** read from Envato's public pricing and help pages. I didn't sign in or contact Envato.

**Short answer:**
- **Elements:** there's no separate "business account" type. The company option is the **Teams plan**, where the owner can name **a company as the licensee**, or **Enterprise** for companies with more than 50 employees.
- **Market/ThemeForest:** there's no business account type. The name on license certificates comes from your account details.
- **Moving licenses:** licenses **can't be moved between accounts**.

### Elements: Teams and Enterprise
- **Company as licensee:** "As the owner of a team, you can nominate either yourself or a company to be the licensee. All items that are licensed by members of your team are licensed on behalf of the licensee." (https://elements.envato.com/pricing/teams)
- "The licence can be registered on behalf of an individual or a company." Teams is for "Up to five members"; "One Team Owner controls the account, including inviting members, modifying the number of seats…" (https://help.elements.envato.com/hc/en-us/articles/360035838371-About-the-Envato-Teams-Plan)
- **Seats:** "You can increase the number of members in your plan at any time. You can reduce the number of members in your plan at the end of your subscription period." (Teams pricing page)
- **Upgrading from Individual:** "you can upgrade to a Team plan on the same tier … directly from the Upgrade to Teams button on your My Account page". Upgrading "automatically makes you the Team Owner". "While on a Team, you cannot license assets for personal or individual use — all licensing goes through the Team." (https://help.elements.envato.com/hc/en-us/articles/360035838591-How-Do-I-Sign-Up-to-an-Envato-Team)
- **If Teams is cancelled:** "all team member accounts revert to free individual Envato accounts. The Team Owner retains access to all previous team downloads and assets." (About the Teams Plan)
- **Enterprise:** "Perfect for organizations, agencies, and companies with more than 50 employees … Contact Sales … Custom number of seats … Custom licensing and tailored indemnification" (https://elements.envato.com/pricing)

### Market/ThemeForest
- **Invoices vs. certificates:** billing "Company name" appears "on invoices only". For the name on license certificates, "see: Update Your Account Details" (https://help.elements.envato.com/hc/en-us/articles/360000629266-How-to-Update-Your-Billing-and-Personal-Details-on-Envato). Envato's search summary says the certificate shows the updated account name when re-downloaded (**UNVERIFIED**; the "Update Your Account Details" page wasn't read).
- **No transfers between accounts:** "No — licenses and other account data can't be transferred between Envato accounts. While you're welcome to have multiple accounts, each one and its associated data (including licenses) are kept completely separate." (https://help.market.envato.com/hc/en-us/articles/24455030832025-Can-I-transfer-a-license-to-other-Envato-account)
- **Accounts can't be sold or merged:** "Your membership is not transferable, that means you cannot sell your Envato account." (Market User Terms, https://help.author.envato.com/hc/en-us/articles/41383558433817-Envato-Market-User-Terms). Elements User Terms §10: "Your subscription and your account are not transferable." "It is not possible to merge two or more separate Envato accounts into one." (https://help.elements.envato.com/hc/en-us/articles/900003430786-Sign-In-with-a-Social-Account-on-Envato)
- **Changing account owner** (personal to company): **not offered** per the terms above. Whether you can change the name, email or company shown on an existing account: **yes for display and billing details** (see above). Changing the legal owner is **UNVERIFIED** and likely not possible.

### Existing licenses and past projects
- **Existing licenses stay in Ezequiel's personal account.** They can't be moved (help article above).
- **His past project registrations if the personal subscription is cancelled:** completed projects stay licensed "for the life of the End Product" (Elements License §8). The pricing FAQ says "even after your Envato subscription has ended you will be able to see the list of items you have previously licensed and continue using them for the completed projects". **Unfinished projects lose their license.**
- **Practical point:** keep the personal account open (free, no subscription needed) so the certificates for past client sites stay downloadable.

### Is a team or business plan cheaper?
| Plan | Annual (per month) | Monthly | Source |
|---|---|---|---|
| Core (individual) | $16.50 ($198/yr) | $33 | pricing page; https://elements.envato.com/learn/is-envato-worth-it |
| Plus (individual) | $39 ($468/yr) | $59 | same |
| Ultimate (individual) | $168 | $259 | pricing page (via search snippet) |
| **Teams Core** | — | **$29/month** (shown; whether per seat and which billing period is **UNVERIFIED**) | https://elements.envato.com/pricing/teams |
| Teams in general | "up to 34% off compared to individual plans" (for 2–5 seats) | | pricing page |
| Student (Core only) | $11.50 (30% off) | — | https://elements.envato.com/pricing/students. Not applicable to 72 After |
| Nonprofit/charity | reported 50% off annual Core and Teams | | **UNVERIFIED**: search summary only, no source page read. Not applicable to 72 After |
| Enterprise | Custom, contact sales | | pricing page. For companies with more than 50 employees |

**Reading this:**
- Ezequiel's **$60/mo** most likely matches **Plus monthly ($59)**, and **$30/mo** matches **Core monthly ($33)** or a **Teams Core seat ($29)**. Both are inferences (**UNVERIFIED**).
- **The cheapest option is Core annual: $198/yr ($16.50/mo).** That's 50% off monthly ($33).
- Plus adds only AI credits, which template work doesn't need.
- Teams is cheaper **per person** only when there are 2 or more seats. For a single user it isn't cheaper than individual Core annual.
- No current promotion was found beyond the student and charity offers (**UNVERIFIED**: promotions change often).

### Does Teams speed builds?
- **How Teams works:** each member gets their own seat and login, so several people can search and download at the same time. A personal account can't be shared (User Terms §18a: "You are not permitted to share the seat").
- **What Envato says:** the Teams help article has **no explicit "simultaneous use" wording**. The closest text is that Teams "is designed for small creative teams, studios, and businesses that need multiple people to download and licence assets under one subscription", and "Team Members can view, download, and licence assets under the team account." (https://help.elements.envato.com/hc/en-us/articles/360035838371-About-the-Envato-Teams-Plan, read Oct 12). Parallel logins are implied, not stated (**UNVERIFIED**).
- **Where build time goes:** downloads take minutes at most. Build time is mostly the hours spent adapting the template, not getting it.
- **Bottom line:** Teams saves time only when **2+ people pull templates in parallel**. With one person picking (Lina), it **doesn't speed builds**.

### Steps to switch 72 After licensing to a company going forward: **ON HOLD (future path, per Ezequiel Oct 12)**. Kept for later; not to be done now.
1. **Decide who pays.** Today Ezequiel pays personally. A company licensee would normally mean 72 After pays, which changes the "Cheapest options" framing.
2. **Choose the account:**
   - **(a)** Upgrade his account in place with "Upgrade to Teams" (same tier), then nominate **72 After as the licensee**; or
   - **(b)** Create a **new Envato account under a 72 After email**, subscribe to **Teams Core, annual**, with the owner nominating 72 After as licensee, and invite Lina and builders as seats.
   - Option (b) keeps his personal history separate. Option (a) keeps one login but blocks personal licensing.
3. **Set billing details:** Company name and tax info under Manage subscription → Billing information, so invoices are in 72 After's name.
4. **Set the certificate name:** via "Update Your Account Details" (**UNVERIFIED** steps).
5. **From the switch date,** register every **new** client project under the company account. Record `license_source=elements`, the project name and the license code on each `website_requests` row.
6. **Leave past licenses where they are.** Keep his personal account open, and only cancel the personal subscription once all projects started under it are **finished**.
7. **Market purchases** by 72 After, if any: buy from the company account. Client-pasted items stay **bought by the client in their own name** (decided Oct 12).

**Unverified:**
- Whether the Teams $29 price is per seat or monthly vs. annual, and the exact 2–5 seat rates.
- The nonprofit discount.
- Current promotions.
- What $30 and $60 match on Ezequiel's actual bill.
- The "Update Your Account Details" steps, and whether certificates re-render with a new name.
- Whether an account's legal owner can be changed.
- Whether upgrading to Teams in place lets past personal licenses show the company name (likely not).

## Arkitect (required)
- **Before any code change,** run the Arkitect MCP (from `/workspace/Arkitect-MCP.AI`) structure checks on `/workspace/freeplug-ladder/freeplug-landing`: `diagnose_repository` and `analyze_refactoring_opportunities`.
- **Before handoff,** run `verify_codebase`, plus `npm run verify`.
- **If `dist` is missing:** run `pnpm -r --filter "./packages/**" build` in `/workspace/Arkitect-MCP.AI`, then restart the Arkitect MCP servers (arkitect-mcp, arkitect-box, arkitect-clean). `packages/ai/dist` existed on 2026-10-12.

## Unverified items
1. Whether a personal token may be used for a client-facing feature.
2. Whether hotlinking images is allowed.
3. The exact Regular vs. Extended license wording, and the hosting-subscription case.
4. Affiliate disclosure duties.
5. The price range of templates.
6. Actual rate-limit numbers, and how Envato would treat about 1,100 calls a day.
7. How to get past the 60-page cap (which split parameters work).
8. How much the categories overlap, so the true number of unique templates.
9. Whether D1 and Cron fit inside the current Cloudflare plan's limits.
10. How accurately the keyword/tag rules sort templates into niches. Lina's tags are the safety net.
11. Coverage counts are raw keyword hits, and the real number of dedicated templates is lower (especially for "cleaning").
12. How many solo operators CBP leaves out (no Nonemployer data pulled), and the business count for "nearby areas".
13. Event venue/quinceañera establishment count (no clean NAICS code).

## Priority types (DECIDED, Oct 12, 12:03 PM CT, Cheke)
- The priority template types are cleaning (home cleaners and housekeeping), restaurants, medical, trades, real estate and legal. Lina shortlists these first, with at least 6 each, the same as every other type.
- Cleaning keywords: the earlier `cleaning` count can't be trusted, because "clean" also matches design styles. Search with "house cleaning", "maid service", "housekeeping", "cleaning service", "janitorial" and "home cleaning", and drop matches that are only about clean design.


## Live note Oct 14 ~7:58 AM CT (verified from Envato email)
Envato emailed ezequielcasillas1@gmail.com on Oct 13: Elements subscription ends **Oct 21, 2026** (one week from today). After that the account downgrades to free; unfinished projects lose licensing. Freeplug's Elements-first picker and Cheke's Oct 14 policy assume an active Elements sub. Not acted on yet. Source: subject "Your subscription is ending–don’t miss out!" from news@m.elements.envato.com.

## DECIDED Oct 14 (Cheke)
Freeplug/Cheke never pays for ThemeForest-only licenses. The picker shows only Lina-flagged Elements items (general fallback). ThemeForest-only items and pasted links are customer-buys-in-own-name, with the purchase code recorded. Spec: /workspace/aria/picker-elements-flag-spec.md

## Elements license facts (Envato Elements License, rev. Oct 6, 2026)
- Per-project: register a license per client site (new license for each reuse).
- Transfer to the client happens as a sublicense with the finished site, limited to that site; tell the client the conditions (add to customer terms/handoff).
- Finish the site while subscribed; after that it's perpetual for that site.
- Clause 12c: no "build it yourself" or on-demand apps. The picker must stay "the team builds"; customers never download the template or get its source files.
