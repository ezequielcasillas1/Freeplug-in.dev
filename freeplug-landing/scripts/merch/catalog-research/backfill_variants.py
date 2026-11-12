#!/usr/bin/env python3
"""Backfill catalog variants.json (titles) for US pairs that already have costs."""
from __future__ import annotations
import json, os, random, sys, time
from pathlib import Path
import requests

RAW = Path("/workspace/logos/freeplug/merch/catalog-research/raw")
COST = RAW / "costs"
VAR = RAW / "variants"
LOG = RAW / "_variants_backfill.log"
API = "https://api.printify.com/v1"
UA = "Freeplug-Catalog-Research-ReadOnly"

def log(m):
    line=f"{time.strftime('%Y-%m-%d %H:%M:%S')} {m}"
    print(line, flush=True)
    with LOG.open("a") as f: f.write(line+"\n")

def main():
    token=os.environ.get("PRINTIFY_API_TOKEN")
    if not token: raise SystemExit("no token")
    s=requests.Session(); s.headers.update({"Authorization":f"Bearer {token}","User-Agent":UA,"Accept":"application/json"})
    pairs=[]
    for p in COST.glob("*.json"):
        stem=p.stem  # bid_pid
        if "_" not in stem: continue
        bid,pid=stem.split("_",1)
        vp=VAR/f"{bid}_{pid}.json"
        if not vp.exists():
            pairs.append((bid,pid,vp))
    log(f"need_variants={len(pairs)}")
    ok=fail=r429=0
    for i,(bid,pid,vp) in enumerate(pairs,1):
        time.sleep(0.28+random.uniform(0,0.05))
        url=f"{API}/catalog/blueprints/{bid}/print_providers/{pid}/variants.json"
        for attempt in range(6):
            try:
                r=s.get(url,timeout=60)
            except Exception as e:
                time.sleep(1.5*(attempt+1)); continue
            if r.status_code==429:
                r429+=1
                ra=r.headers.get("Retry-After")
                wait=float(ra) if ra and str(ra).replace('.','').isdigit() else (2**attempt)+1
                wait=min(wait,90); log(f"429 sleep={wait}"); time.sleep(wait); continue
            if r.status_code>=500:
                time.sleep(2**attempt); continue
            if r.status_code==200:
                vp.write_text(r.text); ok+=1
            else:
                fail+=1; log(f"FAIL {bid}/{pid} {r.status_code}")
            break
        if i%50==0 or i==len(pairs):
            log(f"progress {i}/{len(pairs)} ok={ok} fail={fail} 429s={r429}")
    log(f"DONE ok={ok} fail={fail} 429s={r429}")
    return 0
if __name__=="__main__":
    sys.exit(main())
