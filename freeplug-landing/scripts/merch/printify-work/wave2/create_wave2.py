import os,json,requests,base64,re
from pathlib import Path
from PIL import Image
R=Path('/workspace/logos/freeplug/merch');W=R/'printify-work/wave2';SHOP='/shops/29664778/products'
s=requests.Session();s.headers.update({'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN'],'User-Agent':'Freeplug-Hidden-Merch-Drafts','Content-Type':'application/json'})
def save(name,d):(W/name).write_text(json.dumps(d,indent=2))
def api(method,path,body=None):
 assert (method=='POST' and path in ['/uploads/images.json',SHOP+'.json']) or (method in ['GET','PUT'] and re.fullmatch(SHOP+r'/[a-f0-9]+\.json',path))
 if method in ['POST','PUT'] and path!='/uploads/images.json':assert body.get('visible') is False
 r=s.request(method,'https://api.printify.com/v1'+path,json=body,timeout=100);r.raise_for_status();return r.json()
verse='Give, and it shall be given unto you. Luke 6:38 (King James Version).'
jobs=[
('running-over-canvas','Freeplug Running Over Luke 6:38 Canvas','Running Over. '+verse+' Matte stretched canvas,0.75 inch depth;16x20 and24x36 inches,vertical. Ivory mirrored edges.',937,105,[(82231,'front','16x20-mirror-safe.png'),(82235,'front','24x36-mirror-safe.png')],{'print_on_side':'mirror'}),
('trucker-circle','Freeplug FP Circle Trucker Patch Cap','Black snapback trucker cap with a white circular patch embroidered with the red and white FP circle design. Standard Red and White threads.',2663,99,[(147781,'front_patch','standard-thread-front.png')],None),
('dad-fp','Freeplug FP Dad Hat','Black distressed dad hat with the FP mark embroidered in standard White thread.',1729,410,[(118238,'front','standard-thread-front.png')],None),
('low-profile-plugged','Freeplug Plugged In Low-Profile Cap','Black low-profile cap with tonal PLUGGED IN embroidery in standard Black thread.',1108,99,[(104278,'front_embroidery','standard-thread-front.png')],None),
('beanie-freeplug','Freeplug Cuffed Beanie','Black classic cuffed beanie with Freeplug artwork embroidered directly on the cuff in standard Red and White threads. The patch-shaped artwork is not a separately sewn patch.',1691,410,[(116417,'front','standard-thread-front.png')],None),
('build-journal','Freeplug Build Plug In Repeat Journal','Matte hardcover lined journal with Build.Plug in.Repeat.artwork on the front. Plain ivory spine and back.',485,28,[(65223,'front','front-only-full-cover.png')],None),
('fp-keychain','Freeplug FP Circle Acrylic Keychain','A circle acrylic keychain with the FP mark centered inside a generous clear perimeter.',5341,80,[(243784,'front','safe-circle-front.png')],None),
('running-over-pillow','Freeplug Running Over Luke 6:38 Pillow','An18x18 inch spun-polyester square pillow with matching front and back artwork. '+verse+' Cover and insert supplied separately;assembly required.',220,10,[(41527,'front','identical-front-back.png')],None),
('outdoor-doormat','Freeplug Come On In Outdoor Coir Doormat',"Come On In.You're Plugged In.A24x16 inch Grade A tufted coir doormat with black vinyl backing. Place in a covered,weather-protected area;avoid direct sunlight and excessive moisture. Natural coir may shed initially. Coir texture softens printed edges and colors.",1346,80,[(103043,'front','come-on-in-provider-area.png')],None)]
# Insert spaces after compact punctuation in descriptions without changing verse.
jobs=[(k,t,d.replace('0.75 inch','0.75 inch').replace('canvas,0','canvas, 0').replace(';16','; 16').replace('and24','and 24').replace('inches,vertical','inches, vertical').replace('Build.Plug in.Repeat.artwork','Build. Plug in. Repeat. artwork').replace('An18','An 18').replace('separately;assembly','separately; assembly').replace('In.You','In. You').replace('In.A24','In. A 24').replace('covered,weather','covered, weather').replace(';avoid','; avoid'),b,p,v,det) for k,t,d,b,p,v,det in jobs]
u=W/'uploads.json';uploads=json.loads(u.read_text()) if u.exists() else {};statefile=W/'created-products.json';state=json.loads(statefile.read_text()) if statefile.exists() else []
for key,title,desc,b,p,variants,details in jobs:
 if any(e['key']==key for e in state):print('Exists',key,flush=True);continue
 cat=json.loads((W/(key+'-catalog.json')).read_text());areas=[]
 for vid,pos,file in variants:
  v=next(v for v in cat['variants'] if v['id']==vid);ph=next(x for x in v['placeholders'] if x['position']==pos)
  path=R/key/'printify-ready'/file;im=Image.open(path);assert im.size==(ph['width'],ph['height'])
  rel=str(path.relative_to(R))
  if rel not in uploads:
   uploads[rel]=api('POST','/uploads/images.json',{'file_name':'freeplug-'+key+'-'+file,'contents':base64.b64encode(path.read_bytes()).decode()});save('uploads.json',uploads)
  areas.append({'variant_ids':[vid],'placeholders':[{'position':pos,'decoration_method':ph['decoration_method'],'images':[{'id':uploads[rel]['id'],'x':0.5,'y':0.5,'scale':1,'angle':0}]}]})
 body={'title':title,'description':desc,'blueprint_id':b,'print_provider_id':p,'visible':False,'variants':[{'id':v[0],'price':9999,'is_enabled':True} for v in variants],'print_areas':areas,'tags':['Freeplug','Merch']}
 if details:body['print_details']=details
 save(key+'-create-payload.json',body);result=api('POST',SHOP+'.json',body);save(key+'-created.json',result);e={'key':key,'id':result['id'],'title':title,'mockup_review':'pending'};state.append(e);save('created-products.json',state)
 assert result.get('visible') is False,'STOP: visible:false not honored'
 chosen=[v for v in result['variants'] if v['id'] in [x[0] for x in variants]];assert all(isinstance(v.get('cost'),int) and v['cost']>0 for v in chosen)
 prices=[{'id':v['id'],'price':int(round((v['cost']/0.55-99)/100)*100+99),'is_enabled':True} for v in chosen]
 api('PUT',SHOP+'/'+result['id']+'.json',{'visible':False,'variants':prices});final=api('GET',SHOP+'/'+result['id']+'.json');save(key+'-final.json',final)
 assert final.get('visible') is False and not final.get('external') and not final.get('is_locked')
 e['visible']=False;e['variants']=[{'id':v['id'],'title':v['title'],'cost':v['cost'],'price':v['price']} for v in final['variants'] if v['is_enabled']];e['images']=final['images'];save('created-products.json',state);print('HIDDEN,REVIEW PENDING',key,e['id'],e['variants'],flush=True)
