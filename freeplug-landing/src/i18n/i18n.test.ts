/**
 * Spanish build (Aria's card, Oct 4): gate, catalogs, routing helpers, Stripe/profile helpers.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import enRaw from '../../messages/en.json'
import esRaw from '../../messages/es.json'
import pending from '../../messages/pending-sable.json'
import { ES_STATUS, EN_MESSAGES, ES_MESSAGES, SpanishPendingError, extraKeys, flattenMessages, messagesFor, missingKeys } from './messages'
import { effectiveLocale, enabledLocales, spanishEnabled } from './gate'
import { isLocalizedPublicPath, localizedPath, publicHref, stripLocalePrefix } from './routing'
import { formatList, formatDateIn, formatNumberIn } from './format'
import { localeKeyPart, preferredLocalesFor, stripeLocaleParam } from '@/lib/stripe/locale'
import { readProfileLocale } from './profile-locale'
import { shouldOfferSpanish } from '@/components/i18n/LanguageBanner'

type Tree = { [k: string]: string | Tree }
const EN = EN_MESSAGES as unknown as Tree
const ES = ES_MESSAGES
const ROOT = join(__dirname, '..', '..')

describe('gate (card §9: OFF by default)', () => {
  it('only the literal "on" enables Spanish; unset/anything else is English only', () => {
    expect(spanishEnabled(undefined)).toBe(false)
    expect(spanishEnabled('1')).toBe(false)
    expect(spanishEnabled('true')).toBe(false)
    expect(spanishEnabled('on')).toBe(true)
    expect(enabledLocales('off')).toEqual(['en'])
    expect(enabledLocales('on')).toEqual(['en', 'es'])
  })
  it('this checkout and CI run with the gate off', () => {
    expect(process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES).not.toBe('on')
    expect(enabledLocales()).toEqual(['en'])
  })
  it('a stored "es" preference only counts with the gate on', () => {
    expect(effectiveLocale('es', 'off')).toBe('en')
    expect(effectiveLocale('es', 'on')).toBe('es')
    expect(effectiveLocale(null, 'on')).toBe('en')
  })
})

describe('messagesFor (card C7: missing or unreviewed Spanish fails, no quiet fallback)', () => {
  const en: Tree = { a: 'A', b: { c: 'C {x}' } }
  it('draft Spanish throws without the local-QA override', () => {
    expect(() => messagesFor('es', {}, { en, es: { a: 'Á', b: { c: 'Ć {x}' } }, status: { status: 'draft' } })).toThrow(SpanishPendingError)
  })
  it('reviewed but incomplete Spanish throws', () => {
    expect(() => messagesFor('es', {}, { en, es: { a: 'Á' }, status: { status: 'reviewed' } })).toThrow(/1 key\(s\) pending Sable/)
  })
  it('reviewed and complete Spanish is served', () => {
    const m = messagesFor('es', {}, { en, es: { a: 'Á', b: { c: 'Ć {x}' } }, status: { status: 'reviewed' } }) as unknown as Tree
    expect(m).toEqual({ a: 'Á', b: { c: 'Ć {x}' } })
  })
  it('override fills missing keys with English (optionally marked)', () => {
    const env = { FREEPLUG_I18N_ES_ALLOW_PENDING: '1' }
    expect(messagesFor('es', env, { en, es: { a: 'Á' }, status: { status: 'draft' } })).toEqual({ a: 'Á', b: { c: 'C {x}' } })
    expect(messagesFor('es', { ...env, FREEPLUG_I18N_ES_PENDING_MARK: '1' }, { en, es: { a: 'Á' } })).toEqual({ a: 'Á', b: { c: '[pending Sable] C {x}' } })
  })
  it('the real Spanish catalog is still a draft, so the gate cannot be turned on for real yet', () => {
    expect(ES_STATUS.status).toBe('draft')
    expect(() => messagesFor('es', {})).toThrow(SpanishPendingError)
  })
})

describe('catalogs', () => {
  const en = flattenMessages(EN)
  const es = flattenMessages(ES)
  it('Spanish has no keys English lacks', () => {
    expect(extraKeys(EN, ES)).toEqual([])
  })
  it('the only Spanish gaps are the keys Owen added for the build (pending Sable)', () => {
    expect(missingKeys(EN, ES)).toEqual(Object.keys(pending.addedByOwen).sort())
  })
  it('every Owen-added key is in en.json with the recorded English', () => {
    for (const [k, why] of Object.entries(pending.addedByOwen as Record<string, string>)) {
      expect(en[k], k).toBeDefined()
      expect(why.length, `${k}: reason recorded`).toBeGreaterThan(10)
    }
  })
  // Argument and tag names from the real ICU parser (plural branch words are not arguments).
  const names = (msg: string) => {
    const args = new Set<string>()
    const tagSet = new Set<string>()
    const walk = (els: MessageFormatElement[]) => {
      for (const el of els) {
        if (el.type === TYPE.tag) { tagSet.add(el.value); walk(el.children) }
        else if (el.type === TYPE.plural || el.type === TYPE.select) { args.add(el.value); for (const o of Object.values(el.options)) walk(o.value) }
        else if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) args.add(el.value)
      }
    }
    walk(parse(msg))
    return { args: [...args].sort(), tags: [...tagSet].sort() }
  }
  const placeholders = (s: string) => names(s).args
  const tags = (s: string) => names(s).tags
  it('placeholders and rich-text tags match between English and Spanish', () => {
    const bad: string[] = []
    for (const [k, v] of Object.entries(es)) {
      if (!(k in en)) continue
      if (placeholders(v).join() !== placeholders(en[k]).join()) bad.push(`${k}: {${placeholders(en[k])}} vs {${placeholders(v)}}`)
      if (tags(v).join() !== tags(en[k]).join()) bad.push(`${k}: <${tags(en[k])}> vs <${tags(v)}>`)
    }
    expect(bad).toEqual([])
  })
  it('the loader turns Sable\'s <br/> into an ICU tag pair (the files themselves stay as delivered)', () => {
    expect(JSON.stringify(enRaw)).toContain('<br/>')
    expect(JSON.stringify(esRaw)).toContain('<br/>')
    expect(Object.values(en).some((v) => v.includes('<br/>'))).toBe(false)
    expect(Object.values(es).some((v) => v.includes('<br/>'))).toBe(false)
  })
})

describe('QA case 13: never claim Spanish support', () => {
  const BANNED = /(en español|atención en español|soporte en español|ayuda en español|Spanish support|support in Spanish|hablamos español)/i
  it('not in either catalog', () => {
    const hits = [...Object.entries(flattenMessages(EN)), ...Object.entries(flattenMessages(ES))].filter(([, v]) => BANNED.test(v))
    expect(hits).toEqual([])
  })
  it('not in the source', () => {
    const hits: string[] = []
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n) && BANNED.test(readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(join(ROOT, 'src'))
    expect(hits).toEqual([])
  })
})

describe('routing helpers', () => {
  it('strips the locale prefix', () => {
    expect(stripLocalePrefix('/es/faq')).toEqual({ locale: 'es', path: '/faq' })
    expect(stripLocalePrefix('/es')).toEqual({ locale: 'es', path: '/' })
    expect(stripLocalePrefix('/dashboard')).toEqual({ locale: null, path: '/dashboard' })
  })
  it('gate off: /es is not a localized path (it 404s), English public paths are', () => {
    expect(isLocalizedPublicPath('/')).toBe(true)
    expect(isLocalizedPublicPath('/faq')).toBe(true)
    expect(isLocalizedPublicPath('/signup')).toBe(true)
    expect(isLocalizedPublicPath('/es/faq')).toBe(false)
    expect(isLocalizedPublicPath('/dashboard')).toBe(false)
    expect(isLocalizedPublicPath('/login')).toBe(false)
  })
  it('localizedPath / publicHref only prefix public pages and keep query and hash', () => {
    expect(localizedPath('/es/faq', 'en')).toBe('/faq')
    expect(localizedPath('/', 'es')).toBe('/es')
    expect(publicHref('/#outreach', 'es')).toBe('/es#outreach')
    expect(publicHref('/signup?next=/claim', 'es')).toBe('/es/signup?next=/claim')
    expect(publicHref('/login', 'es')).toBe('/login')
    expect(publicHref('/faq', 'en')).toBe('/faq')
  })
})

describe('formatting (card R3: USD everywhere, Intl per locale)', () => {
  it('dates and money', () => {
    const d = new Date(Date.UTC(2026, 9, 3, 12))
    expect(formatDateIn('en', d, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })).toBe('October 3, 2026')
    expect(formatDateIn('es', d, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })).toBe('3\u00A0de\u00A0octubre\u00A0de\u00A02026')
    expect(formatNumberIn('es', 35, { style: 'currency', currency: 'USD' })).toBe('$35.00')
  })
  it('lists use Intl.ListFormat; English keeps the house style (no serial comma)', () => {
    expect(formatList(['$35', '$55', '$65'], 'en', 'disjunction')).toBe('$35, $55 or $65')
    expect(formatList(['$35', '$55', '$65'], 'es', 'disjunction')).toBe('$35, $55 o $65')
    expect(formatList(['+1 small edit', 'Big change'], 'es')).toBe('+1 small edit y Big change')
  })
})

describe('Stripe locale (card R7): nothing changes with the gate off', () => {
  it('gate off: no params, no preferred_locales, unchanged idempotency keys', () => {
    expect(stripeLocaleParam('es', 'off')).toEqual({})
    expect(preferredLocalesFor('es', 'off')).toBeUndefined()
    expect(localeKeyPart('es', 'off')).toBe('')
  })
  it('gate on: es-419 Checkout/portal, Spanish preferred_locales', () => {
    expect(stripeLocaleParam('es', 'on')).toEqual({ locale: 'es-419' })
    expect(preferredLocalesFor('es', 'on')?.[0]).toMatch(/^es/)
  })
})

describe('readProfileLocale', () => {
  it('gate off: English without touching the database (hosted DB has no locale column yet)', async () => {
    const from = vi.fn()
    expect(await readProfileLocale({ from } as never, 'u1', 'off')).toBe('en')
    expect(from).not.toHaveBeenCalled()
  })
  it('gate on: reads profiles.locale; errors fall back to English', async () => {
    const ok = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { locale: 'es' }, error: null }) }) }) }) }
    const bad = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'column does not exist' } }) }) }) }) }
    expect(await readProfileLocale(ok as never, 'u1', 'on')).toBe('es')
    expect(await readProfileLocale(bad as never, 'u1', 'on')).toBe('en')
  })
})

describe('language banner (card R4: a prompt, never a redirect)', () => {
  it('offers Spanish only to Spanish-first browsers that have not chosen yet', () => {
    expect(shouldOfferSpanish(['es-MX', 'en'], '')).toBe(true)
    expect(shouldOfferSpanish(['en-US', 'es'], '')).toBe(false)
    expect(shouldOfferSpanish(['es'], 'NEXT_LOCALE=en')).toBe(false)
  })
})
