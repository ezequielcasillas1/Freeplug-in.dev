import json,os,requests,datetime
from pathlib import Path
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work';state=json.loads((W/'created-drafts.json').read_text())
s=requests.Session();s.headers.update({'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN'],'User-Agent':'Freeplug-Merch-Draft-Preparation'})
r=s.get('https://api.printify.com/v1/shops/29664778/products.json',timeout=60);r.raise_for_status();now=r.json();(W/'after-products.json').write_text(json.dumps(now,indent=2));byid={x['id']:x for x in now['data']};before=json.loads((W/'before-products.json').read_text())
assert now.get('next_page_url') is None
def stable(x):
 if isinstance(x,dict):return {k:stable(v) for k,v in x.items() if k!='imageId'}
 if isinstance(x,list):return [stable(v) for v in x]
 return x
for p in before['data']:assert stable(byid[p['id']])==stable(p),'Existing product changed: '+p['id']
assert len(now['data'])==len(before['data'])+len(state)
rows=['# Freeplug hidden Printify draft report','', 'Verified November 8, 2026 (America/Chicago). Shop 29664778. All new products visible:false, unlocked, and without external publishing references. No publish/publishing-status endpoints called. Existing six shirts unchanged.','', 'USD production costs and proposed retail prices. Gross margin targeted around 45% of retail, not 45% markup. Shipping, taxes, payment fees and other overhead excluded. All prices pending Cheke’s approval.','', '| Item / variant | Product ID | Base cost | Proposed retail | Issues |','|---|---|---:|---:|---|']
for e in state:
 p=byid[e['id']];assert p['visible'] is False and not p.get('external') and not p.get('is_locked');assert e['verified_hidden']
 # Report only deliberately enabled variants, not catalog-disabled alternatives.
 for v in p['variants']:
  if not v['is_enabled']:continue
  issue='Physical proof needed'
  if e['key']=='running-over-candle':issue='Clean Cotton scent is a proposal; retain safety labels'
  if e['key'].startswith('die-cut-stickers/'):issue='Individual sticker, not a bundled four-pack; cutline proof needed'
  if e['key']=='hero-crewneck':issue='Front + back; Black/White/Sand; proof both ink colorways'
  rows.append(f"| {e['title']} / {v['title']} | {p['id']} | ${v['cost']/100:.2f} | ${v['price']/100:.2f} | {issue} |")
rows += ['', '## Held out rather than guessing', '', '| Item | Reason |','|---|---|', '| Running Over canvas, 16x20 and 24x36 | Exact Jondo wrap/fold/bleed template not verified; do not fit generic extra-bleed artwork blindly. |', '| Trucker, dad hat, low-profile cap, beanie | Source is embroidery-oriented PNG, not approved digitization/thread mapping. Trucker catalog variant is white-patch, while request calls for red patch; confirm construction/color match. Choice hats also require US market routing confirmation. |', '| Build journal | Spine/hinge and trim template alignment not verified. |','| FP keychain | Exact hardware-hole placement/template not verified. |','| Luke pillow 18x18 | Combined front/back fold, seams and orientation template not verified. |','| Luke wallpaper | Digital only. Local artwork ready; deliberately no Printify product. |', '', 'All 18 blueprint/provider pairs and requested variants were checked and exist; no substitutions made.', '', '## Approval still needed','', '- Draft artwork/mockups, retail prices, crewneck colors/sizes and candle scent.', '- Sticker fulfillment: four individually sold designs, not one bundled SKU.', '- Physical/sample proofs; no samples ordered or paid for.', '- Template checks and embroidery digitization before held items can become good drafts.', '- Separate explicit approval for any later publishing or live-site change. Nothing published and no site, Worker, DNS, PR or email touched.', '', 'Contact sheet: `/workspace/logos/freeplug/merch/printify-mockups/contact-sheet.png`', 'Full variant and API evidence: `/workspace/logos/freeplug/merch/printify-work/`.']
(R/'PRINTIFY-DRAFT-REPORT.md').write_text('\n'.join(rows)+'\n')
print('Verified',len(state),'new hidden products;',len(before['data']),'existing products unchanged.')
for e in state:
 costs=[v['cost']/100 for v in e['variants']];prices=[v['price']/100 for v in e['variants']]
 print(e['key'],e['id'],'cost',min(costs),max(costs),'price',min(prices),max(prices))
print('Report:',R/'PRINTIFY-DRAFT-REPORT.md')
