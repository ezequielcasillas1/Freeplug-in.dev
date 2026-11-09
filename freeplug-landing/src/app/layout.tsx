import type { Metadata } from 'next'
import './globals.css'
import { EN_MESSAGES } from '@/i18n/messages'

const meta = EN_MESSAGES.public.meta

/**
 * Pass-through root layout (next-intl pattern, Spanish build Oct 4). The <html> document is
 * rendered one level down so `lang` can follow the locale: [locale]/layout.tsx for public pages,
 * and AppTreeDocument in the (auth), (dashboard), claim and preview layouts; admin is English.
 * Defaults below are the English site metadata; Spanish public pages override them.
 */
export const metadata: Metadata = {
  title: { default: meta.siteTitle, template: '%s' },
  description: meta.siteDescription,
  openGraph: { title: meta.ogTitle, description: meta.ogDescription, type: 'website' },
  other: { 'impact-site-verification': 'd892626b-8110-45f7-af0e-59dae87eef5f' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
