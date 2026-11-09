# Printify US blanks — top items research

Read-only analysis from partial `catalog-us.jsonl` (keyword-filtered fetch).

## Data caveats

- **Partial catalog:** 2,395 US blueprint×provider rows packaged (~2,219 blueprints scanned of 3,022; keyword filter on titles).
- **Not in repo:** Raw JSONL is not committed; regenerate from Printify catalog fetch.
- **Costs:** Product-catalog-service v2 unit costs (typically one print area); multi-area DTG may cost more at draft time.
- **Variant titles:** Many variants lack titles in this dump; size/color counts use parsed titles where present.
- **Printify Choice:** Lowest cost often routes via Choice; confirm fulfillment facility on real orders.

## Summary

- **Total picks:** 195 unique blueprints (one best US provider each).
- **Typical margin at suggested retail:** 44.9%–53.5% (formula: retail = ceil to next $X.99 from cost_max ÷ 0.55).
- **Cheapest pick (max variant cost):** Kiss-Cut Stickers — $2.32
- **Priciest pick:** Matte Canvas, Framed (Multi-color) — $150.16

### Counts per category

| Category | Count |
| --- | ---: |
| Apparel — Tees | 22 |
| Apparel — Long sleeves | 12 |
| Apparel — Hoodies & sweatshirts | 18 |
| Apparel — Tanks | 8 |
| Hats | 12 |
| Drinkware | 14 |
| Home & decor | 22 |
| Wall art | 14 |
| Bags | 12 |
| Tech & desk | 10 |
| Pets | 7 |
| Outdoor & seasonal | 12 |
| Jewelry & pins | 6 |
| Socks & shoes | 6 |
| Kids & baby | 10 |
| Stickers & paper | 10 |

### Five cheapest (by cost_max)

| Blueprint | Brand/Model | Cost max | Suggested retail |
| --- | --- | ---: | ---: |
| Kiss-Cut Stickers (#400) | Generic brand  | $2.32 | $4.99 |
| Square Stickers (#384) | Generic brand  | $2.40 | $4.99 |
| Mouse Pad (Rectangle) (#608) | Generic brand  | $4.98 | $9.99 |
| Kiss-Cut Sticker Sheet (#5372) | Generic brand  | $5.14 | $9.99 |
| Round Vinyl Stickers (#564) | Generic brand  | $5.52 | $10.99 |

### Five priciest (by cost_max)

| Blueprint | Brand/Model | Cost max | Suggested retail |
| --- | --- | ---: | ---: |
| Matte Canvas, Framed (Multi-color) (#944) | Generic brand  | $150.16 | $273.99 |
| Colored Frame Posters (#5651) | Roma Imaging  | $132.56 | $241.99 |
| Matte Canvas, Stretched, 0.75" (Multi-Size) (#937) | Generic brand  | $115.65 | $210.99 |
| Matte Canvas, Stretched, 1.25" (#1159) | Generic brand  | $90.97 | $165.99 |
| Pet Bed (#419) | Generic brand  | $81.40 | $147.99 |

## Buyer section — recommended tabs & filters

**Primary tabs** (mirror category groups below): Apparel, Hats, Drinkware, Home, Wall art, Bags, Tech & desk, Pets, Kids, Outdoor & seasonal, Accessories (socks, jewelry, stickers).

**Filters:**
- Price band (under $25 / $25–50 / $50+ suggested retail)
- Product type (tee, hoodie, mug, poster, …)
- Brand (Bella+Canvas, Gildan, Comfort Colors, …)
- Color family (when variant titles available)
- Size (apparel & kids)

**Sort defaults:** Featured (score), Price low→high, Margin high→low.

## Items by category

### Apparel — Hoodies & sweatshirts

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 49 | Unisex Heavy Blend™ Crewneck Sweatshirt | Gildan 18000 | Printify Choice | 274 | $17.87–$25.32 | $7.39/$2.09 | $46.99 | 46.1% | Popular blank; Choice routes across US network |
| 175 | Unisex Sponge Fleece Pullover Hoodie | Bella+Canvas 3719 | Fulfill Engine | 332 | $37.93–$44.25 | $7.99/$2.09 | $80.99 | 45.4% | Solid US cost + shipping data |
| 1979 | District® V.I.T.™ Men's Fleece Hoodie | District DT6100 | Fulfill Engine | 269 | $30.51–$38.01 | $7.99/$2.09 | $69.99 | 45.7% | Solid US cost + shipping data |
| 439 | Three-Panel Fleece Hoodie | Lane Seven LS14001 | Printify Choice | 97 | $23.05–$25.79 | $7.39/$2.09 | $46.99 | 45.1% | Choice routes across US network |
| 92 | Unisex College Hoodie | AWDIS JH001 | Printify Choice | 90 | $24.07–$27.30 | $7.39/$2.09 | $49.99 | 45.4% | Choice routes across US network |
| 528 | Champion Hoodie | Champion S700 | Ink Blot | 60 | $35.99–$41.22 | $10.39/$2.49 | $74.99 | 45.0% | Solid US cost + shipping data |
| 5485 | Men's Cotton Polyester Hoodie | Port & Company® PC68H | Fulfill Engine | 190 | $22.29–$29.69 | $7.99/$2.09 | $53.99 | 45.0% | Solid US cost + shipping data |
| 314 | Youth Heavy Blend Hooded Sweatshirt | Gildan 18500B | Monster Digital | 30 | $22.20–$22.20 | $4.49/$2.09 | $40.99 | 45.8% | Solid US cost + shipping data |
| 2001 | Unisex Heavyweight Pullover Hoodie | Lane Seven LS19001 | Printify Choice | 36 | $28.66–$30.19 | $7.39/$2.09 | $54.99 | 45.1% | Choice routes across US network |
| 1525 | Unisex Midweight Softstyle Fleece Hoodie | Gildan SF500 | Printify Choice | 181 | $24.99–$28.78 | $7.39/$2.09 | $52.99 | 45.7% | Choice routes across US network |
| 3613 | Core Fleece Crewneck Sweatshirt | Port & Company® PC78 | Fulfill Engine | 174 | $25.90–$33.31 | $7.99/$2.09 | $60.99 | 45.4% | Solid US cost + shipping data |
| 1925 | Unisex Fleece Zip Up Hoodie | Independent Trading Company SS4500Z | Printify Choice | 17 | $36.35–$38.27 | $7.39/$2.09 | $69.99 | 45.3% | Choice routes across US network |
| 3483 | V.I.T. Heavyweight Fleece Hoodie | District DT6150 | Fulfill Engine | 164 | $38.65–$46.05 | $7.99/$2.09 | $83.99 | 45.2% | Solid US cost + shipping data |
| 536 | Unisex EcoSmart® Pullover Hoodie Sweatshirt | Hanes P170 | SwiftPOD | 144 | $23.83–$31.49 | $7.99/$2.09 | $57.99 | 45.7% | Solid US cost + shipping data |
| 696 | Unisex Hooded Sweatshirt | Independent Trading Company SS4500 | SwiftPOD | 122 | $23.28–$25.97 | $7.99/$2.09 | $47.99 | 45.9% | Solid US cost + shipping data |
| 95 | Unisex Sweatshirt | AWDIS JH030 | Printify Choice | 120 | $24.98–$27.19 | $7.39/$2.09 | $49.99 | 45.6% | Choice routes across US network |
| 3607 | Garment-Dyed Crewneck Sweatshirt | Port & Company® PC098 | Fulfill Engine | 126 | $33.72–$41.12 | $7.99/$2.09 | $74.99 | 45.2% | Solid US cost + shipping data |
| 723 | Unisex Crew Neck Sweatshirt | Independent Trading Company SS3000 | Printify Choice | 120 | $25.91–$35.25 | $8.79/$2.09 | $64.99 | 45.8% | Choice routes across US network |
### Apparel — Long sleeves

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 77 | Unisex Heavy Blend™ Hooded Sweatshirt | Gildan 18500 | Printify Choice | 355 | $21.58–$25.71 | $7.39/$2.09 | $46.99 | 45.3% | Popular blank; Choice routes across US network |
| 41 | Unisex Jersey Long Sleeve Tee | Bella+Canvas 3501 | Printify Choice | 65 | $18.43–$21.25 | $3.99/$2.09 | $38.99 | 45.5% | Choice routes across US network |
| 3004 | Unisex Tri-Blend Long Sleeve Colorblock Raglan | Allmade AL6009 | Printify Choice | 53 | $22.70–$30.90 | $4.95/$2.40 | $56.99 | 45.8% | Choice routes across US network |
| 2831 | Women's Perfect Tri Long Sleeve Hoodie | District DM139L | Fulfill Engine | 41 | $20.12–$23.40 | $7.99/$2.09 | $42.99 | 45.6% | Solid US cost + shipping data |
| 2865 | Women's Posi-UV Pro Long Sleeve | Sport-Tek LST420LS | Printify Choice | 45 | $20.58–$28.70 | $4.95/$2.40 | $52.99 | 45.8% | Choice routes across US network |
| 3809 | Women's Perfect Tri Midi Long Sleeve Hoodie | District DT1390L | Printify Choice | 44 | $24.48–$31.85 | $7.39/$2.09 | $57.99 | 45.1% | Choice routes across US network |
| 3554 | Laguna Raglan Sweatshirt | Next Level NL9000 | Fulfill Engine | 49 | $34.46–$40.21 | $7.99/$2.09 | $73.99 | 45.7% | Solid US cost + shipping data |
| 3472 | Featherweight French Terry Long Sleeve Crewneck | District DT572 | Printify Choice | 42 | $26.28–$33.65 | $7.39/$2.09 | $61.99 | 45.7% | Choice routes across US network |
| 3155 | Halftime Long Sleeve Hoodie | Sport-Tek ST6044 | Printify Choice | 37 | $22.54–$30.74 | $8.79/$2.09 | $55.99 | 45.1% | Choice routes across US network |
| 1708 | Unisex French Terry Raglan Crewneck | Lane Seven LS13004 | Printify Choice | 34 | $26.05–$29.34 | $7.39/$2.09 | $53.99 | 45.7% | Choice routes across US network |
| 3157 | Long Sleeve Ultimate Performance Crew | Sport-Tek ST700LS | Fulfill Engine | 36 | $24.67–$32.07 | $4.49/$2.09 | $58.99 | 45.6% | Solid US cost + shipping data |
| 4397 | Repeat 1/2-Zip Long Sleeve Hooded Jacket | Sport-Tek JST488 | Fulfill Engine | 56 | $45.48–$52.74 | $8.29/$2.49 | $95.99 | 45.1% | Solid US cost + shipping data |
### Apparel — Tanks

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 39 | Unisex Jersey Tank | Bella+Canvas 3480 | Printify Choice | 41 | $13.36–$15.58 | $3.99/$2.09 | $28.99 | 46.3% | Popular blank; Choice routes across US network |
| 472 | Women's Cotton Tee | Bella+Canvas 6400 | Printify Choice | 68 | $12.40–$17.61 | $3.99/$2.09 | $32.99 | 46.6% | Choice routes across US network |
| 1459 | Unisex Garment-Dyed Tank Top | Comfort Colors® Print on Demand 9360 | Printify Choice | 191 | $19.79–$24.70 | $3.99/$2.09 | $44.99 | 45.1% | Choice routes across US network |
| 571 | Pet Tank Top | Doggie Skins 3902 | Printed Mint | 11 | $23.15–$23.15 | $5.99/$0.99 | $42.99 | 46.2% | Limited variant breadth |
| 4135 | PosiCharge Reversible Mesh Tank | Sport-Tek ST5000 | Fulfill Engine | 105 | $16.77–$24.03 | $4.49/$2.09 | $43.99 | 45.4% | Solid US cost + shipping data |
| 18 | Women's Ideal Racerback Tank | Next Level 1533 | Printify Choice | 94 | $12.11–$14.23 | $3.99/$2.09 | $25.99 | 45.2% | Choice routes across US network |
| 3076 | The Concert Tank | District DT5300 | Printify Choice | 94 | $14.61–$22.05 | $4.95/$2.40 | $40.99 | 46.2% | Choice routes across US network |
| 5478 | Women's Cotton Tank Top | Next Level NL3933 | Printify Choice | 72 | $15.02–$18.88 | $3.99/$2.09 | $34.99 | 46.0% | Choice routes across US network |
### Apparel — Tees

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 12 | Unisex Jersey Short Sleeve Tee | Bella+Canvas 3001 | Printify Choice | 1192 | $11.29–$20.24 | $3.99/$2.09 | $36.99 | 45.3% | Popular blank; Choice routes across US network |
| 6 | Unisex Heavy Cotton Tee | Gildan 5000 | Printify Choice | 531 | $9.68–$13.47 | $3.99/$2.09 | $24.99 | 46.1% | Popular blank; Choice routes across US network |
| 145 | Unisex Softstyle T-Shirt | Gildan 64000 | Printify Choice | 486 | $10.10–$15.21 | $3.99/$2.09 | $27.99 | 45.7% | Popular blank; Choice routes across US network |
| 3013 | Unisex Heather CVC Short Sleeve Tee | Bella+Canvas BC3001CVC | Ink Blot | 668 | $15.86–$26.58 | $5.69/$2.49 | $48.99 | 45.7% | Solid US cost + shipping data |
| 706 | Unisex Garment-Dyed T-shirt | Comfort Colors® Print on Demand 1717 | Printify Choice | 379 | $12.65–$18.34 | $3.99/$2.09 | $33.99 | 46.0% | Choice routes across US network |
| 36 | Unisex Ultra Cotton Tee | Gildan 2000 | Printify Choice | 385 | $10.72–$16.72 | $3.99/$2.09 | $30.99 | 46.0% | Popular blank; Choice routes across US network |
| 5 | Unisex Cotton Crew Tee | Next Level 3600 | Printify Choice | 173 | $11.31–$18.66 | $4.95/$2.40 | $33.99 | 45.1% | Popular blank; Choice routes across US network |
| 3127 | Easy Cotton Tee | Port & Company® PC43 | Printify Choice | 423 | $10.45–$16.80 | $4.95/$2.40 | $30.99 | 45.8% | Choice routes across US network |
| 2027 | District ® Perfect Tri ® Tee | District DM130 | Fulfill Engine | 403 | $15.02–$23.09 | $4.49/$2.09 | $41.99 | 45.0% | Solid US cost + shipping data |
| 9 | Women's Favorite Tee | Bella+Canvas 6004 | Printify Choice | 109 | $11.92–$13.83 | $3.99/$2.09 | $25.99 | 46.8% | Popular blank; Choice routes across US network |
| 2979 | Unisex Cotton T-Shirt | JERZEES 363M | Fulfill Engine | 337 | $12.83–$21.88 | $4.49/$2.09 | $39.99 | 45.3% | Solid US cost + shipping data |
| 2968 | Dri-Power 50/50 Cotton/Poly T-Shirt | JERZEES 29M | Printify Choice | 312 | $11.72–$19.12 | $4.95/$2.40 | $34.99 | 45.4% | Choice routes across US network |
| 3169 | Unisex Creator 2.0 Tee | Stanley Stella SXU001 | Fulfill Engine | 285 | $20.31–$29.36 | $4.49/$2.09 | $53.99 | 45.6% | Solid US cost + shipping data |
| 1317 | Unisex CVC Jersey T-shirt | Next Level 6210 | Printify Choice | 271 | $12.74–$22.06 | $3.99/$2.09 | $40.99 | 46.2% | Choice routes across US network |
| 1439 | Unisex HD Cotton™ T-shirt | Fruit Of The Loom 3930R | Printify Choice | 237 | $10.87–$16.21 | $3.99/$2.09 | $29.99 | 45.9% | Choice routes across US network |
| 631 | Tie-Dye Tee, Cyclone | Gildan 5000 | Printify Choice | 9 | $17.77–$21.18 | $3.99/$2.09 | $38.99 | 45.7% | Popular blank; Choice routes across US network; Limited variant breadth |
| 630 | Tie-Dye Tee, Crystal | Gildan 5000 | Printify Choice | 4 | $17.77–$17.77 | $3.99/$2.09 | $32.99 | 46.1% | Popular blank; Choice routes across US network; Limited variant breadth |
| 34 | Infant Fine Jersey Tee | Rabbit Skins 3322 | Printify Choice | 69 | $10.31–$10.31 | $3.99/$2.09 | $18.99 | 45.7% | Choice routes across US network |
| 2835 | The Concert Tee | District DT5000 | Printify Choice | 215 | $12.63–$20.10 | $4.95/$2.40 | $36.99 | 45.7% | Choice routes across US network |
| 32 | Toddler's Fine Jersey Tee | Rabbit Skins 3321 | Printify Choice | 52 | $12.45–$12.45 | $3.99/$2.09 | $22.99 | 45.8% | Choice routes across US network |
| 1121 | Unisex Moisture Wicking Tee | Sport-Tek ST350 | Printify Choice | 210 | $18.15–$24.46 | $3.99/$2.09 | $44.99 | 45.6% | Choice routes across US network |
| 710 | Unisex Garment-dyed Long Sleeve T-Shirt | Comfort Colors® Print on Demand 6014 | Printify Choice | 210 | $22.32–$27.29 | $3.99/$2.09 | $49.99 | 45.4% | Choice routes across US network |
### Bags

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 507 | Canvas Tote Bag, 5-Color Straps | Generic brand  | Printify Choice | 15 | $18.74–$21.28 | $6.09/$1.49 | $38.99 | 45.4% | Choice routes across US network |
| 1313 | Cotton Canvas Tote Bag | Liberty Bags OAD113 | Printify Choice | 1 | $9.67–$9.67 | $4.19/$2.09 | $17.99 | 46.2% | Choice routes across US network; Limited variant breadth |
| 1990 | Zippered Canvas Tote | Q-Tees Q1300 | Printify Choice | 8 | $20.97–$20.97 | $7.99/$2.99 | $38.99 | 46.2% | Choice routes across US network; Limited variant breadth |
| 553 | Cotton Tote Bag | AS Colour 1001 | Fulfill Engine | 5 | $20.44–$20.44 | $5.89/$2.09 | $37.99 | 46.2% | Limited variant breadth |
| 468 | Fanny Pack | Generic brand  | Printify Choice | 1 | $24.01–$24.01 | $4.95/$1.69 | $43.99 | 45.4% | Choice routes across US network; Limited variant breadth |
| 414 | Drawstring Bag | Generic brand  | Printify Choice | 1 | $30.54–$30.54 | $4.95/$2.40 | $55.99 | 45.5% | Choice routes across US network; Limited variant breadth |
| 413 | Backpack | Generic brand  | MWW On Demand | 1 | $44.15–$44.15 | $9.19/$2.39 | $80.99 | 45.5% | Limited variant breadth |
| 1389 | Tote Bag (AOP) | Generic brand  | Printify Choice | 15 | $12.60–$17.19 | $4.95/$1.49 | $31.99 | 46.3% | Choice routes across US network |
| 5098 | Essential Zip Tote | Port Authority BG410 | Fulfill Engine | 9 | $16.31–$16.31 | $9.59/$4.39 | $29.99 | 45.6% | Limited variant breadth |
| 5106 | Beach Wash Tote | Port Authority BG421 | Fulfill Engine | 5 | $16.15–$16.15 | $6.09/$2.49 | $29.99 | 46.1% | Limited variant breadth |
| 5123 | Insulated Lunch Tote | Port Authority BG518 | Fulfill Engine | 5 | $16.15–$16.15 | $6.09/$2.49 | $29.99 | 46.1% | Limited variant breadth |
| 5096 | Day Tote | Port Authority BG406 | Fulfill Engine | 4 | $15.33–$15.33 | $6.09/$2.49 | $27.99 | 45.2% | Limited variant breadth |
### Drinkware

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 478 | Ceramic Mug, (11oz, 15oz) | Generic brand  | Printify Choice | 2 | $5.03–$6.13 | $5.79/$2.99 | $11.99 | 48.9% | Choice routes across US network; Limited variant breadth |
| 68 | Mug 11oz | Generic brand  | SPOKE Custom Products | 1 | $6.44–$6.44 | $6.69/$2.99 | $11.99 | 46.3% | Limited variant breadth |
| 479 | Black Mug (11oz, 15oz) | Generic brand  | Printify Choice | 2 | $7.11–$8.29 | $5.79/$2.99 | $15.99 | 48.2% | Choice routes across US network; Limited variant breadth |
| 425 | Mug 15oz | Generic brand  | SPOKE Custom Products | 1 | $8.62–$8.62 | $8.69/$2.99 | $15.99 | 46.1% | Limited variant breadth |
| 503 | White Ceramic Mug, 11oz | Generic brand  | Printify Choice | 1 | $8.64–$8.64 | $7.29/$3.09 | $15.99 | 46.0% | Choice routes across US network; Limited variant breadth |
| 483 | Enamel Camping Mug | Generic brand  | District Photo | 1 | $11.41–$11.41 | $6.49/$1.99 | $20.99 | 45.6% | Limited variant breadth |
| 1511 | Coffee Mug Tumbler, 15oz | Polar Camel  | Fulfill Engine | 17 | $28.24–$28.24 | $7.09/$2.99 | $51.99 | 45.7% | Solid US cost + shipping data |
| 633 | Pint Glass, 16oz | Generic brand  | Chill | 1 | $13.28–$13.28 | $9.39/$2.99 | $24.99 | 46.9% | Limited variant breadth |
| 604 | Vacuum Insulated Tumbler, 11oz | Generic brand  | SwagRabbit | 3 | $18.88–$18.88 | $5.79/$2.99 | $34.99 | 46.0% | Limited variant breadth |
| 620 | Chill Wine Tumbler | Generic brand  | Chill | 2 | $18.06–$18.06 | $6.89/$2.49 | $32.99 | 45.3% | Limited variant breadth |
| 1151 | Colorful Mugs (11oz, 15oz) | ORCA Coatings  | Printify Choice | 23 | $7.84–$8.92 | $7.29/$3.09 | $16.99 | 47.5% | Choice routes across US network |
| 635 | Accent Coffee Mug (11, 15oz) | Generic brand  | Printify Choice | 21 | $6.40–$8.44 | $5.79/$2.99 | $15.99 | 47.2% | Choice routes across US network |
| 2693 | Two-Tone Accent Mug (11oz, 15oz) | ORCA Coatings  | Printify Choice | 18 | $7.52–$8.60 | $7.29/$3.09 | $15.99 | 46.2% | Choice routes across US network |
| 2692 | Accent Rim & Handle Mug (11oz, 15oz) | ORCA Coatings  | Printify Choice | 17 | $7.52–$8.60 | $7.29/$3.09 | $15.99 | 46.2% | Choice routes across US network |
### Hats

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1221 | Dad Hat with Leather Patch (Rectangle) | ValuCap VC300A | Printify Choice | 24 | $14.96–$14.96 | $5.09/$2.19 | $27.99 | 46.6% | Choice routes across US network |
| 1691 | Classic Cuffed Beanie (Embroidery) | Yupoong 1501KC | Printify Choice | 12 | $15.26–$15.26 | $4.69/$2.09 | $27.99 | 45.5% | Choice routes across US network; Limited variant breadth |
| 1734 | 5 Panel Trucker Cap | Yupoong 6006 | Printify Choice | 12 | $17.29–$17.29 | $4.69/$2.09 | $31.99 | 46.0% | Choice routes across US network; Limited variant breadth |
| 5385 | Cuff Beanie | AS Colour 1107 | Fulfill Engine | 17 | $22.98–$22.98 | $4.59/$2.09 | $41.99 | 45.3% | Solid US cost + shipping data |
| 5284 | Action Snapback Cap | Sport-Tek STC50 | Fulfill Engine | 6 | $15.89–$15.89 | $4.59/$2.09 | $28.99 | 45.2% | Limited variant breadth |
| 4802 | Canvas Mesh Back Cap | CornerStone® CS811 | Fulfill Engine | 3 | $15.74–$15.74 | $4.59/$2.09 | $28.99 | 45.7% | Limited variant breadth |
| 1743 | Snapback Trucker Cap | Richardson 112 | Printify Choice | 7 | $20.46–$20.46 | $4.69/$2.09 | $37.99 | 46.1% | Popular blank; Choice routes across US network; Limited variant breadth |
| 5625 | Impact Mesh Stretch-Tek Cap | Sport-Tek STC70 | Fulfill Engine | 75 | $19.27–$19.27 | $4.59/$2.09 | $35.99 | 46.5% | Solid US cost + shipping data |
| 2707 | Mid Profile Baseball Cap with Leather Patch (Rectangle) | OTTO Cap 31-069 | Printify Choice | 44 | $20.35–$20.35 | $5.09/$2.19 | $36.99 | 45.0% | Choice routes across US network |
| 1446 | Snapback Trucker Cap | Yupoong 6606 | Printify Choice | 35 | $19.22–$19.22 | $4.69/$2.09 | $34.99 | 45.1% | Choice routes across US network |
| 5665 | 12" Solid Cuffed Beanie | Sportsman SP12 | Fulfill Engine | 35 | $20.66–$20.66 | $4.59/$2.09 | $37.99 | 45.6% | Solid US cost + shipping data |
| 1287 | Dad Hat with Leather Patch (Round) | ValuCap VC300A | Printify Choice | 24 | $14.96–$14.96 | $5.09/$2.19 | $27.99 | 46.6% | Choice routes across US network |
### Home & decor

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 5541 | Full-Length Apron | Port Authority A520 | Fulfill Engine | 7 | $18.93–$18.93 | $5.89/$2.49 | $34.99 | 45.9% | Limited variant breadth |
| 677 | Tea Towel | Generic brand  | Printify Choice | 1 | $17.44–$17.44 | $5.89/$0.99 | $31.99 | 45.5% | Choice routes across US network; Limited variant breadth |
| 2764 | Hardboard Coasters with Cork Bottom (Set of 4) | Generic brand  | Printify Choice | 1 | $20.15–$20.15 | $5.79/$1.99 | $36.99 | 45.5% | Choice routes across US network; Limited variant breadth |
| 938 | Glass Cutting Board | Generic brand  | Pic The Gift | 2 | $15.47–$21.56 | $12.19/$2.19 | $39.99 | 46.1% | Limited variant breadth |
| 522 | Velveteen Plush Blanket | Generic brand  | Printify Choice | 3 | $13.64–$30.72 | $5.69/$2.69 | $55.99 | 45.1% | Choice routes across US network; Limited variant breadth |
| 235 | Shower Curtains | Generic brand  | Printify Choice | 1 | $40.77–$40.77 | $9.19/$3.99 | $74.99 | 45.6% | Choice routes across US network; Limited variant breadth |
| 4129 | PosiCharge Competitor 2-Button Henley | Sport-Tek ST359 | Fulfill Engine | 86 | $18.79–$26.05 | $4.49/$2.09 | $47.99 | 45.7% | Solid US cost + shipping data |
| 4118 | Competitor United Crew | Sport-Tek ST100 | Printify Choice | 71 | $19.20–$27.31 | $4.95/$2.40 | $49.99 | 45.4% | Choice routes across US network |
| 1943 | Scented Soy Candles with Black Lid, (4 and 9oz) | Candle Builders  | Printify Choice | 36 | $9.84–$11.89 | $6.79/$2.69 | $21.99 | 45.9% | Choice routes across US network |
| 1488 | Scented Candles, Coconut Apricot Wax (4oz, 9oz) | Printed Mint  | Printify Choice | 37 | $9.33–$14.57 | $6.19/$3.99 | $26.99 | 46.0% | Choice routes across US network |
| 4616 | PosiCharge Competitor 7' Pocketed Short | Sport-Tek ST349P | Fulfill Engine | 46 | $18.79–$26.05 | $7.99/$2.09 | $47.99 | 45.7% | Solid US cost + shipping data |
| 1379 | Tin Candles | Printed Mint  | Printify Choice | 30 | $8.94–$11.79 | $5.49/$2.99 | $21.99 | 46.4% | Choice routes across US network |
| 4127 | PosiCharge Competitor Short | Sport-Tek ST355 | Fulfill Engine | 41 | $17.02–$24.27 | $7.99/$2.09 | $44.99 | 46.1% | Solid US cost + shipping data |
| 5453 | Candle Set with Wick Trimmer | Lumient  | Lumient | 33 | $19.34–$24.18 | $9.89/$3.49 | $43.99 | 45.0% | Solid US cost + shipping data |
| 5577 | Rally Towel | Port Authority PT38 | Fulfill Engine | 14 | $10.98–$10.98 | $5.89/$2.49 | $19.99 | 45.1% | Limited variant breadth |
| 2729 | Paper Gift Bag | Generic brand  | Printify Choice | 8 | $5.35–$6.05 | $5.99/$0.99 | $10.99 | 44.9% | Choice routes across US network; Limited variant breadth |
| 4628 | Unisex Flyer Jogger | Stanley Stella SXU006 | Fulfill Engine | 59 | $53.15–$58.79 | $7.99/$2.09 | $106.99 | 45.1% | Solid US cost + shipping data |
| 6173 | Unisex Pique Gym Shorts | American Apparel 2PQ | Fulfill Engine | 25 | $21.79–$25.66 | $7.99/$2.09 | $46.99 | 45.4% | Solid US cost + shipping data |
| 1468 | Scented Soy Candle (Multi-Size, Amber Jar) | Lumient  | Printify Choice | 12 | $9.82–$13.50 | $6.19/$2.69 | $24.99 | 46.0% | Choice routes across US network; Limited variant breadth |
| 3151 | Women's Ultimate Performance V-Neck | Sport-Tek LST700 | Fulfill Engine | 26 | $20.56–$27.96 | $4.49/$2.09 | $50.99 | 45.2% | Solid US cost + shipping data |
| 5786 | Women's Dare Shorts | Augusta Sportswear 1232 | Fulfill Engine | 32 | $31.07–$34.92 | $5.39/$2.09 | $63.99 | 45.4% | Solid US cost + shipping data |
| 755 | Scented Soy Candles with White Lid, 9oz | Candle Builders  | Printify Choice | 8 | $11.46–$11.87 | $8.29/$3.49 | $21.99 | 46.0% | Choice routes across US network; Limited variant breadth |
### Jewelry & pins

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2651 | Natural Stone Stretch Bar Bracelet (Engraving) | Generic brand  | Fulfill Engine | 13 | $21.96–$21.96 | $4.59/$2.09 | $39.99 | 45.1% | Limited variant breadth |
| 2341 | Circle Necklace (Engraving) | Generic brand  | Fulfill Engine | 5 | $17.85–$17.85 | $4.59/$2.09 | $32.99 | 45.9% | Limited variant breadth |
| 2655 | Heart Necklace (Engraving) | Generic brand  | Fulfill Engine | 5 | $18.17–$18.17 | $4.59/$2.09 | $33.99 | 46.5% | Limited variant breadth |
| 2654 | Horizontal Bar Necklace (Engraving) | Generic brand  | Fulfill Engine | 5 | $18.50–$18.50 | $4.59/$2.09 | $33.99 | 45.6% | Limited variant breadth |
| 2659 | Cutout Heart Bar Necklace (Engraving) | Generic brand  | Fulfill Engine | 5 | $20.15–$20.15 | $4.59/$2.09 | $36.99 | 45.5% | Limited variant breadth |
| 2652 | Cutout Paw Bar Necklace (Engraving) | Generic brand  | Fulfill Engine | 5 | $20.15–$20.15 | $4.59/$2.09 | $36.99 | 45.5% | Limited variant breadth |
### Kids & baby

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 3125 | Youth Easy Cotton Tee | Port & Company® PC43Y | Printify Choice | 235 | $10.63–$10.96 | $4.95/$2.40 | $19.99 | 45.2% | Choice routes across US network |
| 580 | Toddler Short Sleeve Tee | Bella+Canvas 3001T | Printify Choice | 72 | $10.63–$10.63 | $3.99/$2.09 | $19.99 | 46.8% | Choice routes across US network |
| 568 | Baby Short Sleeve Onesie® | Gerber Childrenswear 6516A | Printify Choice | 14 | $14.40–$14.40 | $3.99/$2.09 | $26.99 | 46.6% | Choice routes across US network; Limited variant breadth |
| 583 | 11oz Accent Mug | ORCA Coatings  | SunFrog Solutions | 4 | $10.02–$10.02 | $6.69/$2.99 | $18.99 | 47.2% | Limited variant breadth |
| 2728 | Toddler Full-Zip Fleece Hoodie | Rabbit Skins 3346 | Printify Choice | 9 | $31.62–$32.44 | $3.99/$2.09 | $58.99 | 45.0% | Choice routes across US network; Limited variant breadth |
| 561 | Infant Baby Rib Bodysuit | Rabbit Skins 4400 | Printify Choice | 137 | $13.58–$13.58 | $3.99/$2.09 | $24.99 | 45.7% | Choice routes across US network |
| 1617 | Kids Relax Hoodie | AS Colour 3036 | Printify Choice | 6 | $36.95–$36.95 | $3.99/$2.09 | $67.99 | 45.7% | Choice routes across US network; Limited variant breadth |
| 157 | Kids Heavy Cotton™ Tee | Gildan 5000B | Printify Choice | 122 | $7.13–$7.13 | $3.99/$2.09 | $12.99 | 45.1% | Choice routes across US network |
| 750 | Youth Midweight Tee | Comfort Colors® Print on Demand 9018 | SwiftPOD | 125 | $17.52–$17.52 | $4.49/$2.09 | $31.99 | 45.2% | Solid US cost + shipping data |
| 1142 | Youth Competitor Tee | Sport-Tek YST350 | Printify Choice | 122 | $16.34–$16.34 | $3.99/$2.09 | $29.99 | 45.5% | Choice routes across US network |
### Outdoor & seasonal

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 531 | Ceramic Ornament, 4 Shapes | Generic brand  | Printify Choice | 4 | $6.31–$6.31 | $5.89/$0.69 | $11.99 | 47.4% | Choice routes across US network; Limited variant breadth |
| 976 | Garden & House Banner | Generic brand  | Pic The Gift | 2 | $10.49–$20.44 | $6.39/$1.99 | $37.99 | 46.2% | Limited variant breadth |
| 352 | Beach Towel | Generic brand  | Printify Choice | 2 | $23.70–$30.33 | $8.39/$2.99 | $55.99 | 45.8% | Choice routes across US network; Limited variant breadth |
| 1124 | Picnic Blanket | Generic brand  | Printify Choice | 1 | $40.50–$40.50 | $8.69/$2.69 | $73.99 | 45.3% | Choice routes across US network; Limited variant breadth |
| 2756 | Leatherette Ornament, 3 Shapes (Engraving) | Generic brand  | Printify Choice | 27 | $13.79–$13.79 | $4.69/$0.49 | $25.99 | 46.9% | Choice routes across US network |
| 1182 | Metal Ornaments | Generic brand  | Pic The Gift | 12 | $4.75–$7.14 | $5.89/$0.69 | $12.99 | 45.0% | Limited variant breadth |
| 1632 | Ceramic Decoration Ornament, (1pc) | Generic brand  | Printify Choice | 6 | $4.90–$7.35 | $4.79/$0.49 | $13.99 | 47.5% | Choice routes across US network; Limited variant breadth |
| 697 | Wooden Ornaments | Generic brand  | WOYC | 6 | $8.54–$8.54 | $4.79/$0.49 | $15.99 | 46.6% | Limited variant breadth |
| 5582 | Value Beach Towel | Port Authority PT44 | Fulfill Engine | 9 | $28.52–$28.52 | $5.89/$2.49 | $51.99 | 45.1% | Limited variant breadth |
| 5583 | Value Cabana Stripe Beach Towel | Port Authority PT45 | Fulfill Engine | 7 | $28.69–$28.69 | $5.89/$2.49 | $52.99 | 45.9% | Limited variant breadth |
| 5580 | Beach Towel | Port Authority PT42 | Fulfill Engine | 9 | $32.13–$32.13 | $5.89/$2.49 | $58.99 | 45.5% | Limited variant breadth |
| 1347 | Flag | Generic brand  | Printify Choice | 3 | $14.10–$28.95 | $6.39/$1.99 | $52.99 | 45.4% | Choice routes across US network; Limited variant breadth |
### Pets

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 562 | Pet Bandana | Evergreen  | Printify Choice | 2 | $14.50–$16.34 | $5.69/$0.99 | $29.99 | 45.5% | Choice routes across US network; Limited variant breadth |
| 572 | Copper Vacuum Insulated Bottle, 22oz | Generic brand  | SwagRabbit | 8 | $26.27–$26.27 | $8.29/$2.99 | $47.99 | 45.3% | Limited variant breadth |
| 570 | Pet Bowl | Generic brand  | Printed Mint | 1 | $25.21–$25.21 | $14.89/$5.39 | $45.99 | 45.2% | Limited variant breadth |
| 419 | Pet Bed | Generic brand  | Printify Choice | 3 | $29.83–$81.40 | $27.29/$24.99 | $147.99 | 45.0% | Choice routes across US network; Limited variant breadth |
| 1672 | Clip-on Pet Bandana | Generic brand  | Printify Choice | 3 | $8.89–$12.98 | $5.69/$0.99 | $23.99 | 45.9% | Choice routes across US network; Limited variant breadth |
| 1520 | Pet Bowl, 18oz (Engraving) | Polar Camel  | Printify Choice | 6 | $29.57–$29.57 | $9.59/$2.99 | $53.99 | 45.2% | Choice routes across US network; Limited variant breadth |
| 623 | Pet Feeding Mats | Generic brand  | Printify Choice | 3 | $16.85–$27.82 | $5.59/$2.49 | $50.99 | 45.4% | Choice routes across US network; Limited variant breadth |
### Socks & shoes

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 376 | Sublimation Socks | Generic brand  | SPOKE Custom Products | 3 | $7.39–$7.39 | $4.59/$0.99 | $13.99 | 47.2% | Limited variant breadth |
| 1433 | Sublimation Crew Socks | Generic brand  | Printify Choice | 1 | $7.44–$7.44 | $5.29/$0.75 | $13.99 | 46.8% | Choice routes across US network; Limited variant breadth |
| 2941 | Unisex Padded Crew Socks (DTG) | Generic brand  | Printify Choice | 1 | $10.66–$10.66 | $4.59/$0.99 | $19.99 | 46.7% | Choice routes across US network; Limited variant breadth |
| 1903 | Unisex Joggers (Embroidery) | JERZEES 975MPR | Printify Choice | 18 | $26.26–$28.11 | $8.79/$2.09 | $51.99 | 45.9% | Choice routes across US network |
| 574 | Cushioned Crew Socks | Generic brand  | Printify Choice | 1 | $11.37–$11.37 | $4.99/$1.90 | $20.99 | 45.8% | Choice routes across US network; Limited variant breadth |
| 452 | Recycled Poly Socks | Generic brand  | Printify Choice | 1 | $11.46–$11.46 | $5.29/$0.75 | $20.99 | 45.4% | Choice routes across US network; Limited variant breadth |
### Stickers & paper

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 400 | Kiss-Cut Stickers | Generic brand  | Printify Choice | 4 | $1.42–$2.32 | $4.29/$0.09 | $4.99 | 53.5% | Choice routes across US network; Limited variant breadth |
| 384 | Square Stickers | Generic brand  | Printify Choice | 4 | $1.50–$2.40 | $4.29/$0.09 | $4.99 | 51.9% | Choice routes across US network; Limited variant breadth |
| 600 | Die-Cut Stickers | Generic brand  | Printify Choice | 5 | $3.75–$5.90 | $5.29/$0.07 | $10.99 | 46.3% | Choice routes across US network; Limited variant breadth |
| 661 | Sticker Sheets | Generic brand  | Printify Choice | 6 | $6.21–$9.97 | $5.29/$0.40 | $18.99 | 47.5% | Choice routes across US network; Limited variant breadth |
| 5372 | Kiss-Cut Sticker Sheet | Generic brand  | Printify Choice | 1 | $5.14–$5.14 | $4.59/$0.09 | $9.99 | 48.5% | Choice routes across US network; Limited variant breadth |
| 1094 | Greeting Cards (1, 10, 30, and 50pcs) | Generic brand  | Printify Choice | 128 | $4.32–$43.36 | $5.99/$0.99 | $78.99 | 45.1% | Choice routes across US network |
| 1073 | Postcard Bundles (envelopes not included)  | Generic brand  | Printify Choice | 96 | $10.73–$24.89 | $6.99/$2.89 | $45.99 | 45.9% | Choice routes across US network |
| 1101 | Postcard Bundles (envelopes included)  | Generic brand  | Printify Choice | 96 | $11.07–$26.61 | $6.99/$2.89 | $48.99 | 45.7% | Choice routes across US network |
| 564 | Round Vinyl Stickers | Generic brand  | Printify Choice | 5 | $2.76–$5.52 | $5.29/$0.07 | $10.99 | 49.8% | Choice routes across US network; Limited variant breadth |
| 794 | Transparent Outdoor Stickers, Square, 1pc | Generic brand  | Printify Choice | 5 | $3.83–$6.03 | $5.29/$0.07 | $10.99 | 45.1% | Choice routes across US network; Limited variant breadth |
### Tech & desk

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 269 | Tough Phone Cases | Generic brand  | Printify Choice | 34 | $11.22–$12.82 | $4.39/$0.99 | $23.99 | 46.6% | Choice routes across US network |
| 268 | Slim Phone Cases | Generic brand  | Printify Choice | 26 | $9.84–$9.84 | $4.39/$0.99 | $17.99 | 45.3% | Choice routes across US network |
| 608 | Mouse Pad (Rectangle) | Generic brand  | District Photo | 1 | $4.98–$4.98 | $4.99/$1.49 | $9.99 | 50.2% | Limited variant breadth |
| 74 | Spiral Notebook - Ruled Line | Generic brand  | Printify Choice | 1 | $8.26–$8.26 | $5.49/$1.99 | $15.99 | 48.3% | Choice routes across US network; Limited variant breadth |
| 429 | Laptop Sleeve | Generic brand  | Printify Choice | 3 | $18.44–$18.44 | $5.09/$1.99 | $33.99 | 45.7% | Choice routes across US network; Limited variant breadth |
| 1022 | Phone Case With Card Holder | Generic brand  | Printify Choice | 108 | $13.11–$15.57 | $4.39/$0.99 | $28.99 | 46.3% | Choice routes across US network |
| 5369 | PU Leather Phone Cases (Engraving) | Generic brand  | Printify Choice | 72 | $19.71–$19.71 | $5.69/$1.49 | $35.99 | 45.2% | Choice routes across US network |
| 488 | Desk Mat | Generic brand  | SPOKE Custom Products | 3 | $10.67–$15.60 | $5.99/$2.69 | $28.99 | 46.2% | Limited variant breadth |
| 975 | Desk Mats | Generic brand  | Colorway | 3 | $10.72–$20.77 | $7.39/$6.00 | $37.99 | 45.3% | Limited variant breadth |
| 648 | Laptop Sleeve | Generic brand  | Printify Choice | 5 | $14.67–$25.41 | $5.79/$2.99 | $46.99 | 45.9% | Choice routes across US network; Limited variant breadth |
### Wall art

| ID | Title | Brand/Model | Provider | Variants | Cost (min–max) | Ship 1st/add | Retail | Margin | Note |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 5651 | Colored Frame Posters | Roma Imaging  | Printify Choice | 1199 | $25.81–$132.56 | $12.49/$7.39 | $241.99 | 45.2% | Choice routes across US network |
| 944 | Matte Canvas, Framed (Multi-color) | Generic brand  | Roma Imaging | 412 | $19.60–$150.16 | $15.19/$5.69 | $273.99 | 45.2% | Solid US cost + shipping data |
| 284 | Matte Horizontal Posters | Generic brand  | Printify Choice | 46 | $4.96–$33.74 | $5.19/$0.39 | $61.99 | 45.6% | Choice routes across US network |
| 97 | Satin Posters (210gsm) | Generic brand  | Printify Choice | 12 | $5.31–$14.27 | $5.19/$0.39 | $25.99 | 45.1% | Choice routes across US network; Limited variant breadth |
| 282 | Matte Vertical Posters | Generic brand  | Today's Graphics | 9 | $5.15–$14.01 | $7.39/$1.99 | $25.99 | 46.1% | Limited variant breadth |
| 1159 | Matte Canvas, Stretched, 1.25" | Generic brand  | Roma Imaging | 52 | $10.63–$90.97 | $10.89/$3.69 | $165.99 | 45.2% | Solid US cost + shipping data |
| 1206 | Metal Art Sign | Generic brand  | Printify Choice | 18 | $13.80–$65.99 | $18.39/$5.29 | $119.99 | 45.0% | Choice routes across US network |
| 540 | Framed Vertical Poster | Roma Imaging  | Printify Choice | 21 | $35.89–$71.03 | $12.49/$5.89 | $129.99 | 45.4% | Choice routes across US network |
| 937 | Matte Canvas, Stretched, 0.75" (Multi-Size) | Generic brand  | Roma Imaging | 60 | $12.69–$115.65 | $10.09/$3.39 | $210.99 | 45.2% | Solid US cost + shipping data |
| 1309 | Satin and Archival Matte Posters | Generic brand  | Printify Choice | 60 | $3.34–$32.44 | $7.39/$1.99 | $58.99 | 45.0% | Choice routes across US network |
| 1220 | Rolled Posters | Generic brand  | Today's Graphics | 54 | $4.99–$30.60 | $7.39/$1.99 | $55.99 | 45.3% | Solid US cost + shipping data |
| 1068 | Uncoated Posters | Generic brand  | Printify Choice | 31 | $3.76–$13.43 | $7.39/$1.99 | $24.99 | 46.3% | Choice routes across US network |
| 763 | Indoor and Outdoor Silk Posters | Generic brand  | Printify Choice | 32 | $5.37–$25.43 | $7.89/$1.99 | $46.99 | 45.9% | Choice routes across US network |
| 1600 | Ceramic Ornaments, 1-Side Print | Generic brand  | Printify Choice | 4 | $6.24–$6.24 | $5.89/$0.69 | $11.99 | 48.0% | Choice routes across US network; Limited variant breadth |
