#!/usr/bin/env python3
"""Contrast pass: never put dark ink on dark blanks. Local files only."""
from pathlib import Path
from PIL import Image
import numpy as np, json, shutil
Image.MAX_IMAGE_PIXELS=None

INK_DARK=np.array([23,23,23],dtype=np.uint8)
INK_LIGHT=np.array([247,243,234],dtype=np.uint8)  # ivory
RED=np.array([186,61,61],dtype=np.uint8)
RED_DARK_SAFE=np.array([186,61,61],dtype=np.uint8)
CHARCOAL=np.array([69,69,69],dtype=np.uint8)

LIGHT_BLANKS=['white','ivory','natural','cream','light ash','ash','heather','athletic heather','sand','beige','light grey','light gray','pink','baby pink','yellow','gold','orange','carolina blue','kelly','light blue']
DARK_BLANKS=['black','charcoal','navy','dark navy','dark heather','black heather','dark grey','dark gray','cranberry','maroon','forest','olive','brown','classic navy','j. navy']

created=[];fixed=[];mappings=[]

def load(p):
 im=Image.open(p).convert('RGBA');a=np.array(im);return im,a

def save(path,a,dpi=(300,300)):
 # binary alpha
 a=a.copy();a[:,:,3]=np.where(a[:,:,3]>=128,255,0).astype(np.uint8);a[a[:,:,3]==0,:3]=0
 Image.fromarray(a).save(path,dpi=dpi)

def luminance(rgb):
 rgb=rgb.astype(np.float32);return 0.2126*rgb[...,0]+0.7152*rgb[...,1]+0.0722*rgb[...,2]

def invert_for_dark_garment(a, outline_red=True):
 """Map dark ink -> ivory; keep red; optionally outline red with ivory for contrast on black."""
 out=a.copy();mask=out[:,:,3]>128
 if not mask.any():return out
 rgb=out[:,:,:3]
 lum=luminance(rgb)
 # dark pixels (text/logo black/charcoal) -> ivory
 dark=mask & (lum<90)
 out[dark,:3]=INK_LIGHT
 # mid-dark greys also -> ivory
 mid_dark=mask & (lum>=90) & (lum<140) & (np.abs(rgb[:,:,0].astype(int)-rgb[:,:,1].astype(int))<25)
 out[mid_dark,:3]=INK_LIGHT
 # red-ish keep red, add ivory outline ring for dark blanks
 redish=mask & (rgb[:,:,0].astype(int)>120) & (rgb[:,:,0].astype(int)>rgb[:,:,1].astype(int)+40) & (rgb[:,:,0].astype(int)>rgb[:,:,2].astype(int)+40)
 out[redish,:3]=RED
 if outline_red and redish.any():
  from scipy import ndimage as nd
  # dilate red mask, outline = dilated - red
  dil=nd.binary_dilation(redish,iterations=6)
  outline=dil & ~redish & (out[:,:,3]>0)
  # only paint outline where currently transparent or was background of art - expand alpha
  # Grow canvas outline onto nearby transparent pixels too
  dil2=nd.binary_dilation(redish,iterations=8)
  ring=dil2 & ~redish
  out[ring,:3]=INK_LIGHT;out[ring,3]=255
  # restore red on core
  out[redish,:3]=RED;out[redish,3]=255
 return out

def darken_for_light_garment(a):
 """Map light ink -> charcoal/black; keep red."""
 out=a.copy();mask=out[:,:,3]>128
 if not mask.any():return out
 rgb=out[:,:,:3];lum=luminance(rgb)
 light=mask & (lum>160)
 out[light,:3]=INK_DARK
 # soft light greys
 soft=mask & (lum>120) & (lum<=160) & (np.abs(rgb[:,:,0].astype(int)-rgb[:,:,1])<30)
 out[soft,:3]=INK_DARK
 redish=mask & (rgb[:,:,0].astype(int)>120) & (rgb[:,:,0].astype(int)>rgb[:,:,1].astype(int)+40) & (rgb[:,:,0].astype(int)>rgb[:,:,2].astype(int)+40)
 out[redish,:3]=RED
 return out

def ensure_pair(src_path, light_name, dark_name, current='dark_ink'):
 """current=dark_ink means src is for light garments; current=light_ink means src for dark garments."""
 src=Path(src_path);folder=src.parent
 light_p=folder/light_name;dark_p=folder/dark_name
 im,a=load(src)
 if current=='dark_ink':
  # src -> light-garment; generate dark-garment
  if not light_p.exists() or light_p.resolve()!=src.resolve():
   save(light_p,a); 
   if light_p!=src and src.name not in (light_name,dark_name):
    pass
  da=invert_for_dark_garment(a);save(dark_p,da)
  created.append(str(dark_p))
  if str(light_p)!=str(src) and not light_p.exists():
    save(light_p,a);created.append(str(light_p))
  elif light_p!=src and light_p.name!=src.name:
    if not light_p.exists():
      shutil.copy2(src,light_p);created.append(str(light_p))
 else:
  # src is light ink for dark garments
  if not dark_p.exists():
    save(dark_p,a) if dark_p!=src else None
    if dark_p!=src: shutil.copy2(src,dark_p);created.append(str(dark_p))
  la=darken_for_light_garment(a);save(light_p,la);created.append(str(light_p))
 return light_p,dark_p

# ---- T-shirts: already paired; just map ----
TSHIRT=Path('/workspace/logos/freeplug/tshirts')
for p in sorted((TSHIRT/'print').glob('*-light-garment.png')):
 dark=Path(str(p).replace('-light-garment','-dark-garment'))
 mappings.append({
  'item':'tshirts/'+p.name.replace('-light-garment.png',''),
  'files':{
   p.name:{'ink':'dark (charcoal/burgundy)','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS+['any dark/black blank']},
   dark.name:{'ink':'light (ivory)','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS+['any light/white blank']},
  }
 })

# ---- Hero crewneck: already paired ----
CREW=Path('/workspace/logos/freeplug/merch/hero-crewneck')
for side in ['front','back']:
 for size in ['S','M','L-3XL']:
  light=CREW/f'{size}-{side}-light.png'
  dark=CREW/f'{size}-{side}-dark.png'
  if light.exists() and dark.exists():
   mappings.append({
    'item':f'hero-crewneck/{size}-{side}',
    'files':{
     light.name:{'ink':'dark+red','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS},
     dark.name:{'ink':'ivory','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS},
    }
   })

# ---- Hats embroidery ----
# dad-fp: ivory only currently -> dark-garment; create light-garment black ink
# low-profile: charcoal tonal for dark only -> create light-garment black version; keep charcoal as dark-garment
# trucker/beanie: red+ivory for dark hats; create dark ink (black+red) for light hats

def hat_pair(folder, src_name, style):
 folder=Path(folder);src=folder/src_name;im,a=load(src)
 light_p=folder/'front-embroidery-light-garment.png'
 dark_p=folder/'front-embroidery-dark-garment.png'
 if style=='ivory_on_dark':
  save(dark_p,a)
  save(light_p,darken_for_light_garment(a));created.append(str(light_p));created.append(str(dark_p))
 elif style=='charcoal_tonal_dark':
  # existing charcoal for dark; for light blanks use solid black
  save(dark_p,a)
  out=a.copy();mask=out[:,:,3]>128;out[mask,:3]=INK_DARK;save(light_p,out)
  created.append(str(light_p));created.append(str(dark_p));fixed.append(f'{folder.name}: charcoal tonal kept for dark blanks; solid black version for light blanks')
 elif style=='red_ivory_dark':
  save(dark_p,a)
  # light garment: red stays, ivory -> black
  save(light_p,darken_for_light_garment(a));created.append(str(light_p));created.append(str(dark_p))
  # also add ivory outline around red on dark version for extra contrast
  da=invert_for_dark_garment(darken_for_light_garment(a))  # start from dark ink then invert... 
  # Better: outline red on existing dark version
  from scipy import ndimage as nd
  darr=a.copy();rgb=darr[:,:,:3];mask=darr[:,:,3]>128
  redish=mask & (rgb[:,:,0].astype(int)>120) & (rgb[:,:,0]>rgb[:,:,1]+40) & (rgb[:,:,0]>rgb[:,:,2]+40)
  if redish.any():
   ring=nd.binary_dilation(redish,iterations=6) & ~redish
   darr[ring,:3]=INK_LIGHT;darr[ring,3]=255
   save(dark_p,darr);fixed.append(f'{folder.name}: ivory outline added around red on dark-garment embroidery')
 mappings.append({
  'item':f'{folder.name}/embroidery',
  'files':{
   light_p.name:{'ink':'dark/black (+red if present)','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS},
   dark_p.name:{'ink':'ivory (+red if present)','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS},
  }
 })

hat_pair('/workspace/logos/freeplug/merch/dad-fp','front-embroidery.png','ivory_on_dark')
hat_pair('/workspace/logos/freeplug/merch/low-profile-plugged','front-embroidery.png','charcoal_tonal_dark')
hat_pair('/workspace/logos/freeplug/merch/trucker-circle','front-embroidery.png','red_ivory_dark')
hat_pair('/workspace/logos/freeplug/merch/beanie-freeplug','front-embroidery.png','red_ivory_dark')

# ---- Wave-3 color-variable items (apparel, kids, pets tee, apron, bags that are DTG, ugly sweater, socks, gaiter) ----
W3=Path('/workspace/logos/freeplug/merch/wave-3')
# Files that are dark-ink transparent (need dark-garment light-ink pair)
DARK_INK_ITEMS=[
 'apparel/stay-charged-pullover/front.png',
 'apparel/stay-charged-pullover/back.png',
 'apparel/good-measure-longsleeve/front.png',
 'apparel/good-measure-longsleeve/sleeve-assumed.png',
 'kids-baby/newest-onesie/front.png',
 'kids-baby/mini-plug-tee/front.png',
 'kids-baby/charging-kids-hoodie/front.png',
 'pets/human-knows-dog-tee/front.png',
 'kitchen/chef-apron/front.png',
 'bags/carry-tote/front.png',
 'bags/pocket-fanny/front.png',
 'bags/charger-backpack/front.png',
 'drinkware/recharge-pint/front.png',
 'drinkware/cool-can-cooler/front.png',
 'drinkware/unplugged-wine/front.png',
 'outdoor/offgrid-camping-mug/front.png',
]
# Light-ink embroidery already for dark blanks
LIGHT_INK_ITEMS=[
 'apparel/day-one-zip/left-chest-embroidery.png',
 'apparel/hustle-joggers/thigh-embroidery.png',
]
# Full-bleed light-bg items: need dark-blank variant with inverted field
FULL_BLEED_LIGHT=[
 'seasonal/ugly-sweater-crew/front.png',
 'accessories/charged-socks/leg-panel.png',
]

for rel in DARK_INK_ITEMS:
 src=W3/rel
 if not src.exists():continue
 stem=src.stem  # front / back / sleeve-assumed
 light_name=f'{stem}-light-garment.png'
 dark_name=f'{stem}-dark-garment.png'
 # copy/normalize light-garment from src
 im,a=load(src);save(src.parent/light_name,a)
 da=invert_for_dark_garment(a,outline_red=True);save(src.parent/dark_name,da)
 created.append(str(src.parent/light_name));created.append(str(src.parent/dark_name))
 # If red was present on dark version, note outline fix
 mappings.append({
  'item':'wave-3/'+rel.rsplit('/',1)[0],
  'files':{
   light_name:{'ink':'dark charcoal + brand red','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS+['NEVER black/dark']},
   dark_name:{'ink':'ivory + brand red with ivory outline','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS+['NEVER white/light']},
  }
 })
 fixed.append(f'{rel}: added light-garment + dark-garment pair; red outlined in ivory on dark-garment')

for rel in LIGHT_INK_ITEMS:
 src=W3/rel
 if not src.exists():continue
 stem=src.stem
 light_name=f'{stem}-light-garment.png'
 dark_name=f'{stem}-dark-garment.png'
 im,a=load(src)
 save(src.parent/dark_name,a)  # existing ivory for dark blanks
 save(src.parent/light_name,darken_for_light_garment(a))
 created.append(str(src.parent/light_name));created.append(str(src.parent/dark_name))
 mappings.append({
  'item':'wave-3/'+rel.rsplit('/',1)[0],
  'files':{
   light_name:{'ink':'black/charcoal','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS},
   dark_name:{'ink':'ivory','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS},
  }
 })
 fixed.append(f'{rel}: was ivory-only; added black light-garment version')

for rel in FULL_BLEED_LIGHT:
 src=W3/rel
 if not src.exists():continue
 stem=src.stem
 light_name=f'{stem}-light-garment.png'
 dark_name=f'{stem}-dark-garment.png'
 im,a=load(src)
 # light garment: keep ivory/light field design
 save(src.parent/light_name,a)
 # dark garment: invert field - ivory bg -> charcoal bg, dark text -> ivory, red stays with outline
 out=a.copy()
 # treat near-ivory background as background to recolor
 rgb=out[:,:,:3];lum=luminance(rgb)
 # opaque everywhere for full bleed
 ivory_bg=(lum>200)
 dark_txt=(lum<90)
 out[ivory_bg,:3]=np.array([23,23,23],dtype=np.uint8);out[ivory_bg,3]=255
 out[dark_txt,:3]=INK_LIGHT
 # red keep
 redish=(rgb[:,:,0].astype(int)>120)&(rgb[:,:,0]>rgb[:,:,1]+40)&(rgb[:,:,0]>rgb[:,:,2]+40)&(out[:,:,3]>128)
 out[redish,:3]=RED
 from scipy import ndimage as nd
 if redish.any():
  ring=nd.binary_dilation(redish,iterations=5)&~redish
  out[ring,:3]=INK_LIGHT;out[ring,3]=255;out[redish,:3]=RED
 save(src.parent/dark_name,out)
 created.append(str(src.parent/light_name));created.append(str(src.parent/dark_name))
 mappings.append({
  'item':'wave-3/'+rel.rsplit('/',1)[0],
  'files':{
   light_name:{'ink':'ivory field + dark/red art','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS},
   dark_name:{'ink':'charcoal field + ivory/red art','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS},
  }
 })
 fixed.append(f'{rel}: full-bleed inverted dark-garment version created')

# Gym drawstring / gaiter already dark bg full bleed - OK for any but primarily dark aesthetic
for rel,note in [
 ('bags/gym-drawstring/front.png','full-bleed charcoal+red; use on any blank color (print covers surface); prefer black/charcoal blanks'),
 ('accessories/fp-gaiter/front.png','full-bleed black+red circles; prefer dark blanks; OK on light as printed field covers'),
]:
 src=W3/rel
 if src.exists():
  mappings.append({'item':'wave-3/'+rel.rsplit('/',1)[0],'files':{src.name:{'ink':'full-bleed dark field','allowed_blank_colors':DARK_BLANKS+LIGHT_BLANKS,'never':[],'notes':note}}})

# Journal: full wrap with red/ivory - fixed product colors not garment - note
for p in [Path('/workspace/logos/freeplug/merch/build-journal/full-cover.png')]:
 if p.exists():
  mappings.append({'item':'build-journal','files':{p.name:{'ink':'red+ivory full wrap','allowed_blank_colors':['product is printed wrap; blank color N/A'],'never':['do not treat as DTG garment ink']}}})

# Write contrast mapping docs
contrast={
 'rule':'Dark or black text/art must NEVER be placed on black or dark blanks. Light ink for dark blanks; dark ink for light blanks.',
 'light_blanks':LIGHT_BLANKS,
 'dark_blanks':DARK_BLANKS,
 'created_files':created,
 'fixes':fixed,
 'mappings':mappings,
}
Path('/workspace/logos/freeplug/merch/CONTRAST_MAP.json').write_text(json.dumps(contrast,indent=2))

# Update wave-3 MANIFEST
w3m=Path('/workspace/logos/freeplug/merch/wave-3/MANIFEST.md')
section='\n\n## Contrast / blank-color rule (Cheke Nov 8, 2026)\n\n**Dark or black text/art must never go on a black or dark blank.**\n\n- `*-light-garment.png` = dark ink (charcoal/black + red). **Allowed blanks:** white, ivory, natural, cream, light ash, heather, sand, and other light colors. **NEVER** black, charcoal, navy, dark heather, or other dark blanks.\n- `*-dark-garment.png` = light ink (ivory + red, red often ivory-outlined). **Allowed blanks:** black, charcoal, navy, dark heather, and other dark colors. **NEVER** white/light blanks.\n- Embroidery pairs follow the same rule (ivory thread on dark blanks; black thread on light blanks).\n- Brand red on dark blanks gets an ivory outline where needed for contrast.\n- Original unscoped `front.png` / `back.png` files remain as source references; **use the `-light-garment` / `-dark-garment` files for production.**\n\nSee `/workspace/logos/freeplug/merch/CONTRAST_MAP.json` for the machine-readable map.\n'
if w3m.exists():
 t=w3m.read_text()
 if 'Contrast / blank-color rule' not in t:w3m.write_text(t+section)
else:w3m.write_text('# Wave-3'+section)

# Update root merch MANIFEST
mm=Path('/workspace/logos/freeplug/merch/MANIFEST.md')
sec2='\n\n## Contrast / blank-color rule (Cheke Nov 8, 2026)\n\n**Dark or black text/art must never go on a black or dark blank.**\n\n### Already paired\n- `tshirts/print/*-light-garment.png` → light blanks only; `*-dark-garment.png` → dark blanks only.\n- `hero-crewneck/*-light.png` → light blanks; `*-dark.png` → dark blanks.\n\n### Hats (updated this pass)\n- `*-embroidery-light-garment.png` → light hat colors only (dark/black thread).\n- `*-embroidery-dark-garment.png` → dark hat colors only (ivory/red thread).\n- Low-profile tonal charcoal remains dark-blank only; solid black light-garment version added.\n- Trucker/beanie dark versions: ivory outline around red for contrast on black.\n\n### Wave-3\nColor-variable apparel/bags/drinkware/kids/pets/apron/seasonal now have `-light-garment` and `-dark-garment` pairs. See `wave-3/MANIFEST.md` and `CONTRAST_MAP.json`.\n\n**NEVER** assign a dark-ink / light-garment file to black, charcoal, navy, or dark heather.\n'
if mm.exists():
 t=mm.read_text()
 if 'Contrast / blank-color rule' not in t:mm.write_text(t+sec2)
else:mm.write_text('# Merch'+sec2)

# Update tshirts README
tr=Path('/workspace/logos/freeplug/tshirts/README.md')
if tr.exists():
 t=tr.read_text()
 note='\n\n## Contrast rule (Cheke Nov 8, 2026)\n`*-light-garment.png` = dark ink → **light blanks only** (white/ivory/natural/ash). **NEVER black or dark.**\n`*-dark-garment.png` = light ink → **dark blanks only** (black/charcoal/navy). **NEVER white or light.**\n'
 if 'Contrast rule' not in t:tr.write_text(t+note)

# Update wave-3 manifest.json entries with contrast fields
mj=Path('/workspace/logos/freeplug/merch/wave-3/manifest.json')
if mj.exists():
 data=json.loads(mj.read_text())
 data['contrast_rule']='Dark ink never on dark blanks; use *-light-garment for light blanks and *-dark-garment for dark blanks.'
 data['light_blanks']=LIGHT_BLANKS;data['dark_blanks']=DARK_BLANKS
 data['contrast_map_path']='/workspace/logos/freeplug/merch/CONTRAST_MAP.json'
 # annotate entries
 for e in data.get('entries',[]):
  slug=e.get('slug','');cat=e.get('category','')
  folder=W3/cat/slug
  extra=[]
  for p in sorted(folder.glob('*-light-garment.png')):
   extra.append({'file':p.name,'ink':'dark','allowed_blank_colors':LIGHT_BLANKS,'never':DARK_BLANKS})
  for p in sorted(folder.glob('*-dark-garment.png')):
   extra.append({'file':p.name,'ink':'light','allowed_blank_colors':DARK_BLANKS,'never':LIGHT_BLANKS})
  if extra:e['contrast_files']=extra
 mj.write_text(json.dumps(data,indent=2))

# Update root merch manifest.json if present
rmj=Path('/workspace/logos/freeplug/merch/manifest.json')
if rmj.exists():
 data=json.loads(rmj.read_text())
 if isinstance(data,list):
  data={'entries':data}
 data['contrast_rule']='Dark ink never on dark blanks.'
 data['contrast_map_path']=str(Path('/workspace/logos/freeplug/merch/CONTRAST_MAP.json'))
 rmj.write_text(json.dumps(data,indent=2))

print('CREATED',len(created))
print('FIXES',len(fixed))
for x in fixed[:30]:print(' -',x)
print('MAPPINGS',len(mappings))
