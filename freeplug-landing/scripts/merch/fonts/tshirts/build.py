from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import cairosvg,io,json
O=Path('/workspace/logos/freeplug/tshirts'); (O/'print').mkdir(exist_ok=True);(O/'mockups').mkdir(exist_ok=True)
F=Path('/workspace/logos/FP/fonts/ttf'); C=Path('/workspace/logos/freeplug/cursive/ttf')
fonts={'extended':F/'FPExtended-Black.ttf','dispatch':F/'FreeplugDispatch-Bold.ttf','cursive':C/'FPCursive-Bold.ttf'}
RED='#8B1A1E'; WHITE='#F7F3EA'; BLACK='#111111'; W,H=4500,5400

def text(im,s,y,width,kind,color,cap=700):
 size=cap
 while True:
  f=ImageFont.truetype(str(fonts[kind]),size); b=f.getbbox(s)
  if b[2]-b[0]<=width:break
  size-=2
 d=ImageDraw.Draw(im);d.text(((W-(b[2]-b[0]))//2-b[0],y-b[1]),s,font=f,fill=color,stroke_width=2,stroke_fill=color)
 return b[3]-b[1]
def logo(im,y,width,color,badge=False,x=None):
 p=Path('/workspace/logos/FP/svg')/('fp-badge-onecolor-black.svg' if badge else 'fp-monogram-black.svg')
 svg=p.read_text().replace('#111111',color)
 a=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=width,output_height=width))).convert('RGBA');a=a.crop(a.getbbox())
 im.alpha_composite(a,((W-a.width)//2 if x is None else x,y))
 return a.height

def line(im,y,color,width=2700):
 ImageDraw.Draw(im).rounded_rectangle(((W-width)//2,y,(W+width)//2,y+26),radius=13,fill=color)
def make(n,side,mode):
 im=Image.new('RGBA',(W,H)); ink=BLACK if mode=='light' else WHITE; accent=RED if mode=='light' else WHITE
 if n==1:
  if side=='front':
   text(im,'I Know',700,3300,'cursive',ink,800);text(im,'a Plug',1550,3350,'extended',accent,950);logo(im,2850,1750,ink);line(im,4070,ink,1100)
  else:
   text(im,"It's so cheap",1250,3300,'dispatch',ink,510);text(im,"it's free",1880,3300,'cursive',accent,900);line(im,2950,ink,1800);text(im,'FREEPLUG',3210,1300,'extended',ink,260)
 elif n==2:
  if side=='front':
   logo(im,850,3600,accent,True);text(im,'FREEPLUG',4180,2750,'extended',ink,490)
  else:
   text(im,"It's so cheap it's free",1000,2600,'dispatch',ink,290);logo(im,1500,670,accent)
 elif n==3:
  logo(im,650,820,accent);text(im,'GET',1550,3150,'dispatch',ink,900);text(im,'Plugged',2540,3500,'cursive',accent,850);text(im,'IN',3510,2500,'extended',ink,850);line(im,4520,accent,3000)
 elif n==4:
  text(im,'FREE',1000,3500,'extended',ink,1100)
  ImageDraw.Draw(im).rounded_rectangle((450,2180,4050,3300),radius=60,fill=accent)
  text(im,'Game',2270,3050,'cursive',WHITE if mode=='light' else BLACK,950)
  logo(im,3650,900,ink);text(im,'FREEPLUG',4650,1550,'dispatch',ink,280)
 elif n==5:
  logo(im,620,760,accent)
  for s,y in [('My Website',1530),('Was Free.',2070)]:text(im,s,y,3400,'dispatch',ink,510)
  line(im,2740,accent,3300)
  text(im,'This Shirt',2970,3400,'extended',accent,590);text(im,"Wasn't.",3710,3400,'cursive',ink,850)
 elif n==6:
  d=ImageDraw.Draw(im);d.rounded_rectangle((510,720,3990,4650),radius=210,outline=accent,width=38)
  text(im,'PLUGGED IN',1090,2900,'extended',ink,600);text(im,'Since',1890,2500,'cursive',accent,750)
  text(im,'DAY ONE',2850,2900,'dispatch',ink,710);logo(im,3760,950,accent)
 # Binary alpha: no translucent edge or matte halo, transparent pixels have RGB zero.
 a=im.getchannel('A').point(lambda v:255 if v>=128 else 0);im.putalpha(a)
 import numpy as np
 arr=np.array(im);arr[arr[:,:,3]==0,:3]=0;im=Image.fromarray(arr)
 name=f'{n:02d}-{names[n-1]}-{side}-{mode}-garment.png';im.save(O/'print'/name,dpi=(300,300));return im,name
names=['know-a-plug','circle-mark','get-plugged-in','free-game','website-was-free','day-one'];rows=[];art={}
for n in range(1,7):
 for side in (['front','back'] if n<=2 else ['front']):
  for mode in ['light','dark']:
   im,name=make(n,side,mode);rows.append(name);art[n,side,mode]=im.resize((450,540),Image.Resampling.LANCZOS)
# Original geometric shirt silhouettes. Print canvas mapped to same relative position on all.
def shirt(panel,xy,fill,artwork,back=False):
 x,y=xy;d=ImageDraw.Draw(panel)
 pts=[(x+150,y+20),(x+70,y+55),(x,y+180),(x+80,y+225),(x+115,y+160),(x+110,y+580),(x+430,y+580),(x+425,y+160),(x+460,y+225),(x+540,y+180),(x+470,y+55),(x+390,y+20)]
 d.polygon(pts,fill=fill);d.line(pts+[pts[0]],fill='#77736E',width=2)
 d.arc((x+205,y-7,x+335,y+62),0,180,fill='#77736E',width=3)
 a=artwork.resize((270,324),Image.Resampling.LANCZOS);panel.paste(a,(x+135,y+130),a)
for n in range(1,7):
 panel=Image.new('RGB',(1440,880),'#E8E4DC');d=ImageDraw.Draw(panel)
 f=ImageFont.truetype(str(fonts['dispatch']),30)
 d.text((55,28),f'{n:02d} / '+names[n-1].replace('-',' ').upper(),font=f,fill=BLACK)
 shirt(panel,(70,130),'#F7F3EA',art[n,'front','light']);shirt(panel,(810,130),'#181818',art[n,'front','dark'])
 if n<=2:
  # inset back views, intentionally separate from front
  for x,mode,bg in [(500,'light','#F7F3EA'),(1190,'dark','#181818')]:
   small=Image.new('RGB',(560,620),'#E8E4DC');shirt(small,(0,0),bg,art[n,'back',mode],True);small=small.resize((210,233));panel.paste(small,(x,565));d.text((x,810),'BACK',font=f,fill=BLACK)
 d.text((70,805),'LIGHT GARMENT',font=f,fill=BLACK);d.text((810,805),'DARK GARMENT',font=f,fill=BLACK)
 panel.save(O/'mockups'/f'{n:02d}-{names[n-1]}.png')
over=Image.new('RGB',(2160,1480),'#E8E4DC')
for n in range(1,7):
 p=Image.open(O/'mockups'/f'{n:02d}-{names[n-1]}.png');p.thumbnail((720,440));over.paste(p,(((n-1)%3)*720,100+((n-1)//3)*650))
d=ImageDraw.Draw(over);d.text((45,25),'FREEPLUG / T-SHIRT COLLECTION',font=ImageFont.truetype(str(fonts['extended']),44),fill=BLACK);over.save(O/'overview.png')
(O/'manifest.json').write_text(json.dumps(rows,indent=2))
print('\n'.join(rows))
