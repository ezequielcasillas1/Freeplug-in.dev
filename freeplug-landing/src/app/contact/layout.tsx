import type { Metadata } from 'next'

const title = 'Contact Us | Freeplug'
const description = 'Send the Freeplug team a message. We reply by email.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
