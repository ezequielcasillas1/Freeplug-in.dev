import os,json,requests
from pathlib import Path
W=Path('/workspace/logos/freeplug/merch/printify-work')
s=requests.Session();s.headers.update({'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN'],'User-Agent':'Freeplug-Merch-Draft-Preparation','Content-Type':'application/json'})
picks=[('fully-charged-mug',478,28,[65216,104692]),('cheap-free-latte',289,1,[43321]),('day-one-tumbler',353,1,[44519]),('free-refills-travel',70,1,[33765]),('know-a-plug-mug',425,1,[62014]),('running-over-canvas',937,105,[82231,82235]),('trucker-circle',2663,99,[147781]),('dad-fp',1729,410,[118238]),('low-profile-plugged',1108,99,[104278]),('beanie-freeplug',1691,410,[116417]),('desk-mat',488,1,[65241]),('build-journal',485,28,[65223]),('hero-crewneck',49,29,[25397,25428,25459]),('water-bottle',646,86,[72251]),('die-cut-stickers',600,73,[72007]),('fp-keychain',5341,80,[243784]),('running-over-candle',1048,219,[80301]),('running-over-pillow',220,10,[41527])]
for name,b,p,ids in picks:
 r=s.get(f'https://api.printify.com/v1/catalog/blueprints/{b}/print_providers/{p}/variants.json',timeout=50)
 if not r.ok: print(name,r.status_code,r.text[:400]);break
 data=r.json();(W/(name+'-catalog.json')).write_text(json.dumps(data,indent=2))
 selected=[v for v in data['variants'] if v['id'] in ids]
 print(name,b,p,'OK' if len(selected)==len(ids) else 'MISSING VARIANT',json.dumps(selected),flush=True)
r=s.get('https://api.printify.com/v1/shops/29664778/products.json?limit=100',timeout=60)
if r.ok:
 data=r.json();(W/'before-products.json').write_text(json.dumps(data,indent=2));print('Existing products:',[(x['id'],x['title'],x['visible']) for x in data['data']])
else:print('Existing products read failed',r.status_code)
