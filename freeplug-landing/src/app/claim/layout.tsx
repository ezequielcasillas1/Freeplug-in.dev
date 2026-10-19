import type { Metadata } from 'next'
import { PREVIEW_ROBOTS_METADATA } from '@/lib/outreach/headers'
import { AppTreeDocument } from '@/app/app-document-server'

export const metadata: Metadata = {
  title: 'Claim your website | Freeplug',
  robots: PREVIEW_ROBOTS_METADATA,
  referrer: 'no-referrer',
}

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <AppTreeDocument>{children}</AppTreeDocument>
}
