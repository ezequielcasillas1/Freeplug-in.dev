import os,requests,json,concurrent.futures
from pathlib import Path
P=Path(__file__).parent
ids=[478,289,353,70,425,937,1159,2663,1729,1108,1691,488,975,485,49,1512,600,5341,1048,220,5383,1446]
def get(i):
 r=requests.get(f'https://api.printify.com/v1/catalog/blueprints/{i}/print_providers.json',headers={'Authorization':'Bearer '+os.environ['PRINTIFY_API_TOKEN']},timeout=40)
 if r.ok:
  d=r.json();(P/f'{i}-providers.json').write_text(json.dumps(d,indent=2));return i,[(x['id'],x['title'],x.get('location')) for x in d]
 return i,r.status_code
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 for i,r in ex.map(get,ids):print(i,r)
