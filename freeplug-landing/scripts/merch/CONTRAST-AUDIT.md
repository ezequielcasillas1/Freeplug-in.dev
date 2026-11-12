# Freeplug contrast audit (read-only)

**When:** Sunday Nov 8, 2026, 6:34 PM CT (America/Chicago)  
**Shop:** 29664778  
**Rule source:** `/workspace/logos/freeplug/merch/CONTRAST_MAP.json`  
**Rule:** Dark/black ink never on dark blanks; light/ivory ink never on light blanks.  
`-light-garment.png` / `*-light.png` = dark ink → light blanks only.  
`-dark-garment.png` / `*-dark.png` = light ink → dark blanks only.

**Scope:** All 28 existing Printify products (6 shirts + 22 wave-1/2 drafts). GET only. No uploads, updates, publishes, or site changes.

**Method:**
- `GET /v1/shops/29664778/products/{id}.json` for each product (User-Agent set; token from env only).
- Enabled variants only (`is_enabled: true`).
- Blank color from Printify color options (not size/shape alone).
- Ink from uploaded filename suffixes where present; for hats still on `*-standard-thread-front.png`, ink confirmed from local printify-ready PNGs + `THREADS.md` (pixel sample).
- Live sellability from `/workspace/pr24src/freeplug-landing/src/lib/merch/shirts/catalog.ts` + `collections/collections-catalog.json` / `catalog.ts` (and `/workspace/pr24-catalog.json`).

Raw product JSON saved under `printify-work/contrast-audit/` (local cache of GETs only).

---

## Violations

### 1. Freeplug Plugged In Low-Profile Cap — Black

| Field | Value |
|---|---|
| **Product id** | `6af0dd8bc85eee5c4804aba2` |
| **Slug** | `plugged-in-low-profile-cap` |
| **Enabled blank** | Black (variant `104278`, title `Black / One size`) |
| **Uploaded file** | `freeplug-low-profile-plugged-standard-thread-front.png` (position `front_embroidery`) |
| **Ink on file** | Solid black `#000000` (100% dark opaque pixels). `THREADS.md`: “Charcoal #454545, tonal on black”. Draft report also noted Black1800 on black. |
| **Why it fails** | Dark/black ink on a dark (Black) blank. |
| **Printify visible** | `false` (draft) |
| **Sellable on live site?** | **Yes.** Collections catalog option `one-size` → variant `104278`, `$40.99`. Merch collections are live. |

**Proposed fix (do not apply until Cheke OK):**
1. **Preferred:** Ask Milo for a true ivory `front-embroidery-dark-garment.png` for this design, then swap the Printify image on the Black variant to that file.  
   **Note:** Milo’s current local `front-embroidery-dark-garment.png` is still charcoal `#404040`, and `CONTRAST_MAP.json` incorrectly lists its ink as “ivory”. The map and the PNG disagree; charcoal-on-black would still violate the rule.
2. **Alternative:** Disable Black; enable a light blank (White or Khaki) and upload `front-embroidery-light-garment.png` (black ink). Update the live catalog variant id to match.
3. Do not treat “tonal black-on-black” as compliant under the new rule unless Cheke explicitly exempts it.

---

### 2. Freeplug FP Circle Trucker Patch Cap — Black / White patch

| Field | Value |
|---|---|
| **Product id** | `6af0dd85bc999340580aba5e` |
| **Slug** | `fp-circle-trucker-cap` |
| **Enabled blank** | `Black / White patch / Circle` (variant `147781`) |
| **Print substrate** | White patch (embroidery sits on the patch, not the black crown) |
| **Uploaded file** | `freeplug-trucker-circle-standard-thread-front.png` (position `front_patch`) |
| **Ink on file** | Red + ivory (`THREADS.md`: Red #ba3d3d + ivory #f7f3ea). Pixel sample ~81% red, ~19% light/ivory. |
| **Why it fails** | Ivory/light thread on a white (light) patch. Red on white is fine; the ivory portion is light-on-light. |
| **Printify visible** | `false` (draft) |
| **Sellable on live site?** | **Yes.** Collections catalog option `one-size` → variant `147781`, `$36.99`. |

**Proposed fix (do not apply until Cheke OK):**
1. **Preferred:** Swap the Printify patch image to Milo’s `trucker-circle/front-embroidery-light-garment.png` (red + dark/black ink), which is the correct pair for a white patch.
2. **Alternative:** Switch to a Black patch variant and use `front-embroidery-dark-garment.png` (red + ivory, with ivory outline). That needs a different enabled variant id and a live catalog update.
3. Re-check mockups after the swap; white-patch + dark lettering should read clearly.

---

## Clear passes (multi-color apparel)

These already split print areas by blank and match the map.

### Six shirts (all live on site; Printify `visible: true`)

| Product | Id | Enabled colors | Files |
|---|---|---|---|
| I Know a Plug | `6af0d0f27a7a4ea34b0b118b` | White, Natural, Black, Charcoal | light-garment → White/Natural; dark-garment → Black/Charcoal (front+back) |
| Circle Logo | `6af0d0f95dc84ade530368cd` | same | same pattern (front+back) |
| Get Plugged In | `6af0d0fe5dc84ade530368cf` | same | same pattern (front only) |
| Free Game | `6af0d1029219dad5010831c9` | same | same pattern (front only) |
| Website Was Free | `6af0d107e696fed2aa02c8ac` | same | same pattern (front only) |
| Day One | `6af0d10bc85eee5c48049e0b` | same | same pattern (front only) |

Live shirt colors from `catalog.ts`: Black, Charcoal, Natural, White — all four are correctly paired.

### Hero Crewneck (live via collections; Printify `visible: false`)

| Id | `6af0dc44fb9024aaf308bd94` |
|---|---|
| Enabled | Sand, White, Black × S–3XL (18 variants) |
| Files | `*-light.png` (dark+red ink) → Sand/White; `*-dark.png` (ivory) → Black; split per size group S / M / L–3XL |
| Live | `CREWNECK_COLORS = Black, White, Sand` in `collections/catalog.ts` — all correctly paired |

---

## Hats that pass (enabled blank only)

| Product | Id | Blank | File | Ink | Verdict |
|---|---|---|---|---|---|
| FP Dad Hat | `6af0dd88bc999340580aba6b` | Black (`118238`) | `freeplug-dad-fp-standard-thread-front.png` | Ivory / light (100% light pixels; THREADS: Ivory #f7f3ea) | Pass — light on dark |
| Cuffed Beanie | `6af0dd8ec85eee5c4804abb8` | Black (`116417`) | `freeplug-beanie-freeplug-standard-thread-front.png` | Red + ivory | Pass — light/red on dark |

Both are **sellable on the live site** (catalog `one-size`). They still use pre-contrast-pass `standard-thread` filenames; Milo’s new `*-light-garment` / `*-dark-garment` files exist locally but are **not** on the Printify products yet. No blank violation for the currently enabled color.

---

## Single-blank / non-apparel drafts (no blank mismatch found)

These have one enabled size/scent option (or White only). Blank is light ceramic, white bottle, white sticker stock, ivory journal, etc. Uploaded wraps use dark (and brand-red) art on light fields, or full-bleed designs that define their own surface. **No dark-ink-on-dark-blank or light-ink-on-light-blank pairing found** under the garment rule.

| Product | Id | Enabled | File | Notes |
|---|---|---|---|---|
| Fully Charged Mug | `6af0dc189219dad501083c14` | 11oz, 15oz | wrap-11oz / wrap-15oz | Ceramic; dark+red art |
| Cheap Free Latte Mug | `6af0dc26e696fed2aa02d36b` | 12oz | wrap | Full-bleed black field on light mug; within-art grey-on-black text is a design-contrast nit, not a blank-map fail |
| Know a Plug Mug | `6af0dc2f5a7173e14f0ae104` | 15oz | wrap | Dark+red on ceramic |
| Day One Tumbler | `6af0dc297a7a4ea34b0b1d11` | 20oz | wrap-20oz | Dark text on cream wrap |
| Free Refills Travel Mug | `6af0dc2c5a7173e14f0ae0f4` | 15oz | wrap | Dark art on stainless travel mug |
| Water Bottle | `6af0dc34c85eee5c4804a972` | 20oz / **White** | wrap-20oz | Black “STAY” + red on cream wrap → White bottle. Pass. Live: `20oz-white` |
| Desk Mat | `6af0dc31e696fed2aa02d392` | 12×22 | wrap | Full-bleed charcoal pattern |
| Candle | `6af0dc377a7a4ea34b0b1d36` | Clean Cotton / 9oz | front-label | Ivory label field + dark type |
| Canvas | `6af0dd82e696fed2aa02d577` | 16×20, 24×36 | mirror-safe | Ivory field + dark KJV type |
| Pillow | `6af0dd995dc84ade530375ea` | 18×18 | identical front/back | Ivory field + dark type |
| Doormat | `6af0dd9ce696fed2aa02d5ce` | 24×16 | come-on-in | Dark art on natural coir (not in light/dark garment lists) |
| Journal | `6af0dd93f2139253b306e22a` | Journal | front-only-template-aligned | Ivory hardcover |
| Keychain | `6af0dd96c85eee5c4804abd5` | One size | safe-circle-front | Acrylic; red/ivory mark |
| Stickers (4) | `6af0dc47…` / `49…` / `4c…` / `4e…` | White / Die-Cut / 3×3 | die-cut PNGs | White sticker stock |

All 22 collection products are in the live site catalog (sellable when collections flag is on). Printify `visible: false` on these drafts; site checkout still sends orders to these ids.

---

## Summary

| Result | Count |
|---|---:|
| Products audited | 28 |
| Violating products | **2** (low-profile Black; trucker White-patch ivory) |
| Violating colors sellable live | **Both yes** |
| Apparel with correct light/dark split | 6 shirts + 1 crewneck |
| Hats OK on enabled blank | Dad, Beanie |
| Wave-3 items | Not in Printify yet — out of scope |

**Stale-file note:** All four hat drafts still host `*-standard-thread-front.png`. Milo’s contrast-pass `front-embroidery-{light,dark}-garment.png` files are on disk only. Even the two passing hats should be refreshed to the new files when Cheke approves a Printify update (dad → dark-garment ivory; beanie → dark-garment red+ivory with outline).

**Map/file bug to flag to Milo (no Printify change):** `low-profile-plugged` `front-embroidery-dark-garment.png` is charcoal, but `CONTRAST_MAP.json` says ink “ivory”. Fix the art or the map before any swap.

**No actions taken.** Report only.
