import type { Metadata } from 'next'

// The FAQ page is a client component, so its metadata lives here.
const title = 'FAQ: How Freeplug Works | Freeplug'
const description =
  "Answers about Freeplug's free website build, what you pay for after launch, timelines, and how to request your site."

// Own openGraph block: Next replaces (not merges) the root layout's openGraph, so set all fields.
export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website' },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children
}
