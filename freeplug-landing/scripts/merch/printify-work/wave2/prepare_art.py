from pathlib import Path
from PIL import Image,ImageChops,ImageOps
import numpy as np,json
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work/wave2';bg=(247,243,234,255);audit=[]
def save(im,item,name,note):
 o=R/item/'printify-ready';o.mkdir(exist_ok=True);p=o/name;im.save(p,dpi=(300,300));audit.append({'item':item,'file':str(p),'size':im.size,'notes':note})
def foreground(im):
 im=im.convert('RGBA');a=np.asarray(im).copy();mask=np.max(np.abs(a[:,:,:3].astype(int)-np.array(bg[:3])),axis=2)>28;a[:,:,3]=np.where(mask,255,0);x=Image.fromarray(a);return x.crop(x.getbbox())
def fit(fg,size):return ImageOps.contain(fg,size,Image.Resampling.LANCZOS)
# Journal: isolate original front only, ivory across full back/spine, generous front margins.
im=Image.open(R/'build-journal/full-cover.png');front=foreground(im.crop((int(im.width*.55),0,im.width,im.height)));fg=fit(front,(1350,2050));out=Image.new('RGBA',im.size,bg);cx=3100;cy=1425;out.alpha_composite(fg,(cx-fg.width//2,cy-fg.height//2));save(out,'build-journal','front-only-full-cover.png','Front-only art centered at x=3100; art max1350x2050; ivory back/spine and outer bleed.')
# Pillow: identical left/front and right/back faces; generous seam clearances.
im=Image.open(R/'running-over-pillow/wrap-18x18.png');fg=fit(foreground(im.crop((0,0,2925,2925))),(1950,1950));out=Image.new('RGBA',(5850,2925),bg)
for cx in [1462,4387]:out.alpha_composite(fg,(cx-fg.width//2,1462-fg.height//2))
save(out,'running-over-pillow','identical-front-back.png','Identical upright KJV faces. At least487px quiet margin on each panel; continuous ivory across seams/bleed.')
# Keychain: 410px artwork circle inside639px area, leaving114px around top hardware and perimeter.
im=Image.open(R/'fp-keychain/circle-front.png').convert('RGBA');fg=fit(im.crop(im.getbbox()),(410,410));out=Image.new('RGBA',(639,639),(0,0,0,0));out.alpha_composite(fg,((639-fg.width)//2,(639-fg.height)//2));save(out,'fp-keychain','safe-circle-front.png','Centered410px artwork; >=114px transparent perimeter/top hardware exclusion (~0.38in at300DPI).')
# Canvas exact catalog front area; keep opaque ivory edges, documented mirrored edge treatment.
for size in ['16x20','24x36']:
 im=Image.open(R/'running-over-canvas'/f'{size}-api-area.png').convert('RGBA');save(im,'running-over-canvas',f'{size}-mirror-safe.png','Exact catalog area; existing600px/2in ivory quiet edge retained. print_on_side=mirror extends ivory onto0.75in wrap without guessing generic bleed scaling.')
# Map only to actual supported palette; alpha stays binary. No stitch file is required at draft creation.
for item in ['trucker-circle','dad-fp','low-profile-plugged','beanie-freeplug']:
 im=Image.open(R/item/'front-embroidery.png').convert('RGBA');a=np.array(im);alpha=a[:,:,3]>0
 old=a[:,:,:3].copy();red=(old[:,:,0]>old[:,:,1]*1.5)&alpha;light=(old[:,:,0]>180)&~red&alpha;dark=alpha&~red&~light
 a[red,:3]=(204,51,51);a[light,:3]=(255,255,255);a[dark,:3]=(0,0,0);a[:,:,3]=np.where(alpha,255,0)
 out=Image.fromarray(a);save(out,item,'standard-thread-front.png','Red#CC3333(1839), White#FFFFFF(1801); neutral charcoal becomes Black#000000(1800) for tonal cap.1–2 colors. Original native scale/embroidery margins retained. Printify digitizes only on first order.')
# Doormat exact provider canvas; source already has >2in content margin, transparent exterior.
im=Image.open(R/'outdoor-doormat/option-03-come-on-in.png').convert('RGBA');assert im.size==(7275,4875);save(im,'outdoor-doormat','come-on-in-provider-area.png','Exact7275x4875 area for24x16in; nominal excess is75px overall; all foreground>=650px from sides and>=826px top/bottom. Physical coir sample required.')
(W/'art-adaptations.json').write_text(json.dumps(audit,indent=2));print(json.dumps(audit,indent=2))
