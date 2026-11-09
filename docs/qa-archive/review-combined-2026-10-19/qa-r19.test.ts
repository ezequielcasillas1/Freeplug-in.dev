import { test, expect } from 'vitest'
import { buyoutTierForPages, buyoutPriceCents, buyoutTierById, buyoutTierSentence, BUYOUT_TIERS } from '@/lib/buyout/tiers'
import { parseBuyoutPriceInput } from '@/lib/buyout/buyout'
import { recipientFromParams, signUnsubscribeToken } from '@/lib/unsubscribe/token'
import { spanishEnabled, enabledLocales, effectiveLocale } from '@/i18n/gate'
test('dump', async () => {
  const S='qa-fake-secret-0123456789abcdef'; const good=await signUnsubscribeToken('a@example.test',S)
  const tampered='YkBleGFtcGxlLnRlc3Q.'+good.split('.')[1]
  expect({
    edges: Object.fromEntries([-1,0,1,5,6,7,8,11,12,500,2.5].map(p=>[p, buyoutTierForPages(p)?.cents ?? null])),
    max: Math.max(...BUYOUT_TIERS.map(t=>t.cents)), sentence: buyoutTierSentence(),
    override: { o2500: buyoutPriceCents(buyoutTierById('quick'), parseBuyoutPriceInput('2500').ok ? 250000 : null), parse2001: parseBuyoutPriceInput('2001').ok, parse500000: parseBuyoutPriceInput('500000').ok, parse0: parseBuyoutPriceInput('0').ok },
    unsub: { good: await recipientFromParams({t:good},S), tampered: await recipientFromParams({t:tampered},S), tamperedPlusE: await recipientFromParams({t:tampered,e:'victim@example.test'},S), plainE: await recipientFromParams({e:'victim@example.test'},S), noSecret: await recipientFromParams({t:good},undefined) },
    gate: { unset: spanishEnabled(undefined), on: spanishEnabled('on'), ON: spanishEnabled('ON'), localesUnset: enabledLocales(''), effUnset: effectiveLocale('es','') },
  }).toEqual({})
})
