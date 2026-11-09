import type { Metadata } from 'next'
import { AppDocument } from '@/app/AppDocument'
import { NotFoundView } from '@/app/NotFoundView'
import { EN_MESSAGES } from '@/i18n/messages'

export const metadata: Metadata = {
  title: EN_MESSAGES.public.notFound.metaTitle,
  robots: { index: false },
}

/**
 * Root 404 for unmatched URLs (English). The root layout is a pass-through, so this renders its own
 * document. Spanish 404s under /es come from [locale]/not-found.tsx.
 */
export default function NotFound() {
  // This 404 boundary is rendered into every static page's tree. Give the provider all of its config
  // (now included) so it never asks next-intl's request scope: that reads headers() and made / and
  // /faq dynamic. setRequestLocale here would overwrite /es's locale (same request scope), so no.
  return (
    <AppDocument lang="en" messages={EN_MESSAGES} now={new Date()}>
      <NotFoundView locale="en" />
    </AppDocument>
  )
}
