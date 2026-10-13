'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Niche } from '@/lib/envato/niche-tags'
import { TYPE_LABELS, orderedTypes, t, type Lang } from '@/lib/templates/copy'

/** Step 1: 20 radio tiles (Cleaning first, other_local last). 1 col at 375, 3 at 640, 4 at 1024. */
export function TypeStep({ lang, basePath, initial }: { lang: Lang; basePath: string; initial: Niche | null }) {
  const router = useRouter()
  const [type, setType] = useState<Niche | null>(initial)
  const [tried, setTried] = useState(false)
  const types = orderedTypes(lang)
  const go = () => {
    if (!type) return setTried(true)
    const q = new URLSearchParams({ type })
    if (lang === 'es') q.set('lang', 'es')
    router.push(`${basePath}?${q.toString()}`)
  }
  return (
    <section data-testid="type-step">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t(lang, 'picker.type.title')}</h1>
      <p className="mt-2 text-gray-600">{t(lang, 'picker.type.body')}</p>
      <fieldset className="mt-6">
        <legend className="sr-only">{t(lang, 'picker.filter.label')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {types.map((n) => {
            const on = type === n
            return (
              <label
                key={n}
                data-testid={`type-tile-${n}`}
                className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-900 focus-within:ring-2 focus-within:ring-[#ba3d3d] focus-within:ring-offset-2 ${on ? 'border-2 border-[#ba3d3d]' : 'border border-gray-300'}`}
              >
                <input type="radio" name="business_type" value={n} checked={on} onChange={() => setType(n)} className="h-4 w-4 accent-[#ba3d3d]" />
                <span className="break-words">{TYPE_LABELS[lang][n]}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      {tried && !type ? <p role="alert" className="mt-4 text-sm text-red-700">{t(lang, 'picker.type.required')}</p> : null}
      <button
        type="button"
        onClick={go}
        disabled={!type}
        aria-disabled={!type}
        className="mt-4 w-full sm:w-auto min-h-[44px] rounded-lg bg-[#ba3d3d] px-6 text-white font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]"
      >
        {t(lang, 'picker.type.next')}
      </button>
    </section>
  )
}
