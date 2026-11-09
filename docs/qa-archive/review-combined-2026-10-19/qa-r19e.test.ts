import { test, expect } from 'vitest'
import { buyoutTierForPages, buyoutTierById, BUYOUT_TIERS, buyoutTierSentence } from '@/lib/buyout/tiers'
test('dump', () => { expect({
  edges: Object.fromEntries([5,6,7,8,11,12,15,16,1000,1e6,Number.MAX_SAFE_INTEGER,0,-1,2.5].map(p=>[p, buyoutTierForPages(p)?.id ?? null])),
  more_pages: buyoutTierById('more_pages'), labels: BUYOUT_TIERS.map(t=>`${t.id}|${t.label}|${t.cents}`), sentence: buyoutTierSentence() }).toEqual({}) })
