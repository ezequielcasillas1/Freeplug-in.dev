import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DomainRequestForm } from './DomainRequestForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('domainTitle') }
}

export default async function DomainPage() {
  const t = await getTranslations('claim')
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('setUpDomainLabel')}</h1>
      <p className="text-gray-600 mb-6">{t('domainHelper')}</p>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <DomainRequestForm />
      </div>
    </div>
  )
}
