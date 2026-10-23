import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/config'
import { translatorFor, type Translate } from '@/i18n/translate'

/** Consultation strings for one locale (messages/<locale>.json → consultation.*). */
export function consultationTranslator(locale: AppLocale = DEFAULT_LOCALE): Translate {
  return translatorFor(locale, 'consultation')
}
