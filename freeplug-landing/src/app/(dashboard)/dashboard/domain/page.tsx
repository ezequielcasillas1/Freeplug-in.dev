import type { Metadata } from 'next'
import { DOMAIN_HELPER, SET_UP_DOMAIN_LABEL } from '@/lib/outreach/copy'
import { DomainRequestForm } from './DomainRequestForm'

export const metadata: Metadata = { title: 'Set up my domain | Freeplug' }

export default function DomainPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{SET_UP_DOMAIN_LABEL}</h1>
      <p className="text-gray-600 mb-6">{DOMAIN_HELPER}</p>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <DomainRequestForm />
      </div>
    </div>
  )
}
