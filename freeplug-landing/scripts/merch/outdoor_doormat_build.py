from pathlib import Path
import json,io,math
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cairosvg
P=Path('/workspace/logos/freeplug/merch');scope={};exec((P/'build_merch.py').read_text().split('# 01-05 drinkware')[0],scope)
Doc=scope['Doc'];INK=scope['INK'];RED=scope['RED'];O=P/'outdoor-doormat';O.mkdir(exist_ok=True)
v=json.loads((P/'catalog/1346-80-variants.json').read_text())['variants'][0];w,h=7275,4875
records=[]
for i,name in [(1,'welcome-plugged-in'),(2,'you-know-a-plug'),(3,'come-on-in')]:
 d=Doc(w,h)
 if i==1:
  d.text('Welcome',850,600,5575,1300,'c',INK)
  d.text("YOU'RE",1100,2250,5075,650,'e',INK)
  d.text('PLUGGED IN',680,3225,5915,820,'e',INK)
 elif i==2:
  d.raw(f'<circle cx="1930" cy="2437" r="1430" fill="none" stroke="{INK}" stroke-width="145"/>')
  d.mark(890,1570,2080,1700,INK)
  d.text('YOU KNOW',3720,1330,3000,780,'e',INK)
  d.text('A PLUG.',3680,2590,3080,920,'e',INK)
 else:
  d.text('COME ON IN.',650,740,5975,900,'e',INK)
  d.mark(2930,2020,1415,1130,RED)
  d.text("YOU'RE PLUGGED IN",650,3500,5975,600,'d',INK)
 stem=f'option-{i:02d}-{name}';(O/f'{stem}.svg').write_text(d.svg())
 im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=d.svg().encode()))).convert('RGBA');a=np.array(im);a[:,:,3]=np.where(a[:,:,3]>=128,255,0).astype('uint8')
 # Exact two-color palette; black-only options stay strictly single-ink.
 if i<3:a[a[:,:,3]>0,:3]=[23,23,23]
 else:
  pal=np.array([[23,23,23],[186,61,61]],dtype=np.int32);ds=((a[:,:,:3,None].astype('int32')-pal.T[None,None,:,:])**2).sum(2);a[:,:,:3]=pal[ds.argmin(2)].astype('uint8')
 a[a[:,:,3]==0,:3]=0;im=Image.fromarray(a);im.save(O/f'{stem}.png',dpi=(300,300))
 bb=im.getbbox();assert bb[0]>300 and bb[1]>300 and bb[2]<w-300 and bb[3]<h-300
 # Flat original coir illustration, generated texture rather than stock.
 out=Image.new('RGB',(1500,1180),'#e7e3dc');dr=ImageDraw.Draw(out);font=ImageFont.truetype('/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Bold.ttf',38)
 dr.text((70,48),f'{i:02d} / '+name.replace('-',' ').upper(),font=font,fill=INK)
 dr.rounded_rectangle((100,210,1400,1090),radius=35,fill='#171717')
 mat=Image.new('RGB',(1260,840),'#b9915e');ar=np.array(mat).astype('int16');rng=np.random.default_rng(70+i);n=rng.normal(0,9,(840,1260,1));ar=np.clip(ar+n,0,255).astype('uint8');mat=Image.fromarray(ar);md=ImageDraw.Draw(mat)
 for _ in range(27000):
  x=int(rng.integers(0,1260));y=int(rng.integers(0,840));md.line((x,y,x+int(rng.integers(-4,5)),y+int(rng.integers(2,9))),fill=('#ad8653' if rng.random()<.5 else '#c69d66'),width=1)
 art=im.resize((1260,840),Image.Resampling.LANCZOS);mat.paste(art,(0,0),art);out.paste(mat,(120,230));dr.text((75,1125),'24 x 16 IN / ORIGINAL FLAT PREVIEW / NATURAL COIR',font=ImageFont.truetype('/workspace/logos/FP/fonts/ttf/FreeplugDispatch-Bold.ttf',25),fill=INK)
 out.save(O/f'{stem}-mockup.png')
 records.append({'option':name,'png':stem+'.png','svg':stem+'.svg','mockup':stem+'-mockup.png','pixels':[w,h],'dpi':300,'ink_bounds':bb,'colors':['#171717']+(['#ba3d3d'] if i==3 else [])})
over=Image.new('RGB',(2250,700),'#e7e3dc')
for i,r in enumerate(records):
 im=Image.open(O/r['mockup']);im.thumbnail((750,590),Image.Resampling.LANCZOS);over.paste(im,(i*750,80))
dr=ImageDraw.Draw(over);dr.text((35,20),'FREEPLUG / OUTDOOR COIR DOORMAT / THREE OPTIONS',font=ImageFont.truetype('/workspace/logos/FP/fonts/ttf/FPExtended-Black.ttf',36),fill=INK);over.save(O/'overview-doormat.png')
(O/'specifications.json').write_text(json.dumps({'blueprint_id':1346,'blueprint_name':'Doormat','provider_id':80,'provider_name':'M.i.A Merchandise','variant_id':103043,'available_sizes':['24" x 16"'],'print_area':[w,h],'position':'front','material':'Grade A tufted coir coconut fiber; black vinyl backing','files':records},indent=2))
notes='''# Outdoor Freeplug doormat\n\nBlank: Printify Doormat 1346; M.i.A Merchandise 80; variant 103043. One available size: 24 × 16 inches. Grade A tufted coir coconut fiber, black vinyl backing, assembled in the USA from globally sourced parts. Public provider page lists New Hampshire US fulfillment.\n\nAll three artwork PNGs are transparent, exact API print area 7275 × 4875 px at 300 DPI; matching outlined SVG sources and drawn mockups included. No embedded fonts. Options 01/02 are charcoal only for reliable contrast; option 03 adds brand red #ba3d3d. The coir provides the natural ground; there is no ivory/white ink layer. The circle in option 02 is a bold outline with the real FP mark, avoiding a white-ink knockout assumption.\n\nPrintify's API calls this decoration dye-sublimation even though the blank is coir; this handoff preserves that metadata rather than asserting a different process. The API canvas is slightly larger than the nominal 7200 × 4800 product face. Do not crop away that extra 75px or resize to nominal dimensions: confirm trim guides later in the Product Creator. All foreground has at least 300px quiet margin; backgrounds remain transparent.\n\nOutdoor production caveats: coir is coarse and varies naturally. Color detail/edge fidelity will be softer than a screen preview; black/charcoal options recommended over red for maximum legibility. Prefer a covered entryway, avoid standing water/prolonged soaking, and confirm manufacturer care instructions before publishing claims. Coir can shed and ink can fade/wear; not a guaranteed all-weather industrial mat. Vinyl backing is not rubber and no anti-slip certification is asserted.\n\nMockup texture and mat silhouettes are drawn/generated locally, not stock product photos. Physical sample and product template alignment review are required before sale. No upload, product creation, purchase or publication performed.\n\nSource: saved catalog GET responses in ../catalog/1346-80-variants.json and ../catalog/1346-providers.json; blueprint description in ../catalog/blueprints.json. Location evidence: https://printify.com/shipping-rates/m-i-a-merchandise/\n'''
(O/'README.md').write_text(notes)
manifest=P/'MANIFEST.md';s=manifest.read_text();s+='\n\n## Added item: outdoor-doormat\n\nBlueprint **1346 — Doormat**; provider **80 — M.i.A Merchandise** (US, New Hampshire); variant **103043**, sole size **24" × 16"**. Grade A tufted coir coconut fiber with black vinyl backing, mainly outdoor use. Exact front print area **7275 × 4875 px**, 300 DPI.\n\nOverview: `outdoor-doormat/overview-doormat.png`. Individual previews and production caveats in `outdoor-doormat/README.md`.\n\n| Option | Transparent PNG | Outlined SVG | Original mockup | Colors |\n|---|---|---|---|---|\n'
for r in records:s+=f"| {r['option']} | `outdoor-doormat/{r['png']}` | `outdoor-doormat/{r['svg']}` | `outdoor-doormat/{r['mockup']}` | {', '.join(r['colors'])} |\n"
s+='\nNo ivory ink assumed on coir. All foreground retains a generous quiet margin; transparent art dimensions and 300 DPI checked. Provider-specific trim guides and physical coir proof remain pre-production checks. Budget/rating ranking not available from these catalog GET responses. This addition brings the collection to **20 item groups and 40 print/digital PNGs** (including two canvas extra-bleed companions and one wallpaper).\n';manifest.write_text(s)
print('COMPLETE',json.dumps(records,indent=2))
