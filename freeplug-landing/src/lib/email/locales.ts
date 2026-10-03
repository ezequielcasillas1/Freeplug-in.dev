/**
 * Locales the app sends email in. Today every template is English-only, so this is ['en']. The template
 * CI test (templates/edge-cases.test.tsx) renders every template for every locale listed here, so adding
 * one extends the test automatically.
 */
export const EMAIL_LOCALES = ['en'] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]
export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'en'
