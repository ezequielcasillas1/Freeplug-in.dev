import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getClaimedSiteForUser, getDomainOfferStatus } from '@/lib/outreach/server'
import { domainStatusStep } from '@/lib/domain/flow'
import { DomainRequestForm } from './DomainRequestForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('domainTitle') }
}

export default async function DomainPage() {
  const t = await getTranslations('domainFlow')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ data: latest }, site] = user
    ? await Promise.all([
        supabase.from('domain_requests').select('kind, domain, status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        getClaimedSiteForUser(user.id).catch(() => null),
      ])
    : [{ data: null }, null]
  const offer = await getDomainOfferStatus()
  const step = latest ? domainStatusStep(latest.status as string) : null
  const steps = ['saved', 'connecting', 'live'] as const
  return (
    <div className="max-w-xl text-[#3a2e26]">
      <h1 className="mb-1 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-[#5a4637]">{t('intro')}</p>
      {step ? (
        <section className="mb-5 rounded-xl border border-[#e5d6c6] bg-white p-4" aria-label={t('status.title')}>
          <h2 className="mb-2 text-base font-semibold">{t('status.title')}</h2>
          <ol className="flex flex-wrap gap-2 text-sm">
            {steps.map((s, i) => {
              const reached = i <= steps.indexOf(step)
              return (
                <li key={s} aria-current={s === step ? 'step' : undefined} className={`rounded-full px-3 py-1 ${reached ? 'bg-[#c2643a] text-white' : 'bg-[#f6efe7] text-[#9a8676]'}`}>
                  {s === 'live' ? t('status.live', { domain: (latest?.domain as string | null) || t('status.yourDomain') }) : t(`status.${s}`)}
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}
      <DomainRequestForm freeplugUrl={site?.live_url ?? null} offer={offer} />
    </div>
  )
}
