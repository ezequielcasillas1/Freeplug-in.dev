# Shop lifestyle hero audit (195 items)

## Rules applied

- **No fallback placement on hidden lifestyle slides** — `resolveShopGalleryPlacement` and `resolvePreviewWordmark` return `null` when a slide has `hide: true` (no product-type placement on skin).
- **Leather-patch hats (2707, 1287)** — slide 0 lifestyle hidden; patch placement on slide 1 (~70% patch width, `inkBlankKind: dark` → light ink on brown leather).
- **1221** — both slides are flat product; patch centered with light ink (unchanged, user-approved).
- **Two-slide rebalance** — when slide 0 was wrongly hidden but has less skin than slide 1, inference keeps the flat product slide visible.
- **Salvage** — if every slide was hidden, pick the lowest-skin slide and run `inferSafeFlatPlacement` (print-area seed, skin overlap cap 16%).

## Manual overrides (checked / fixed)

| Slug | Fix |
|------|-----|
| `mid-profile-baseball-cap-with-leather-patch-rect-2707` | Hide lifestyle slide 0; patch on slide 1 |
| `dad-hat-with-leather-patch-round-1287` | Hide lifestyle slide 0; patch on slide 1 |
| `copper-vacuum-insulated-bottle-22oz-572` | ~60% bottle width (`width: 0.36`), dark ink on white body |
| `value-cabana-stripe-beach-towel-5583` | `cursive-plate` + light ink on both slides |
| `district-v-i-t-men-s-fleece-hoodie-1979` | Flat dark slide 0; hide lifestyle slide 1 |
| `women-s-perfect-tri-midi-long-sleeve-hoodie-3809` | Hide slide 0; print on slide 1 |
| `beach-wash-tote-5106` | Hide slide 0; bag body slide 1 |
| `day-tote-5096` | Hide slide 0; bag body slide 1 |
| `canvas-mesh-back-cap-4802` | Hide slide 0; crown slide 1 |
| `unisex-flyer-jogger-4628` | Hide slide 0; flat product slide 1 |

Full machine list: `/opt/cursor/artifacts/shop-lifestyle-hero-audit.json` (`hiddenCount`: 61 hidden slides across the catalog).

## Verification

- `shop-overlay-contrast.test.ts` — all 195 grid heroes ≥ 3:1 contrast under overlay bbox.
- `shop-visible-overlay.test.ts` — every grid card and PDP hero index renders `mode: 'full'`.
- Contact sheets: `shop-overlay-contact-pdp-page1–5.png`, `shop-overlay-contact-grid-page1–2.png`.
