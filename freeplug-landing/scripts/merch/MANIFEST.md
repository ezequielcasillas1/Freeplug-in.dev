# Freeplug merch — local production handoff

Created November 8, 2026 (America/Chicago). Local artwork only; GET-only catalog reads. No products, uploads, orders or publishing.

## Brand and production rules
Red #ba3d3d, ivory #f7f3ea, black #171717; tonal charcoal #454545 for low-profile cap. Owned FP Cursive v2 Bold, FP Extended Black and Freeplug Dispatch Bold. Real FP master path reused; all remaining illustrations original. All type converted to vector outlines. PNGs have 300 DPI metadata. Transparent files use 0/255 alpha, no semi-transparent halo. Full-bleed files have opaque backgrounds to all four edges.

### Important production gates
- Exact pixel sizes come from saved Printify catalog variant GET responses in `catalog/`. They are the provider upload-area dimensions, not proof of trim/fold/bleed coordinates. Product-specific templates are not returned by these endpoints. Canvas, journal, keychain and combined pillow layouts need the Product Creator template alignment check before production.
- Canvas: exact API-area PNGs included with 600px all-background edge reservation. Separate extra-1.5in-bleed companions included, following generic Printify guidance, but not asserted to be the Jondo-specific template. Do not auto-fit those companions as the catalog upload. Exact Jondo wrap/fold guide remains unverified.
- Printify Choice (99) is a US-target routing service, not a named fixed factory; trucker patch and low-profile cap had no fixed US alternative in their catalog listings. Ensure US target market in any later setup.
- US fulfillment intended for fixed providers; multi-country networks (Jondo, Printful, Monster Digital and MWW) may route by destination. No live provider cost/rating data in these allowed catalog endpoints: selections are sensible standard blanks, not a verified cheapest/best-rated ranking.
- Hat art is embroidery-oriented source, not digitized stitch files. Letter outlines thickened by 18px at native 300DPI (~1.52mm added width); native text height exceeds 6mm. Thread targets in each `THREADS.md`; match physical threads, do not reduce artwork. Patch-like beanie artwork is embroidered directly on cuff, not separately sewn patch.
- Mugs use rectangular provider wrap area without guessing taper distortions; provider product mapping handles it. Full-wrap means supplied print zone, not guaranteed 360-degree printing through handle gaps.
- Sticker set = four individually mapped 3-inch die-cut designs, not a bundled fulfillment SKU. Alpha defines proposed cut shape; provider adds border/cut path.
- Wallpaper is digital-only, 1290×2796, top 30% clear and verse lower third.
- Scripture is the exact first KJV clause: “Give, and it shall be given unto you”. No other translation or optional longer text.
- Mockups are original drawn silhouettes and visual previews, not garment sizing, wrap-placement or color proofs. Physical proof and template review required before sale.

## Item inventory

### fully-charged-mug
Blueprint **478 — Ceramic Mug, (11oz, 15oz)**; provider **28 — District Photo**.
Preview: `fully-charged-mug/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `fully-charged-mug/wrap-11oz.png` | 2475×1155 | 65216 / 11oz | front | Two faces in one wrap; keep handle gap blank. |
| `fully-charged-mug/wrap-15oz.png` | 2475×1275 | 104692 / 15oz | front | Two faces in one wrap; keep handle gap blank. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### cheap-free-latte
Blueprint **289 — Latte Mug**; provider **1 — SPOKE Custom Products**.
Preview: `cheap-free-latte/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `cheap-free-latte/wrap.png` | 1988×1196 | 43321 / 12oz | front | Single rectangular wrap; no taper warp applied, provider maps to blank. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### free-refills-travel
Blueprint **70 — Stainless Steel Travel Mug**; provider **1 — SPOKE Custom Products**.
Preview: `free-refills-travel/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `free-refills-travel/wrap.png` | 2376×2024 | 33765 / 15oz | front | Single rectangular wrap; no taper warp applied, provider maps to blank. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### know-a-plug-mug
Blueprint **425 — Mug 15oz**; provider **1 — SPOKE Custom Products**.
Preview: `know-a-plug-mug/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `know-a-plug-mug/wrap.png` | 2790×1219 | 62014 / 15oz | front | Single rectangular wrap; no taper warp applied, provider maps to blank. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### day-one-tumbler
Blueprint **353 — Tumbler 20oz**; provider **1 — SPOKE Custom Products**.
Preview: `day-one-tumbler/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `day-one-tumbler/wrap-20oz.png` | 2795×2100 | 44519 / 20oz | front | Stacked vertical reading on both faces; ivory background to full API extent. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### running-over-canvas
Blueprint **937 — Matte Canvas, Stretched, 0.75" (Multi-Size)**; provider **105 — Jondo**.
Preview: `running-over-canvas/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `running-over-canvas/16x20-api-area.png` | 4800×6000 | 82231 / 16″ x 20″ (Vertical) / 0.75'' | front | Exact API area. Full ivory background and 600px edge reservation for wrap/bleed. Provider-specific fold/bleed guide not exposed by API; verify template before production. |
| `running-over-canvas/16x20-extra-1p5in-bleed.png` | 5700×6900 | 82231 / 16″ x 20″ (Vertical) / 0.75'' | reference-extra-bleed | Companion with 1.5in extra ivory each side, following general Printify canvas guidance; not a confirmed product-specific template. Do not auto-fit this in place of API-area artwork. |
| `running-over-canvas/24x36-api-area.png` | 7200×10800 | 82235 / 24" x 36" (Vertical) / 0.75'' | front | Exact API area. Full ivory background and 600px edge reservation for wrap/bleed. Provider-specific fold/bleed guide not exposed by API; verify template before production. |
| `running-over-canvas/24x36-extra-1p5in-bleed.png` | 8100×11700 | 82235 / 24" x 36" (Vertical) / 0.75'' | reference-extra-bleed | Companion with 1.5in extra ivory each side, following general Printify canvas guidance; not a confirmed product-specific template. Do not auto-fit this in place of API-area artwork. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### running-over-wallpaper
Blueprint **None — Digital companion; no POD blank**; provider **None — None**.
Preview: `running-over-wallpaper/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `running-over-wallpaper/wallpaper-1290x2796.png` | 1290×2796 | None / Phone wallpaper | None | Top 30% clear; verse entirely in lower third. Digital only. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### trucker-circle
Blueprint **2663 — Snapback Trucker Cap with Patch (Embroidery)**; provider **99 — Printify Choice**.
Preview: `trucker-circle/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `trucker-circle/front-embroidery.png` | 675×675 | 147781 / One size / Black / White patch / Circle | front_patch | Embroidery artwork, not a stitch/DST file. 18px outline on letters; solid fills, max two thread colors. Digitizer must validate pull compensation, counters and thread mapping. |
Colors: Ivory/charcoal thread on black; red/ivory patch accents. See THREADS.md.

### dad-fp
Blueprint **1729 — Distressed Dad Hat (Embroidery)**; provider **410 — Printful**.
Preview: `dad-fp/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `dad-fp/front-embroidery.png` | 1650×600 | 118238 / Black / One size | front | Embroidery artwork, not a stitch/DST file. 18px outline on letters; solid fills, max two thread colors. Digitizer must validate pull compensation, counters and thread mapping. |
Colors: Ivory/charcoal thread on black; red/ivory patch accents. See THREADS.md.

### low-profile-plugged
Blueprint **1108 — Low Profile Baseball Cap**; provider **99 — Printify Choice**.
Preview: `low-profile-plugged/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `low-profile-plugged/front-embroidery.png` | 1650×600 | 104278 / Black / One size | front_embroidery | Embroidery artwork, not a stitch/DST file. 18px outline on letters; solid fills, max two thread colors. Digitizer must validate pull compensation, counters and thread mapping. |
Colors: Ivory/charcoal thread on black; red/ivory patch accents. See THREADS.md.

### beanie-freeplug
Blueprint **1691 — Classic Cuffed Beanie (Embroidery)**; provider **410 — Printful**.
Preview: `beanie-freeplug/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `beanie-freeplug/front-embroidery.png` | 1500×525 | 116417 / Black / One size | front | Embroidery artwork, not a stitch/DST file. 18px outline on letters; solid fills, max two thread colors. Digitizer must validate pull compensation, counters and thread mapping. |
Colors: Ivory/charcoal thread on black; red/ivory patch accents. See THREADS.md.

### desk-mat
Blueprint **488 — Desk Mat**; provider **1 — SPOKE Custom Products**.
Preview: `desk-mat/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `desk-mat/wrap-12x22.png` | 6791×3839 | 65241 / 12" × 22" | front | Full bleed charcoal FP pattern; clear center writing/mouse zone. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### build-journal
Blueprint **485 — Hardcover Journal Matte (Lined)**; provider **28 — District Photo**.
Preview: `build-journal/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `build-journal/full-cover.png` | 4065×2850 | 65223 / Journal | front | Full wrap: back left/front right. Central 8% kept clear for spine/hinges; outer 150px quiet. Exact hinge/trim guide still needs Product Creator template check. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### hero-crewneck
Blueprint **49 — Unisex Heavy Blend™ Crewneck Sweatshirt**; provider **29 — Monster Digital**.
Preview: `hero-crewneck/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `hero-crewneck/S-front-dark.png` | 3319×3761 | 25397 / S / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/S-back-dark.png` | 3319×3761 | 25397 / S / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
| `hero-crewneck/S-front-light.png` | 3319×3761 | 25397 / S / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/S-back-light.png` | 3319×3761 | 25397 / S / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
| `hero-crewneck/M-front-dark.png` | 3909×4431 | 25428 / M / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/M-back-dark.png` | 3909×4431 | 25428 / M / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
| `hero-crewneck/M-front-light.png` | 3909×4431 | 25428 / M / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/M-back-light.png` | 3909×4431 | 25428 / M / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
| `hero-crewneck/L-3XL-front-dark.png` | 4500×5100 | 25459 / L / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/L-3XL-back-dark.png` | 4500×5100 | 25459 / L / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
| `hero-crewneck/L-3XL-front-light.png` | 4500×5100 | 25459 / L / Black | front | Small left-chest mark; colorway names refer to garment, not ink. |
| `hero-crewneck/L-3XL-back-light.png` | 4500×5100 | 25459 / L / Black | back | Large back graphic. L-3XL share API size; S and M have separate exact dimensions. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### water-bottle
Blueprint **646 — Slim Water Bottle**; provider **86 — Chill**.
Preview: `water-bottle/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `water-bottle/wrap-20oz.png` | 2502×2303 | 72251 / 20oz / White | front | Full wrap on white slim water bottle. Keep critical art away from wrap seam. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### die-cut-stickers
Blueprint **600 — Die-Cut Stickers**; provider **73 — Printed Simply**.
Preview: `die-cut-stickers/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `die-cut-stickers/fp-circle.png` | 900×900 | 72007 / White / Die-Cut / 3" × 3" | front | Four separate sticker designs; provider generates cutline from alpha. Keep provider-added border; no production cutline supplied. |
| `die-cut-stickers/know-a-plug.png` | 900×900 | 72007 / White / Die-Cut / 3" × 3" | front | Four separate sticker designs; provider generates cutline from alpha. Keep provider-added border; no production cutline supplied. |
| `die-cut-stickers/zero-price-tag.png` | 900×900 | 72007 / White / Die-Cut / 3" × 3" | front | Four separate sticker designs; provider generates cutline from alpha. Keep provider-added border; no production cutline supplied. |
| `die-cut-stickers/plug-heart.png` | 900×900 | 72007 / White / Die-Cut / 3" × 3" | front | Four separate sticker designs; provider generates cutline from alpha. Keep provider-added border; no production cutline supplied. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### fp-keychain
Blueprint **5341 — Acrylic Keychain**; provider **80 — M.i.A Merchandise**.
Preview: `fp-keychain/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `fp-keychain/circle-front.png` | 639×639 | 243784 / Circle / One size | front | Circle acrylic keychain; 56px inset, keep top hardware zone clear. Physical hole position requires final template confirmation. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### running-over-candle
Blueprint **1048 — Scented Soy Candle, 9oz**; provider **219 — Lumient**.
Preview: `running-over-candle/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `running-over-candle/front-label.png` | 900×600 | 80301 / Clean Cotton / 9oz | front | Scented Soy Candle 9oz; KJV first clause exactly. Decorative label only: retain provider safety/burn labels. Scent not selected for purchase. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

### running-over-pillow
Blueprint **220 — Spun Polyester Square Pillow**; provider **10 — MWW On Demand**.
Preview: `running-over-pillow/mockup.png`.
| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |
|---|---:|---|---|---|
| `running-over-pillow/wrap-18x18.png` | 5850×2925 | 41527 / 18" × 18" | front | Combined front-left/back-right layout; both halves upright. 200px minimum seam quiet area, ivory all edges. API exposes single combined print area. |
Colors: Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.

## Evidence / references
- Printify GET `/catalog/blueprints.json` and selected `/catalog/blueprints/{id}/print_providers/{pid}/variants.json`: raw responses saved in `catalog/`.
- https://help.printify.com/hc/en-us/articles/4483626015889-What-are-safe-areas-and-bleeds
- https://help.printify.com/hc/en-us/articles/11240165642641-How-do-I-use-the-design-templates
- https://printify.com/blog/how-to-print-on-canvas/ (general 1.5–2in canvas bleed guidance, not product-specific)
- https://printify.com/shipping-rates/chill/ (Massachusetts US fulfillment)
- https://help.printify.com/hc/en-us/articles/18287001523345-What-is-Printify-Choice-and-how-does-it-work

Total: 19 item groups, 37 print/digital PNGs, matching SVG sources, 19 mockup PNGs, two overview sheets. See `quality-check.json` for dimensions and content bounds.

## Final quality audit
- All 37 print/digital PNGs validated for declared dimensions, 300 DPI and binary/opaque alpha. All catalog-target files match the selected variant placeholder exactly; extra-bleed companions and wallpaper are explicitly separate. Transparent artwork stays within the canvas.
- Native embroidery positive-letter skeleton widths are at least 34.2px (trucker), 66.0px (dad), 41.8px (low-profile) and 20.0px (beanie), all above 18px / ~1.5mm. See `embroidery-letter-stroke-check.json`. PNGs use exactly 1–2 solid thread colors. Tiny enclosed negative specks removed in PNG/SVG; digitization still required.
- Public provider fulfillment-location evidence is saved in `catalog/provider-location-evidence.json`. Selected providers have US fulfillment; do not assume every order is US-routed without confirming the market.
- Rebuild workflow: `python3 build_merch.py` then `python3 finalize_hats.py` (embroidery palette cleanup and mockup refresh). Artwork contains outlined type, not embedded font dependencies.


## Added item: outdoor-doormat

Blueprint **1346 — Doormat**; provider **80 — M.i.A Merchandise** (US, New Hampshire); variant **103043**, sole size **24" × 16"**. Grade A tufted coir coconut fiber with black vinyl backing, mainly outdoor use. Exact front print area **7275 × 4875 px**, 300 DPI.

Overview: `outdoor-doormat/overview-doormat.png`. Individual previews and production caveats in `outdoor-doormat/README.md`.

| Option | Transparent PNG | Outlined SVG | Original mockup | Colors |
|---|---|---|---|---|
| welcome-plugged-in | `outdoor-doormat/option-01-welcome-plugged-in.png` | `outdoor-doormat/option-01-welcome-plugged-in.svg` | `outdoor-doormat/option-01-welcome-plugged-in-mockup.png` | #171717 |
| you-know-a-plug | `outdoor-doormat/option-02-you-know-a-plug.png` | `outdoor-doormat/option-02-you-know-a-plug.svg` | `outdoor-doormat/option-02-you-know-a-plug-mockup.png` | #171717 |
| come-on-in | `outdoor-doormat/option-03-come-on-in.png` | `outdoor-doormat/option-03-come-on-in.svg` | `outdoor-doormat/option-03-come-on-in-mockup.png` | #171717, #ba3d3d |

No ivory ink assumed on coir. All foreground retains a generous quiet margin; transparent art dimensions and 300 DPI checked. Provider-specific trim guides and physical coir proof remain pre-production checks. Budget/rating ranking not available from these catalog GET responses. This addition brings the collection to **20 item groups and 40 print/digital PNGs** (including two canvas extra-bleed companions and one wallpaper).


## Contrast / blank-color rule (Cheke Nov 8, 2026)

**Dark or black text/art must never go on a black or dark blank.**

### Already paired
- `tshirts/print/*-light-garment.png` → light blanks only; `*-dark-garment.png` → dark blanks only.
- `hero-crewneck/*-light.png` → light blanks; `*-dark.png` → dark blanks.

### Hats (updated this pass)
- `*-embroidery-light-garment.png` → light hat colors only (dark/black thread).
- `*-embroidery-dark-garment.png` → dark hat colors only (ivory/red thread).
- Low-profile tonal charcoal remains dark-blank only; solid black light-garment version added.
- Trucker/beanie dark versions: ivory outline around red for contrast on black.

### Wave-3
Color-variable apparel/bags/drinkware/kids/pets/apron/seasonal now have `-light-garment` and `-dark-garment` pairs. See `wave-3/MANIFEST.md` and `CONTRAST_MAP.json`.

**NEVER** assign a dark-ink / light-garment file to black, charcoal, navy, or dark heather.


### Hat contrast fix (Nov 8, 2026 evening)
- **Low-profile:** `front-embroidery-dark-garment.png` is now **ivory only** (1650×600, same placement as `printify-ready/standard-thread-front.png`). Light blanks use `front-embroidery-light-garment.png` (black only). Charcoal-on-black retired.
- **Trucker:** `front-embroidery-light-garment.png` confirmed final for **white patch**: red + black (2 threads). Dark/black patch uses `front-embroidery-dark-garment.png` (red + ivory).
