import { getLocale } from 'next-intl/server'
import { NotFoundView } from '@/app/NotFoundView'
import { toAppLocale } from '@/i18n/config'

/** 404 inside a public locale tree (e.g. /es/unknown): same view, localized, link to that home. */
export default async function LocaleNotFound() {
  return <NotFoundView locale={toAppLocale(await getLocale())} />
}
