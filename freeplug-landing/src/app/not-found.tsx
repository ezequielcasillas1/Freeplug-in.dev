import Link from 'next/link'
import type { Metadata } from 'next'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'

// Neutral placeholder wording (Owen); pending Sable's review.
const NOT_FOUND_HEADING = 'Page not found'
const NOT_FOUND_LINK = 'Go to the homepage'

export const metadata: Metadata = {
  title: 'Page not found | Freeplug',
  robots: { index: false },
}

/** Custom 404 (Wren G16): same nav, footer and styling as the public pages, with a link home. */
export default function NotFound() {
  return (
    <>
      <Navigation />
      <main className="relative min-h-[70vh] overflow-hidden bg-gradient-to-b from-white to-zinc-50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4">
            404
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">{NOT_FOUND_HEADING}</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
          >
            {NOT_FOUND_LINK}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
