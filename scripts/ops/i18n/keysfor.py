#!/usr/bin/env python3
"""keysfor.py <src-relative-file> : keys whose refs include the file, with line and English."""
import csv, json, sys
root='/workspace/owen/i18n-es-wt/freeplug-landing/'
en=json.load(open(root+'messages/en.json'))
def get(k):
    n=en
    for p in k.split('.'): n=n[p]
    return n
f=sys.argv[1]
rows=list(csv.reader(open(root+'docs/i18n/freeplug-en-source-2026-10-04.keys.tsv'),delimiter='\t'))[1:]
out=[]
for r in rows:
    for ref in r[1].split('; '):
        if ref.rsplit(':',1)[0]==f:
            out.append((int(ref.rsplit(':',1)[1].split('-')[0]), r[0], r[2]))
for line,k,strict in sorted(out):
    print(f"{line:4d} {'S' if strict=='y' else ' '} {k} = {json.dumps(get(k),ensure_ascii=False)}")
