import { getRequestConfig } from 'next-intl/server'
import { isAppLocale } from './config'
import { enabledLocales } from './gate'
import { messagesFor } from './messages'
import { resolveAppLocale } from './user-locale'

/**
 * next-intl request config. Public /[locale] pages pass their locale (setRequestLocale), so they
 * stay statically rendered; every other page resolves it from the profile/cookie (gated).
 */
export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  // An explicit locale (getTranslations({ locale }) in generateMetadata) must not touch
  // requestLocale: that reads headers() and would make the static public pages dynamic.
  const requested = explicit ?? (await requestLocale)
  const locale =
    requested && isAppLocale(requested) && enabledLocales().includes(requested) ? requested : await resolveAppLocale()
  return {
    locale,
    messages: messagesFor(locale),
    timeZone: 'America/Chicago',
  }
})
