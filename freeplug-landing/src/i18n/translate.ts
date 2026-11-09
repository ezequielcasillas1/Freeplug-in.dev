import { createTranslator } from 'use-intl/core'
import { DEFAULT_LOCALE, type AppLocale } from './config'
import { messagesFor, SpanishPendingError, type Messages } from './messages'

/** A plain translator: t('key', values) -> string. Rich text (tags) is done in components. */
export type Translate = (key: string, values?: Record<string, string | number | Date>) => string

const cache = new Map<string, Translate>()

/**
 * Translator outside React (copy modules, server actions, emails, route handlers). If Spanish is
 * not servable (draft or keys pending, card C7) this logs and uses English instead of failing a
 * payment, email or webhook path; pages fail loudly at build/render instead (messagesFor).
 */
export function translatorFor(locale: AppLocale = DEFAULT_LOCALE, namespace?: string): Translate {
  const id = `${locale}:${namespace ?? ''}`
  const hit = cache.get(id)
  if (hit) return hit
  let messages: Messages
  let used: AppLocale = locale
  try {
    messages = messagesFor(locale)
  } catch (e) {
    if (!(e instanceof SpanishPendingError)) throw e
    console.error('[i18n] Spanish not servable here, using English:', e.message)
    messages = messagesFor('en')
    used = 'en'
  }
  const t = createTranslator({ locale: used, messages, namespace: namespace as never, timeZone: 'America/Chicago' })
  const fn: Translate = (key, values) => (t as unknown as Translate)(key, values)
  // Tests flip the env between cases; only cache for the process's own environment.
  if (!process.env.VITEST) cache.set(id, fn)
  return fn
}

/**
 * Translator over messages the server already resolved (the NextIntlClientProvider payload). Client
 * code uses this instead of translatorFor: the browser has no FREEPLUG_I18N_ES_ALLOW_PENDING, so
 * re-deciding there refused the draft and fell back to English. The server's locale decision (gate,
 * status, local pending flag) is final; the client only formats.
 */
export function translatorFromMessages(locale: AppLocale, messages: Messages, namespace?: string): Translate {
  const t = createTranslator({ locale, messages, namespace: namespace as never, timeZone: 'America/Chicago' })
  return (key, values) => (t as unknown as Translate)(key, values)
}
