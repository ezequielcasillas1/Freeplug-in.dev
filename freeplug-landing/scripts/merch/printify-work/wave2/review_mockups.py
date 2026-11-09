import requests,json,concurrent.futures,math
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work/wave2';O=R/'printify-mockups';state=json.loads((W/'created-products.json').read_text());tasks=[];entries=[]
for e in state:
 if not e.get('variants'):continue
 p=json.loads((W/(e['key']+'-final.json')).read_text());images=p['images'];primary=[]
 for v in e['variants']:
  ims=[x for x in images if v['id'] in x.get('variant_ids',[])]
  if not ims:continue
  # Catalog-generated default front, plus back/side angles when available.
  picks=[next((x for x in ims if x.get('is_default')),ims[0])]
  for label in ['back','left','right']:
   match=next((x for x in ims if ('camera_label='+label) in x['src'] and not ('camera_label='+label+'-') in x['src']),None)
   if match and match not in picks:picks.append(match)
  for j,i in enumerate(picks):
   name=e['key']+'-'+str(v['id'])+'-'+str(j);path=O/(name+'.jpg')
   if e['key']=='build-journal' and j<2:path=O/('build-journal-template-aligned-'+('front' if j==0 else 'back')+'.jpg')
   tasks.append((i['src'],path))
   entries.append({'key':e['key'],'title':e['title'],'id':e['id'],'variant':v,'angle':j,'src':i['src'],'path':str(path)})
def dl(t):
 url,p=t
 if not p.exists():r=requests.get(url,timeout=80);r.raise_for_status();p.write_bytes(r.content)
 Image.open(p).verify()
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(dl,tasks))
(W/'mockups.json').write_text(json.dumps(entries,indent=2))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20);sm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
def sheet(entries,path,cols,cw,ch):
 out=Image.new('RGB',(cols*cw,90+math.ceil(len(entries)/cols)*ch),(247,243,234));d=ImageDraw.Draw(out)
 d.text((20,16),'FREEPLUG / BATCH 2 / HIDDEN PRINTIFY DRAFTS',font=font,fill='black');d.text((20,49),'Visual mockups only — physical samples still needed; not published',font=sm,fill='#555')
 for n,e in enumerate(entries):
  x=n%cols*cw;y=90+n//cols*ch;im=Image.open(e['path']).convert('RGB');im=ImageOps.contain(im,(cw-20,ch-100));out.paste(im,(x+(cw-im.width)//2,y))
  title=e['title'].replace('Freeplug ','');v=e['variant']
  for j,t in enumerate([title[:42],v['title'][:45],f"${v['price']/100:.2f} proposed / angle {e['angle']}"]):d.text((x+10,y+ch-90+j*25),t,font=sm,fill='black' if j<2 else '#ba3d3d')
 out.save(path)
sheet(entries,W/'all-angle-review.png',4,500,500)
# One tile per variant. Canvas shows both sizes. Pillow gets a second tile for identical rear.
main=[e for e in entries if e['angle']==0]
main += [e for e in entries if e['key']=='running-over-pillow' and e['angle']==1]
sheet(main,O/'contact-sheet-2.png',3,600,600)
print('Products:',len(state),'review angles:',len(entries),'main tiles:',len(main));print('All angle sheet:',W/'all-angle-review.png');print('Contact sheet:',O/'contact-sheet-2.png')
