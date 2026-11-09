import { getTranslations } from 'next-intl/server'
import { DashboardNotFoundView } from './DashboardNotFoundView'

/**
 * Dashboard 404 (Oct 30). notFound() under /dashboard renders here, inside the dashboard layout's
 * <main>, so it must NOT render the root not-found's full document (that nested <html> in <main>
 * and caused a hydration error with an empty body).
 */
export default async function DashboardNotFound() {
  const t = await getTranslations('dashboard.notFound')
  return <DashboardNotFoundView heading={t('heading')} body={t('body')} link={t('link')} />
}
