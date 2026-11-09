import { getLocale } from 'next-intl/server'
import { toAppLocale, type AppLocale } from './config'

/**
 * The locale of the current request for async server code (server components, server actions,
 * route handlers). Goes through src/i18n/request.ts: /es for public pages, otherwise
 * profiles.locale then the NEXT_LOCALE cookie, and always 'en' while the gate is off (no reads).
 */
export async function currentLocale(): Promise<AppLocale> {
  return toAppLocale(await getLocale())
}
