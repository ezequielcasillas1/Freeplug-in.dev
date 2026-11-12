import { test, expect } from 'vitest'
import { parseBuyoutPriceInput } from '@/lib/buyout/buyout'
import { buyoutDueLine, BUYOUT_TIERS_FILES_ONLY, buyoutTierForPages } from '@/lib/buyout/tiers'
import es from '../messages/es.json'; import en from '../messages/en.json'
test('dump', () => { const k=Object.keys((es as any).auth.signup.claim), ke=Object.keys((en as any).auth.signup.claim)
 expect({ parse: Object.fromEntries(['0','1','2000','2000.5','2001','abc'].map(a=>{const r=parseBuyoutPriceInput(a);return [a, r.ok?r.cents:(r as any).error]})),
  due: buyoutDueLine(25000), files: BUYOUT_TIERS_FILES_ONLY, edges:[5,6,7,8,11,12].map(p=>buyoutTierForPages(p)?.cents),
  claimKeysMatch: JSON.stringify(k)===JSON.stringify(ke), esFaqHasFiles: (es as any).buyout.faqAnswer.includes('La compra incluye solo los archivos de tu sitio web.'), enFaqHasFiles:(en as any).buyout.faqAnswer.includes('The buyout covers your website files only.') }).toEqual({}) })
