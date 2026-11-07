'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  COMPARE_PROVIDERS,
  COMPARE_SECTION_ORDER,
  type CompareProvider,
  type CompareSectionId,
} from '@/lib/compare/providers'

const GROUP_LABEL: Record<CompareSectionId, 'groupRentToOwn' | 'groupDiy' | 'groupAgencies'> = {
  rentToOwn: 'groupRentToOwn',
  diy: 'groupDiy',
  agencies: 'groupAgencies',
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 text-sm text-gray-700 align-top border-t border-zinc-100">{children}</td>
}

function ProviderName({ provider, t }: { provider: CompareProvider; t: ReturnType<typeof useTranslations> }) {
  const name = t(`rows.${provider.id}.name`)
  const isInternal = provider.pricingUrl.startsWith('/')
  const href = isInternal ? publicHref(provider.pricingUrl, toAppLocale(useLocale())) : provider.pricingUrl
  const hint = t('sourceHint')

  return (
    <div className="space-y-1">
      {isInternal ? (
        <Link href={href} className="font-medium text-[#ba3d3d] hover:underline">
          {name}
        </Link>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#ba3d3d] hover:underline inline-flex items-center gap-1"
        >
          {name}
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
        </a>
      )}
      {!isInternal && <p className="text-xs text-gray-500">{hint}</p>}
      {provider.sourceUrl && (
        <p className="text-xs text-gray-500">
          <a
            href={provider.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ba3d3d] hover:underline"
          >
            {t(`rows.${provider.id}.sourceLabel`)}
          </a>
        </p>
      )}
    </div>
  )
}

function rowField(t: ReturnType<typeof useTranslations>, id: string, key: string) {
  const full = `rows.${id}.${key}`
  try {
    const v = t(full)
    return v === full ? '—' : v
  } catch {
    return '—'
  }
}

type Props = {
  /** Home teaser shows only the Freeplug row in the compact layout on small screens. */
  teaser?: boolean
}

export function CompareTable({ teaser = false }: Props) {
  const t = useTranslations('public.compare')
  const providers = teaser ? COMPARE_PROVIDERS.filter((p) => p.id === 'freeplug') : COMPARE_PROVIDERS

  const rowsBySection = COMPARE_SECTION_ORDER.map((section) => ({
    section,
    rows: providers.filter((p) => p.section === section),
  })).filter((g) => g.rows.length > 0)

  return (
    <div data-testid="compare-table" className="w-full">
      <div className="rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-zinc-200/80 overflow-x-auto hidden lg:block">
        <table className="w-full min-w-[960px] text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/90">
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colCompany')}
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colUpfront')}
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colMonthly')}
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colCounts')}
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colOwn')}
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('colWork')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsBySection.map(({ section, rows }) => (
              <Fragment key={section}>
                <tr className="bg-zinc-100/80">
                  <td colSpan={6} className="px-3 py-2 text-sm font-semibold text-gray-800">
                    {t(GROUP_LABEL[section])}
                  </td>
                </tr>
                {rows.map((provider) => (
                  <tr key={provider.id}>
                    <Cell>
                      <ProviderName provider={provider} t={t} />
                    </Cell>
                    <Cell>{rowField(t, provider.id, 'upfront')}</Cell>
                    <Cell>{rowField(t, provider.id, 'monthly')}</Cell>
                    <Cell>{rowField(t, provider.id, 'counts')}</Cell>
                    <Cell>
                      <div>{rowField(t, provider.id, 'own')}</div>
                      {rowField(t, provider.id, 'note') !== '—' && (
                        <p className="text-xs text-gray-500 mt-1">{rowField(t, provider.id, 'note')}</p>
                      )}
                    </Cell>
                    <Cell>{rowField(t, provider.id, 'work')}</Cell>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards on small screens */}
      <div className="lg:hidden space-y-4">
        {providers.map((provider) => (
          <article
            key={provider.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2"
          >
            <ProviderName provider={provider} t={t} />
            <dl className="grid grid-cols-1 gap-2 text-sm">
              {(['upfront', 'monthly', 'counts', 'own', 'work'] as const).map((key) => (
                <div key={key} className="flex justify-between gap-3 border-t border-zinc-100 pt-2 first:border-0 first:pt-0">
                  <dt className="text-gray-500">{t(key === 'counts' ? 'colCounts' : key === 'own' ? 'colOwn' : key === 'work' ? 'colWork' : key === 'monthly' ? 'colMonthly' : 'colUpfront')}</dt>
                  <dd className="text-gray-800 text-right">{rowField(t, provider.id, key)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
