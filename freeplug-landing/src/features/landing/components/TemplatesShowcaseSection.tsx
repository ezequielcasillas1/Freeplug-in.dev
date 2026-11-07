'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import {
  SHOWCASE_CATEGORIES,
  categoryLabel,
  nicheLabel,
  templatesFor,
  templateBlurb,
} from '@/lib/templates/public-showcase'

export function TemplatesShowcaseSection() {
  const t = useTranslations('public.landing.templates')
  const locale = toAppLocale(useLocale())
  const [categoryId, setCategoryId] = useState(SHOWCASE_CATEGORIES[0]?.id ?? 'local')
  const category = SHOWCASE_CATEGORIES.find((c) => c.id === categoryId) ?? SHOWCASE_CATEGORIES[0]
  const [nicheId, setNicheId] = useState(category?.niches[0]?.id ?? 'cleaning')

  const niches = category?.niches ?? []
  const activeNiche = niches.find((n) => n.id === nicheId)?.id ?? niches[0]?.id ?? 'cleaning'
  useEffect(() => {
    if (!category?.niches.some((n) => n.id === nicheId)) {
      setNicheId(category?.niches[0]?.id ?? 'cleaning')
    }
  }, [category, nicheId])

  const templates = useMemo(
    () => (category ? templatesFor(category.id, activeNiche) : []),
    [category, activeNiche]
  )

  return (
    <section id="templates" aria-labelledby="templates-heading" className="py-16 sm:py-24 bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={fadeInUp} className="text-center mb-10 sm:mb-12">
            <h2 id="templates-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('heading')}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
          </motion.div>

          <motion.details
            variants={fadeInUp}
            className="lg:hidden mb-6 rounded-xl border border-zinc-200 bg-white p-4"
            data-testid="templates-mobile"
          >
            <summary className="font-semibold text-gray-900 cursor-pointer">{t('mobileToggle')}</summary>
            <div className="mt-4 space-y-4">
              <CategoryNichePicker
                categoryId={categoryId}
                nicheId={activeNiche}
                onCategory={setCategoryId}
                onNiche={setNicheId}
                locale={locale}
                vertical
              />
            </div>
          </motion.details>

          <motion.div variants={fadeInUp} className="hidden lg:grid lg:grid-cols-[240px_1fr] gap-8">
            <CategoryNichePicker
              categoryId={categoryId}
              nicheId={activeNiche}
              onCategory={(id) => {
                setCategoryId(id)
                const cat = SHOWCASE_CATEGORIES.find((c) => c.id === id)
                setNicheId(cat?.niches[0]?.id ?? 'cleaning')
              }}
              onNiche={setNicheId}
              locale={locale}
            />

            <div>
              <p className="text-sm font-medium text-gray-500 mb-4">
                {t('count', { count: templates.length })}
              </p>
              <div
                className="grid sm:grid-cols-2 gap-6"
                data-testid="templates-grid"
              >
                {templates.map((item) => (
                  <article
                    key={item.template_id}
                    data-testid={`template-${item.template_id}`}
                    className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[16/10] bg-zinc-100">
                      <Image
                        src={item.preview_image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(min-width: 1024px) 400px, 50vw"
                      />
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</h3>
                        <span className="text-xs text-gray-500 shrink-0">{item.edition}</span>
                      </div>
                      <p className="text-sm text-gray-600">{templateBlurb(item, locale)}</p>
                      <a
                        href={item.live_demo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#ba3d3d] hover:underline"
                      >
                        {t('demo')}
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                        <span className="sr-only"> {t('newTab')}</span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Mobile grid below picker */}
          <motion.div variants={fadeInUp} className="lg:hidden" data-testid="templates-grid">
            <p className="text-sm font-medium text-gray-500 mb-4">{t('count', { count: templates.length })}</p>
            <div className="grid gap-6">
              {templates.map((item) => (
                <article
                  key={item.template_id}
                  data-testid={`template-${item.template_id}`}
                  className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-sm"
                >
                  <div className="relative aspect-[16/10] bg-zinc-100">
                    <Image
                      src={item.preview_image}
                      alt={item.name}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="100vw"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{templateBlurb(item, locale)}</p>
                    <a
                      href={item.live_demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[#ba3d3d] hover:underline"
                    >
                      {t('demo')} {t('newTab')}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function CategoryNichePicker({
  categoryId,
  nicheId,
  onCategory,
  onNiche,
  locale,
  vertical = false,
}: {
  categoryId: string
  nicheId: string
  onCategory: (id: string) => void
  onNiche: (id: string) => void
  locale: 'en' | 'es'
  vertical?: boolean
}) {
  const t = useTranslations('public.landing.templates')
  const category = SHOWCASE_CATEGORIES.find((c) => c.id === categoryId)

  return (
    <div className={vertical ? 'space-y-4' : 'space-y-6'}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('categoriesLabel')}</p>
        <div
          className={vertical ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}
          data-testid="templates-categories"
        >
          {SHOWCASE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategory(cat.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                cat.id === categoryId
                  ? 'bg-[#ba3d3d] text-white'
                  : 'bg-white border border-zinc-200 text-gray-700 hover:border-[#ba3d3d]/40'
              }`}
            >
              {categoryLabel(cat, locale)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('nichesLabel')}</p>
        <div
          className={vertical ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}
          data-testid="templates-niches"
        >
          {(category?.niches ?? []).map((niche) => (
            <button
              key={niche.id}
              type="button"
              onClick={() => onNiche(niche.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                niche.id === nicheId
                  ? 'bg-[#ba3d3d]/15 text-[#ba3d3d] border border-[#ba3d3d]/30'
                  : 'bg-white border border-zinc-200 text-gray-700 hover:border-[#ba3d3d]/40'
              }`}
            >
              {nicheLabel(niche, locale)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
