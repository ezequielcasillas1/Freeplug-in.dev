import { test, expect } from 'vitest'
import { buyoutTierForPages } from '@/lib/buyout/tiers'
import { parseBuyoutPriceInput, BUYOUT_PRICE_MAX_DOLLARS } from '@/lib/buyout/buyout'
import { recipientFromParams } from '@/lib/unsubscribe/token'
test('dump', async () => { expect({ max: BUYOUT_PRICE_MAX_DOLLARS,
  parse: Object.fromEntries(['2000','2,000','$2000','2000.01','2001','2500','1','0'].map(a=>[a, parseBuyoutPriceInput(a).ok])),
  edges: [5,6,7,8,11,12,0,-1].map(p=>buyoutTierForPages(p)?.cents ?? null),
  eOnly: await recipientFromParams({ e: 'v@example.test' } as any, 'qa-secret-0123456789'),
}).toEqual({}) })
