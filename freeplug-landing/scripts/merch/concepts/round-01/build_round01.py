#!/usr/bin/env python3
"""Freeplug concept round-01: 18 designs, 3 groups x 6, Pillow text + Krea art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter, ImageChops
import numpy as np, json, math, io, re, cairosvg

ROOT=Path('/workspace/logos/freeplug/merch/concepts/round-01')
PRINT=ROOT/'prints';MOCK=ROOT/'mockups';RAW=ROOT/'krea-raw';CONTACT=ROOT/'contact'
for d in (PRINT,MOCK,CONTACT): d.mkdir(parents=True,exist_ok=True)
Image.MAX_IMAGE_PIXELS=None

RED=(186,61,61,255); INK=(17,17,17,255); IVORY=(247,243,234,255); WHITE=(255,255,255,255)
W,H=4500,5400
FDIR=Path('/workspace/logos/FP/fonts/ttf'); CDIR=Path('/workspace/logos/freeplug/cursive/ttf')
fonts={
 'eb':ImageFont.truetype(str(FDIR/'FPExtended-Black.ttf'),1),
 'e':ImageFont.truetype(str(FDIR/'FPExtended-Bold.ttf'),1),
 'd':ImageFont.truetype(str(FDIR/'FreeplugDispatch-Bold.ttf'),1),
 'dc':ImageFont.truetype(str(FDIR/'FreeplugDispatch-CondensedHeadline.ttf'),1),
 'c':ImageFont.truetype(str(CDIR/'FPCursive-Bold.ttf'),1),
}
# monogram path
MONO=re.search(r'<path d="([^"]+)"',Path('/workspace/logos/FP/svg/fp-monogram-black.svg').read_text()).group(1)

def font(kind,size):
 p={'eb':FDIR/'FPExtended-Black.ttf','e':FDIR/'FPExtended-Bold.ttf','d':FDIR/'FreeplugDispatch-Bold.ttf','dc':FDIR/'FreeplugDispatch-CondensedHeadline.ttf','c':CDIR/'FPCursive-Bold.ttf'}[kind]
 return ImageFont.truetype(str(p),size)

def fit_text(draw,text,kind,max_w,max_h,cap=900):
 size=cap
 while size>20:
  f=font(kind,size);b=draw.textbbox((0,0),text,font=f)
  if b[2]-b[0]<=max_w and b[3]-b[1]<=max_h:return f,b
  size-=4
 return font(kind,20),draw.textbbox((0,0),text,font=font(kind,20))

def center_text(im,text,y,kind,color,max_w=3800,max_h=700,cap=900,stroke=0,stroke_fill=None):
 d=ImageDraw.Draw(im);f,b=fit_text(d,text,kind,max_w,max_h,cap)
 x=(W-(b[2]-b[0]))//2-b[0]
 kw={}
 if stroke:kw.update(stroke_width=stroke,stroke_fill=stroke_fill or color)
 d.text((x,y-b[1]),text,font=f,fill=color,**kw)
 return b[3]-b[1]

def paste_art(im,path,box,knock_cream=True):
 art=Image.open(path).convert('RGBA')
 if knock_cream:
  a=np.array(art)
  # knock near-cream/white background to transparent for print overlay
  rgb=a[:,:,:3].astype(int);lum=0.2126*rgb[:,:,0]+0.7152*rgb[:,:,1]+0.0722*rgb[:,:,2]
  pale=(lum>210)&(np.abs(rgb[:,:,0]-rgb[:,:,1])<25)&(np.abs(rgb[:,:,1]-rgb[:,:,2])<25)
  a[pale,3]=0;art=Image.fromarray(a)
 art=art.crop(art.getbbox() or (0,0,art.width,art.height))
 art.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
 x=box[0]+(box[2]-box[0]-art.width)//2;y=box[1]+(box[3]-box[1]-art.height)//2
 im.alpha_composite(art,(x,y));return art.size

def mark(im,xy,size,color):
 # render mono via cairo
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024"><path d="{MONO}" fill="rgb({color[0]},{color[1]},{color[2]})"/></svg>'
 a=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA')
 a=a.crop(a.getbbox());a.thumbnail((size,size),Image.Resampling.LANCZOS)
 im.alpha_composite(a,(xy[0]+(size-a.width)//2,xy[1]+(size-a.height)//2))

def circle_mark(im,xy,diam,ring=RED,fill_mark=IVORY):
 d=ImageDraw.Draw(im)
 d.ellipse([xy[0],xy[1],xy[0]+diam,xy[1]+diam],fill=ring)
 mark(im,(xy[0]+int(diam*.18),xy[1]+int(diam*.2)),int(diam*.64),fill_mark[:3]+(255,))

def binary(im):
 a=np.array(im);a[:,:,3]=np.where(a[:,:,3]>=128,255,0).astype(np.uint8);a[a[:,:,3]==0,:3]=0
 return Image.fromarray(a)

def invert_dark_garment(im):
 """Dark ink -> ivory; keep red; outline red with ivory."""
 from scipy import ndimage as nd
 a=np.array(im.convert('RGBA'));mask=a[:,:,3]>128
 if not mask.any():return im
 rgb=a[:,:,:3].astype(int)
 lum=0.2126*rgb[:,:,0]+0.7152*rgb[:,:,1]+0.0722*rgb[:,:,2]
 redish=mask&(rgb[:,:,0]>130)&(rgb[:,:,0]>rgb[:,:,1]+35)&(rgb[:,:,0]>rgb[:,:,2]+35)
 other=mask&~redish
 a[other,:3]=np.array(IVORY[:3],dtype=np.uint8)
 a[redish,:3]=np.array(RED[:3],dtype=np.uint8)
 if redish.any():
  ring=nd.binary_dilation(redish,iterations=6)&~redish
  a[ring,:3]=np.array(IVORY[:3],dtype=np.uint8);a[ring,3]=255
  a[redish,:3]=np.array(RED[:3],dtype=np.uint8);a[redish,3]=255
 return binary(Image.fromarray(a))

def mockup(art,title,group,on_dark=False):
 out=Image.new('RGB',(1100,900),'#e7e3dc');d=ImageDraw.Draw(out)
 d.text((40,24),title[:52].upper(),font=font('d',26),fill=INK[:3])
 d.text((40,58),group.upper(),font=font('dc',18),fill=RED[:3])
 fill='#1a1a1a' if on_dark else '#f3efe8'
 pts=[(320,140),(250,180),(190,310),(270,350),(300,290),(295,720),(620,720),(615,290),(645,350),(725,310),(665,180),(595,140)]
 d.polygon(pts,fill=fill);d.arc((405,118,520,188),0,180,fill='#777',width=3)
 a=art.copy();a.thumbnail((280,340),Image.Resampling.LANCZOS)
 out.paste(a,(325,270),a)
 d.text((40,850),'ORIGINAL FLAT PREVIEW / NOT A COLOR OR SCALE PROOF',font=font('d',16),fill=(80,80,80))
 return out

def save_concept(num,slug,group,theme,name,slogan,tool,im_light,need_dark=True,notes=''):
 base=f'{num:02d}-{slug}'
 light=binary(im_light)
 light_path=PRINT/f'{base}-light-garment.png';light.save(light_path,dpi=(300,300))
 paths={'light':str(light_path)}
 mock_art=light; on_dark=False
 if need_dark:
  dark=invert_dark_garment(light)
  dark_path=PRINT/f'{base}-dark-garment.png';dark.save(dark_path,dpi=(300,300))
  paths['dark']=str(dark_path);mock_art=dark;on_dark=True
 mp=MOCK/f'{base}-mockup.png';mockup(mock_art,f'{num:02d} {name}',group,on_dark).save(mp)
 return {
  'number':num,'slug':slug,'name':name,'group':group,'theme':theme,'slogan':slogan,'tool':tool,
  'files':paths,'mockup':str(mp),
  'allowed_light_garment':['white','ivory','natural','cream','light ash','heather','sand'],
  'allowed_dark_garment':['black','charcoal','navy','dark heather'] if need_dark else [],
  'never_light_on':['black','charcoal','navy','dark heather'] if True else [],
  'notes':notes,
 }

entries=[];credits_before=5081.482222222222

# ---------- helpers to build canvases ----------
def canvas(): return Image.new('RGBA',(W,H),(0,0,0,0))

# ===== BUSINESS CLIENT SAMPLES (6) =====
# C01 Rio Rosa Taqueria
im=canvas();paste_art(im,RAW/'battery.png',(1200,700,3300,2200));center_text(im,'TACOS',2350,'eb',RED,cap=700);center_text(im,'FULLY CHARGED',3100,'e',INK,cap=420);center_text(im,'RIO ROSA TAQUERIA',4000,'d',INK,max_h=200,cap=180);center_text(im,'sample · Freeplug',4600,'d',(120,120,120,255),max_h=120,cap=100)
entries.append(save_concept(1,'rio-rosa-taqueria','business-client-sample','plug-pun','Rio Rosa Taqueria — Tacos Fully Charged','Tacos Fully Charged','Krea battery + Pillow fonts',im,notes='Placeholder business. Tiny Freeplug credit only.'))

# C02 River Bend Barbers
im=canvas();circle_mark(im,(1550,900),1400,RED,IVORY);center_text(im,'FRESH FADE.',2600,'eb',INK,cap=480);center_text(im,'FULLY PLUGGED.',3200,'e',RED,cap=420);center_text(im,'RIVER BEND BARBERS',4000,'d',INK,cap=160);center_text(im,'sample · Freeplug',4550,'d',(120,120,120,255),cap=100)
entries.append(save_concept(2,'river-bend-barbers','business-client-sample','minimal','River Bend Barbers — Fresh Fade','Fresh Fade. Fully Plugged.','Pillow + FP circle mark',im))

# C03 Hill Country Lawns
im=canvas();paste_art(im,RAW/'hills.png',(400,900,4100,2800));center_text(im,'GROWN LOCAL.',3000,'eb',INK,cap=420);center_text(im,'PLUGGED LOCAL.',3550,'e',RED,cap=380);center_text(im,'HILL COUNTRY LAWNS',4200,'d',INK,cap=160);center_text(im,'San Marcos · sample · Freeplug',4700,'d',(120,120,120,255),cap=110)
entries.append(save_concept(3,'hill-country-lawns','business-client-sample','san-marcos','Hill Country Lawns — Grown Local','Grown Local. Plugged Local.','Krea hills + Pillow',im))

# C04 Iron Bridge Gym
im=canvas();paste_art(im,RAW/'bolts.png',(1200,600,3300,2400));center_text(im,'LOW BATTERY',2700,'eb',INK,cap=480);center_text(im,'HIGH HUSTLE',3400,'e',RED,cap=480);center_text(im,'IRON BRIDGE GYM',4200,'d',INK,cap=160);center_text(im,'sample · Freeplug',4700,'d',(120,120,120,255),cap=100)
entries.append(save_concept(4,'iron-bridge-gym','business-client-sample','street-art','Iron Bridge Gym — High Hustle','Low Battery, High Hustle','Krea bolts + Pillow',im))

# C05 Lampstand Coffee — KJV
im=canvas();paste_art(im,RAW/'cup.png',(1100,500,3400,2600))
center_text(im,'Give, and it shall',2800,'c',INK,cap=380,max_h=350)
center_text(im,'be given unto you',3250,'c',INK,cap=380,max_h=350)
center_text(im,'LUKE 6:38  ·  KJV',3900,'d',RED,cap=160)
center_text(im,'LAMPSTAND COFFEE',4400,'d',INK,cap=150)
center_text(im,'sample · Freeplug',4800,'d',(120,120,120,255),cap=100)
entries.append(save_concept(5,'lampstand-coffee-luke','business-client-sample','faith-kjv','Lampstand Coffee — Luke 6:38','Give, and it shall be given unto you (KJV)','Krea cup + Pillow KJV',im,notes='Exact KJV first clause only.'))

# C06 Neon Alley Arcade — retro
im=canvas();paste_art(im,RAW/'badge.png',(900,500,3600,3200));center_text(im,'INSERT COIN',2100,'eb',IVORY,cap=360,stroke=8,stroke_fill=INK);center_text(im,'STAY CHARGED',2700,'e',RED,cap=340,stroke=6,stroke_fill=INK);center_text(im,'NEON ALLEY ARCADE',4000,'d',INK,cap=160);center_text(im,'sample · Freeplug',4550,'d',(120,120,120,255),cap=100)
entries.append(save_concept(6,'neon-alley-arcade','business-client-sample','retro','Neon Alley Arcade — Insert Coin','Insert Coin / Stay Charged','Krea badge + Pillow',im))

# ===== FREEPLUG BRAND MERCH (6) =====
# B07 I Know a Plug
im=canvas();center_text(im,'I Know',900,'c',INK,cap=700);center_text(im,'a Plug',1800,'eb',RED,cap=850);mark(im,(1600,3000),1300,INK[:3]+(255,));center_text(im,'FREEPLUG',4600,'e',INK,cap=220)
entries.append(save_concept(7,'know-a-plug','freeplug-brand-merch','plug-pun','Freeplug — I Know a Plug','I Know a Plug','Pillow + FP mark',im))

# B08 so cheap
im=canvas();center_text(im,"It's so cheap",1100,'d',INK,cap=420);center_text(im,"it's free",1900,'c',RED,cap=750);mark(im,(1750,3100),1000,INK[:3]+(255,));center_text(im,'FREEPLUG',4600,'e',INK,cap=220)
entries.append(save_concept(8,'so-cheap-its-free','freeplug-brand-merch','plug-pun',"Freeplug — It's so cheap it's free","It's so cheap it's free",'Pillow + FP mark',im))

# B09 Stay Charged
im=canvas();paste_art(im,RAW/'battery.png',(900,700,3600,2600));center_text(im,'STAY CHARGED',3000,'eb',INK,cap=520);center_text(im,'FULL POWER',3700,'d',RED,cap=280);center_text(im,'FREEPLUG',4500,'e',INK,cap=200)
entries.append(save_concept(9,'stay-charged','freeplug-brand-merch','plug-pun','Freeplug — Stay Charged','Stay Charged / Full Power','Krea battery + Pillow',im))

# B10 Luke Give brand
im=canvas();paste_art(im,RAW/'cup.png',(1100,500,3400,2500));center_text(im,'Give, and it shall',2750,'c',INK,cap=400);center_text(im,'be given unto you',3250,'c',INK,cap=400);center_text(im,'LUKE 6:38  ·  KJV',3950,'d',RED,cap=170);center_text(im,'FREEPLUG',4600,'e',INK,cap=200)
entries.append(save_concept(10,'running-over-give','freeplug-brand-merch','faith-kjv','Freeplug — Give (Luke 6:38)','Give, and it shall be given unto you','Krea cup + Pillow KJV',im,notes='Exact KJV first clause.'))

# B11 San Marcos Plug
im=canvas();paste_art(im,RAW/'hills.png',(350,800,4150,2700));center_text(im,'SAN MARCOS',2900,'eb',INK,cap=480);center_text(im,'PLUG',3500,'c',RED,cap=700);circle_mark(im,(1850,4200),800);center_text(im,'FREEPLUG',5200,'e',INK,cap=1)  # may clip - adjust
# fix bottom - canvas is 5400 so circle at 4200 ok; skip FREEPLUG text if overlap
im2=canvas();paste_art(im2,RAW/'hills.png',(350,700,4150,2500));center_text(im2,'SAN MARCOS',2700,'eb',INK,cap=500);center_text(im2,'PLUG',3350,'c',RED,cap=720);circle_mark(im2,(1750,4000),900)
entries.append(save_concept(11,'san-marcos-plug','freeplug-brand-merch','san-marcos','Freeplug — San Marcos Plug','San Marcos Plug','Krea hills + Pillow + circle',im2))

# B12 Minimal FP circle
im=canvas();circle_mark(im,(750,1100),3000);center_text(im,'FREEPLUG',4500,'e',INK,cap=280)
entries.append(save_concept(12,'fp-circle-minimal','freeplug-brand-merch','minimal','Freeplug — Circle Mark','FREEPLUG','Pillow FP circle',im))

# ===== FREEPLUG CREW (6) =====
# T13 TEAM PLUG stencil
im=canvas();paste_art(im,RAW/'graffiti.png',(400,400,4100,2800),knock_cream=True);center_text(im,'TEAM',3000,'eb',INK,cap=700);center_text(im,'PLUG',3800,'eb',RED,cap=700);center_text(im,'FREEPLUG CREW',4700,'d',INK,cap=180)
entries.append(save_concept(13,'team-plug-stencil','freeplug-crew','street-art','Crew — TEAM PLUG','TEAM PLUG','Krea graffiti + Pillow',im))

# T14 CREW On Call
im=canvas();center_text(im,'CREW',900,'eb',RED,cap=900);center_text(im,'ON CALL.',2200,'e',INK,cap=520);center_text(im,'PLUGGED IN.',2950,'e',INK,cap=520);mark(im,(1700,3800),1100,INK[:3]+(255,));center_text(im,'FREEPLUG',5000,'e',INK,cap=1)
im=canvas();center_text(im,'CREW',800,'eb',RED,cap=900);center_text(im,'ON CALL.',2000,'e',INK,cap=520);center_text(im,'PLUGGED IN.',2750,'e',INK,cap=520);mark(im,(1650,3600),1200,INK[:3]+(255,))
entries.append(save_concept(14,'crew-on-call','freeplug-crew','minimal','Crew — On Call','CREW / On Call. Plugged In.','Pillow + FP mark',im))

# T15 Built by Freeplug
im=canvas();paste_art(im,RAW/'plug.png',(1200,600,3300,2400));center_text(im,'BUILT BY',2700,'d',INK,cap=360);center_text(im,'FREEPLUG',3300,'eb',RED,cap=520);center_text(im,'CREW',4100,'e',INK,cap=360)
entries.append(save_concept(15,'built-by-freeplug','freeplug-crew','plug-pun','Crew — Built by Freeplug','Built by Freeplug','Krea plug + Pillow',im))

# T16 Running Over crew
im=canvas();paste_art(im,RAW/'cup.png',(1100,450,3400,2400));center_text(im,'RUNNING OVER',2650,'eb',RED,cap=400);center_text(im,'Give, and it shall',3250,'c',INK,cap=320);center_text(im,'be given unto you',3650,'c',INK,cap=320);center_text(im,'LUKE 6:38 KJV  ·  CREW',4300,'d',INK,cap=150)
entries.append(save_concept(16,'crew-running-over','freeplug-crew','faith-kjv','Crew — Running Over','Running Over / Luke 6:38 KJV','Krea cup + Pillow KJV',im,notes='Exact KJV clause.'))

# T17 From San Marcos crew
im=canvas();paste_art(im,RAW/'hills.png',(400,700,4100,2500));center_text(im,'FROM',2700,'d',INK,cap=300);center_text(im,'SAN MARCOS',3100,'eb',RED,cap=420);center_text(im,'FREEPLUG CREW',4000,'e',INK,cap=260)
entries.append(save_concept(17,'crew-from-san-marcos','freeplug-crew','san-marcos','Crew — From San Marcos','From San Marcos / Freeplug Crew','Krea hills + Pillow',im))

# T18 Retro Fully Charged Crew
im=canvas();paste_art(im,RAW/'sleepy.png',(1100,500,3400,2600));center_text(im,'FULLY CHARGED',2900,'eb',INK,cap=400);center_text(im,'CREW',3550,'c',RED,cap=600);center_text(im,'FREEPLUG',4400,'e',INK,cap=220)
entries.append(save_concept(18,'crew-fully-charged','freeplug-crew','retro','Crew — Fully Charged','Fully Charged Crew','Krea sleepy battery + Pillow',im))

# Contact sheets by group
groups=[
 ('business-client-sample','BUSINESS CLIENT SAMPLES'),
 ('freeplug-brand-merch','FREEPLUG BRAND MERCH'),
 ('freeplug-crew','FREEPLUG CREW'),
]
sheets=[]
for gi,(gkey,glabel) in enumerate(groups,1):
 items=[e for e in entries if e['group']==gkey]
 rows=2;cols=3
 sheet=Image.new('RGB',(1800,80+rows*520),'#e7e3dc');d=ImageDraw.Draw(sheet)
 d.text((30,22),f'FREEPLUG CONCEPTS ROUND-01 / {glabel}',font=font('d',28),fill=INK[:3])
 for i,e in enumerate(items):
  m=Image.open(e['mockup']);m.thumbnail((560,480),Image.Resampling.LANCZOS)
  x=(i%cols)*600;y=70+(i//cols)*520;sheet.paste(m,(x+20,y))
  d.text((x+30,y+470),f"{e['number']:02d} · {e['theme']}",font=font('dc',16),fill=RED[:3])
 path=CONTACT/f'contact-sheet-{gi}-{gkey}.png';sheet.save(path);sheets.append(str(path))
# master contact of all 18
rows=6;cols=3
master=Image.new('RGB',(1800,80+rows*310),'#e7e3dc');d=ImageDraw.Draw(master)
d.text((30,20),'FREEPLUG CONCEPTS ROUND-01 / ALL 18',font=font('d',28),fill=INK[:3])
for i,e in enumerate(entries):
 m=Image.open(e['mockup']);m.thumbnail((560,280),Image.Resampling.LANCZOS)
 x=(i%cols)*600;y=70+(i//cols)*310;master.paste(m,(x+20,y))
 d.text((x+30,y+275),f"{e['number']:02d} {e['group'][:12]} · {e['theme']}",font=font('dc',14),fill=INK[:3])
master_path=CONTACT/'contact-sheet.png';master.save(master_path);sheets.insert(0,str(master_path))
# also copy as overview
master.save(ROOT/'contact-sheet.png')

# Manifest
lines=['# Freeplug Concepts — Round 01','',
'Cheke OK: "go aheading" (t122u), Nov 9, 2026 ~10:11 AM CT. Local files only. No Printify / site.',
'',
'## Groups (3 × 6 = 18)',
'1. **business-client-sample** — made-up local businesses for sample shirt pitches. No real names/marks. Optional tiny Freeplug credit only.',
'2. **freeplug-brand-merch** — Freeplug public merch for customers.',
'3. **freeplug-crew** — shirts for the Freeplug team (CREW / TEAM PLUG).',
'',
'## Themes covered','plug-pun, faith-kjv (exact KJV wording), san-marcos, street-art, retro, minimal — spread across groups.',
'',
'## Contrast','`-light-garment.png` = dark ink → light blanks only. `-dark-garment.png` = ivory/light ink → dark blanks only. See `/workspace/logos/freeplug/merch/CONTRAST_MAP.json`.',
'',
'## Krea','Illustration assets generated with `krea/krea-2/medium-turbo` (~2 CU each). Exact wording composited in Pillow with FP Extended, Freeplug Dispatch, FP Cursive. Credits checked via get_balance before start.',
'','## Inventory','']
for e in entries:
 lines += [f"### {e['number']:02d} — {e['name']}",
 f"- **Group:** `{e['group']}`",
 f"- **Theme:** {e['theme']}",
 f"- **Slogan / text:** {e['slogan']}",
 f"- **Tool:** {e['tool']}",
 f"- **Light garment file:** `{Path(e['files']['light']).name}` → {', '.join(e['allowed_light_garment'])}",
 ]
 if 'dark' in e['files']:
  lines.append(f"- **Dark garment file:** `{Path(e['files']['dark']).name}` → {', '.join(e['allowed_dark_garment'])}")
 lines += [f"- **Mockup:** `{Path(e['mockup']).name}`", f"- **Notes:** {e['notes'] or '—'}", '']
lines += ['## Contact sheets']+[f'- `{p}`' for p in sheets]
(ROOT/'MANIFEST.md').write_text('\n'.join(lines))
(ROOT/'manifest.json').write_text(json.dumps({'credits_before':credits_before,'entries':entries,'sheets':sheets},indent=2))
print('DONE',len(entries),'concepts')
from collections import Counter
print('groups',Counter(e['group'] for e in entries))
print('themes',Counter(e['theme'] for e in entries))
