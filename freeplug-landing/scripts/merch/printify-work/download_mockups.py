import json,requests,math
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work';O=R/'printify-mockups';O.mkdir(exist_ok=True)
state=json.loads((W/'created-drafts.json').read_text());font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
items=[]
for e in state:
 if not e.get('verified_hidden'):continue
 name=e['key'].replace('/','-');dst=O/(name+'.jpg')
 images=e['images'];img=next((i for i in images if i.get('is_default')),images[0])
 if e['key'] in ['fully-charged-mug','cheap-free-latte','day-one-tumbler','free-refills-travel','know-a-plug-mug','water-bottle']:
  img=next((i for i in images if 'camera_label=left' in i['src']),img);dst=O/(name+'-left.jpg')
 url=img['src']
 if not dst.exists():
  r=requests.get(url,timeout=90);r.raise_for_status();dst.write_bytes(r.content);Image.open(dst).verify()
 e['mockup_path']=str(dst);e['mockup_url']=url;items.append(e);print('Downloaded',name,flush=True)
(W/'mockup-index.json').write_text(json.dumps(items,indent=2))
cols=4;cw=420;ch=490;header=95
sheet=Image.new('RGB',(cols*cw,header+math.ceil(len(items)/cols)*ch),(247,243,234));draw=ImageDraw.Draw(sheet)
draw.text((24,18),'FREEPLUG — HIDDEN PRINTIFY DRAFTS',font=font,fill=(23,23,23));draw.text((24,48),'Proposal only • Not published • Prices exclude shipping, tax and fees • Physical proofs still needed',font=small,fill=(60,60,60))
for i,e in enumerate(items):
 x=(i%cols)*cw;y=header+(i//cols)*ch
 im=Image.open(e['mockup_path']).convert('RGB');im=ImageOps.contain(im,(cw-24,380));sheet.paste(im,(x+(cw-im.width)//2,y))
 title=e['title'].replace('Freeplug ','');lines=[]
 while len(title)>36:
  j=title.rfind(' ',0,36);j=j if j>0 else 36;lines.append(title[:j]);title=title[j:].strip()
 lines.append(title)
 for j,line in enumerate(lines):draw.text((x+14,y+385+j*23),line,font=font,fill=(23,23,23))
 vals=[v['price']/100 for v in e['variants']];pr=f'${min(vals):.2f}' if min(vals)==max(vals) else f'${min(vals):.2f}–${max(vals):.2f}'
 draw.text((x+14,y+446),pr+' proposed • HIDDEN',font=small,fill=(186,61,61))
sheet.save(O/'contact-sheet.png');print('Contact sheet:',O/'contact-sheet.png')
