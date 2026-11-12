#!/usr/bin/env python3
"""Local Freeplug wave-3 merch artwork. GET-only catalog data already saved. No uploads."""
from pathlib import Path
import json,io,math,re
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cairosvg

ROOT=Path('/workspace/logos/freeplug/merch/wave-3')
CAT=Path('/workspace/logos/freeplug/merch/catalog')
Image.MAX_IMAGE_PIXELS=250_000_000
# Reuse brand Doc helpers from prior merch build
scope={}
exec((Path('/workspace/logos/freeplug/merch/build_merch.py')).read_text().split('# 01-05 drinkware')[0],scope)
Doc,RED,IVORY,INK,GRAY=scope['Doc'],scope['RED'],scope['IVORY'],scope['INK'],scope['GRAY']
GOLD='#c9a227'
FONTDIR=Path('/workspace/logos/FP/fonts/ttf')
PRE=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),28)
SMALL=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),18)
entries=[];checks=[];skips=[]

def save(cat,slug,name,doc,meta):
 folder=ROOT/cat/slug;folder.mkdir(parents=True,exist_ok=True)
 svg=doc.svg();(folder/f'{name}.svg').write_text(svg)
 im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA')
 if doc.bg is None:
  a=np.array(im);a[:,:,3]=np.where(a[:,:,3]>=128,255,0).astype('uint8');a[a[:,:,3]==0,:3]=0;im=Image.fromarray(a)
 im.save(folder/f'{name}.png',dpi=(300,300))
 assert im.size==(doc.w,doc.h)
 bb=im.getbbox();checks.append({'file':f'{cat}/{slug}/{name}.png','size':list(im.size),'dpi':300,'bounds':bb,'confirmed':meta.get('confirmed',True)})
 ent=next((e for e in entries if e['slug']==slug),None)
 if not ent:
  ent={'category':cat,'slug':slug,'product':meta['product'],'blueprint':meta.get('blueprint'),'blueprint_name':meta.get('blueprint_name'),'provider':meta.get('provider'),'provider_name':meta.get('provider_name'),'slogan':meta.get('slogan',''),'files':[]};entries.append(ent)
 ent['files'].append({'file':f'{name}.png','svg':f'{name}.svg','size':[doc.w,doc.h],'position':meta.get('position','front'),'variant':meta.get('variant'),'confirmed':meta.get('confirmed',True),'notes':meta.get('notes','')})
 return im

def mock(cat,slug,title,art,kind='rect'):
 folder=ROOT/cat/slug;out=Image.new('RGB',(1100,820),'#e7e3dc');d=ImageDraw.Draw(out)
 d.text((40,24),title.upper()[:48],font=PRE,fill=INK)
 a=art.convert('RGBA')
 if kind=='apparel':
  pts=[(320,120),(250,160),(190,290),(270,330),(300,270),(295,700),(620,700),(615,270),(645,330),(725,290),(665,160),(595,120)]
  d.polygon(pts,fill='#1a1a1a');a.thumbnail((280,340),Image.Resampling.LANCZOS);out.paste(a,(325,250),a)
 elif kind=='circle':
  d.ellipse((350,160,750,560),fill='#ddd');a.thumbnail((360,360),Image.Resampling.LANCZOS);out.paste(a,(370,180),a)
 elif kind=='tall':
  d.rounded_rectangle((400,100,700,700),radius=40,fill='#f3efe6');a.thumbnail((260,540),Image.Resampling.LANCZOS);out.paste(a,(420,130),a)
 else:
  d.rounded_rectangle((120,120,980,700),radius=28,fill='#111');a.thumbnail((820,540),Image.Resampling.LANCZOS);out.paste(a,((1100-a.width)//2,160),a)
 d.text((40,770),'ORIGINAL FLAT PREVIEW / NOT A COLOR OR SCALE PROOF',font=SMALL,fill=GRAY)
 out.save(folder/'mockup.png')

def pattern_plugs(d,w,h,step=280,c=RED):
 for y in range(80,h-40,step):
  for x in range(80,w-40,step):
   # bolt
   d.raw(f'<path d="M{x+40} {y} L{x+70} {y} L{x+55} {y+45} L{x+85} {y+45} L{x+35} {y+120} L{x+50} {y+70} L{x+20} {y+70} Z" fill="{c}"/>')
   # tiny plug
   d.rect(x+140,y+30,55,40,c,8);d.rect(x+150,y+10,12,28,c,4);d.rect(x+172,y+10,12,28,c,4)

def battery(d,x,y,w,h,fill_frac=1.0,c=RED,frame=INK):
 d.rect(x,y,w,h,'none',h*.12,frame,max(8,int(w*.03)));d.rect(x+w+6,y+h*.28,w*.06,h*.44,frame,5)
 bars=4;gap=w*.04;bw=(w-gap*(bars+1))/bars
 for i in range(bars):
  if (i+1)/bars<=fill_frac+1e-6:d.rect(x+gap+i*(bw+gap),y+gap,bw,h-2*gap,c,6)

# ---------------- APPAREL ----------------
# 1 pullover
meta=dict(product='Unisex Heavyweight Pullover Hoodie',blueprint=2001,blueprint_name='Unisex Heavyweight Pullover Hoodie',provider=29,provider_name='Monster Digital',slogan='Stay Charged',variant='Black / L',confirmed=True)
d=Doc(4200,2799);d.circle(1550,350,1100,RED);d.text('STAY CHARGED',900,1600,2400,450,'e',INK);im=save('apparel','stay-charged-pullover','front',d,{**meta,'position':'front','notes':'Chest circle mark + wordmark. Exact L front area.'})
d=Doc(4200,4800);battery(d,700,900,2800,1400,1.0,RED,INK);d.text('STAY CHARGED',700,2800,2800,500,'e',INK);d.text('FULL POWER',1200,3500,1800,280,'d',RED);im2=save('apparel','stay-charged-pullover','back',d,{**meta,'position':'back','notes':'Large battery bars on back. Exact L back area.'});mock('apparel','stay-charged-pullover','Stay Charged Pullover',im2,'apparel')

# 2 zip embroidery
meta=dict(product='Unisex Fleece Zip Up Hoodie (embroidery)',blueprint=1925,blueprint_name='Unisex Fleece Zip Up Hoodie',provider=99,provider_name='Printify Choice',slogan='Plugged In Since Day One',variant='Black / L',confirmed=True)
d=Doc(1193,1193);d.text('PLUGGED IN',80,220,1033,220,'e',IVORY,True);d.text('SINCE',300,520,593,180,'c',IVORY,True);d.text('DAY ONE',140,780,913,220,'e',IVORY,True);im=save('apparel','day-one-zip','left-chest-embroidery',d,{**meta,'position':'front_left_chest','notes':'Embroidery-safe 1 ivory thread on dark zip hoodie. Exact Printify Choice embroidery area. Digitizer validation required.'});mock('apparel','day-one-zip','Day One Zip Embroidery',im,'apparel')

# 3 long sleeve + assumed sleeve
meta=dict(product='Unisex Jersey Long Sleeve Tee',blueprint=41,blueprint_name='Unisex Jersey Long Sleeve Tee',provider=29,provider_name='Monster Digital',slogan='Good Measure / Luke 6:38',variant='L front',confirmed=True)
d=Doc(4200,4800);d.text('GOOD',900,900,2400,700,'e',INK);d.text('MEASURE',700,1800,2800,700,'e',RED);d.mark(1600,2900,1000,800,INK);d.text('LUKE 6:38',1400,4000,1400,250,'d',INK);im=save('apparel','good-measure-longsleeve','front',d,{**meta,'position':'front','notes':'Confirmed front area.'})
# Sleeve: no long-sleeve tee sleeve placeholder found; use common Printify sleeve DTG size from zip hoodie 1925 as ASSUMED companion.
d=Doc(900,3600);verse=['Give, and it shall','be given unto you;','good measure,','pressed down,','and shaken together,','and running over,','shall men give','into your bosom.','For with the same','measure that ye','mete withal it shall','be measured to','you again.','— Luke 6:38 KJV']
for i,s in enumerate(verse):d.text(s,40,120+i*230,820,160,'d',INK)
im2=save('apparel','good-measure-longsleeve','sleeve-assumed',d,{**meta,'position':'left_sleeve','confirmed':False,'variant':'ASSUMED 900x3600','notes':'ASSUMED size from similar Printify apparel sleeve placeholders (e.g. zip hoodie 1925). No long-sleeve tee sleeve area found in catalog. Confirm before production.'});mock('apparel','good-measure-longsleeve','Good Measure Long Sleeve',im,'apparel')

# 4 joggers embroidery
meta=dict(product='Unisex Joggers (Embroidery)',blueprint=1903,blueprint_name='Unisex Joggers (Embroidery)',provider=410,provider_name='Printful',slogan='Low Battery, High Hustle',variant='Black / M',confirmed=True)
d=Doc(1200,1200);d.mark(420,80,360,280,IVORY);d.text('LOW BATTERY',80,420,1040,180,'e',IVORY,True);d.text('HIGH HUSTLE',80,700,1040,180,'e',IVORY,True);im=save('apparel','hustle-joggers','thigh-embroidery',d,{**meta,'position':'front_apparel_embroidery','notes':'FP mark + slogan in one embroidery field (only placement exposed). 1 ivory thread. Digitizer required.'});mock('apparel','hustle-joggers','Hustle Joggers',im,'apparel')

# ---------------- ACCESSORIES ----------------
# socks AOP one panel reused
meta=dict(product='Sublimation Socks',blueprint=376,blueprint_name='Sublimation Socks',provider=1,provider_name='SPOKE Custom Products',slogan='Fully Charged Feet',variant='L',confirmed=True)
d=Doc(1348,5595,IVORY);pattern_plugs(d,1348,5595,320,RED);d.rect(120,2400,1108,700,INK,40);d.text('FULLY',200,2480,948,220,'e',IVORY);d.text('CHARGED FEET',160,2800,1028,220,'e',RED);im=save('accessories','charged-socks','leg-panel',d,{**meta,'position':'front_left_leg','notes':'Same panel usable for all four sock placements. Exact size.'});mock('accessories','charged-socks','Fully Charged Socks',im,'tall')

# gaiter
meta=dict(product='Midweight Neck Gaiter',blueprint=970,blueprint_name='Midweight Neck Gaiter',provider=99,provider_name='Printify Choice',slogan='FP circle repeat',variant='One size',confirmed=True)
d=Doc(2900,5300,INK)
for y in range(120,5200,620):
 for x in range(120,2800,620):d.circle(x,y,480,RED)
im=save('accessories','fp-gaiter','front',d,{**meta,'position':'front','notes':'AOP circle repeat; same art for back. Exact area.'});mock('accessories','fp-gaiter','FP Neck Gaiter',im,'tall')

# pin set - custom pin buttons
meta=dict(product='Custom Pin Buttons',blueprint=430,blueprint_name='Custom Pin Buttons',provider=1,provider_name='SPOKE Custom Products',slogan='FP / Plug / Bolt pin set',variant='1.25"',confirmed=True)
for name,draw in [
 ('fp-mark', lambda d: (d.circle(40,40,439,RED))),
 ('plug', lambda d: (d.rect(160,260,200,160,RED,30), d.rect(195,160,40,120,RED,10), d.rect(285,160,40,120,RED,10), d.raw(f'<path d="M259 420 Q340 520 259 560" fill="none" stroke="{RED}" stroke-width="36" stroke-linecap="round"/>'))),
 ('bolt', lambda d: d.raw(f'<path d="M230 80 L320 80 L270 230 L360 230 L200 450 L250 280 L150 280 Z" fill="{RED}"/>'))
]:
 d=Doc(519,519);draw(d);im=save('accessories','pin-set',name,d,{**meta,'position':'front','notes':'Round button pin. Exact 519px area.'})
mock('accessories','pin-set','Pin Set',Image.open(ROOT/'accessories/pin-set/fp-mark.png'),'circle')

# ---------------- BAGS ----------------
meta=dict(product='Cotton Tote Bag',blueprint=553,blueprint_name='Cotton Tote Bag',provider=217,provider_name='Fulfill Engine',slogan='Carry the Connection',variant='front',confirmed=True)
d=Doc(3000,2400);d.mark(1100,250,800,650,RED);d.text('CARRY THE',400,1100,2200,400,'e',INK);d.text('CONNECTION',300,1650,2400,400,'e',RED);im=save('bags','carry-tote','front',d,{**meta,'position':'front'});mock('bags','carry-tote','Carry Tote',im)

meta=dict(product='Drawstring Bag',blueprint=414,blueprint_name='Drawstring Bag',provider=10,provider_name='MWW On Demand',slogan='Gym Plug',variant='One size',confirmed=True)
d=Doc(4950,11100,INK);d.circle(1475,2800,2000,RED);d.text('GYM',1200,5600,2550,900,'e',IVORY);d.text('PLUG',1200,6800,2550,900,'e',IVORY);im=save('bags','gym-drawstring','front',d,{**meta,'position':'front','notes':'Full-bleed AOP panel.'});mock('bags','gym-drawstring','Gym Drawstring',im,'tall')

meta=dict(product='Backpack',blueprint=413,blueprint_name='Backpack',provider=10,provider_name='MWW On Demand',slogan='Charger Not Included',variant='front panel',confirmed=True)
d=Doc(1925,2796);d.mark(662,400,600,480,RED);d.text('CHARGER',200,1200,1525,280,'e',INK);d.text('NOT INCLUDED',150,1650,1625,280,'e',INK);im=save('bags','charger-backpack','front',d,{**meta,'position':'front'});d=Doc(3937,351);d.text('CHARGER NOT INCLUDED',200,60,3537,230,'e',INK);save('bags','charger-backpack','strap-top',d,{**meta,'position':'top_part_to_front','notes':'Strap/top strip placement for slogan.'});mock('bags','charger-backpack','Charger Backpack',im,'tall')

meta=dict(product='Fanny Pack',blueprint=468,blueprint_name='Fanny Pack',provider=10,provider_name='MWW On Demand',slogan='Pocket Plug',variant='One size',confirmed=True)
d=Doc(2323,846);d.mark(120,180,420,420,RED);d.text('POCKET PLUG',620,260,1550,320,'e',INK);im=save('bags','pocket-fanny','front',d,{**meta,'position':'front'});mock('bags','pocket-fanny','Pocket Fanny',im)

# ---------------- HOME ----------------
meta=dict(product='Velveteen Plush Blanket',blueprint=522,blueprint_name='Velveteen Plush Blanket',provider=1,provider_name='SPOKE Custom Products',slogan='Recharge Mode',variant='30x40',confirmed=True)
d=Doc(4725,6300,IVORY);d.text('RECHARGE',600,900,3525,700,'e',INK);d.text('MODE',1200,1800,2325,700,'c',RED);battery(d,1100,3000,2525,1200,0.25,RED,INK);d.text('zzz',2100,4600,500,300,'c',GRAY);im=save('home-living','recharge-blanket','front',d,{**meta,'position':'front'});mock('home-living','recharge-blanket','Recharge Blanket',im)

meta=dict(product='Wall Clock',blueprint=277,blueprint_name='Wall Clock',provider=1,provider_name='SPOKE Custom Products',slogan='Plug Time',variant='One size',confirmed=True)
d=Doc(3000,3000,IVORY)
for ang,label in [(270,'12'),(0,'3'),(90,'6'),(180,'9')]:
 rad=math.radians(ang);cx,cy=1500+1050*math.cos(rad),1500+1050*math.sin(rad)
 d.raw(f'<path d="M{cx-40} {cy-70} L{cx-10} {cy-70} L{cx-25} {cy-20} L{cx+20} {cy-20} L{cx-50} {cy+80} L{cx-20} {cy+10} L{cx-70} {cy+10} Z" fill="{RED}"/>')
d.circle(1050,1050,900,RED);d.text('PLUG TIME',900,2550,1200,250,'e',INK);im=save('home-living','plug-clock','front',d,{**meta,'position':'front','notes':'Keep center clear of critical type for clock hardware.'});mock('home-living','plug-clock','Plug Clock',im,'circle')

meta=dict(product='Shower Curtains',blueprint=235,blueprint_name='Shower Curtains',provider=10,provider_name='MWW On Demand',slogan='Rinse, Recharge, Repeat',variant='One size',confirmed=True)
d=Doc(7104,7392,IVORY);pattern_plugs(d,7104,7392,520,RED)
d.rect(800,2800,5500,1600,INK,80);d.text('RINSE, RECHARGE,',1100,3000,4900,500,'e',IVORY);d.text('REPEAT.',2200,3700,2700,500,'e',RED);im=save('home-living','rinse-curtain','front',d,{**meta,'position':'front'});mock('home-living','rinse-curtain','Shower Curtain',im)

# ---------------- KITCHEN ----------------
meta=dict(product='Cotton Apron',blueprint=713,blueprint_name='Cotton Apron',provider=6,provider_name='T Shirt and Sons',slogan='Head Chef, Head Plug',variant='One size',confirmed=True)
d=Doc(2953,3780);d.mark(1076,400,800,650,RED);d.text('HEAD CHEF',400,1400,2153,400,'e',INK);d.text('HEAD PLUG',400,2000,2153,400,'e',RED);im=save('kitchen','chef-apron','front',d,{**meta,'position':'front','notes':'Provider T Shirt and Sons may fulfill outside US; confirm market.'});mock('kitchen','chef-apron','Chef Apron',im,'apparel')

meta=dict(product='Glass Cutting Board',blueprint=938,blueprint_name='Glass Cutting Board',provider=92,provider_name='Pic The Gift',slogan='Plugged-In Kitchen',variant='8x11',confirmed=True)
d=Doc(2250,1650,IVORY);d.mark(150,450,500,500,RED);d.text('PLUGGED-IN',750,500,1350,300,'e',INK);d.text('KITCHEN',750,950,1350,300,'e',RED);im=save('kitchen','plugged-cutting-board','front',d,{**meta,'position':'front'});mock('kitchen','plugged-cutting-board','Cutting Board',im)

meta=dict(product='Hardboard Coasters Set of 4',blueprint=2764,blueprint_name='Hardboard Coasters with Cork Bottom (Set of 4)',provider=59,provider_name='Imagine Your Photos',slogan='FP / plug / bolt / charged',variant='4x4',confirmed=True)
for name,fn in [('fp',lambda d:d.circle(120,120,998,RED)),('plug',lambda d:(d.rect(400,520,440,280,RED,40),d.rect(470,320,80,240,RED,12),d.rect(680,320,80,240,RED,12))),('bolt',lambda d:d.raw(f'<path d="M520 180 L720 180 L600 480 L820 480 L420 1050 L560 620 L320 620 Z" fill="{RED}"/>')),('charged',lambda d:(battery(d,220,420,800,400,1.0),d.text('CHARGED',220,900,800,180,'e',INK)))]:
 d=Doc(1238,1238,IVORY);fn(d);im=save('kitchen','coaster-set',name,d,{**meta,'position':'front'})
mock('kitchen','coaster-set','Coaster Set',Image.open(ROOT/'kitchen/coaster-set/fp.png'),'circle')

# ---------------- DRINKWARE ----------------
meta=dict(product='Pint Glass 16oz',blueprint=633,blueprint_name='Pint Glass, 16oz',provider=86,provider_name='Chill',slogan='Recharge Station',variant='16oz',confirmed=True)
d=Doc(2738,1276);d.mark(200,300,500,500,RED);d.text('RECHARGE',800,350,1700,280,'e',INK);d.text('STATION',800,750,1700,280,'e',RED);im=save('drinkware','recharge-pint','front',d,{**meta,'position':'front'});mock('drinkware','recharge-pint','Pint Glass',im)

meta=dict(product='Can Cooler',blueprint=951,blueprint_name='Can Cooler',provider=92,provider_name='Pic The Gift',slogan='Keep It Cool, Keep It Plugged',variant='One size',confirmed=True)
d=Doc(1425,3300);d.text('KEEP IT',150,600,1125,350,'e',INK);d.text('COOL',200,1100,1025,400,'e',RED);d.mark(412,1700,600,500,INK);d.text('KEEP IT',150,2400,1125,280,'e',INK);d.text('PLUGGED',100,2800,1225,280,'e',RED);im=save('drinkware','cool-can-cooler','front',d,{**meta,'position':'front'});mock('drinkware','cool-can-cooler','Can Cooler',im,'tall')

meta=dict(product='Chill Wine Tumbler',blueprint=620,blueprint_name='Chill Wine Tumbler',provider=86,provider_name='Chill',slogan='Unplugged Hours',variant='One size',confirmed=True)
d=Doc(3279,900);d.mark(200,150,500,500,RED);d.text('UNPLUGGED HOURS',850,280,2200,320,'e',INK);im=save('drinkware','unplugged-wine','front',d,{**meta,'position':'front'});mock('drinkware','unplugged-wine','Wine Tumbler',im)

# ---------------- PETS ----------------
meta=dict(product='Pet Bandana',blueprint=562,blueprint_name='Pet Bandana',provider=70,provider_name='Printed Mint',slogan='Good Boy Fully Charged',variant='20x10',confirmed=True)
d=Doc(3150,1691,IVORY);d.mark(200,400,500,500,RED);d.text('GOOD BOY',900,350,2000,400,'e',INK);d.text('FULLY CHARGED',850,950,2100,350,'e',RED);im=save('pets','good-boy-bandana','front',d,{**meta,'position':'front'});mock('pets','good-boy-bandana','Pet Bandana',im)

meta=dict(product='Pet Bowl',blueprint=570,blueprint_name='Pet Bowl',provider=70,provider_name='Printed Mint',slogan='Fuel Station',variant='One size',confirmed=True)
d=Doc(2760,750);d.mark(80,100,400,400,RED);d.text('FUEL STATION',550,200,2000,320,'e',INK);im=save('pets','fuel-bowl','front',d,{**meta,'position':'front','notes':'Wrap band around bowl; keep type large.'});mock('pets','fuel-bowl','Pet Bowl',im)

meta=dict(product='Pet Bed',blueprint=419,blueprint_name='Pet Bed',provider=10,provider_name='MWW On Demand',slogan='Recharge Zone',variant='28x18',confirmed=True)
d=Doc(8850,5850,IVORY);battery(d,2425,1200,4000,1800,0.5,RED,INK);d.text('RECHARGE ZONE',1800,3600,5250,700,'e',INK);im=save('pets','recharge-pet-bed','front',d,{**meta,'position':'front'});mock('pets','recharge-pet-bed','Pet Bed',im)

meta=dict(product='Pet Tank Top',blueprint=571,blueprint_name='Pet Tank Top',provider=70,provider_name='Printed Mint',slogan='My Human Knows a Plug',variant='M',confirmed=True)
d=Doc(1500,2100);d.mark(450,200,600,500,RED);d.text('MY HUMAN',150,900,1200,250,'e',INK);d.text('KNOWS A',200,1250,1100,250,'e',INK);d.text('PLUG',400,1600,700,280,'e',RED);im=save('pets','human-knows-dog-tee','front',d,{**meta,'position':'front','notes':'Mapped to Pet Tank Top (closest dog apparel blank).'});mock('pets','human-knows-dog-tee','Dog Tee',im,'apparel')

# ---------------- KIDS ----------------
meta=dict(product='Baby Short Sleeve Onesie',blueprint=568,blueprint_name='Baby Short Sleeve Onesie®',provider=39,provider_name='SwiftPOD',slogan='Newest Plug',variant='6M',confirmed=True)
d=Doc(1800,2056);d.circle(450,200,900,RED);d.text('NEWEST',300,1300,1200,280,'e',INK);d.text('PLUG',450,1650,900,250,'e',INK);im=save('kids-baby','newest-onesie','front',d,{**meta,'position':'front'});mock('kids-baby','newest-onesie','Onesie',im,'apparel')

meta=dict(product='Toddler Short Sleeve Tee',blueprint=580,blueprint_name='Toddler Short Sleeve Tee',provider=39,provider_name='SwiftPOD',slogan='Mini Plug',variant='2T',confirmed=True)
d=Doc(1500,1714);d.mark(450,150,600,500,RED);d.text('MINI',400,850,700,280,'e',INK);d.text('PLUG',350,1200,800,280,'e',RED);im=save('kids-baby','mini-plug-tee','front',d,{**meta,'position':'front'});mock('kids-baby','mini-plug-tee','Toddler Tee',im,'apparel')

meta=dict(product='Youth Heavy Blend Hooded Sweatshirt',blueprint=314,blueprint_name='Youth Heavy Blend Hooded Sweatshirt',provider=29,provider_name='Monster Digital',slogan='Charging Up',variant='M',confirmed=True)
d=Doc(2717,1817);battery(d,458,250,1800,900,0.5,RED,INK);d.text('CHARGING UP',400,1300,1917,300,'e',INK);im=save('kids-baby','charging-kids-hoodie','front',d,{**meta,'position':'front'});mock('kids-baby','charging-kids-hoodie','Kids Hoodie',im,'apparel')

# ---------------- TECH ----------------
meta=dict(product='Tough Phone Cases',blueprint=269,blueprint_name='Tough Phone Cases',provider=1,provider_name='SPOKE Custom Products',slogan="Don't Let Me Hit 1%",variant='iPhone generic area',confirmed=True)
d=Doc(1290,2160,INK);d.text("DON'T LET",120,500,1050,280,'e',IVORY);d.text('ME HIT',250,900,790,280,'e',IVORY);d.text('1%',400,1300,490,400,'e',RED);battery(d,245,1750,800,280,0.05,RED,IVORY);im=save('tech','dont-hit-1-case','front',d,{**meta,'position':'front','notes':'Exact tough-case placeholder; model-specific variants share this area family—confirm model before upload.'});mock('tech','dont-hit-1-case','Tough Case',im,'tall')

meta=dict(product='Slim Phone Cases',blueprint=268,blueprint_name='Slim Phone Cases',provider=1,provider_name='SPOKE Custom Products',slogan='Minimal FP circle',variant='slim area',confirmed=True)
d=Doc(1200,2040);d.circle(250,620,700,RED);im=save('tech','slim-fp-case','front',d,{**meta,'position':'front'});mock('tech','slim-fp-case','Slim Case',im,'tall')

meta=dict(product='Mouse Pad (Rectangle)',blueprint=608,blueprint_name='Mouse Pad (Rectangle)',provider=28,provider_name='District Photo',slogan='Click, Connect, Get Paid',variant='One size',confirmed=True)
d=Doc(2925,2502,IVORY);d.mark(200,700,700,700,RED);d.text('CLICK,',1100,600,1600,350,'e',INK);d.text('CONNECT,',1000,1050,1700,350,'e',INK);d.text('GET PAID',1050,1500,1600,350,'e',RED);im=save('tech','click-mousepad','front',d,{**meta,'position':'front'});mock('tech','click-mousepad','Mouse Pad',im)

meta=dict(product='Laptop Sleeve',blueprint=429,blueprint_name='Laptop Sleeve',provider=1,provider_name='SPOKE Custom Products',slogan='Website Was Free',variant='13"',confirmed=True)
d=Doc(3600,2700,IVORY);d.mark(200,850,800,800,RED);d.text('WEBSITE',1200,800,2100,450,'e',INK);d.text('WAS FREE',1200,1450,2100,450,'e',RED);im=save('tech','website-laptop-sleeve','front',d,{**meta,'position':'front'});mock('tech','website-laptop-sleeve','Laptop Sleeve',im)

# ---------------- STATIONERY ----------------
meta=dict(product='Spiral Notebook Ruled Line',blueprint=74,blueprint_name='Spiral Notebook - Ruled Line',provider=1,provider_name='SPOKE Custom Products',slogan='Ideas Worth Plugging',variant='One size',confirmed=True)
d=Doc(1810,2534,IVORY);d.mark(555,300,700,600,RED);d.text('IDEAS WORTH',150,1200,1510,350,'e',INK);d.text('PLUGGING',250,1700,1310,350,'e',RED);im=save('stationery','ideas-notebook','front',d,{**meta,'position':'front'});mock('stationery','ideas-notebook','Spiral Notebook',im,'tall')

# ---------------- WALL ART ----------------
posters=[('plug-map','PLUG MAP','Find your people.'),('hustle-hours','HUSTLE HOURS','Stay charged.'),('free-is-a-feeling','FREE IS A','FEELING'),('wired-different','WIRED','DIFFERENT')]
meta=dict(product='Matte Vertical Posters',blueprint=282,blueprint_name='Matte Vertical Posters',provider=2,provider_name='Sensaria',slogan='Poster series',variant='18x24',confirmed=True)
for slug,(a,b,c) in [(f'poster-{i+1}-{s[0].lower().replace(" ","-")}',s) for i,s in enumerate([(x[0],x[1],x[2]) for x in posters])]:
 pass
for i,(slug,line1,line2) in enumerate(posters):
 d=Doc(5400,7200,IVORY);d.mark(2100,800,1200,1000,RED);d.text(line1,400,2600,4600,700,'e',INK);d.text(line2,400,3600,4600,700,'e',RED if i%2 else INK);d.line(1800,4800,3600,4800,RED,20);im=save('wall-art',f'poster-{i+1}-{slug}','18x24',d,{**meta,'slogan':f'{line1} {line2}','position':'front'})
 mock('wall-art',f'poster-{i+1}-{slug}',f'Poster {i+1}',im,'tall')

meta=dict(product='Framed Vertical Poster',blueprint=540,blueprint_name='Framed Vertical Poster',provider=2,provider_name='Sensaria',slogan='Stay Connected',variant='16x20 Black',confirmed=True)
d=Doc(4800,6000,IVORY)
# minimalist line art: two plugs connecting
d.raw(f'<path d="M900 2800 H1800 V2500 H2100 V3100 H1800 V2800 H2400" fill="none" stroke="{INK}" stroke-width="48" stroke-linecap="round"/>')
d.raw(f'<path d="M3900 2800 H3000 V2500 H2700 V3100 H3000 V2800 H2400" fill="none" stroke="{RED}" stroke-width="48" stroke-linecap="round"/>')
d.circle(2280,2680,240,RED);d.text('STAY CONNECTED',800,4200,3200,450,'e',INK);im=save('wall-art','stay-connected-framed','16x20',d,{**meta,'position':'front'});mock('wall-art','stay-connected-framed','Framed Print',im,'tall')

meta=dict(product='Metal Art Sign',blueprint=1206,blueprint_name='Metal Art Sign',provider=228,provider_name='Taylor',slogan='Plug Parking Only',variant='landscape',confirmed=True)
d=Doc(2250,1650,INK);d.rect(80,80,2090,1490,'none',40,IVORY,40);d.text('PLUG',300,350,1650,400,'e',IVORY);d.text('PARKING ONLY',200,900,1850,350,'e',RED);im=save('wall-art','plug-parking-sign','front',d,{**meta,'position':'front'});mock('wall-art','plug-parking-sign','Metal Sign',im)

# ---------------- OUTDOOR ----------------
meta=dict(product='Beach Towel',blueprint=352,blueprint_name='Beach Towel',provider=1,provider_name='SPOKE Custom Products',slogan='Solar Charging',variant='30x60',confirmed=True)
d=Doc(18900,9900,IVORY);pattern_plugs(d,18900,9900,900,RED);d.rect(4200,3200,10500,3200,INK,120);d.text('SOLAR CHARGING',4800,3800,9300,1200,'e',IVORY);d.mark(8500,7000,1900,1600,RED);im=save('outdoor','solar-towel','front',d,{**meta,'position':'front','notes':'Large AOP; file is large.'});mock('outdoor','solar-towel','Beach Towel',im)

meta=dict(product='Enamel Camping Mug',blueprint=483,blueprint_name='Enamel Camping Mug',provider=28,provider_name='District Photo',slogan='Off-Grid Plug',variant='12oz',confirmed=True)
d=Doc(2400,750);d.mark(100,100,400,400,RED);d.text('OFF-GRID PLUG',600,220,1600,280,'e',INK);im=save('outdoor','offgrid-camping-mug','front',d,{**meta,'position':'front'});mock('outdoor','offgrid-camping-mug','Camping Mug',im)

meta=dict(product='Picnic Blanket',blueprint=1124,blueprint_name='Picnic Blanket',provider=28,provider_name='District Photo',slogan='Unplug Together',variant='One size',confirmed=True)
d=Doc(7800,9300,IVORY);d.mark(2900,1800,2000,1700,RED);d.text('UNPLUG',1800,4500,4200,900,'e',INK);d.text('TOGETHER',1400,5800,5000,900,'e',RED);im=save('outdoor','unplug-picnic','front',d,{**meta,'position':'front'});mock('outdoor','unplug-picnic','Picnic Blanket',im)

meta=dict(product='Garden & House Banner',blueprint=976,blueprint_name='Garden & House Banner',provider=92,provider_name='Pic The Gift',slogan='A Plug Lives Here',variant='garden',confirmed=True)
d=Doc(3900,5700,IVORY);d.circle(950,700,2000,RED);d.text('A PLUG',600,3400,2700,500,'e',INK);d.text('LIVES HERE',400,4200,3100,500,'e',RED);im=save('outdoor','plug-lives-flag','front',d,{**meta,'position':'front'});mock('outdoor','plug-lives-flag','Garden Flag',im,'tall')

# ---------------- SEASONAL ----------------
meta=dict(product='Ceramic Ornament',blueprint=531,blueprint_name='Ceramic Ornament, 4 Shapes',provider=59,provider_name='Imagine Your Photos',slogan='Plugged-In Christmas',variant='Circle',confirmed=True)
d=Doc(1043,996,IVORY)
# string lights forming loose FP silhouette: circle of bulbs + inner mark
for i in range(16):
 ang=i*math.pi*2/16;x=521+340*math.cos(ang);y=498+300*math.sin(ang)
 d.raw(f'<circle cx="{x}" cy="{y}" r="28" fill="{RED}"/>')
d.mark(321,280,400,400,GOLD);d.text('PLUGGED-IN',180,780,683,120,'e',INK);im=save('seasonal','plugged-ornament','circle',d,{**meta,'position':'front','notes':'Lights as original dots; FP mark in gold.'});mock('seasonal','plugged-ornament','Ornament',im,'circle')

meta=dict(product='Unisex Heavy Blend Crewneck Sweatshirt',blueprint=49,blueprint_name='Unisex Heavy Blend™ Crewneck Sweatshirt',provider=29,provider_name='Monster Digital',slogan='Ugly-sweater plugs & bolts',variant='L',confirmed=True)
d=Doc(4500,5100,IVORY);pattern_plugs(d,4500,5100,380,RED);d.rect(900,2000,2700,900,INK,40);d.text('PLUGGED-IN',1100,2150,2300,300,'e',IVORY);d.text('HOLIDAYS',1300,2550,1900,280,'e',RED);im=save('seasonal','ugly-sweater-crew','front',d,{**meta,'position':'front','notes':'Knit-look suggested via bold pattern on DTG crewneck (not true knit). Exact L area shared with prior merch.'});mock('seasonal','ugly-sweater-crew','Ugly Sweater Crew',im,'apparel')

meta=dict(product='Christmas Stocking',blueprint=734,blueprint_name='Christmas Stocking',provider=59,provider_name='Imagine Your Photos',slogan='Fill It Running Over',variant='One size',confirmed=True)
d=Doc(3184,3246,IVORY);d.mark(1092,400,1000,850,RED);d.text('FILL IT',500,1600,2184,400,'e',INK);d.text('RUNNING OVER',300,2200,2584,400,'e',RED);im=save('seasonal','running-over-stocking','front',d,{**meta,'position':'front'});mock('seasonal','running-over-stocking','Holiday Stocking',im,'tall')

# ---------------- RUNNING OVER ----------------
KJV_SHORT='Give, and it shall be given unto you'
KJV_FULL='Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again.'

meta=dict(product='Woven Blanket',blueprint=1626,blueprint_name='Woven Blanket',provider=10,provider_name='MWW On Demand',slogan=KJV_SHORT,variant='52x37 Artwork',confirmed=True)
d=Doc(4992,3552,IVORY)
d.text('Give, and it shall',400,500,4192,400,'c',INK);d.text('be given unto you',400,1000,4192,400,'c',INK)
# measuring cup simplified
scope['Doc'].cup(d,1746,1600,1500,1100) if False else None
d.cup(1746,1600,1500,1100)
d.text('LUKE 6:38  ·  KJV',1400,3000,2200,250,'d',GOLD);im=save('running-over','kjv-woven-blanket','front',d,{**meta,'position':'front','notes':'Woven/weaving process; simplify colors. Ivory+ink+gold/red hearts.'});mock('running-over','kjv-woven-blanket','Woven Blanket',im)

meta=dict(product='Acrylic Serving Tray',blueprint=780,blueprint_name='Acrylic Serving Tray',provider=59,provider_name='Imagine Your Photos',slogan=KJV_SHORT,variant='One size',confirmed=True)
d=Doc(4950,3150,IVORY);d.text('Give, and it shall',400,700,4150,450,'c',INK);d.text('be given unto you',400,1300,4150,450,'c',INK);d.text('LUKE 6:38',1700,2300,1550,250,'d',GOLD);im=save('running-over','kjv-serving-tray','front',d,{**meta,'position':'front'});mock('running-over','kjv-serving-tray','Serving Tray',im)

meta=dict(product='Bookmark',blueprint=765,blueprint_name='Bookmark',provider=59,provider_name='Imagine Your Photos',slogan='Luke 6:38',variant='One size',confirmed=True)
for i,lines in enumerate([
 ['Give, and it shall','be given unto you'],
 ['good measure,','pressed down,'],
 ['and shaken together,','and running over'],
 ['shall men give','into your bosom.']
]):
 d=Doc(450,1575,IVORY);d.mark(125,80,200,180,GOLD);d.text(lines[0],30,350,390,180,'d',INK);d.text(lines[1],30,580,390,180,'d',INK);d.text('LUKE 6:38',60,1300,330,100,'e',GOLD);save('running-over','kjv-bookmarks',f'bookmark-{i+1}',d,{**meta,'position':'front','slogan':lines[0]})
mock('running-over','kjv-bookmarks','Bookmark Set',Image.open(ROOT/'running-over/kjv-bookmarks/bookmark-1.png'),'tall')

meta=dict(product='Framed Vertical Poster',blueprint=540,blueprint_name='Framed Vertical Poster',provider=2,provider_name='Sensaria',slogan='Pressed Down, Shaken Together',variant='16x20',confirmed=True)
d=Doc(4800,6000,IVORY);d.text('PRESSED DOWN,',500,900,3800,450,'e',INK);d.text('SHAKEN TOGETHER',300,1500,4200,450,'e',GOLD);d.cup(1650,2300,1500,1400);d.text('LUKE 6:38 KJV',1400,4300,2000,250,'d',INK)
# small exact clause
d.text('Give, and it shall be given unto you',600,5000,3600,250,'c',INK);im=save('running-over','pressed-down-framed','16x20',d,{**meta,'position':'front'});mock('running-over','pressed-down-framed','Framed Poster',im,'tall')

meta=dict(product='Tea Towel',blueprint=677,blueprint_name='Tea Towel',provider=70,provider_name='Printed Mint',slogan=KJV_SHORT,variant='One size',confirmed=True)
d=Doc(3600,4800,IVORY);d.text('Give, and it shall',300,900,3000,400,'c',INK);d.text('be given unto you',300,1500,3000,400,'c',INK);d.cup(1050,2200,1500,1400);d.text('THANKSGIVING  ·  LUKE 6:38',600,4000,2400,220,'d',GOLD);im=save('running-over','thanksgiving-tea-towel','front',d,{**meta,'position':'front'});mock('running-over','thanksgiving-tea-towel','Tea Towel',im,'tall')

# Skips
skips=[
 {'item':'Lanyard — I Know a Plug repeat','reason':'No Printify lanyard blueprint in catalog.'},
 {'item':'Bib — Refuel Required','reason':'No baby/infant feeding bib blueprint in catalog.'},
 {'item':'Notepad — Note to Self: Stay Charged','reason':'No notepad blueprint; spiral notebook covered Ideas Worth Plugging instead.'},
 {'item':'Planner cover — Plan the Plug','reason':'No planner-cover blueprint in catalog.'},
]

# Overviews by category groups
cats=sorted({e['category'] for e in entries})
# Build sheets of up to 12 mockups
sheets=[];idx=0
for cat in ['apparel','accessories','bags','home-living','kitchen','drinkware','pets','kids-baby','tech','stationery','wall-art','outdoor','seasonal','running-over']:
 items=[e for e in entries if e['category']==cat]
 if not items:continue
 rows=math.ceil(len(items)/4);over=Image.new('RGB',(2200,80+rows*360),'#e7e3dc');dr=ImageDraw.Draw(over)
 dr.text((30,20),f'FREEPLUG WAVE-3 / {cat.upper()}',font=PRE,fill=INK)
 for i,e in enumerate(items):
  mp=ROOT/e['category']/e['slug']/'mockup.png'
  if mp.exists():
   im=Image.open(mp);im.thumbnail((550,340),Image.Resampling.LANCZOS);over.paste(im,((i%4)*550,70+(i//4)*360))
 sheets.append(over);over.save(ROOT/f'overview-{len(sheets)}.png')
if sheets:sheets[0].save(ROOT/'overview.png')

# Manifest
lines=['# Freeplug merch — Wave 3','','Local artwork only. Created with read-only Printify catalog GETs. No products created, uploaded, or published.','',f'Item groups: **{len(entries)}**. Print/digital PNG files: **{sum(len(e["files"]) for e in entries)}**. Matching SVGs and mockups included.','','## Skipped',]
for s in skips:lines.append(f"- **{s['item']}** — {s['reason']}")
lines += ['','## Production gates','- Confirmed sizes match saved variant placeholders in `../catalog/`. Assumed files are labeled in notes.','- Embroidery files use 1–2 solid colors and thickened strokes; digitizer/sample required.','- Faith pieces use exact KJV Luke 6:38 wording only.','- Large AOP files (towel, curtain, picnic, pet bed) are heavy; confirm upload limits.','- Some providers may route outside the US; confirm target market before selling.','- Mockups are original flat drawings, not product photos or color proofs.','','## Inventory']
for e in entries:
 lines += ['',f"### {e['category']}/{e['slug']}",f"**Product:** {e['product']}",f"**Blueprint:** {e.get('blueprint')} — {e.get('blueprint_name')}",f"**Provider:** {e.get('provider')} — {e.get('provider_name')}",f"**Slogan:** {e.get('slogan')}",'| File | Pixels | Position | Confirmed | Notes |','|---|---:|---|---|---|']
 for f in e['files']:
  lines.append(f"| `{e['category']}/{e['slug']}/{f['file']}` | {f['size'][0]}×{f['size'][1]} | {f['position']} | {'yes' if f['confirmed'] else 'ASSUMED'} | {f['notes']} |")
(ROOT/'MANIFEST.md').write_text('\n'.join(lines))
(ROOT/'manifest.json').write_text(json.dumps({'entries':entries,'skips':skips},indent=2))
(ROOT/'quality-check.json').write_text(json.dumps(checks,indent=2))
print('DONE',len(entries),'items',sum(len(e['files']) for e in entries),'files',len(sheets),'overviews',len(skips),'skips')
