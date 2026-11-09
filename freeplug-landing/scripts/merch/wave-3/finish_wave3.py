from pathlib import Path
import json,io,math
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cairosvg
ROOT=Path('/workspace/logos/freeplug/merch/wave-3');Image.MAX_IMAGE_PIXELS=None
scope={};exec((Path('/workspace/logos/freeplug/merch/build_merch.py')).read_text().split('# 01-05 drinkware')[0],scope)
Image.MAX_IMAGE_PIXELS=None
Doc,RED,IVORY,INK,GRAY=scope['Doc'],scope['RED'],scope['IVORY'],scope['INK'],scope['GRAY'];GOLD='#c9a227'
FONTDIR=Path('/workspace/logos/FP/fonts/ttf');PRE=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),28);SMALL=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),18)
entries=[];checks=[]
KJV_SHORT='Give, and it shall be given unto you'

def save(cat,slug,name,doc,meta):
 folder=ROOT/cat/slug;folder.mkdir(parents=True,exist_ok=True)
 svg=doc.svg();(folder/f'{name}.svg').write_text(svg)
 im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA')
 if doc.bg is None:
  a=np.array(im);a[:,:,3]=np.where(a[:,:,3]>=128,255,0).astype('uint8');a[a[:,:,3]==0,:3]=0;im=Image.fromarray(a)
 im.save(folder/f'{name}.png',dpi=(300,300));assert im.size==(doc.w,doc.h)
 checks.append({'file':f'{cat}/{slug}/{name}.png','size':list(im.size)})
 ent=next((e for e in entries if e['slug']==slug),None)
 if not ent:
  ent={'category':cat,'slug':slug,'product':meta['product'],'blueprint':meta.get('blueprint'),'blueprint_name':meta.get('blueprint_name'),'provider':meta.get('provider'),'provider_name':meta.get('provider_name'),'slogan':meta.get('slogan',''),'files':[]};entries.append(ent)
 ent['files'].append({'file':f'{name}.png','svg':f'{name}.svg','size':[doc.w,doc.h],'position':meta.get('position','front'),'variant':meta.get('variant'),'confirmed':meta.get('confirmed',True),'notes':meta.get('notes','')})
 return im

def mock(cat,slug,title,art,kind='rect'):
 folder=ROOT/cat/slug;out=Image.new('RGB',(1100,820),'#e7e3dc');d=ImageDraw.Draw(out);d.text((40,24),title.upper()[:48],font=PRE,fill=INK);a=art.convert('RGBA')
 if kind=='tall':d.rounded_rectangle((400,100,700,700),radius=40,fill='#f3efe6');a.thumbnail((260,540),Image.Resampling.LANCZOS);out.paste(a,(420,130),a)
 else:d.rounded_rectangle((120,120,980,700),radius=28,fill='#111');a.thumbnail((820,540),Image.Resampling.LANCZOS);out.paste(a,((1100-a.width)//2,160),a)
 d.text((40,770),'ORIGINAL FLAT PREVIEW / NOT A COLOR OR SCALE PROOF',font=SMALL,fill=GRAY);out.save(folder/'mockup.png')

meta=dict(product='Woven Blanket',blueprint=1626,blueprint_name='Woven Blanket',provider=10,provider_name='MWW On Demand',slogan=KJV_SHORT,variant='52x37 Artwork',confirmed=True)
d=Doc(4992,3552,IVORY);d.text('Give, and it shall',400,500,4192,400,'c',INK);d.text('be given unto you',400,1000,4192,400,'c',INK);d.cup(1746,1600,1500,1100);d.text('LUKE 6:38 - KJV',1400,3000,2200,250,'d',GOLD)
im=save('running-over','kjv-woven-blanket','front',d,{**meta,'position':'front','notes':'Woven process; ivory/ink/gold. Exact 52x37 artwork area.'});mock('running-over','kjv-woven-blanket','Woven Blanket',im)

meta=dict(product='Acrylic Serving Tray',blueprint=780,blueprint_name='Acrylic Serving Tray',provider=59,provider_name='Imagine Your Photos',slogan=KJV_SHORT,variant='One size',confirmed=True)
d=Doc(4950,3150,IVORY);d.text('Give, and it shall',400,700,4150,450,'c',INK);d.text('be given unto you',400,1300,4150,450,'c',INK);d.text('LUKE 6:38',1700,2300,1550,250,'d',GOLD)
im=save('running-over','kjv-serving-tray','front',d,{**meta,'position':'front'});mock('running-over','kjv-serving-tray','Serving Tray',im)

meta=dict(product='Bookmark',blueprint=765,blueprint_name='Bookmark',provider=59,provider_name='Imagine Your Photos',slogan='Luke 6:38',variant='One size',confirmed=True)
for i,lines in enumerate([['Give, and it shall','be given unto you'],['good measure,','pressed down,'],['and shaken together,','and running over'],['shall men give','into your bosom.']]):
 d=Doc(450,1575,IVORY);d.mark(125,80,200,180,GOLD);d.text(lines[0],30,350,390,180,'d',INK);d.text(lines[1],30,580,390,180,'d',INK);d.text('LUKE 6:38',60,1300,330,100,'e',GOLD);save('running-over','kjv-bookmarks',f'bookmark-{i+1}',d,{**meta,'position':'front','slogan':lines[0]})
mock('running-over','kjv-bookmarks','Bookmark Set',Image.open(ROOT/'running-over/kjv-bookmarks/bookmark-1.png'),'tall')

meta=dict(product='Framed Vertical Poster',blueprint=540,blueprint_name='Framed Vertical Poster',provider=2,provider_name='Sensaria',slogan='Pressed Down, Shaken Together',variant='16x20',confirmed=True)
d=Doc(4800,6000,IVORY);d.text('PRESSED DOWN,',500,900,3800,450,'e',INK);d.text('SHAKEN TOGETHER',300,1500,4200,450,'e',GOLD);d.cup(1650,2300,1500,1400);d.text('LUKE 6:38 KJV',1400,4300,2000,250,'d',INK);d.text('Give, and it shall be given unto you',600,5000,3600,250,'c',INK)
im=save('running-over','pressed-down-framed','16x20',d,{**meta,'position':'front'});mock('running-over','pressed-down-framed','Framed Poster',im,'tall')

meta=dict(product='Tea Towel',blueprint=677,blueprint_name='Tea Towel',provider=70,provider_name='Printed Mint',slogan=KJV_SHORT,variant='One size',confirmed=True)
d=Doc(3600,4800,IVORY);d.text('Give, and it shall',300,900,3000,400,'c',INK);d.text('be given unto you',300,1500,3000,400,'c',INK);d.cup(1050,2200,1500,1400);d.text('THANKSGIVING - LUKE 6:38',600,4000,2400,220,'d',GOLD)
im=save('running-over','thanksgiving-tea-towel','front',d,{**meta,'position':'front'});mock('running-over','thanksgiving-tea-towel','Tea Towel',im,'tall')

# Inventory all wave-3 items from filesystem for manifest
KNOWN={
'stay-charged-pullover':dict(cat='apparel',product='Unisex Heavyweight Pullover Hoodie',blueprint=2001,blueprint_name='Unisex Heavyweight Pullover Hoodie',provider=29,provider_name='Monster Digital',slogan='Stay Charged'),
'day-one-zip':dict(cat='apparel',product='Unisex Fleece Zip Up Hoodie',blueprint=1925,blueprint_name='Unisex Fleece Zip Up Hoodie',provider=99,provider_name='Printify Choice',slogan='Plugged In Since Day One'),
'good-measure-longsleeve':dict(cat='apparel',product='Unisex Jersey Long Sleeve Tee',blueprint=41,blueprint_name='Unisex Jersey Long Sleeve Tee',provider=29,provider_name='Monster Digital',slogan='Good Measure / Luke 6:38'),
'hustle-joggers':dict(cat='apparel',product='Unisex Joggers (Embroidery)',blueprint=1903,blueprint_name='Unisex Joggers (Embroidery)',provider=410,provider_name='Printful',slogan='Low Battery, High Hustle'),
'charged-socks':dict(cat='accessories',product='Sublimation Socks',blueprint=376,blueprint_name='Sublimation Socks',provider=1,provider_name='SPOKE',slogan='Fully Charged Feet'),
'fp-gaiter':dict(cat='accessories',product='Midweight Neck Gaiter',blueprint=970,blueprint_name='Midweight Neck Gaiter',provider=99,provider_name='Printify Choice',slogan='FP circle repeat'),
'pin-set':dict(cat='accessories',product='Custom Pin Buttons',blueprint=430,blueprint_name='Custom Pin Buttons',provider=1,provider_name='SPOKE',slogan='FP / Plug / Bolt'),
'carry-tote':dict(cat='bags',product='Cotton Tote Bag',blueprint=553,blueprint_name='Cotton Tote Bag',provider=217,provider_name='Fulfill Engine',slogan='Carry the Connection'),
'gym-drawstring':dict(cat='bags',product='Drawstring Bag',blueprint=414,blueprint_name='Drawstring Bag',provider=10,provider_name='MWW On Demand',slogan='Gym Plug'),
'charger-backpack':dict(cat='bags',product='Backpack',blueprint=413,blueprint_name='Backpack',provider=10,provider_name='MWW On Demand',slogan='Charger Not Included'),
'pocket-fanny':dict(cat='bags',product='Fanny Pack',blueprint=468,blueprint_name='Fanny Pack',provider=10,provider_name='MWW On Demand',slogan='Pocket Plug'),
'recharge-blanket':dict(cat='home-living',product='Velveteen Plush Blanket',blueprint=522,blueprint_name='Velveteen Plush Blanket',provider=1,provider_name='SPOKE',slogan='Recharge Mode'),
'plug-clock':dict(cat='home-living',product='Wall Clock',blueprint=277,blueprint_name='Wall Clock',provider=1,provider_name='SPOKE',slogan='Plug Time'),
'rinse-curtain':dict(cat='home-living',product='Shower Curtains',blueprint=235,blueprint_name='Shower Curtains',provider=10,provider_name='MWW On Demand',slogan='Rinse, Recharge, Repeat'),
'chef-apron':dict(cat='kitchen',product='Cotton Apron',blueprint=713,blueprint_name='Cotton Apron',provider=6,provider_name='T Shirt and Sons',slogan='Head Chef, Head Plug'),
'plugged-cutting-board':dict(cat='kitchen',product='Glass Cutting Board',blueprint=938,blueprint_name='Glass Cutting Board',provider=92,provider_name='Pic The Gift',slogan='Plugged-In Kitchen'),
'coaster-set':dict(cat='kitchen',product='Hardboard Coasters Set of 4',blueprint=2764,blueprint_name='Hardboard Coasters with Cork Bottom (Set of 4)',provider=59,provider_name='Imagine Your Photos',slogan='FP / plug / bolt / charged'),
'recharge-pint':dict(cat='drinkware',product='Pint Glass 16oz',blueprint=633,blueprint_name='Pint Glass, 16oz',provider=86,provider_name='Chill',slogan='Recharge Station'),
'cool-can-cooler':dict(cat='drinkware',product='Can Cooler',blueprint=951,blueprint_name='Can Cooler',provider=92,provider_name='Pic The Gift',slogan='Keep It Cool, Keep It Plugged'),
'unplugged-wine':dict(cat='drinkware',product='Chill Wine Tumbler',blueprint=620,blueprint_name='Chill Wine Tumbler',provider=86,provider_name='Chill',slogan='Unplugged Hours'),
'good-boy-bandana':dict(cat='pets',product='Pet Bandana',blueprint=562,blueprint_name='Pet Bandana',provider=70,provider_name='Printed Mint',slogan='Good Boy Fully Charged'),
'fuel-bowl':dict(cat='pets',product='Pet Bowl',blueprint=570,blueprint_name='Pet Bowl',provider=70,provider_name='Printed Mint',slogan='Fuel Station'),
'recharge-pet-bed':dict(cat='pets',product='Pet Bed',blueprint=419,blueprint_name='Pet Bed',provider=10,provider_name='MWW On Demand',slogan='Recharge Zone'),
'human-knows-dog-tee':dict(cat='pets',product='Pet Tank Top',blueprint=571,blueprint_name='Pet Tank Top',provider=70,provider_name='Printed Mint',slogan='My Human Knows a Plug'),
'newest-onesie':dict(cat='kids-baby',product='Baby Short Sleeve Onesie',blueprint=568,blueprint_name='Baby Short Sleeve Onesie®',provider=39,provider_name='SwiftPOD',slogan='Newest Plug'),
'mini-plug-tee':dict(cat='kids-baby',product='Toddler Short Sleeve Tee',blueprint=580,blueprint_name='Toddler Short Sleeve Tee',provider=39,provider_name='SwiftPOD',slogan='Mini Plug'),
'charging-kids-hoodie':dict(cat='kids-baby',product='Youth Heavy Blend Hooded Sweatshirt',blueprint=314,blueprint_name='Youth Heavy Blend Hooded Sweatshirt',provider=29,provider_name='Monster Digital',slogan='Charging Up'),
'dont-hit-1-case':dict(cat='tech',product='Tough Phone Cases',blueprint=269,blueprint_name='Tough Phone Cases',provider=1,provider_name='SPOKE',slogan="Don't Let Me Hit 1%"),
'slim-fp-case':dict(cat='tech',product='Slim Phone Cases',blueprint=268,blueprint_name='Slim Phone Cases',provider=1,provider_name='SPOKE',slogan='Minimal FP circle'),
'click-mousepad':dict(cat='tech',product='Mouse Pad (Rectangle)',blueprint=608,blueprint_name='Mouse Pad (Rectangle)',provider=28,provider_name='District Photo',slogan='Click, Connect, Get Paid'),
'website-laptop-sleeve':dict(cat='tech',product='Laptop Sleeve',blueprint=429,blueprint_name='Laptop Sleeve',provider=1,provider_name='SPOKE',slogan='Website Was Free'),
'ideas-notebook':dict(cat='stationery',product='Spiral Notebook - Ruled Line',blueprint=74,blueprint_name='Spiral Notebook - Ruled Line',provider=1,provider_name='SPOKE',slogan='Ideas Worth Plugging'),
'poster-1-plug-map':dict(cat='wall-art',product='Matte Vertical Posters',blueprint=282,blueprint_name='Matte Vertical Posters',provider=2,provider_name='Sensaria',slogan='Plug Map'),
'poster-2-hustle-hours':dict(cat='wall-art',product='Matte Vertical Posters',blueprint=282,blueprint_name='Matte Vertical Posters',provider=2,provider_name='Sensaria',slogan='Hustle Hours'),
'poster-3-free-is-a-feeling':dict(cat='wall-art',product='Matte Vertical Posters',blueprint=282,blueprint_name='Matte Vertical Posters',provider=2,provider_name='Sensaria',slogan='Free Is a Feeling'),
'poster-4-wired-different':dict(cat='wall-art',product='Matte Vertical Posters',blueprint=282,blueprint_name='Matte Vertical Posters',provider=2,provider_name='Sensaria',slogan='Wired Different'),
'stay-connected-framed':dict(cat='wall-art',product='Framed Vertical Poster',blueprint=540,blueprint_name='Framed Vertical Poster',provider=2,provider_name='Sensaria',slogan='Stay Connected'),
'plug-parking-sign':dict(cat='wall-art',product='Metal Art Sign',blueprint=1206,blueprint_name='Metal Art Sign',provider=228,provider_name='Taylor',slogan='Plug Parking Only'),
'solar-towel':dict(cat='outdoor',product='Beach Towel',blueprint=352,blueprint_name='Beach Towel',provider=1,provider_name='SPOKE',slogan='Solar Charging'),
'offgrid-camping-mug':dict(cat='outdoor',product='Enamel Camping Mug',blueprint=483,blueprint_name='Enamel Camping Mug',provider=28,provider_name='District Photo',slogan='Off-Grid Plug'),
'unplug-picnic':dict(cat='outdoor',product='Picnic Blanket',blueprint=1124,blueprint_name='Picnic Blanket',provider=28,provider_name='District Photo',slogan='Unplug Together'),
'plug-lives-flag':dict(cat='outdoor',product='Garden & House Banner',blueprint=976,blueprint_name='Garden & House Banner',provider=92,provider_name='Pic The Gift',slogan='A Plug Lives Here'),
'plugged-ornament':dict(cat='seasonal',product='Ceramic Ornament',blueprint=531,blueprint_name='Ceramic Ornament, 4 Shapes',provider=59,provider_name='Imagine Your Photos',slogan='Plugged-In Christmas'),
'ugly-sweater-crew':dict(cat='seasonal',product='Unisex Heavy Blend Crewneck',blueprint=49,blueprint_name='Unisex Heavy Blend™ Crewneck Sweatshirt',provider=29,provider_name='Monster Digital',slogan='Ugly-sweater plugs & bolts'),
'running-over-stocking':dict(cat='seasonal',product='Christmas Stocking',blueprint=734,blueprint_name='Christmas Stocking',provider=59,provider_name='Imagine Your Photos',slogan='Fill It Running Over'),
'kjv-woven-blanket':dict(cat='running-over',product='Woven Blanket',blueprint=1626,blueprint_name='Woven Blanket',provider=10,provider_name='MWW On Demand',slogan=KJV_SHORT),
'kjv-serving-tray':dict(cat='running-over',product='Acrylic Serving Tray',blueprint=780,blueprint_name='Acrylic Serving Tray',provider=59,provider_name='Imagine Your Photos',slogan=KJV_SHORT),
'kjv-bookmarks':dict(cat='running-over',product='Bookmark',blueprint=765,blueprint_name='Bookmark',provider=59,provider_name='Imagine Your Photos',slogan='Luke 6:38'),
'pressed-down-framed':dict(cat='running-over',product='Framed Vertical Poster',blueprint=540,blueprint_name='Framed Vertical Poster',provider=2,provider_name='Sensaria',slogan='Pressed Down, Shaken Together'),
'thanksgiving-tea-towel':dict(cat='running-over',product='Tea Towel',blueprint=677,blueprint_name='Tea Towel',provider=70,provider_name='Printed Mint',slogan=KJV_SHORT),
}
full=[];png_count=0
for slug,info in KNOWN.items():
 folder=ROOT/info['cat']/slug
 files=[]
 for png in sorted(folder.glob('*.png')):
  if png.name=='mockup.png':continue
  im=Image.open(png);png_count+=1
  conf=not ('assumed' in png.stem.lower())
  files.append({'file':png.name,'svg':png.with_suffix('.svg').name if png.with_suffix('.svg').exists() else None,'size':list(im.size),'confirmed':conf,'dpi':im.info.get('dpi')})
 full.append({**info,'slug':slug,'category':info['cat'],'files':files,'mockup':'mockup.png' if (folder/'mockup.png').exists() else None})

# Overviews
sheets=[]
for cat in ['apparel','accessories','bags','home-living','kitchen','drinkware','pets','kids-baby','tech','stationery','wall-art','outdoor','seasonal','running-over']:
 items=[e for e in full if e['category']==cat]
 if not items:continue
 rows=math.ceil(len(items)/4);over=Image.new('RGB',(2200,80+rows*360),'#e7e3dc');dr=ImageDraw.Draw(over)
 dr.text((30,20),f'FREEPLUG WAVE-3 / {cat.upper()}',font=PRE,fill=INK)
 for i,e in enumerate(items):
  mp=ROOT/e['category']/e['slug']/'mockup.png'
  if mp.exists():
   im=Image.open(mp);im.thumbnail((550,340),Image.Resampling.LANCZOS);over.paste(im,((i%4)*550,70+(i//4)*360))
 sheets.append(over);over.save(ROOT/f'overview-{len(sheets)}.png')
if sheets:sheets[0].save(ROOT/'overview.png')

skips=[
 {'item':'Lanyard — I Know a Plug repeat','reason':'No Printify lanyard blueprint in catalog.'},
 {'item':'Bib — Refuel Required','reason':'No baby/infant feeding bib blueprint in catalog.'},
 {'item':'Notepad — Note to Self: Stay Charged','reason':'No notepad blueprint; spiral notebook covers Ideas Worth Plugging.'},
 {'item':'Planner cover — Plan the Plug','reason':'No planner-cover blueprint in catalog.'},
]
lines=['# Freeplug merch — Wave 3','','Local artwork only. Read-only Printify catalog GETs. No products created, uploaded, or published.','',f'Item groups: **{len(full)}**. Print PNG files: **{png_count}**. Matching SVGs and mockups included where generated.','','## Skipped']
for s in skips:lines.append(f"- **{s['item']}** — {s['reason']}")
lines+=['','## Production gates','- Confirmed sizes match saved variant placeholders under `../catalog/` unless marked ASSUMED.','- Long-sleeve sleeve art is ASSUMED 900×3600 from similar apparel sleeve placeholders; no long-sleeve tee sleeve area was found.','- Embroidery: day-one zip + hustle joggers — 1 ivory thread, thickened strokes; digitizer/sample required.','- Faith pieces: exact KJV Luke 6:38 wording only (short clause or segmented full verse on sleeve/bookmarks).','- Large AOP (towel, curtain, picnic, pet bed) files are heavy.','- Ugly sweater is DTG pattern on crewneck, not true knit.','- Dog tee mapped to Pet Tank Top (closest blank).','- Mockups are original flats, not proofs.','','## Inventory']
for e in full:
 lines+=['',f"### {e['category']}/{e['slug']}",f"**Product:** {e['product']}",f"**Blueprint:** {e['blueprint']} — {e['blueprint_name']}",f"**Provider:** {e['provider']} — {e['provider_name']}",f"**Slogan:** {e['slogan']}",'| File | Pixels | Confirmed |','|---|---:|---|']
 for f in e['files']:
  lines.append(f"| `{e['category']}/{e['slug']}/{f['file']}` | {f['size'][0]}×{f['size'][1]} | {'yes' if f['confirmed'] else 'ASSUMED'} |")
(ROOT/'MANIFEST.md').write_text('\n'.join(lines))
(ROOT/'manifest.json').write_text(json.dumps({'entries':full,'skips':skips,'png_count':png_count,'overviews':len(sheets)},indent=2))
print('DONE',len(full),'items',png_count,'pngs',len(sheets),'overviews')
