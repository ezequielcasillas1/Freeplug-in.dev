'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Link2, Sparkles } from 'lucide-react'
import type { Niche } from '@/lib/envato/niche-tags'
import { TYPE_LABELS, t, type Lang } from '@/lib/templates/copy'
import { isValidPastedUrl, type PickInput, type PickResult } from '@/lib/templates/pick'

export type PickerItem = { id: number; name: string; thumb: string | null; preview: string | null; available: boolean }
export type Selection = { kind: 'team' } | { kind: 'paste'; url: string } | { kind: 'item'; id: number }

type Props = {
  lang: Lang
  requestId: string
  type: Niche
  repick?: boolean
  changeTypeHref: string
  items: PickerItem[]
  initial: Selection | null
  save: (requestId: string, input: PickInput) => Promise<PickResult>
}

/** Lina: first 12 cards, then Show more loads 12 per tap. */
export const PAGE_SIZE = 12

const RED_BTN = 'min-h-[44px] rounded-lg bg-[#ba3d3d] px-4 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]'
const OUTLINE_BTN = 'min-h-[44px] rounded-lg border border-[#ba3d3d] px-4 text-[#ba3d3d] font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]'

export function Picker({ lang, requestId, type, repick, changeTypeHref, items, initial, save }: Props) {
  const router = useRouter()
  const [sel, setSel] = useState<Selection | null>(initial)
  const [pasteOpen, setPasteOpen] = useState(initial?.kind === 'paste')
  const [pasteText, setPasteText] = useState(initial?.kind === 'paste' ? initial.url : '')
  const [pasteErr, setPasteErr] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  // A restored pick past the first page stays visible after refresh.
  const [shown, setShown] = useState(() => {
    const idx = initial?.kind === 'item' ? items.findIndex((i) => i.id === initial.id) : -1
    return Math.max(PAGE_SIZE, Math.ceil((idx + 1) / PAGE_SIZE) * PAGE_SIZE)
  })
  const remaining = Math.max(0, items.length - shown)

  const selItem = sel?.kind === 'item' ? items.find((i) => i.id === sel.id) ?? null : null
  const selName =
    sel?.kind === 'team' ? t(lang, 'picker.teampick.title') : sel?.kind === 'paste' ? t(lang, 'picker.paste.label') : selItem?.name ?? ''
  const usePaste = () => {
    if (!isValidPastedUrl(pasteText)) return setPasteErr(true)
    setPasteErr(false)
    setSel({ kind: 'paste', url: pasteText.trim() })
  }
  const confirm = () =>
    start(async () => {
      setSaveErr(null)
      if (!sel) return
      const input: PickInput =
        sel.kind === 'team'
          ? { choice: 'team_pick', businessType: type }
          : sel.kind === 'paste'
            ? { choice: 'client_pasted', pastedUrl: sel.url, businessType: type }
            : { choice: 'envato_catalog', envatoItemId: sel.id, businessType: type }
      const r = await save(requestId, input)
      if (r.ok) {
        router.push(`/dashboard/request-website?picked=1${lang === 'es' ? '&lang=es' : ''}`)
        router.refresh()
        return
      }
      setSaveErr(
        t(lang, r.error === 'stale' ? 'picker.stale' : r.error === 'locked' ? 'picker.locked' : r.error === 'paste' ? 'picker.paste.error' : 'picker.save.error'),
      )
    })

  if (confirming && sel) {
    return (
      <section data-testid="confirm-screen" className="max-w-xl">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
          {selItem?.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selItem.thumb} alt={t(lang, 'picker.card.alt', { name: selItem.name })} className="h-full w-full object-cover" />
          ) : sel.kind === 'paste' ? <Link2 aria-hidden className="h-16 w-16 text-gray-500" /> : <Sparkles aria-hidden className="h-16 w-16 text-gray-500" />}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 break-words">{t(lang, 'picker.confirm.title', { name: selName })}</h1>
        {sel.kind === 'paste' ? <p className="mt-1 text-sm text-gray-600 break-all">{sel.url}</p> : null}
        <p className="mt-2 text-gray-600">{t(lang, 'picker.confirm.body')}</p>
        {saveErr ? <p role="alert" data-testid="save-error" className="mt-4 text-sm text-red-700">{saveErr}</p> : null}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={confirm} disabled={pending} className={`${RED_BTN} w-full sm:w-auto`}>{t(lang, 'picker.confirm.yes')}</button>
          <button type="button" onClick={() => { setConfirming(false); setSaveErr(null) }} className="min-h-[44px] w-full sm:w-auto px-4 text-[#ba3d3d] underline">{t(lang, 'picker.confirm.back')}</button>
        </div>
      </section>
    )
  }

  const optionCls = (on: boolean) =>
    `relative rounded-lg bg-white p-4 text-left ${on ? 'border-2 border-[#ba3d3d]' : 'border border-gray-300'}`
  return (
    <section data-testid="picker" className={`flex flex-col ${sel ? 'pb-24 sm:pb-0' : ''}`}>
      <div className="order-1">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t(lang, 'picker.title')}</h1>
      <p className="mt-2 text-gray-600">{t(lang, 'picker.intro')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span data-testid="type-chip" className="inline-flex min-h-[32px] items-center rounded-full bg-gray-100 px-3 text-sm font-medium text-gray-900">{TYPE_LABELS[lang][type]}</span>
        <a href={changeTypeHref} className="inline-flex min-h-[44px] items-center text-sm text-[#ba3d3d] underline">{t(lang, 'picker.type.change')}</a>
      </div>
      {repick ? <p role="status" data-testid="type-cleared" className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{t(lang, 'picker.type.cleared')}</p> : null}
      </div>
      {/* DOM order keeps keyboard order: option cards, grid, then bar (bar shows under the header on desktop). */}
      <div className="order-3">
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={optionCls(sel?.kind === 'team')} data-testid="option-team">
          {sel?.kind === 'team' ? <SelectedBadge /> : null}
          <h2 className="font-semibold text-gray-900">{t(lang, 'picker.teampick.title')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t(lang, 'picker.teampick.body')}</p>
          <button type="button" disabled={sel?.kind === 'team'} onClick={() => setSel({ kind: 'team' })} className={`${RED_BTN} mt-3 w-full sm:w-auto disabled:cursor-default`}>
            {sel?.kind === 'team' ? t(lang, 'picker.card.selected') : t(lang, 'picker.card.select')}
          </button>
        </div>
        <div className={optionCls(sel?.kind === 'paste')} data-testid="option-paste">
          {sel?.kind === 'paste' ? <SelectedBadge /> : null}
          <h2 className="font-semibold text-gray-900">{t(lang, 'picker.paste.title')}</h2>
          {pasteOpen ? (
            <div className="mt-3">
              <label htmlFor="paste-url" className="block text-sm font-medium text-gray-900">{t(lang, 'picker.paste.label')}</label>
              <input
                id="paste-url"
                type="url"
                inputMode="url"
                maxLength={500}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t(lang, 'picker.paste.placeholder')}
                aria-invalid={pasteErr}
                aria-describedby={pasteErr ? 'paste-err' : undefined}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
              />
              {pasteErr ? <p id="paste-err" role="alert" className="mt-1 text-sm text-red-700">{t(lang, 'picker.paste.error')}</p> : null}
              <button type="button" onClick={usePaste} className={`${OUTLINE_BTN} mt-3 w-full sm:w-auto`}>{t(lang, 'picker.paste.submit')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setPasteOpen(true)} className={`${OUTLINE_BTN} mt-3 w-full sm:w-auto`}>{t(lang, 'picker.paste.label')}</button>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-600" data-testid="count">
        {items.length === 1 ? t(lang, 'picker.count.one') : t(lang, 'picker.count', { count: items.length })}
      </p>
      {items.length === 0 ? (
        <p data-testid="empty" className="mt-2 text-gray-700">{t(lang, 'picker.empty')}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid">
          {items.slice(0, shown).map((i) => {
            const on = sel?.kind === 'item' && sel.id === i.id
            return (
              <li key={i.id} data-testid={`card-${i.id}`} className={`relative flex flex-col rounded-lg bg-white overflow-hidden ${on ? 'border-2 border-[#ba3d3d]' : 'border border-gray-200'}`}>
                <div className="relative aspect-[4/3] w-full bg-gray-100">
                  {i.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.thumb} alt={t(lang, 'picker.card.alt', { name: i.name })} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  {on ? <SelectedBadge /> : null}
                  {!i.available ? (
                    <div data-testid="unavailable" className="absolute inset-0 flex items-center justify-center bg-gray-200/80 text-sm font-semibold text-gray-700">{t(lang, 'picker.card.unavailable')}</div>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold text-gray-900 break-words">{i.name}</h3>
                  <p className="mt-1 truncate text-sm text-gray-600">{TYPE_LABELS[lang][type]}</p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    {i.preview ? (
                      <a href={i.preview} target="_blank" rel="noopener noreferrer" className={`${OUTLINE_BTN} w-full sm:flex-1`}>
                        {t(lang, 'picker.card.preview')} <ExternalLink aria-hidden className="h-4 w-4" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      disabled={on || !i.available}
                      onClick={() => setSel({ kind: 'item', id: i.id })}
                      className={`${RED_BTN} w-full sm:flex-1 disabled:cursor-default ${!i.available ? 'opacity-50' : ''}`}
                    >
                      {on ? t(lang, 'picker.card.selected') : t(lang, 'picker.card.select')}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {remaining > 0 ? (
        <button
          type="button"
          data-testid="show-more"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          aria-label={t(lang, remaining >= PAGE_SIZE ? 'picker.showmore.aria' : 'picker.showmore.aria.rest')}
          className={`${OUTLINE_BTN} mt-4 w-full`}
        >
          {t(lang, 'picker.showmore')}
        </button>
      ) : null}
      </div>
      {sel ? (
        <div data-testid="confirm-bar" className="order-4 sm:order-2 fixed inset-x-0 bottom-0 z-20 flex h-[72px] items-center gap-3 border-t border-gray-200 bg-white px-4 sm:static sm:mt-4 sm:h-auto sm:justify-end sm:border-0 sm:bg-transparent sm:px-0">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 sm:flex-none">{selName}</span>
          <button type="button" onClick={() => setConfirming(true)} className={RED_BTN}>{t(lang, 'picker.continue')}</button>
        </div>
      ) : null}

    </section>
  )
}

function SelectedBadge() {
  return (
    <span data-testid="selected-badge" className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ba3d3d] text-white">
      <Check aria-hidden className="h-4 w-4" />
    </span>
  )
}
