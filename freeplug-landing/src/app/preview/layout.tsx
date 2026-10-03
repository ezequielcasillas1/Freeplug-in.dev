import type { Metadata } from 'next'
import { PREVIEW_ROBOTS_METADATA } from '@/lib/outreach/headers'

export const metadata: Metadata = {
  title: 'Your website preview | Freeplug',
  robots: PREVIEW_ROBOTS_METADATA,
  referrer: 'no-referrer',
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
