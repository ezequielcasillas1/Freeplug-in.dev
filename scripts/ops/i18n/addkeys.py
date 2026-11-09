#!/usr/bin/env python3
"""Add Owen's new English keys to messages/en.json and list them in messages/pending-sable.json.
usage: addkeys.py '<json {"a.b.c": "English", ...}>' [reason]"""
import json, sys, collections
root = '/workspace/owen/i18n-es-wt/freeplug-landing/messages/'
en = json.load(open(root + 'en.json'), object_pairs_hook=collections.OrderedDict)
try:
    pend = json.load(open(root + 'pending-sable.json'), object_pairs_hook=collections.OrderedDict)
except FileNotFoundError:
    pend = collections.OrderedDict()
pend.setdefault('_about', 'Keys Owen added for the Spanish build (Oct 4). English is Owen\'s wiring text; Sable owns final wording in both languages. Every key here is missing from es.json on purpose (pending Sable). The test i18n/catalog.test.ts fails if es.json misses any other key.')
pend.setdefault('addedByOwen', collections.OrderedDict())
new = json.loads(sys.argv[1]); reason = sys.argv[2] if len(sys.argv) > 2 else ''
for k, v in new.items():
    node = en
    parts = k.split('.')
    for p in parts[:-1]:
        if p not in node: node[p] = collections.OrderedDict()
        node = node[p]
        assert isinstance(node, dict), k
    assert parts[-1] not in node or node[parts[-1]] == v, f'exists: {k}'
    node[parts[-1]] = v
    pend['addedByOwen'][k] = reason
json.dump(en, open(root + 'en.json', 'w'), ensure_ascii=False, indent=2); open(root + 'en.json', 'a').write('\n')
json.dump(pend, open(root + 'pending-sable.json', 'w'), ensure_ascii=False, indent=2); open(root + 'pending-sable.json', 'a').write('\n')
print('added', len(new))
