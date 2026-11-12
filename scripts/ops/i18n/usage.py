import re,sys
mod=sys.argv[1]  # e.g. @/lib/plans/ladder-copy
for f in sys.argv[2:]:
    src=open(f).read()
    m=re.search(r"import\s*\{([^}]*)\}\s*from\s*'"+re.escape(mod)+"'",src)
    if not m: continue
    names=[n.strip().split(' as ')[-1] for n in m.group(1).replace('\n',' ').split(',') if n.strip() and not n.strip().startswith('type ')]
    lines=src.split('\n'); top=None; uses={}
    start=src[:m.end()].count('\n')+1
    for i,l in enumerate(lines):
        if i<start: continue
        if re.match(r'^(export\s+)?(default\s+)?(async\s+)?(function|const|let|class)\s+(\w+)',l):
            top=re.match(r'^(export\s+)?(default\s+)?(async\s+)?(function|const|let|class)\s+(\w+)',l).group(5)
        for n in names:
            if re.search(r'\b'+n+r'\b',l): uses.setdefault(top,set()).add(n)
    print(f, '| client' if "'use client'" in src[:30] else '| server')
    for k,v in uses.items(): print('   ',k,':',' '.join(sorted(v)))
