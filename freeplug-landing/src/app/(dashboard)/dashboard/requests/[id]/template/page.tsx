import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isNiche } from '@/lib/envato/niche-tags'
import { isFresh, type CatalogCard } from '@/lib/templates/catalog-lookup'
import { getCatalogItem, listTemplatesForType } from '@/lib/templates/server'
import { pickLang, t, TYPE_LABELS } from '@/lib/templates/copy'
import { isPickEditable } from '@/lib/templates/pick'
import { saveTemplatePick } from './actions'
import { Picker, type PickerItem, type Selection } from './Picker'
import { TypeStep } from './TypeStep'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Choose your site template | Freeplug' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string; lang?: string; step?: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toItem(c: CatalogCard, now: number): PickerItem {
  return { id: c.id, name: c.name, thumb: c.previewImageUrl, preview: c.livePreviewUrl ?? c.url, available: isFresh(c, now) }
}

export default async function TemplatePickerPage({ params, searchParams }: Props) {
  const { id } = await params
  const q = await searchParams
  const lang = pickLang(q.lang)
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  // Owner read through RLS (website_requests_select_own): another user's id is simply not found.
  const { data: req } = await supabase
    .from('website_requests')
    .select('id, status, business_type, template_choice, envato_item_id, pasted_template_url, template_locked_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!req) notFound()

  const langQ = lang === 'es' ? 'lang=es' : ''
  const basePath = `/dashboard/requests/${id}/template`
  const back = (
    <p className="mb-6 text-sm">
      <Link href={`/dashboard/request-website${langQ ? `?${langQ}` : ''}`} className="inline-flex min-h-[44px] items-center text-[#ba3d3d] hover:underline">← {t(lang, 'picker.back')}</Link>
    </p>
  )
  const savedType = isNiche(req.business_type) ? req.business_type : null

  if (!isPickEditable(req)) {
    let name: string | null = null
    if (req.template_choice === 'envato_catalog' && req.envato_item_id != null) {
      try { name = (await getCatalogItem(Number(req.envato_item_id)))?.name ?? `#${req.envato_item_id}` } catch { name = `#${req.envato_item_id}` }
    }
    const pickLine = req.template_choice === 'team_pick' ? t(lang, 'picker.card.teampick') : req.template_choice === 'client_pasted' ? req.pasted_template_url : name
    return (
      <div className="px-0 overflow-x-hidden" data-testid="picker-locked">
        {back}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t(lang, 'picker.title')}</h1>
        {pickLine ? <p className="mt-4 font-medium text-gray-900 break-all">{pickLine}</p> : null}
        <p className="mt-4 flex items-start gap-2 text-sm text-gray-600"><span aria-hidden>🔒</span>{t(lang, 'picker.locked')}</p>
      </div>
    )
  }

  const queryType = isNiche(q.type) ? q.type : null
  const type = savedType ?? queryType
  if (!type || (!savedType && q.step === 'type')) {
    return <div className="overflow-x-hidden">{back}<TypeStep lang={lang} basePath={basePath} initial={type} /></div>
  }

  let items: PickerItem[] | null = null
  try {
    const now = Date.now()
    items = (await listTemplatesForType(type)).map((c) => toItem(c, now))
  } catch {
    items = null
  }
  if (!items) {
    return (
      <div className="overflow-x-hidden" data-testid="picker-error">
        {back}
        <p role="alert" className="text-gray-800">{t(lang, 'picker.error')}</p>
        <Link href={`${basePath}?${new URLSearchParams({ type, ...(lang === 'es' ? { lang } : {}) })}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[#ba3d3d] px-4 font-semibold text-[#ba3d3d]">{t(lang, 'picker.retry')}</Link>
      </div>
    )
  }

  const initial: Selection | null =
    req.template_choice === 'team_pick' ? { kind: 'team' }
      : req.template_choice === 'client_pasted' && req.pasted_template_url ? { kind: 'paste', url: req.pasted_template_url }
        : req.template_choice === 'envato_catalog' && req.envato_item_id != null ? { kind: 'item', id: Number(req.envato_item_id) }
          : null
  const changeQ = new URLSearchParams({ step: 'type', type, ...(lang === 'es' ? { lang } : {}) })
  return (
    <div className="overflow-x-hidden" aria-label={TYPE_LABELS[lang][type]}>
      {back}
      <Picker
        lang={lang}
        requestId={id}
        type={type}
        typeSaved={savedType != null}
        changeTypeHref={`${basePath}?${changeQ}`}
        items={items}
        initial={initial}
        save={saveTemplatePick}
      />
    </div>
  )
}
