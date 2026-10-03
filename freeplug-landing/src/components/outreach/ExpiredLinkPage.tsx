import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { EMAIL_US_LABEL, EXPIRED_BODY, EXPIRED_HEADING } from '@/lib/outreach/copy'
import { SUPPORT_MAILTO } from '@/lib/site'

/**
 * The one page every invalid preview / claim link gets (unknown, expired, revoked, claimed):
 * the custom 404 layout with Sable's expired-link wording and one "Email us" button. It never
 * says whose preview it was.
 */
export function ExpiredLinkPage() {
  return (
    <>
      <Navigation />
      <main className="relative min-h-[70vh] overflow-hidden bg-gradient-to-b from-white to-zinc-50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4">
            404
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4" data-testid="expired-heading">
            {EXPIRED_HEADING}
          </h1>
          <p className="text-gray-600 mb-8">{EXPIRED_BODY}</p>
          <a
            href={SUPPORT_MAILTO}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
          >
            {EMAIL_US_LABEL}
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}
