# Freeplug — girlfriend-themed tee set (seven lines)

A consistent set of seven tees, one clean centered layout each: a strictly minimal line icon, the line, and the official curly Fp monogram (`/workspace/logos/FP/svg/fp-monogram-black.svg`). Rough concepts only. Nothing has been published, uploaded, or sent to print. Nothing goes live without Cheke's OK.

Wording is kept exactly, including "don't". A typographic apostrophe is used in "don't".

## The seven lines

| ID | Line | Icon |
|---|---|---|
| `01-no-time` | FREEPLUG DON’T HAVE TIME FOR GIRLFRIENDS. | Struck heart (same mark as the no-time calendar Friday) |
| `02-plugging-needy` | Freeplug don’t have time for girlfriends. Too busy plugging the needy. | The calendar plug, with a cord that forms the shared heart |
| `03-deadlines-deeds` | No girlfriend. Just deadlines and good deeds. | Calendar clock + a two-stroke check, as one lockup |
| `04-status-shipping` | Relationship status: shipping. | Calendar package box |
| `05-taken-mission` | Taken by the mission. | Target (two circles + four ticks) |
| `06-single-busy-building` | Single. Busy. Building. | Three stroke squares stacked 2+1 |
| `07-love-language` | My love language is free websites. | Chevrons flanking the shared heart |

All seven marks use the same stroke, caps, and joins as the no-time calendar set (stroke 1.7 on a 24-unit grid). Stroke only. No fills, no scenes, no extra detail.

Each line has a light-garment and a dark-garment version (`{id}-light` / `{id}-dark`).

## Deliverables

- Path-only SVG (type as paths; icons as stroke paths): `svg/`
- Transparent 4500×5400 PNG: `png/`
- 1200×1440 web mockup JPEGs on ivory or black: `web/{id}-{light,dark}.jpg`
- Variant index: `variants.json` (id, text, garment, ink, accent, svg, png, web)
- Contact sheet: `/workspace/logos/freeplug-girlfriend-tee/contact-sheet.png`
- Contrast log: `CONTRAST-CHECK.csv`

Rebuild with `python3 build_tees.py` from this folder.

## Colors

Same palette as the no-time, knock, and 144k concepts. Only hex values found in existing Freeplug files are used.

| Hex | Role | Source |
|---|---|---|
| `#111111` | Dark ink (all type on light garments). Black tee ground. | `/workspace/logos/FP/USAGE.md` (Ink black); also merch `designs.json` (`contrast.ink`) and `build_masters.py` (`INK`). |
| `#F7F3EA` | Ivory ink (all type on dark garments). Ivory tee ground. | Merch `designs.json` (`contrast.ivory`) and `build_masters.py` (`IVORY`). |
| `#8B1A1E` | Freeplug Red. Light-garment accent only: icons, monogram. Never used for slogan text. | `/workspace/logos/FP/USAGE.md` (Freeplug Red, primary). |
| `#FFDCD6` | Soft pink. Dark-garment accent only: icons, monogram. | `/workspace/logos/freeplug-merchandise/wordmark-variants-pop/freeplug-dev-light.svg`. |
| `#FFFFFF`, `#232323` | White and charcoal tee grounds, contrast-checked, not printed in the art. | `/workspace/logos/FP/USAGE.md`. |

Red `#8B1A1E` is never used on dark garments (2.04:1 on black). Soft pink is used on dark only because it clears 4.5:1. Slogan text is always ink, never red or pink.

## Fonts

| Font | Use | License |
|---|---|---|
| **Freeplug Dispatch Bold** | All seven lines | Owner-created Freeplug font, by Ezequiel Casillas with the 72 After team. See `/workspace/logos/freeplug/FONT-LICENSE.txt`. Personal use is allowed; commercial use of the font files needs Freeplug's permission. Using them on Cheke's own merch matches existing verse-tee practice. Do not redistribute the font files. |

The curly Fp monogram is custom-drawn, not a font. The icons are custom stroke marks, not a font.

## Garment pairings

Dark ink only on light garments. Light ink only on dark garments.

| Version | Print on | Type | Icons and monogram |
|---|---|---|---|
| `*-light` | Ivory, white, cream, natural, and other light blanks | `#111111` | `#8B1A1E` |
| `*-dark` | Black, charcoal, and other dark blanks | `#F7F3EA` | `#FFDCD6` |

Do not print a light file on a dark tee, or a dark file on a light tee.

## Contrast

Same method as the merch masters and the earlier tee sets: relative luminance, ratio `(L1+0.05)/(L2+0.05)`. Every element, including icons and the monogram, is held to 4.5:1.

**112 checks, 0 fails.** Full log: `CONTRAST-CHECK.csv`.

| Ink | Ground | Ratio |
|---|---|---:|
| `#111111` | Ivory `#F7F3EA` | 17.05 |
| `#111111` | White `#FFFFFF` | 18.88 |
| `#8B1A1E` | Ivory `#F7F3EA` | 8.37 |
| `#8B1A1E` | White `#FFFFFF` | 9.27 |
| `#F7F3EA` | Black `#111111` | 17.05 |
| `#F7F3EA` | Charcoal `#232323` | 14.19 |
| `#FFDCD6` | Black `#111111` | 14.80 |
| `#FFDCD6` | Charcoal `#232323` | 12.32 |

## Caveats

- These are review-ready concepts, not locked production files. Placement and type size can be tightened once a direction is chosen.
- The first line also exists as a three-direction typographic exploration under `/workspace/logos/freeplug-no-time-tee/`. This set is the consistent seven-line family, one layout each.
- No trademarked marks. No imagery of real people. No AI mentions in the art or in this note.
- Rebuild requires fontTools, cairosvg, and Pillow, plus the font paths cited above.
- Publish nothing and upload nothing until Cheke types an OK for this specific work.
