# Freeplug merch — Wave 3 pricing report

Verified **November 8, 2026** (America/Chicago). Shop `29664778`. **Read-only** Printify catalog + product-catalog-service costs. No products created, uploaded, updated, or published. No site/DNS/email changes.

## Method

- Blueprints/providers/print areas/shipping: official Catalog API (`/v1/catalog/...`).
- Production costs: Printify product-catalog-service v2 (`/product-catalog-service/api/v2/blueprints/{id}/print-providers/{id}/variants`) — catalog API does not expose unit cost without a draft.
- Retail formula (same as earlier drafts): target **~45% gross margin of retail** → `price = round_to_.99(cost / 0.55)`. Shipping, tax, and Stripe fees excluded.
- Front+back DTG apparel: catalog cost is **1 print area**. Added **+$7.24** estimate for a second DTG area (delta from live Hero Crewneck draft $26.69 vs catalog 1-area ~$19.45). Real cost confirmed only at draft time.
- Shipping: Printify US first/extra; proposed class reuses an existing Freeplug class when it covers Printify, else a NEW covering rate.

## Counts

- Items priced: **50** / 50 (all returned a catalog base cost).
- Clean / minor notes only: **42**
- Warnings (embroidery, Choice routing, size assumptions, 2-area estimate): **6**
- Critical blockers before draft: **2**
  - `good-measure-longsleeve`: ASSUMED file size: sleeve-assumed.png 900×3600; CRITICAL: sleeve art sleeve-assumed.png 900×3600 but blueprint 41 has no sleeve print area (front/back only)
  - `chef-apron`: NON-US provider: T Shirt and Sons (GB); US alt: blueprint 5541 Full-Length Apron / provider 217 Fulfill Engine (US), or 7391 Bib Apron / 217; AOP 418/MWW if all-over ok; UK shipping to US is $37.29 first — do not sell on this provider

## Critical / provider issues

### Long-sleeve sleeve art (good-measure-longsleeve)

- Blueprint **41** / Monster Digital (US) print areas: **front 4200×4800**, **back 4200×4800** only.
- Milo’s `sleeve-assumed.png` **900×3600** does **not** match any placeholder (no sleeve area on this blank).
- **Action:** sell front-only (Luke sleeve text moved onto front/back), or switch to a blank that has sleeve print (e.g. zip hoodie 1925 has left/right sleeve 900×3600), or drop the sleeve file.

### Cotton apron (chef-apron) — non-US

- Blueprint **713** / **T Shirt and Sons** is **United Kingdom**. US first-item shipping **$37.29** — not viable for Freeplug US store.
- US alternatives (files would need remake; current art is 2953×3780 for blueprint 713):

| Alt | Blueprint | Provider | Print area | Base cost (min) | US ship first/extra |
|---|---:|---|---|---:|---:|
| Full-Length Apron / Fulfill Engine | 5541 | 217 | front_dtf 2100×3000 | $18.93 | $5.89/$2.49 |
| Bib Apron / Fulfill Engine | 7391 | 217 | front_dtf 3000×3600, bottom_left_dtf 1200×1200, bottom_right_dtf 1200×1200 | $13.77 | $5.89/$2.49 |
| Apron AOP / MWW | 418 | 10 | front 4350×4783 | $22.54 | $6.19/$2.99 |

**Recommendation:** remake art for **5541 / Fulfill Engine** (front_dtf 2100×3000) or **7391** (front_dtf 3000×3600). Prefer 5541/7391 over AOP unless Cheke wants all-over.


### Pin set (pin-set) — priced per pin, not a pack

- Blueprint **430** variants are **individual** pins (1.25" / 2.25" / 3"). Milo’s three arts (FP / plug / bolt) are **519×519** = **1.25"** size.
- Catalog base **$2.28 each** → proposed **$3.99 each**, or a **3-pin set** at ~$6.84 cost → proposed **$12.99** set (same ~45% margin). Confirm with Cheke whether to sell singles or a set SKU (Printify still fulfills as separate line items unless bundled elsewhere).

## Cheke summary — proposed retail (main variant)

| Item | Proposed price | Base cost used | Notes |
|---|---:|---:|---|
| Stay Charged (stay-charged-pullover) | $64.99 | $35.93 | incl. est. 2nd print |
| Plugged In Since Day One (day-one-zip) | $65.99 | $36.35 | embroidery; Choice routing |
| Good Measure / Luke 6:38 (good-measure-longsleeve) | $33.99 | $18.46 | BLOCKED |
| Low Battery, High Hustle (hustle-joggers) | $47.99 | $26.26 | embroidery |
| Fully Charged Feet (charged-socks) | $12.99 | $7.39 | — |
| FP circle repeat (fp-gaiter) | $22.99 | $12.70 | Choice routing |
| FP / Plug / Bolt (pin-set) | $3.99 each or $12.99 / 3-pack | $2.28 each ($6.84×3) | per-pin blank; not a pack SKU |
| Carry the Connection (carry-tote) | $36.99 | $20.44 | — |
| Gym Plug (gym-drawstring) | $55.99 | $30.57 | — |
| Charger Not Included (charger-backpack) | $79.99 | $44.15 | — |
| Pocket Plug (pocket-fanny) | $43.99 | $24.04 | — |
| Recharge Mode (recharge-blanket) | $26.99 | $14.78 | — |
| Plug Time (plug-clock) | $53.99 | $29.56 | — |
| Rinse, Recharge, Repeat (rinse-curtain) | $73.99 | $40.80 | — |
| Head Chef, Head Plug (chef-apron) | $37.99 | $20.97 | BLOCKED |
| Plugged-In Kitchen (plugged-cutting-board) | $38.99 | $21.56 | — |
| FP / plug / bolt / charged (coaster-set) | $36.99 | $20.18 | — |
| Recharge Station (recharge-pint) | $23.99 | $13.28 | — |
| Keep It Cool, Keep It Plugged (cool-can-cooler) | $8.99 | $4.99 | — |
| Unplugged Hours (unplugged-wine) | $32.99 | $18.06 | — |
| Good Boy Fully Charged (good-boy-bandana) | $25.99 | $14.53 | — |
| Fuel Station (fuel-bowl) | $45.99 | $25.21 | — |
| Recharge Zone (recharge-pet-bed) | $53.99 | $29.84 | — |
| My Human Knows a Plug (human-knows-dog-tee) | $41.99 | $23.15 | — |
| Newest Plug (newest-onesie) | $25.99 | $14.43 | — |
| Mini Plug (mini-plug-tee) | $19.99 | $11.02 | — |
| Charging Up (charging-kids-hoodie) | $39.99 | $22.20 | — |
| Don't Let Me Hit 1% (dont-hit-1-case) | $19.99 | $11.25 | — |
| Minimal FP circle (slim-fp-case) | $17.99 | $9.87 | — |
| Click, Connect, Get Paid (click-mousepad) | $8.99 | $4.98 | — |
| Website Was Free (website-laptop-sleeve) | $33.99 | $18.47 | — |
| Ideas Worth Plugging (ideas-notebook) | $14.99 | $8.29 | — |
| Plug Map (poster-1-plug-map) | $21.99 | $12.00 | — |
| Hustle Hours (poster-2-hustle-hours) | $21.99 | $12.00 | — |
| Free Is a Feeling (poster-3-free-is-a-feeling) | $21.99 | $12.00 | — |
| Wired Different (poster-4-wired-different) | $21.99 | $12.00 | — |
| Stay Connected (stay-connected-framed) | $103.99 | $57.20 | — |
| Plug Parking Only (plug-parking-sign) | $31.99 | $17.37 | — |
| Solar Charging (solar-towel) | $42.99 | $23.81 | — |
| Off-Grid Plug (offgrid-camping-mug) | $20.99 | $11.41 | — |
| Unplug Together (unplug-picnic) | $73.99 | $40.53 | — |
| A Plug Lives Here (plug-lives-flag) | $18.99 | $10.49 | — |
| Plugged-In Christmas (plugged-ornament) | $11.99 | $6.34 | — |
| Ugly-sweater plugs & bolts (ugly-sweater-crew) | $34.99 | $19.45 | — |
| Fill It Running Over (running-over-stocking) | $30.99 | $17.16 | — |
| Give, and it shall be given unto you (kjv-woven-blanket) | $52.99 | $28.89 | — |
| Give, and it shall be given unto you (kjv-serving-tray) | $139.99 | $77.09 | — |
| Luke 6:38 (kjv-bookmarks) | $10.99 | $6.11 | — |
| Pressed Down, Shaken Together (pressed-down-framed) | $103.99 | $57.20 | — |
| Give, and it shall be given unto you (thanksgiving-tea-towel) | $31.99 | $17.47 | — |

## By category

### apparel

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Stay Charged**<br>`stay-charged-pullover`<br>Unisex Heavyweight Pullover Hoodie | 2001 / 29 Monster Digital (US) | Black / M: cost $28.69 → used $35.93 → $64.99 (44.7%)<br>Black / L: cost $28.69 → used $35.93 → $64.99 (44.7%)<br>Black / S: cost $28.69 → used $35.93 → $64.99 (44.7%) | $35.93 | $64.99 | 44.7% | $7.99 / $2.09 | crewneck<br>$8.99 / $2.49 | preferred apparel undercovers; using crewneck |
| **Plugged In Since Day One**<br>`day-one-zip`<br>Unisex Fleece Zip Up Hoodie | 1925 / 99 Printify Choice (US) | Black / M: cost $36.35 → $65.99 (44.9%)<br>Black / L: cost $36.35 → $65.99 (44.9%)<br>Black / S: cost $36.35 → $65.99 (44.9%) | $36.35 | $65.99 | 44.9% | $7.39 / $2.09 | crewneck<br>$8.99 / $2.49 | Embroidery requires Printify digitizing after first order + physical sample; Printify Choice routes across network; confirm US destination facility on real orders |
| **Good Measure / Luke 6:38**<br>`good-measure-longsleeve`<br>Unisex Jersey Long Sleeve Tee | 41 / 29 Monster Digital (US) | M / Black: cost $18.46 → $33.99 (45.7%)<br>L / Black: cost $18.46 → $33.99 (45.7%)<br>S / Black: cost $18.46 → $33.99 (45.7%) | $18.46 | $33.99 | 45.7% | $4.49 / $2.09 | apparel<br>$4.95 / $2.40 | ASSUMED file size: sleeve-assumed.png 900×3600; CRITICAL: sleeve art sleeve-assumed.png 900×3600 but blueprint 41 has no sleeve print area (front/back only) |
| **Low Battery, High Hustle**<br>`hustle-joggers`<br>Unisex Joggers (Embroidery) | 1903 / 410 Printful (US) | Black / M: cost $26.26 → $47.99 (45.3%)<br>Black / L: cost $26.26 → $47.99 (45.3%)<br>Black / S: cost $26.26 → $47.99 (45.3%) | $26.26 | $47.99 | 45.3% | $8.79 / $2.09 | crewneck<br>$8.99 / $2.49 | Embroidery requires Printify digitizing after first order + physical sample |

### accessories

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Fully Charged Feet**<br>`charged-socks`<br>Sublimation Socks | 376 / 1 SPOKE Custom Products (US) | M: cost $7.39 → $12.99 (43.1%)<br>L: cost $7.39 → $12.99 (43.1%) | $7.39 | $12.99 | 43.1% | $4.59 / $0.99 | apparel<br>$4.95 / $2.40 | — |
| **FP circle repeat**<br>`fp-gaiter`<br>Midweight Neck Gaiter | 970 / 99 Printify Choice (US) | M: cost $12.70 → $22.99 (44.8%)<br>L: cost $12.70 → $22.99 (44.8%) | $12.70 | $22.99 | 44.8% | $4.99 / $0.99 | hat<br>$6.99 / $3.00 | Printify Choice routes across network; confirm US destination facility on real orders; preferred apparel undercovers; using hat |
| **FP / Plug / Bolt**<br>`pin-set`<br>Custom Pin Buttons | 430 / 1 SPOKE Custom Products (US) | 1.25": cost $2.28 → $3.99 (42.9%)<br>2.25": cost $2.45 → $3.99 (38.6%) | $2.28 | $3.99 | 42.9% | $4.49 / $0.19 | sticker<br>$5.49 / $0.75 | — |

### bags

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Carry the Connection**<br>`carry-tote`<br>Cotton Tote Bag | 553 / 217 Fulfill Engine (US) | One size / Black: cost $20.44 → $36.99 (44.7%) | $20.44 | $36.99 | 44.7% | $5.89 / $2.09 | home_standard<br>$7.99 / $4.00 | — |
| **Gym Plug**<br>`gym-drawstring`<br>Drawstring Bag | 414 / 10 MWW On Demand (US) | One size: cost $30.57 → $55.99 (45.4%) | $30.57 | $55.99 | 45.4% | $6.79 / $2.99 | home_standard<br>$7.99 / $4.00 | — |
| **Charger Not Included**<br>`charger-backpack`<br>Backpack | 413 / 10 MWW On Demand (US) | One size: cost $44.15 → $79.99 (44.8%) | $44.15 | $79.99 | 44.8% | $9.19 / $2.39 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |
| **Pocket Plug**<br>`pocket-fanny`<br>Fanny Pack | 468 / 10 MWW On Demand (US) | One size: cost $24.04 → $43.99 (45.4%) | $24.04 | $43.99 | 45.4% | $5.29 / $1.69 | home_standard<br>$7.99 / $4.00 | — |

### home-living

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Recharge Mode**<br>`recharge-blanket`<br>Velveteen Plush Blanket | 522 / 1 SPOKE Custom Products (US) | 30" × 40": cost $14.78 → $26.99 (45.2%)<br>50" × 60": cost $23.68 → $42.99 (44.9%) | $14.78 | $26.99 | 45.2% | $5.89 / $2.79 | home_standard<br>$7.99 / $4.00 | — |
| **Plug Time**<br>`plug-clock`<br>Wall Clock | 277 / 1 SPOKE Custom Products (US) | Black Base / Black / 10": cost $29.56 → $53.99 (45.2%) | $29.56 | $53.99 | 45.2% | $8.89 / $4.99 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |
| **Rinse, Recharge, Repeat**<br>`rinse-curtain`<br>Shower Curtains | 235 / 10 MWW On Demand (US) | 71" × 74": cost $40.80 → $73.99 (44.9%) | $40.80 | $73.99 | 44.9% | $9.19 / $3.99 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |

### kitchen

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Head Chef, Head Plug**<br>`chef-apron`<br>Cotton Apron | 713 / 6 T Shirt and Sons (GB) | Black / One size: cost $20.97 → $37.99 (44.8%) | $20.97 | $37.99 | 44.8% | $37.29 / $6.19 | NEW (covers Printify; near home_standard)<br>$37.49 / $6.49 | NON-US provider: T Shirt and Sons (GB); US alt: blueprint 5541 Full-Length Apron / provider 217 Fulfill Engine (US), or 7391 Bib Apron / 217; AOP 418/MWW if all-over ok; UK shipping to US is $37.29 first — do not sell on this provider |
| **Plugged-In Kitchen**<br>`plugged-cutting-board`<br>Glass Cutting Board | 938 / 92 Pic The Gift (US) | 11" x 15" / Rectangle: cost $21.56 → $38.99 (44.7%)<br>8" x 11" / Rectangle: cost $15.47 → $27.99 (44.7%) | $21.56 | $38.99 | 44.7% | $14.39 / $3.29 | home_canvas_lg<br>$19.99 / $8.00 | preferred home_standard undercovers; using home_canvas_lg |
| **FP / plug / bolt / charged**<br>`coaster-set`<br>Hardboard Coasters Set of 4 | 2764 / 59 Imagine Your Photos (US) | 4" × 4": cost $20.18 → $36.99 (45.4%) | $20.18 | $36.99 | 45.4% | $5.79 / $1.99 | home_standard<br>$7.99 / $4.00 | — |

### drinkware

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Recharge Station**<br>`recharge-pint`<br>Pint Glass 16oz | 633 / 86 Chill (US) | 16oz: cost $13.28 → $23.99 (44.6%) | $13.28 | $23.99 | 44.6% | $9.39 / $2.99 | desk_mat<br>$10.99 / $7.49 | preferred drinkware_heavy undercovers; using desk_mat |
| **Keep It Cool, Keep It Plugged**<br>`cool-can-cooler`<br>Can Cooler | 951 / 92 Pic The Gift (US) | Regular Can: cost $4.99 → $8.99 (44.5%)<br>Slim Can: cost $4.99 → $8.99 (44.5%) | $4.99 | $8.99 | 44.5% | $5.59 / $0.89 | drinkware_heavy<br>$7.49 / $3.99 | — |
| **Unplugged Hours**<br>`unplugged-wine`<br>Chill Wine Tumbler | 620 / 86 Chill (US) | White / 12oz: cost $18.06 → $32.99 (45.3%) | $18.06 | $32.99 | 45.3% | $6.89 / $2.49 | drinkware_heavy<br>$7.49 / $3.99 | — |

### pets

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Good Boy Fully Charged**<br>`good-boy-bandana`<br>Pet Bandana | 562 / 70 Printed Mint (US) | 20" × 10": cost $14.53 → $25.99 (44.1%)<br>27" × 13": cost $16.37 → $29.99 (45.4%) | $14.53 | $25.99 | 44.1% | $5.69 / $0.99 | home_standard<br>$7.99 / $4.00 | — |
| **Fuel Station**<br>`fuel-bowl`<br>Pet Bowl | 570 / 70 Printed Mint (US) | 16oz: cost $25.21 → $45.99 (45.2%) | $25.21 | $45.99 | 45.2% | $14.89 / $5.39 | home_canvas_lg<br>$19.99 / $8.00 | preferred home_standard undercovers; using home_canvas_lg |
| **Recharge Zone**<br>`recharge-pet-bed`<br>Pet Bed | 419 / 10 MWW On Demand (US) | 28" × 18": cost $29.84 → $53.99 (44.7%)<br>40" × 30": cost $50.48 → $91.99 (45.1%) | $29.84 | $53.99 | 44.7% | $27.29 / $24.99 | NEW (covers Printify; near home_doormat)<br>$27.49 / $24.99 | size mismatch front.png 8850×5850 vs front 15600×12600; no existing class covers Printify $27.29/$24.99 |
| **My Human Knows a Plug**<br>`human-knows-dog-tee`<br>Pet Tank Top | 571 / 70 Printed Mint (US) | M / White: cost $23.15 → $41.99 (44.9%)<br>L / Black: cost $23.15 → $41.99 (44.9%) | $23.15 | $41.99 | 44.9% | $5.99 / $0.99 | hat<br>$6.99 / $3.00 | preferred apparel undercovers; using hat |

### kids-baby

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Newest Plug**<br>`newest-onesie`<br>Baby Short Sleeve Onesie | 568 / 39 SwiftPOD (US) | White / 12M: cost $14.43 → $25.99 (44.5%)<br>White / 18M: cost $14.43 → $25.99 (44.5%) | $14.43 | $25.99 | 44.5% | $4.49 / $2.09 | apparel<br>$4.95 / $2.40 | — |
| **Mini Plug**<br>`mini-plug-tee`<br>Toddler Short Sleeve Tee | 580 / 39 SwiftPOD (US) | Black / 2T: cost $11.02 → $19.99 (44.9%)<br>Black / 3T: cost $11.02 → $19.99 (44.9%) | $11.02 | $19.99 | 44.9% | $4.49 / $2.09 | apparel<br>$4.95 / $2.40 | — |
| **Charging Up**<br>`charging-kids-hoodie`<br>Youth Heavy Blend Hooded Sweatshirt | 314 / 29 Monster Digital (US) | Black / M: cost $22.20 → $39.99 (44.5%)<br>Black / L: cost $22.20 → $39.99 (44.5%)<br>Black / XL: cost $22.20 → $39.99 (44.5%) | $22.20 | $39.99 | 44.5% | $4.49 / $2.09 | crewneck<br>$8.99 / $2.49 | — |

### tech

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Don't Let Me Hit 1%**<br>`dont-hit-1-case`<br>Tough Phone Cases | 269 / 1 SPOKE Custom Products (US) | iPhone 15: cost $11.25 → $19.99 (43.7%)<br>iPhone 15 Plus: cost $11.25 → $19.99 (43.7%) | $11.25 | $19.99 | 43.7% | $4.39 / $0.99 | home_standard<br>$7.99 / $4.00 | — |
| **Minimal FP circle**<br>`slim-fp-case`<br>Slim Phone Cases | 268 / 1 SPOKE Custom Products (US) | iPhone 15: cost $9.87 → $17.99 (45.1%)<br>iPhone 15 Plus: cost $9.87 → $17.99 (45.1%) | $9.87 | $17.99 | 45.1% | $4.39 / $0.99 | home_standard<br>$7.99 / $4.00 | — |
| **Click, Connect, Get Paid**<br>`click-mousepad`<br>Mouse Pad (Rectangle) | 608 / 28 District Photo (US) | 9" × 8" / Rectangle: cost $4.98 → $8.99 (44.6%) | $4.98 | $8.99 | 44.6% | $4.99 / $1.49 | desk_mat<br>$10.99 / $7.49 | — |
| **Website Was Free**<br>`website-laptop-sleeve`<br>Laptop Sleeve | 429 / 1 SPOKE Custom Products (US) | 12": cost $18.47 → $33.99 (45.7%)<br>13": cost $18.47 → $33.99 (45.7%) | $18.47 | $33.99 | 45.7% | $5.09 / $1.99 | home_standard<br>$7.99 / $4.00 | — |

### stationery

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Ideas Worth Plugging**<br>`ideas-notebook`<br>Spiral Notebook - Ruled Line | 74 / 1 SPOKE Custom Products (US) | One Size: cost $8.29 → $14.99 (44.7%) | $8.29 | $14.99 | 44.7% | $5.49 / $1.99 | journal<br>$7.99 / $4.00 | — |

### wall-art

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Plug Map**<br>`poster-1-plug-map`<br>Matte Vertical Posters | 282 / 2 Sensaria (US) | 16″ x 20″ / Matte: cost $12.00 → $21.99 (45.4%)<br>18″ x 24″ / Matte: cost $11.84 → $21.99 (46.2%) | $12.00 | $21.99 | 45.4% | $7.69 / $1.09 | home_canvas_sm<br>$13.99 / $4.49 | — |
| **Hustle Hours**<br>`poster-2-hustle-hours`<br>Matte Vertical Posters | 282 / 2 Sensaria (US) | 16″ x 20″ / Matte: cost $12.00 → $21.99 (45.4%)<br>18″ x 24″ / Matte: cost $11.84 → $21.99 (46.2%) | $12.00 | $21.99 | 45.4% | $7.69 / $1.09 | home_canvas_sm<br>$13.99 / $4.49 | — |
| **Free Is a Feeling**<br>`poster-3-free-is-a-feeling`<br>Matte Vertical Posters | 282 / 2 Sensaria (US) | 16″ x 20″ / Matte: cost $12.00 → $21.99 (45.4%)<br>18″ x 24″ / Matte: cost $11.84 → $21.99 (46.2%) | $12.00 | $21.99 | 45.4% | $7.69 / $1.09 | home_canvas_sm<br>$13.99 / $4.49 | — |
| **Wired Different**<br>`poster-4-wired-different`<br>Matte Vertical Posters | 282 / 2 Sensaria (US) | 16″ x 20″ / Matte: cost $12.00 → $21.99 (45.4%)<br>18″ x 24″ / Matte: cost $11.84 → $21.99 (46.2%) | $12.00 | $21.99 | 45.4% | $7.69 / $1.09 | home_canvas_sm<br>$13.99 / $4.49 | — |
| **Stay Connected**<br>`stay-connected-framed`<br>Framed Vertical Poster | 540 / 2 Sensaria (US) | 16″ x 20″ / Black: cost $57.20 → $103.99 (45.0%)<br>11" x 14" / Black: cost $42.98 → $77.99 (44.9%) | $57.20 | $103.99 | 45.0% | $18.09 / $7.29 | home_canvas_lg<br>$19.99 / $8.00 | preferred home_canvas_sm undercovers; using home_canvas_lg |
| **Plug Parking Only**<br>`plug-parking-sign`<br>Metal Art Sign | 1206 / 228 Taylor (US) | 10″ x 8″ (Horizontal) / 0.12'': cost $17.37 → $31.99 (45.7%)<br>11" x 11" / 0.12'': cost $17.88 → $32.99 (45.8%) | $17.37 | $31.99 | 45.7% | $18.39 / $5.29 | home_canvas_lg<br>$19.99 / $8.00 | preferred home_standard undercovers; using home_canvas_lg |

### outdoor

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Solar Charging**<br>`solar-towel`<br>Beach Towel | 352 / 1 SPOKE Custom Products (US) | 30" × 60": cost $23.81 → $42.99 (44.6%)<br>36" × 72": cost $30.46 → $54.99 (44.6%) | $23.81 | $42.99 | 44.6% | $8.29 / $2.99 | candle_keychain<br>$8.49 / $3.49 | preferred home_standard undercovers; using candle_keychain |
| **Off-Grid Plug**<br>`offgrid-camping-mug`<br>Enamel Camping Mug | 483 / 28 District Photo (US) | 12oz: cost $11.41 → $20.99 (45.6%) | $11.41 | $20.99 | 45.6% | $6.49 / $1.99 | drinkware_heavy<br>$7.49 / $3.99 | — |
| **Unplug Together**<br>`unplug-picnic`<br>Picnic Blanket | 1124 / 28 District Photo (US) | 61" × 51": cost $40.53 → $73.99 (45.2%) | $40.53 | $73.99 | 45.2% | $8.69 / $2.69 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |
| **A Plug Lives Here**<br>`plug-lives-flag`<br>Garden & House Banner | 976 / 92 Pic The Gift (US) | 12'' × 18'': cost $10.49 → $18.99 (44.8%)<br>24.5'' × 32'': cost $20.44 → $36.99 (44.7%) | $10.49 | $18.99 | 44.8% | $6.39 / $1.99 | home_standard<br>$7.99 / $4.00 | — |

### seasonal

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Plugged-In Christmas**<br>`plugged-ornament`<br>Ceramic Ornament | 531 / 59 Imagine Your Photos (US) | Circle / One Size: cost $6.34 → $11.99 (47.1%) | $6.34 | $11.99 | 47.1% | $5.89 / $0.69 | hat<br>$6.99 / $3.00 | preferred sticker undercovers; using hat |
| **Ugly-sweater plugs & bolts**<br>`ugly-sweater-crew`<br>Unisex Heavy Blend Crewneck | 49 / 29 Monster Digital (US) | M / Black: cost $19.45 → $34.99 (44.4%)<br>L / Black: cost $19.45 → $34.99 (44.4%)<br>S / Black: cost $19.45 → $34.99 (44.4%) | $19.45 | $34.99 | 44.4% | $7.99 / $2.09 | crewneck<br>$8.99 / $2.49 | size mismatch front.png 4500×5100 vs front 3319×3761 |
| **Fill It Running Over**<br>`running-over-stocking`<br>Christmas Stocking | 734 / 59 Imagine Your Photos (US) | One size / Red and Black/Natural: cost $17.16 → $30.99 (44.6%) | $17.16 | $30.99 | 44.6% | $8.79 / $3.99 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |

### running-over

| Item | Blueprint / provider | Variant(s) | Base cost | Proposed price | Margin | Ship Printify first/extra | Proposed ship class first/extra | Issues |
|---|---|---|---:|---:|---:|---:|---:|---|
| **Give, and it shall be given unto you**<br>`kjv-woven-blanket`<br>Woven Blanket | 1626 / 10 MWW On Demand (US) | Artwork / 52'' × 37'': cost $28.89 → $52.99 (45.5%)<br>Artwork / 60" × 50": cost $39.73 → $71.99 (44.8%) | $28.89 | $52.99 | 45.5% | $10.39 / $4.99 | desk_mat<br>$10.99 / $7.49 | preferred home_standard undercovers; using desk_mat |
| **Give, and it shall be given unto you**<br>`kjv-serving-tray`<br>Acrylic Serving Tray | 780 / 59 Imagine Your Photos (US) | 11" x 17" / Clear: cost $77.09 → $139.99 (44.9%) | $77.09 | $139.99 | 44.9% | $23.99 / $4.99 | NEW (covers Printify; near home_standard)<br>$23.99 / $4.99 | no existing class covers Printify $23.99/$4.99 |
| **Luke 6:38**<br>`kjv-bookmarks`<br>Bookmark | 765 / 59 Imagine Your Photos (US) | One size / White: cost $6.11 → $10.99 (44.4%) | $6.11 | $10.99 | 44.4% | $6.09 / $0.99 | hat<br>$6.99 / $3.00 | preferred sticker undercovers; using hat |
| **Pressed Down, Shaken Together**<br>`pressed-down-framed`<br>Framed Vertical Poster | 540 / 2 Sensaria (US) | 16″ x 20″ / Black: cost $57.20 → $103.99 (45.0%)<br>11" x 14" / Black: cost $42.98 → $77.99 (44.9%) | $57.20 | $103.99 | 45.0% | $18.09 / $7.29 | home_canvas_lg<br>$19.99 / $8.00 | preferred home_canvas_sm undercovers; using home_canvas_lg |
| **Give, and it shall be given unto you**<br>`thanksgiving-tea-towel`<br>Tea Towel | 677 / 70 Printed Mint (US) | White / 28" × 28": cost $17.47 → $31.99 (45.4%) | $17.47 | $31.99 | 45.4% | $5.89 / $0.99 | home_standard<br>$7.99 / $4.00 | — |

## Print-area confirmation highlights

| Item | File px | Placeholder | Match |
|---|---|---|---|
| stay-charged-pullover | front 4200×2799 / back 4200×4800 | front 4200×2799, back 4200×4800 | yes |
| day-one-zip | left-chest 1193×1193 | front_left_chest 1193×1193 | yes |
| good-measure-longsleeve | front 4200×4800; sleeve 900×3600 ASSUMED | front/back 4200×4800 only — no sleeve | FRONT only; sleeve FAIL |
| charged-socks | 1348×5595 | leg panel matches SPOKE socks | yes (per manifest) |
| pin-set | 519×519 ×3 | Custom Pin Buttons | confirm set vs single pin pricing |
| poster 18×24 | 5400×7200 | Sensaria 18×24 | check per-row |
| framed 16×20 | 4800×6000 | Sensaria framed 16×20 | check per-row |
| chef-apron | 2953×3780 | 713 front 2953×3780 | size OK but provider GB |

- `poster-1-plug-map` placeholders: {'front': '3300×4200'}
- `poster-2-hustle-hours` placeholders: {'front': '3300×4200'}
- `poster-3-free-is-a-feeling` placeholders: {'front': '3300×4200'}
- `poster-4-wired-different` placeholders: {'front': '3300×4200'}
- `stay-connected-framed` placeholders: {'front': '3300×4200'}
- `pressed-down-framed` placeholders: {'front': '3300×4200'}

## Notes for next step (after Cheke price OK)

1. Fix long-sleeve (drop sleeve or change blank) and remake apron for a US provider before drafting those two.
2. Embroidery items need digitizing + sample after first order — do not promise stitch-perfect mockups.
3. Multi-area DTG costs are estimates until hidden drafts are created (still requires Cheke OK to create drafts).
4. Printify Choice (zip hoodie, gaiter) — confirm US routing on real orders.
5. Pin set is per-pin ($3.99) or propose $12.99 for all three designs as a set.
6. Serving tray ($77 base → ~$140 retail) and framed posters (~$57 → ~$104) are expensive; call out before drafting.
7. Nothing drafted or published in this pass.

## Sources

- `https://api.printify.com/v1/catalog/blueprints/{id}/print_providers/{id}/variants.json`
- `https://api.printify.com/v1/catalog/blueprints/{id}/print_providers/{id}/shipping.json`
- `https://api.printify.com/v1/catalog/print_providers/{id}.json` (location)
- `https://printify.com/product-catalog-service/api/v2/blueprints/{id}/print-providers/{id}/variants` (production cost)
- Prior margin approach: `/workspace/logos/freeplug/merch/PRINTIFY-DRAFT-REPORT.md`
- Shipping classes reference: PR #24 `shipping.ts` + Cheke-approved rate table from go-live session
