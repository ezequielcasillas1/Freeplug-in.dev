exec(open('/workspace/logos/freeplug/merch/catalog/read_catalog.py').read().split('ids=')[0])
pairs=[(478,28),(289,1),(353,1),(70,1),(425,1),(937,105),(1159,105),(2663,99),(1729,410),(1108,99),(1691,410),(488,1),(485,28),(49,29),(1512,217),(600,73),(5341,80),(1048,219),(220,10)]
def get(pair):
 i,p=pair;r=requests.get(f'https://api.printify.com/v1/catalog/blueprints/{i}/print_providers/{p}/variants.json',headers={'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN']},timeout=40)
 if r.ok:
  d=r.json();(P/f'{i}-{p}-variants.json').write_text(json.dumps(d,indent=2));v=d.get('variants',[])
  areas={json.dumps(x.get('placeholders')) for x in v}; print(i,p,'variants',len(v),'areas',list(areas)[:12])
 else:print(i,p,r.status_code)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:list(ex.map(get,pairs))
