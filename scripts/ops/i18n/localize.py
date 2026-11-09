"""localize.py MOD HOOKMOD HOOK FACTORY KEEP file fn:mode[,fn:mode...]
Rewrites `import {A,B} from MOD` so copy names come from the hook/factory inside each listed
top-level function. mode: hook -> const {..} = HOOK(); await -> const {..} = FACTORY(await currentLocale())
KEEP: comma list of names that stay imported from MOD (non-copy exports)."""
import re,sys
mod,hookmod,hook,factory,keep,f=sys.argv[1:7]; specs=sys.argv[7].split(',')
keep=set(k for k in keep.split(',') if k)
src=open(f).read()
m=re.search(r"import\s*\{([^}]*)\}\s*from\s*'"+re.escape(mod)+"'\n",src)
items=[n.strip() for n in m.group(1).replace('\n',' ').split(',') if n.strip()]
copy=[n for n in items if not n.startswith('type ') and n not in keep]
kept=[n for n in items if n.startswith('type ') or n in keep]
modes={s.split(':')[0]:s.split(':')[1] for s in specs}
need_factory=any(v=='await' for v in modes.values())
imp=[]
if kept or need_factory: imp.append("import { "+', '.join(kept+([factory] if need_factory else []))+" } from '"+mod+"'\n")
if any(v=='hook' for v in modes.values()): imp.append("import { "+hook+" } from '"+hookmod+"'\n")
if need_factory and 'currentLocale' not in src: imp.append("import { currentLocale } from '@/i18n/current-locale'\n")
src=src[:m.start()]+''.join(imp)+src[m.end():]
lines=src.split('\n')
for fn,mode in modes.items():
    idx=next(i for i,l in enumerate(lines) if re.match(r'^(export\s+)?(default\s+)?(async\s+)?(function\s+'+fn+r'\b|const\s+'+fn+r'\b)',l))
    # find body start: first '{' at paren depth 0 after the parameter list closed
    depth=0; seen=False; pos=None
    for j in range(idx,len(lines)):
        for k,ch in enumerate(lines[j]):
            if ch=='(': depth+=1; seen=True
            elif ch==')': depth-=1
            elif ch=='{' and depth==0 and seen:
                rest=lines[j][k+1:].strip()
                if rest=='' : pos=j; break
        if pos is not None: break
    # names used in this function (until next top-level decl)
    end=next((i for i in range(pos+1,len(lines)) if re.match(r'^(export\s+)?(default\s+)?(async\s+)?(function|const|let|class|type|interface)\s',lines[i])),len(lines))
    body='\n'.join(lines[pos+1:end])
    used=[n for n in copy if re.search(r'\b'+n+r'\b',body)]
    if not used: print('WARN no uses in',fn); continue
    call=hook+'()' if mode=='hook' else factory+'(await currentLocale())'
    ind=re.match(r'\s*',lines[pos+1]).group(0) or '  '
    lines.insert(pos+1, f"{ind}const {{ {', '.join(used)} }} = {call}")
open(f,'w').write('\n'.join(lines))
print('ok',f)
