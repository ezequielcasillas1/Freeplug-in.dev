import os,json,requests,base64,math,sys,re
from pathlib import Path
from PIL import Image
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work'; SHOP='/shops/29664778/products'
s=requests.Session();s.headers.update({'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN'],'User-Agent':'Freeplug-Merch-Draft-Preparation','Content-Type':'application/json'})
def api(method,path,body=None):
 assert ((method=='POST' and path in ['/uploads/images.json',SHOP+'.json']) or (method in ['GET','PUT'] and re.fullmatch(SHOP+r'/[a-f0-9]+\.json',path)))
 if method in ['PUT','POST'] and path!='/uploads/images.json':assert body.get('visible') is False
 r=s.request(method,'https://api.printify.com/v1'+path,json=body,timeout=100)
 if not r.ok:raise RuntimeError(str(r.status_code)+' '+r.text[:1000])
 return r.json()
def save(name,data): (W/name).write_text(json.dumps(data,indent=2))
u_path=W/'uploads.json';uploads=json.loads(u_path.read_text()) if u_path.exists() else {}
def upload(rel,ph):
 im=Image.open(R/rel);assert im.size==(ph['width'],ph['height']),(rel,im.size,ph)
 if rel not in uploads:
  d=api('POST','/uploads/images.json',{'file_name':'freeplug-'+rel.replace('/','-'),'contents':base64.b64encode((R/rel).read_bytes()).decode()});uploads[rel]=d;save('uploads.json',uploads)
 return uploads[rel]['id']
def variant(name,vid):return next(x for x in json.loads((W/(name+'-catalog.json')).read_text())['variants'] if x['id']==vid)
# Template-dependent items deliberately excluded; no uncertain embroidery, folds, holes or canvas wrap.
jobs=[
 ('fully-charged-mug','Freeplug Fully Charged Mug','Fully Charged. Freeplug artwork on a ceramic mug in 11oz and 15oz sizes.',478,28,[(65216,{'front':'wrap-11oz.png'}),(104692,{'front':'wrap-15oz.png'})]),
 ('cheap-free-latte',"Freeplug It's So Cheap It's Free Latte Mug",'A 12oz latte mug with Freeplug lettering and the zero-price-tag graphic.',289,1,[(43321,{'front':'wrap.png'})]),
 ('day-one-tumbler','Freeplug Plugged In Since Day One Tumbler','A 20oz tumbler featuring the Freeplug mark and Plugged In Since Day One lettering.',353,1,[(44519,{'front':'wrap-20oz.png'})]),
 ('free-refills-travel','Freeplug Free Refills Travel Mug','Free Refills. Free Game. A 15oz stainless steel travel mug with original Freeplug artwork.',70,1,[(33765,{'front':'wrap.png'})]),
 ('know-a-plug-mug','Freeplug I Know a Plug Mug','I Know a Plug. A 15oz mug with signature Freeplug lettering.',425,1,[(62014,{'front':'wrap.png'})]),
 ('desk-mat','Freeplug Plug-In Station Desk Mat','A 12 x 22 inch desk mat with an original charcoal Freeplug pattern and a clear working zone.',488,1,[(65241,{'front':'wrap-12x22.png'})]),
 ('water-bottle','Freeplug Stay Plugged In Water Bottle','A white 20oz slim water bottle with original Freeplug wrap artwork.',646,86,[(72251,{'front':'wrap-20oz.png'})]),
 ('running-over-candle','Freeplug Running Over Luke 6:38 Candle','Running Over. A 9oz Clean Cotton scented soy candle featuring the King James wording: Give, and it shall be given unto you. Luke 6:38. Follow all candle safety and burning instructions supplied with the candle.',1048,219,[(80301,{'front':'front-label.png'})])]
crew=[]
for v in json.loads((W/'hero-crewneck-catalog.json').read_text())['variants']:
 size=v['options']['size'];col=v['options']['color']
 if col in ['Black','White','Sand'] and size in ['S','M','L','XL','2XL','3XL']:
  z=size if size in ['S','M'] else 'L-3XL';color='dark' if col=='Black' else 'light'
  crew.append((v['id'],{p:f'{z}-{p}-{color}.png' for p in ['front','back']}))
jobs.append(('hero-crewneck','Freeplug Hero Crewneck Sweatshirt','A Heavy Blend crewneck sweatshirt with a small front mark and a large Freeplug back graphic. Black, White and Sand; sizes S to 3XL.',49,29,crew))
for file,label in [('fp-circle','FP Circle'),('know-a-plug','I Know a Plug'),('zero-price-tag','Zero Price Tag'),('plug-heart','Plug Heart')]:
 jobs.append(('die-cut-stickers/'+file,'Freeplug '+label+' Die-Cut Sticker','One individual 3 x 3 inch white die-cut sticker with the '+label+' design. Sold individually; not a four-pack.',600,73,[(72007,{'front':file+'.png'})]))
state_path=W/'created-drafts.json';state=json.loads(state_path.read_text()) if state_path.exists() else []
for key,title,description,b,p,vs in jobs:
 if '--first' in sys.argv and key!='fully-charged-mug':continue
 if any(x['key']==key for x in state):print('Already created',key,flush=True);continue
 name=key.split('/')[0];areas=[]
 for vid,positions in vs:
  v=variant(name,vid);placeholders=[]
  for pos,file in positions.items():
   ph=next(x for x in v['placeholders'] if x['position']==pos)
   iid=upload(name+'/'+file,ph)
   placeholders.append({'position':pos,'decoration_method':ph['decoration_method'],'images':[{'id':iid,'x':0.5,'y':0.5,'scale':1,'angle':0}]})
  # Group identical print-area mappings only where variant-specific artwork matches.
  same=next((x for x in areas if x['placeholders']==placeholders),None)
  if same:same['variant_ids'].append(vid)
  else:areas.append({'variant_ids':[vid],'placeholders':placeholders})
 payload={'title':title,'description':description,'blueprint_id':b,'print_provider_id':p,'visible':False,'variants':[{'id':vid,'price':9999,'is_enabled':True} for vid,_ in vs],'print_areas':areas,'tags':['Freeplug','Merch']}
 save(key.replace('/','-')+'-create-payload.json',payload)
 result=api('POST',SHOP+'.json',payload)
 entry={'key':key,'id':result['id'],'title':title,'created_visible':result.get('visible')};state.append(entry);save('created-drafts.json',state);save(key.replace('/','-')+'-created.json',result)
 print('CREATED',entry,flush=True)
 # Visibility is a hard stop, not an excuse to publish/unpublish.
 if result.get('visible') is not False:raise RuntimeError('STOP: API did not honor visible:false; no further products will be created.')
 selected=[v for v in result['variants'] if v['id'] in [i for i,_ in vs]]
 assert all(isinstance(v.get('cost'),int) and v['cost']>0 for v in selected)
 # Target 45% gross margin on production cost, closest .99 (shipping/fees/tax not included).
 changes=[{'id':v['id'],'price':int(round((v['cost']/0.55-99)/100)*100+99),'is_enabled':True} for v in selected]
 api('PUT',SHOP+'/'+result['id']+'.json',{'visible':False,'variants':changes})
 final=api('GET',SHOP+'/'+result['id']+'.json');save(key.replace('/','-')+'-final.json',final)
 assert final.get('visible') is False and not final.get('is_locked') and not final.get('external')
 entry['verified_hidden']=True;entry['variants']=[{'id':v['id'],'title':v['title'],'cost':v['cost'],'price':v['price']} for v in final['variants'] if v['is_enabled']];entry['images']=final['images'];save('created-drafts.json',state)
 print('VERIFIED',key,entry['variants'],flush=True)
