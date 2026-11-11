# Buyer wordmark kits

Place Cheke’s archives here, then run:

```bash
node scripts/ingest-buyer-wordmark-kits.mjs
```

## Incoming files

- `incoming/kit-cursive.zip` — Cursive + Cursive Plate PNGs
- `incoming/kit-pop.zip` — Pop v2 PNGs
- `incoming/kit-popplate.zip` — Pop Plate v2 PNGs

Output: `public/merch/buyer-wordmark-art/{style}/{Brand}-{on-dark|on-light}.png`

Kit PNG names: `{brand}-dark.png` (dark ink → light garments → `on-light` in public tree),
`{brand}-light.png` (light ink → dark garments → `on-dark`).

Chest crops prefer `bar/` then top-level; `before/` folders are ignored at ingest.
