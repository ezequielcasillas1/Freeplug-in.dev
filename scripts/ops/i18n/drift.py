#!/usr/bin/env python3
"""For each key (no placeholders/tags), check its English appears in each referenced file at ea817ef."""
import csv, json, re, subprocess, sys, html
root='/workspace/owen/i18n-es-wt/freeplug-landing/'
en=json.load(open(root+'messages/en.json'))
def get(k):
    n=en
    for p in k.split('.'): n=n[p]
    return n
rows=list(csv.reader(open(root+'docs/i18n/freeplug-en-source-2026-10-04.keys.tsv'),delimiter='\t'))[1:]
cache={}
def src(f):
    if f not in cache:
        try: cache[f]=subprocess.run(['git','-C',root,'show',f'ea817ef:freeplug-landing/{f}'],capture_output=True,text=True).stdout
        except Exception: cache[f]=''
    return cache[f]
def norm(t):
    t=html.unescape(t.replace('&apos;',"'").replace("{' '}",' '))
    t=re.sub(r"\\'", "'", t)
    return re.sub(r'\s+',' ',t)
bad=0
for r in rows:
    k=r[0]; v=get(k)
    if re.search(r'[{}<>]',v): continue
    for ref in r[1].split('; '):
        f=ref.rsplit(':',1)[0]
        s=norm(src(f))
        if norm(v) not in s:
            # try word-level: all words present in order within window
            bad+=1; print(f'{k}\t{f}\t{v[:120]}')
print('not found verbatim:',bad, file=sys.stderr)
