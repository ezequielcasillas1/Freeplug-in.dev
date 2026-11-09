'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toAppLocale } from '@/i18n/config'
import { templatesFor, visibleTemplateTree, type EnvatoTemplate } from '@/lib/templates/template-tree'

// TEST-ONLY (Cheke, Oct 23): not deployed. Demos are author-hosted (some http:), so link only,
// never iframe/embed them.
const TREE = visibleTemplateTree()

const chip = (active: boolean) =>
  `inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-medium transition-colors ${
    active ? 'border-[#ba3d3d] bg-[#ba3d3d] text-white' : 'border-zinc-200 bg-white text-gray-700 hover:border-[#ba3d3d]'
  }`

function TemplateCard({ tpl, es }: { tpl: EnvatoTemplate; es: boolean }) {
  const t = useTranslations('public.landing.templates')
  return (
    <li className="flex">
      <Card className="flex w-full flex-col overflow-hidden border-zinc-200" data-testid={`template-${tpl.template_id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote og:image; next/image remotePatterns stay empty */}
        <img
          src={tpl.preview_image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[1200/630] w-full bg-zinc-100 object-cover"
        />
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-gray-900">{tpl.name}</h4>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-gray-600">{tpl.edition}</span>
          </div>
          <p className="mt-2 flex-1 text-sm text-gray-600">{es ? tpl.good_for_es : tpl.good_for_en}</p>
          <a
            href={tpl.live_demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#ba3d3d] hover:underline"
          >
            {t('demo')} <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only">{t('newTab')}</span>
          </a>
        </div>
      </Card>
    </li>
  )
}

export function TemplatesSection() {
  const t = useTranslations('public.landing.templates')
  const es = toAppLocale(useLocale()) === 'es'
  const label = (x: { label_en: string; label_es: string }) => (es ? x.label_es : x.label_en)
  const [cat, setCat] = useState(TREE[0]?.id ?? '')
  const [niche, setNiche] = useState(TREE[0]?.niches[0]?.id ?? '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const current = TREE.find((c) => c.id === cat)
  const cards = templatesFor(cat, niche)

  const pick = (c: string, n: string) => {
    setCat(c)
    setNiche(n)
  }

  return (
    <section id="templates" aria-labelledby="templates-heading" className="py-16 sm:py-24 bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <h2 id="templates-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('heading')}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
        </div>

        {/* Phones: tap-to-open list of categories → niches */}
        <div className="md:hidden mb-6" data-testid="templates-mobile">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="templates-mobile-list"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex w-full min-h-[48px] items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 text-left text-base font-semibold text-gray-900"
          >
            <span>
              {current ? `${label(current)} · ${label(current.niches.find((n) => n.id === niche) ?? current.niches[0])}` : t('mobileToggle')}
            </span>
            <ChevronDown size={20} aria-hidden="true" className={mobileOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {mobileOpen ? (
            <ul id="templates-mobile-list" className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white" aria-label={t('categoriesLabel')}>
              {TREE.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{label(c)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.niches.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        aria-pressed={c.id === cat && n.id === niche}
                        className={chip(c.id === cat && n.id === niche)}
                        onClick={() => {
                          pick(c.id, n.id)
                          setMobileOpen(false)
                        }}
                      >
                        {label(n)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Tablet/desktop: category row, then niche row */}
        <div className="hidden md:block mb-8">
          <div role="group" aria-label={t('categoriesLabel')} className="flex flex-wrap justify-center gap-2" data-testid="templates-categories">
            {TREE.map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === cat} className={chip(c.id === cat)} onClick={() => pick(c.id, c.niches[0].id)}>
                {label(c)}
              </button>
            ))}
          </div>
          {current && current.niches.length > 1 ? (
            <div role="group" aria-label={t('nichesLabel')} className="mt-4 flex flex-wrap justify-center gap-2" data-testid="templates-niches">
              {current.niches.map((n) => (
                <button key={n.id} type="button" aria-pressed={n.id === niche} className={chip(n.id === niche)} onClick={() => setNiche(n.id)}>
                  {label(n)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <p className="mb-4 text-sm text-gray-500" aria-live="polite">{t('count', { count: cards.length })}</p>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6" data-testid="templates-grid">
          {cards.map((tpl) => (
            <TemplateCard key={tpl.template_id} tpl={tpl} es={es} />
          ))}
        </ul>
      </div>
    </section>
  )
}
