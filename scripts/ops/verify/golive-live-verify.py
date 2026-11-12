import json, urllib.request, concurrent.futures as cf, re
B='https://freeplug-in.dev'
cat=json.load(open('/workspace/owen/golive-wt/freeplug-landing/src/lib/merch/shop/shop-catalog.json'))['items']
soon={'fanny-pack-468','glass-cutting-board-938','garden-house-banner-976','matte-canvas-stretched-1-25-1159','metal-art-sign-1206','matte-canvas-stretched-0-75-multi-size-937'}
def get(p):
    req=urllib.request.Request(B+p,headers={'User-Agent':'Mozilla/5.0 freeplug-golive-check'})
    try:
        r=urllib.request.urlopen(req,timeout=40); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, ''
    except Exception as e: return 0, str(e)
paths=['/merch','/es/merch','/shop','/es/shop']
for it in cat:
    paths+= ['/shop/'+it['slug'], '/es/shop/'+it['slug']]
res={}
with cf.ThreadPoolExecutor(12) as ex:
    for p,(s,b) in zip(paths, ex.map(get,paths)): res[p]=(s,b)
ok=[p for p,(s,b) in res.items() if s==200]
fail=[(p,res[p][0]) for p in paths if res[p][0]!=200]
soonbad=[]; buybad=[]
for it in cat:
    for pre in ('','/es'):
        p=pre+'/shop/'+it['slug']; s,b=res[p]
        if s!=200: continue
        has_soon=('Coming soon' in b) or ('Próximamente' in b)
        if it['slug'] in soon and not has_soon: soonbad.append(p)
out={'total':len(paths),'ok':len(ok),'fail':fail,'soon_missing_label':soonbad}
# landing checks
for p in ['/shop','/es/shop','/merch','/es/merch']:
    s,b=res[p]; out[p]={'status':s,'shop_links':len(set(re.findall(r'href="(?:/es)?/shop/[a-z0-9-]+"',b)))}
json.dump(out,open('/workspace/owen/golive-live-verify.json','w'),indent=1)
print(json.dumps(out,indent=1)[:3000])
