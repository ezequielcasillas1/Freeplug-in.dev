from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import json,math,io,re,cairosvg,numpy as np
ROOT=Path('/workspace/logos/freeplug/merch');CAT=ROOT/'catalog'
RED='#ba3d3d';IVORY='#f7f3ea';INK='#171717';GRAY='#454545'
FONTDIR=Path('/workspace/logos/FP/fonts/ttf');CUR=Path('/workspace/logos/freeplug/cursive/ttf')
FONTS={'c':TTFont(CUR/'FPCursive-Bold.ttf'),'e':TTFont(FONTDIR/'FPExtended-Black.ttf'),'d':TTFont(FONTDIR/'FreeplugDispatch-Bold.ttf')}
MASTER=Path('/workspace/logos/FP/svg/fp-monogram-black.svg').read_text();MONO=re.search(r'<path d="([^"]+)"',MASTER).group(1)
blueprints={x['id']:x['title'] for x in json.loads((CAT/'blueprints.json').read_text())}
entries=[];checks=[]
Image.MAX_IMAGE_PIXELS=120000000

def variants(b,p):return json.loads((CAT/f'{b}-{p}-variants.json').read_text())['variants']
def variant(b,p,vid=None,match=None):
 vs=variants(b,p)
 return next(x for x in vs if (x['id']==vid if vid else (match in x['title'] if match else True)))
def area(v,pos=None):return next(x for x in v['placeholders'] if not pos or x['position']==pos)
def text_path(s,k):
 f=FONTS[k];gs=f.getGlyphSet();cm=f.getBestCmap();parts=[];xx=0;bounds=[]
 for c in s:
  g=cm.get(ord(c))
  if g is None:raise ValueError('Missing glyph '+c)
  pen=SVGPathPen(gs);gs[g].draw(pen)
  bp=BoundsPen(gs);gs[g].draw(bp)
  if bp.bounds:
   x0,y0,x1,y1=bp.bounds;bounds.append((xx+x0,y0,xx+x1,y1))
  parts.append(f'<path transform="translate({xx},0)" d="{pen.getCommands()}"/>');xx+=f['hmtx'][g][0]
 if not bounds:return '',(0,0,1,1)
 return ''.join(parts),(min(x[0] for x in bounds),min(x[1] for x in bounds),max(x[2] for x in bounds),max(x[3] for x in bounds))
class Doc:
 def __init__(self,w,h,bg=None):
  self.w=w;self.h=h;self.parts=[];self.bg=bg
  if bg:self.rect(0,0,w,h,bg)
 def raw(self,s):self.parts.append(s)
 def rect(self,x,y,w,h,c,r=0,stroke=None,sw=1):self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>')
 def line(self,x1,y1,x2,y2,c=RED,sw=8):self.raw(f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round"/>')
 def text(self,s,x,y,w,h,k='d',c=INK,emb=False):
  paths,b=text_path(s,k);bw=b[2]-b[0];bh=b[3]-b[1];sc=min(w/bw,h/bh)
  tx=x+(w-bw*sc)/2-b[0]*sc;ty=y+(h-bh*sc)/2+b[3]*sc
  # Expand embroidery outline to ensure 1.5 mm minimum working stroke at native 300dpi.
  thick=18/sc if emb else 0
  self.raw(f'<g fill="{c}" stroke="{c}" stroke-width="{thick}" stroke-linejoin="round" paint-order="stroke" transform="translate({tx},{ty}) scale({sc},-{sc})">{paths}</g>')
 def mark(self,x,y,w,h,c=RED):
  # Original FP path, visible bounds approximated from source. No retracing.
  sc=min(w/706,h/577);tx=x+(w-706*sc)/2-154*sc;ty=y+(h-577*sc)/2-225*sc
  self.raw(f'<path d="{MONO}" transform="translate({tx},{ty}) scale({sc})" fill="{c}"/>')
 def circle(self,x,y,diam,c=RED):
  self.raw(f'<circle cx="{x+diam/2}" cy="{y+diam/2}" r="{diam/2}" fill="{c}"/>');self.mark(x+diam*.15,y+diam*.18,diam*.7,diam*.66,IVORY)
 def heart(self,x,y,s,c=RED):
  self.raw(f'<path d="M{x+s/2} {y+s} C{x+s*.3} {y+s*.8} {x} {y+s*.55} {x} {y+s*.27} C{x} {y-s*.02} {x+s*.35} {y-s*.1} {x+s/2} {y+s*.18} C{x+s*.66} {y-s*.1} {x+s} {y-s*.02} {x+s} {y+s*.27} C{x+s} {y+s*.55} {x+s*.7} {y+s*.8} {x+s/2} {y+s}Z" fill="{c}"/>')
 def cup(self,x,y,w,h):
  sw=w*.022
  self.raw(f'<path d="M{x+w*.08} {y+h*.2} L{x+w*.2} {y+h*.29} L{x+w*.25} {y+h*.86} Q{x+w*.48} {y+h*.98} {x+w*.72} {y+h*.86} L{x+w*.76} {y+h*.23} Q{x+w*.89} {y+h*.12} {x+w*.96} {y+h*.32} Q{x+w*1.02} {y+h*.58} {x+w*.75} {y+h*.64} M{x+w*.08} {y+h*.2} Q{x+w*.42} {y+h*.06} {x+w*.76} {y+h*.23}" fill="none" stroke="{INK}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>')
  for i in range(4):self.line(x+w*.29,y+h*(.4+i*.11),x+w*(.43 if i%2 else .5),y+h*(.4+i*.11),INK,sw*.75)
  for a,b,s in [(.22,.00,.12),(.46,-.12,.14),(.63,-.04,.11),(.1,.35,.09),(.79,.74,.10),(.86,.91,.08)]:self.heart(x+w*a,y+h*b,w*s)
 def tag(self,x,y,w,h,price=True):
  self.raw(f'<path d="M{x+w*.16} {y} L{x+w*.97} {y+h*.035} L{x+w} {y+h*.94} L{x+w*.15} {y+h} L{x} {y+h*.5}Z" fill="{IVORY}" stroke="{RED}" stroke-width="{w*.018}" stroke-linejoin="round"/>')
  self.raw(f'<circle cx="{x+w*.12}" cy="{y+h*.5}" r="{w*.023}" fill="{RED}"/>')
  self.raw(f'<path d="M{x+w*.12} {y+h*.5} Q{x-w*.15} {y-h*.3} {x-w*.04} {y-h*.22}" fill="none" stroke="{RED}" stroke-width="{w*.012}" stroke-linecap="round"/>')
  if price:self.text('$0.00',x+w*.23,y+h*.22,w*.67,h*.58,'c',RED)
 def svg(self):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'+''.join(self.parts)+'</svg>'

def write(slug,name,doc,b,p,v,pos=None,note='',preview_kind=None):
 folder=ROOT/slug;folder.mkdir(exist_ok=True)
 svg=doc.svg();(folder/(name+'.svg')).write_text(svg)
 png=cairosvg.svg2png(bytestring=svg.encode());im=Image.open(io.BytesIO(png)).convert('RGBA')
 if doc.bg is None:
  ar=np.array(im);ar[:,:,3]=np.where(ar[:,:,3]>=128,255,0).astype('uint8');ar[ar[:,:,3]==0,:3]=0;im=Image.fromarray(ar)
 im.save(folder/(name+'.png'),dpi=(300,300))
 # validate alpha/dimensions and content is away from trim unless full-bleed
 bb=im.getbbox();assert im.size==(doc.w,doc.h)
 if doc.bg is None:assert bb and bb[0]>0 and bb[1]>0 and bb[2]<doc.w and bb[3]<doc.h,(slug,name,bb)
 ent=next((x for x in entries if x['slug']==slug),None)
 if not ent:
  ent={'slug':slug,'blueprint':b,'blueprint_name':blueprints.get(b,'Digital companion; no POD blank'),'provider':p,'provider_name':provider_name(b,p) if p else 'None','files':[]};entries.append(ent)
 ent['files'].append({'file':name+'.png','vector':name+'.svg','size':[doc.w,doc.h],'variant_id':v['id'] if v else None,'variant':v['title'] if v else 'Phone wallpaper','position':pos,'notes':note})
 checks.append({'file':str(folder/(name+'.png')),'pixels':[doc.w,doc.h],'dpi':300,'content_bounds':bb,'full_bleed':bool(doc.bg)})
 return im

def provider_name(b,p):
 for x in json.loads((CAT/f'{b}-providers.json').read_text()):
  if x['id']==p:return x['title']
 return str(p)
def scaled(w,h,bg=None):return Doc(w,h,bg)

def wrap_mug(style,w,h):
 d=Doc(w,h);m=h*.10;panel=w*.43;lx=w*.04;rx=w*.53
 if style=='charged':
  for x,label in [(lx,'Fully Charged'),(rx,'Freshly Plugged In')]:
   if x==lx:
    bx=x+panel*.22;by=h*.18;bw=panel*.52;bh=h*.22
    d.rect(bx,by,bw,bh,'none',bh*.12,INK,12);d.rect(bx+bw+8,by+bh*.28,20,bh*.44,INK,5)
    for i in range(4):d.rect(bx+18+i*(bw-28)/4,by+18,(bw-60)/4,bh-36,RED,6)
    d.text(label,x,h*.51,panel,h*.22,'c')
   else:
    d.mark(x+panel*.34,h*.15,panel*.32,h*.25,RED)
    d.text('Freshly',x,h*.49,panel,h*.16,'c');d.text('Plugged In',x,h*.70,panel,h*.16,'e')
 elif style=='latte':
  d.text("It's so cheap",lx,h*.16,panel,h*.24,'c');d.text("it's free",lx,h*.48,panel,h*.25,'c',RED)
  d.tag(rx+panel*.12,h*.25,panel*.8,h*.43)
 elif style=='travel':
  d.text('Free Refills.',lx,h*.20,panel,h*.18,'c');d.text('Free Game.',lx,h*.46,panel,h*.18,'e',RED);d.text('Freeplug.',lx,h*.71,panel,h*.12,'d')
  d.mark(rx+panel*.22,h*.25,panel*.56,h*.4,RED);d.text('FREEPLUG',rx,h*.75,panel,h*.09,'e')
 elif style=='hero':
  d.text('I Know',lx,h*.14,panel,h*.22,'c');d.text('a Plug',lx,h*.43,panel,h*.21,'e',RED);d.mark(lx+panel*.35,h*.73,panel*.30,h*.18,INK)
  d.text("It's so cheap",rx,h*.24,panel,h*.17,'d');d.text("it's free",rx,h*.49,panel,h*.24,'c',RED);d.text('FREEPLUG',rx+panel*.2,h*.82,panel*.6,h*.08,'e')
 return d
# 01-05 drinkware
for sz in ['11oz','15oz']:
 v=variant(478,28,match=sz);a=area(v);d=wrap_mug('charged',a['width'],a['height']);write('fully-charged-mug',f'wrap-{sz}',d,478,28,v,'front','Two faces in one wrap; keep handle gap blank.')
for slug,b,p,style in [('cheap-free-latte',289,1,'latte'),('free-refills-travel',70,1,'travel'),('know-a-plug-mug',425,1,'hero')]:
 v=variant(b,p);a=area(v);write(slug,'wrap',wrap_mug(style,a['width'],a['height']),b,p,v,'front','Single rectangular wrap; no taper warp applied, provider maps to blank.')
v=variant(353,1);a=area(v);w,h=a['width'],a['height'];d=Doc(w,h,IVORY)
# repeat front and reverse columns; top mark and upright vertical text stack
for x in [w*.06,w*.56]:
 d.mark(x+w*.10,h*.10,w*.22,h*.20,RED)
 for i,s in enumerate(['PLUGGED IN','SINCE','DAY ONE']):d.text(s,x,h*(.38+i*.15),w*.38,h*.105,'e',INK)
for x in [w*.02,w*.49,w*.97]:d.line(x,h*.08,x,h*.92,RED,11)
write('day-one-tumbler','wrap-20oz',d,353,1,v,'front','Stacked vertical reading on both faces; ivory background to full API extent.')

# Shared scripture art family. Exact first KJV clause only, no paraphrase.
def scripture(d,x,y,w,h,compact=False):
 for i,s in enumerate(['Give, and it shall','be given unto you']):d.text(s,x,y+h*(.06+i*.16),w,h*.135,'c',INK)
 d.cup(x+w*.22,y+h*.48,w*.56,h*.35)
 d.text('LUKE 6:38',x+w*.24,y+h*.91,w*.52,h*.05,'d',RED)
for sz,vid in [('16x20',82231),('24x36',82235)]:
 v=variant(937,105,vid);a=area(v);w,h=a['width'],a['height'];d=Doc(w,h,IVORY)
 # minimum 600px / 2 inch quiet zone, with all-background outer wrap
 margin=600;scripture(d,margin,margin,w-2*margin,h-2*margin)
 write('running-over-canvas',f'{sz}-api-area',d,937,105,v,'front','Exact API area. Full ivory background and 600px edge reservation for wrap/bleed. Provider-specific fold/bleed guide not exposed by API; verify template before production.')
 # Extra-bleed companion is explicitly not the catalog upload target.
 bleed=450;ex=Doc(w+2*bleed,h+2*bleed,IVORY);ex.raw(f'<g transform="translate({bleed},{bleed})">'+''.join(d.parts[1:])+'</g>')
 write('running-over-canvas',f'{sz}-extra-1p5in-bleed',ex,937,105,v,'reference-extra-bleed','Companion with 1.5in extra ivory each side, following general Printify canvas guidance; not a confirmed product-specific template. Do not auto-fit this in place of API-area artwork.')
d=Doc(1290,2796,IVORY)
# Clock clear above 839px; illustration centered, exact verse lower third.
d.cup(370,1110,550,570)
d.text('Give, and it shall',105,2010,1080,140,'c');d.text('be given unto you',105,2195,1080,140,'c');d.text('LUKE 6:38',415,2470,460,70,'d',RED)
write('running-over-wallpaper','wallpaper-1290x2796',d,None,None,None,None,'Top 30% clear; verse entirely in lower third. Digital only.')
# Hats, native pixels. Thick solid outlined glyphs, no letter below 6mm height.
for slug,b,p,vid,pos in [('trucker-circle',2663,99,147781,'front_patch'),('dad-fp',1729,410,118238,'front'),('low-profile-plugged',1108,99,104278,'front_embroidery'),('beanie-freeplug',1691,410,116417,'front')]:
 v=variant(b,p,vid);a=area(v,pos);w,h=a['width'],a['height'];d=Doc(w,h)
 if slug=='trucker-circle':d.circle(60,60,555,RED)
 elif slug=='dad-fp':d.text('Fp',w*.25,h*.18,w*.5,h*.64,'c',IVORY,True)
 elif slug=='low-profile-plugged':d.text('PLUGGED IN',100,160,w-200,h-320,'e',GRAY,True)
 else:
  d.rect(45,60,w-90,h-120,RED,35)
  d.text('Freeplug',105,120,w-210,h-240,'c',IVORY,True)
 im=write(slug,'front-embroidery',d,b,p,v,pos,'Embroidery artwork, not a stitch/DST file. 18px outline on letters; solid fills, max two thread colors. Digitizer must validate pull compensation, counters and thread mapping.')
 (ROOT/slug/'THREADS.md').write_text('# Thread targets\n\n'+ ('Red #ba3d3d + ivory #f7f3ea' if slug in ['trucker-circle','beanie-freeplug'] else ('Ivory #f7f3ea' if slug=='dad-fp' else 'Charcoal #454545, tonal on black'))+'\n\nHex targets are visual references, not thread SKU codes. Match to the provider’s available palette with a physical swatch. Native 300DPI art; outlined letters add at least 18px (~1.52mm) width at terminals. No letter cap height below 71px (~6mm). Do not reduce; digitization approval/sample required. Patch-shaped embroidery is not a separately sewn patch unless offered by the chosen blank.\n')
# Desk mat
v=variant(488,1,65241);a=area(v);w,h=a['width'],a['height'];d=Doc(w,h,INK)
for yy in range(300,h-150,530):
 for xx in range(260,w-100,620):d.mark(xx,yy,240,200,GRAY)
d.rect(w*.16,h*.25,w*.68,h*.5,IVORY,80)
d.text('PLUG-IN STATION',w*.2,h*.34,w*.6,h*.12,'e',RED);d.text('Build. Plug in. Repeat.',w*.23,h*.53,w*.54,h*.10,'c');d.mark(w*.45,h*.68,w*.10,h*.14,RED)
write('desk-mat','wrap-12x22',d,488,1,v,'front','Full bleed charcoal FP pattern; clear center writing/mouse zone.')
# Journal back-left / front-right with quiet spine.
v=variant(485,28);w,h=4065,2850;d=Doc(w,h,IVORY)
d.rect(0,0,w*.46,h,RED);d.mark(w*.12,h*.32,w*.22,h*.27,IVORY);d.text('FREEPLUG',w*.10,h*.68,w*.26,h*.07,'e',IVORY)
for i,(s,k) in enumerate([('Build.','e'),('Plug in.','c'),('Repeat.','e')]):d.text(s,w*.58,h*(.19+i*.19),w*.32,h*.13,k,RED if i==1 else INK)
d.mark(w*.70,h*.81,w*.09,h*.10,RED)
write('build-journal','full-cover',d,485,28,v,'front','Full wrap: back left/front right. Central 8% kept clear for spine/hinges; outer 150px quiet. Exact hinge/trim guide still needs Product Creator template check.')
# Sweatshirt all three provider-size print-area groups, two colorways
for label,vid in [('S',25397),('M',25428),('L-3XL',25459)]:
 v=variant(49,29,vid);a=area(v,'front');w,h=a['width'],a['height']
 for mode,ink in [('dark',IVORY),('light',INK)]:
  d=Doc(w,h);ac=IVORY if mode=='dark' else RED
  # left chest from wearer's perspective (viewer's right)
  d.mark(w*.61,h*.13,w*.20,h*.16,ac);d.text('I Know a Plug',w*.54,h*.32,w*.34,h*.05,'c',ink)
  write('hero-crewneck',f'{label}-front-{mode}',d,49,29,v,'front','Small left-chest mark; colorway names refer to garment, not ink.')
  d=Doc(w,h);d.text("It's so cheap",w*.12,h*.18,w*.76,h*.11,'d',ink);d.text("it's free",w*.12,h*.34,w*.76,h*.22,'c',ac);d.mark(w*.39,h*.65,w*.22,h*.18,ink);d.text('FREEPLUG',w*.30,h*.88,w*.4,h*.06,'e',ink)
  write('hero-crewneck',f'{label}-back-{mode}',d,49,29,v,'back','Large back graphic. L-3XL share API size; S and M have separate exact dimensions.')
# Bottle wrap
v=variant(646,86);a=area(v);w,h=a['width'],a['height'];d=Doc(w,h,IVORY)
for x in [w*.06,w*.56]:
 d.circle(x+w*.08,h*.13,w*.25,RED);d.text('STAY',x,h*.56,w*.38,h*.10,'e');d.text('Plugged In',x,h*.72,w*.38,h*.10,'c',RED)
for yy in [h*.05,h*.95]:d.line(w*.04,yy,w*.96,yy,RED,16)
write('water-bottle','wrap-20oz',d,646,86,v,'front','Full wrap on white slim water bottle. Keep critical art away from wrap seam.')
# Four separate die-cut stickers, 3x3 variant at 900x900
v=variant(600,73,match='3"');a=area(v);w,h=a['width'],a['height']
for typ in ['fp-circle','know-a-plug','zero-price-tag','plug-heart']:
 d=Doc(w,h)
 if typ=='fp-circle':d.circle(w*.12,h*.12,w*.76,RED)
 elif typ=='know-a-plug':
  d.rect(w*.09,h*.16,w*.82,h*.67,IVORY,80)
  d.text('I Know',w*.16,h*.25,w*.68,h*.18,'c');d.text('a Plug',w*.16,h*.5,w*.68,h*.17,'e',RED)
 elif typ=='zero-price-tag':
  d.tag(w*.18,h*.29,w*.67,h*.45,False);d.text('So cheap',w*.33,h*.35,w*.46,h*.095,'c');d.text("it's free",w*.33,h*.49,w*.46,h*.095,'c',RED)
 else:
  d.heart(w*.16,h*.2,w*.68,RED)
  # original simple two-prong electrical plug silhouette centered within heart
  d.rect(w*.38,h*.37,w*.24,h*.23,IVORY,32)
  for xx in [.41,.55]:d.rect(w*xx,h*.27,w*.045,h*.15,IVORY,10)
  d.raw(f'<path d="M{w*.5} {h*.59} Q{w*.66} {h*.77} {w*.50} {h*.81}" fill="none" stroke="{IVORY}" stroke-width="{w*.045}" stroke-linecap="round"/>')
 write('die-cut-stickers',typ,d,600,73,v,'front','Four separate sticker designs; provider generates cutline from alpha. Keep provider-added border; no production cutline supplied.')
# Keychain circle
v=variant(5341,80,243784);w,h=639,639;d=Doc(w,h);d.circle(56,56,527,RED)
write('fp-keychain','circle-front',d,5341,80,v,'front','Circle acrylic keychain; 56px inset, keep top hardware zone clear. Physical hole position requires final template confirmation.')
# Candle KJV clause; brand label only, no safety label replacement
v=variant(1048,219);w,h=900,600;d=Doc(w,h,IVORY)
d.text('RUNNING OVER',65,45,770,55,'e',RED);d.text('Give, and it shall',65,145,770,88,'c');d.text('be given unto you',65,255,770,88,'c');d.text('LUKE 6:38',280,400,340,45,'d',RED);d.mark(380,485,140,75,RED)
write('running-over-candle','front-label',d,1048,219,v,'front','Scented Soy Candle 9oz; KJV first clause exactly. Decorative label only: retain provider safety/burn labels. Scent not selected for purchase.')
# Pillow wrap is two square faces side by side.
v=variant(220,10,41527);w,h=5850,2925;d=Doc(w,h,IVORY)
scripture(d,280,160,2365,2530)
d.circle(3875,600,1030,RED);d.text('RUNNING OVER',3300,1930,2100,190,'e');d.text('LUKE 6:38',3660,2300,1380,130,'d',RED)
write('running-over-pillow','wrap-18x18',d,220,10,v,'front','Combined front-left/back-right layout; both halves upright. 200px minimum seam quiet area, ivory all edges. API exposes single combined print area.')

# Draw original flat product silhouettes; artwork is composited onto a mask or front panel.
PRE=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),27)
SMALL=ImageFont.truetype(str(FONTDIR/'FreeplugDispatch-Bold.ttf'),19)
def contain(im,box):
 a=im.copy();a.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS);return a,(box[0]+(box[2]-box[0]-a.width)//2,box[1]+(box[3]-box[1]-a.height)//2)
def pasted(canvas,img,box):
 a,xy=contain(img,box);canvas.paste(a,xy,a if a.mode=='RGBA' else None)
def preview(ent):
 slug=ent['slug'];out=Image.new('RGB',(1100,850),'#e7e3dc');p=ImageDraw.Draw(out)
 p.text((45,28),slug.replace('-',' ').upper(),font=PRE,fill=INK)
 file=ent['files'][0]['file'];art=Image.open(ROOT/slug/file).convert('RGBA')
 if slug=='hero-crewneck':
  for ox,side in [(35,'front'),(570,'back')]:
   a=Image.open(ROOT/slug/f'L-3XL-{side}-dark.png');pts=[(ox+140,155),(ox+65,195),(ox+5,330),(ox+90,370),(ox+125,300),(ox+120,700),(ox+420,700),(ox+415,300),(ox+450,370),(ox+530,330),(ox+470,195),(ox+395,155)]
   p.polygon(pts,fill=INK);p.arc((ox+215,133,ox+330,203),0,180,fill=GRAY,width=4);pasted(out,a,(ox+130,235,ox+410,650));p.text((ox+210,735),side.upper(),font=SMALL,fill=INK)
 elif slug in ['trucker-circle','dad-fp','low-profile-plugged','beanie-freeplug']:
  if slug=='beanie-freeplug':
   p.rounded_rectangle((270,160,830,645),radius=175,fill=INK);p.rounded_rectangle((260,470,840,670),radius=20,fill='#292929');pasted(out,art,(340,495,760,640))
  else:
   p.pieslice((220,130,880,760),180,360,fill=INK);p.polygon([(220,440),(880,440),(815,570),(285,570)],fill=INK);p.ellipse((210,490,890,655),fill='#303030');pasted(out,art,(350,260,750,450))
 elif slug=='running-over-wallpaper':
  p.rounded_rectangle((370,110,730,780),radius=40,fill=INK);pasted(out,art,(385,130,715,760))
 elif slug=='running-over-canvas':
  p.polygon([(320,130),(800,150),(800,735),(320,715)],fill='#c8c0b4');pasted(out,art,(290,110,770,710))
 elif slug=='desk-mat':
  p.rounded_rectangle((90,210,1010,680),radius=36,fill=INK);pasted(out,art,(115,225,985,665))
 elif slug=='build-journal':
  p.rounded_rectangle((330,130,780,735),radius=20,fill=INK);front=art.crop((int(art.width*.53),0,art.width,art.height));pasted(out,front,(345,145,765,720));p.line((350,150,350,720),fill='#b5ada0',width=3)
 elif slug=='die-cut-stickers':
  for idx,f in enumerate(ent['files']):pasted(out,Image.open(ROOT/slug/f['file']),((idx%2)*470+100,(idx//2)*310+150,(idx%2)*470+530,(idx//2)*310+440))
 elif slug=='fp-keychain':
  p.ellipse((460,130,640,310),outline='#777777',width=15);p.line((550,300,550,360),fill='#777777',width=12);pasted(out,art,(330,315,770,755))
 elif slug=='running-over-pillow':
  p.rounded_rectangle((220,180,880,740),radius=110,fill=IVORY);front=art.crop((0,0,art.width//2,art.height));pasted(out,front,(280,220,820,700))
 elif slug=='running-over-candle':
  p.rounded_rectangle((330,220,770,710),radius=48,fill='#ccb393');p.ellipse((330,170,770,270),fill='#d8c6ae');p.rectangle((320,150,780,215),fill=INK);pasted(out,art,(355,350,745,610))
 else:
  # Drinkware front and reverse, with full-wrap swatch beneath.
  for j,xx in enumerate([170,650]):
   if slug=='water-bottle':
    p.rounded_rectangle((xx+40,180,xx+260,620),radius=50,fill=IVORY);p.rounded_rectangle((xx+85,115,xx+215,200),radius=20,fill=INK)
   elif slug in ['day-one-tumbler','free-refills-travel']:
    p.polygon([(xx+10,175),(xx+290,175),(xx+250,620),(xx+50,620)],fill=IVORY);p.rounded_rectangle((xx,145,xx+300,190),radius=12,fill=INK)
   else:
    p.ellipse((xx+200,250,xx+365,470),outline='#faf7f0',width=35);p.rounded_rectangle((xx,200,xx+275,590),radius=30,fill=IVORY)
   half=art.crop((int(art.width*(.02 if j==0 else .52)),0,int(art.width*(.49 if j==0 else .99)),art.height));pasted(out,half,(xx+25,260,xx+250,525))
  pasted(out,art,(90,650,1010,780))
 p.text((45,810),'ORIGINAL FLAT PREVIEW / NOT A SCALE OR COLOR PROOF',font=SMALL,fill=GRAY)
 out.save(ROOT/slug/'mockup.png')
for ent in entries:preview(ent)
# Overview grouped into two sheets, 10 and 9 item cards.
for sn,start in enumerate([0,10],1):
 group=entries[start:start+10];over=Image.new('RGB',(2200,105+425*math.ceil(len(group)/4)),'#e7e3dc');dr=ImageDraw.Draw(over);dr.text((32,28),f'FREEPLUG / MERCH COLLECTION / {sn}',font=PRE,fill=INK)
 for idx,e in enumerate(group):
  im=Image.open(ROOT/e['slug']/'mockup.png');im=im.resize((550,425),Image.Resampling.LANCZOS);over.paste(im,((idx%4)*550,105+(idx//4)*425))
 over.save(ROOT/f'overview-{sn}.png')
Image.open(ROOT/'overview-1.png').save(ROOT/'overview.png')
(ROOT/'manifest.json').write_text(json.dumps(entries,indent=2));(ROOT/'quality-check.json').write_text(json.dumps(checks,indent=2))
md=['# Freeplug merch — local production handoff','', 'Created November 8, 2026 (America/Chicago). Local artwork only; GET-only catalog reads. No products, uploads, orders or publishing.','', '## Brand and production rules','Red #ba3d3d, ivory #f7f3ea, black #171717; tonal charcoal #454545 for low-profile cap. Owned FP Cursive v2 Bold, FP Extended Black and Freeplug Dispatch Bold. Real FP master path reused; all remaining illustrations original. All type converted to vector outlines. PNGs have 300 DPI metadata. Transparent files use 0/255 alpha, no semi-transparent halo. Full-bleed files have opaque backgrounds to all four edges.','', '### Important production gates','- Exact pixel sizes come from saved Printify catalog variant GET responses in `catalog/`. They are the provider upload-area dimensions, not proof of trim/fold/bleed coordinates. Product-specific templates are not returned by these endpoints. Canvas, journal, keychain and combined pillow layouts need the Product Creator template alignment check before production.','- Canvas: exact API-area PNGs included with 600px all-background edge reservation. Separate extra-1.5in-bleed companions included, following generic Printify guidance, but not asserted to be the Jondo-specific template. Do not auto-fit those companions as the catalog upload. Exact Jondo wrap/fold guide remains unverified.','- Printify Choice (99) is a US-target routing service, not a named fixed factory; trucker patch and low-profile cap had no fixed US alternative in their catalog listings. Ensure US target market in any later setup.','- US fulfillment intended for fixed providers; global networks (Jondo/Printful) may route by destination. No live provider cost/rating data in these allowed catalog endpoints: selections are sensible standard blanks, not a verified cheapest/best-rated ranking.','- Hat art is embroidery-oriented source, not digitized stitch files. Letter outlines thickened by 18px at native 300DPI (~1.52mm added width); native text height exceeds 6mm. Thread targets in each `THREADS.md`; match physical threads, do not reduce artwork. Patch-like beanie artwork is embroidered directly on cuff, not separately sewn patch.','- Mugs use rectangular provider wrap area without guessing taper distortions; provider product mapping handles it. Full-wrap means supplied print zone, not guaranteed 360-degree printing through handle gaps.','- Sticker set = four individually mapped 3-inch die-cut designs, not a bundled fulfillment SKU. Alpha defines proposed cut shape; provider adds border/cut path.','- Wallpaper is digital-only, 1290×2796, top 30% clear and verse lower third.','- Scripture is the exact first KJV clause: “Give, and it shall be given unto you”. No other translation or optional longer text.','- Mockups are original drawn silhouettes and visual previews, not garment sizing, wrap-placement or color proofs. Physical proof and template review required before sale.','', '## Item inventory']
for e in entries:
 md+=['',f"### {e['slug']}",f"Blueprint **{e['blueprint']} — {e['blueprint_name']}**; provider **{e['provider']} — {e['provider_name']}**.",f"Preview: `{e['slug']}/mockup.png`.",'| PNG (SVG companion same basename) | Pixels | Variant | Position | Notes |','|---|---:|---|---|---|']
 for f in e['files']:md.append(f"| `{e['slug']}/{f['file']}` | {f['size'][0]}×{f['size'][1]} | {f['variant_id']} / {f['variant']} | {f['position']} | {f['notes']} |")
 md+=['Colors: '+('Ivory/charcoal thread on black; red/ivory patch accents. See THREADS.md.' if 'embroidery' in e['files'][0]['file'] else 'Red #ba3d3d, ivory #f7f3ea, black/charcoal; sweatshirt has light/dark garment versions.')]
md+=['','## Evidence / references','- Printify GET `/catalog/blueprints.json` and selected `/catalog/blueprints/{id}/print_providers/{pid}/variants.json`: raw responses saved in `catalog/`.','- https://help.printify.com/hc/en-us/articles/4483626015889-What-are-safe-areas-and-bleeds','- https://help.printify.com/hc/en-us/articles/11240165642641-How-do-I-use-the-design-templates','- https://printify.com/blog/how-to-print-on-canvas/ (general 1.5–2in canvas bleed guidance, not product-specific)','- https://printify.com/shipping-rates/chill/ (Massachusetts US fulfillment)','- https://help.printify.com/hc/en-us/articles/18287001523345-What-is-Printify-Choice-and-how-does-it-work','',f"Total: {len(entries)} item groups, {len(checks)} print/digital PNGs, matching SVG sources, {len(entries)} mockup PNGs, two overview sheets. See `quality-check.json` for dimensions and content bounds."]
(ROOT/'MANIFEST.md').write_text('\n'.join(md))
print('DONE',len(entries),'items',len(checks),'print/digital files')
