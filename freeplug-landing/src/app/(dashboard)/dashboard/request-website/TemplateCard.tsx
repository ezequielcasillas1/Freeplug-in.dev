import Link from 'next/link'
import { t, type Lang } from '@/lib/templates/copy'

export type TemplateCardPick = {
  requestId: string
  choice: 'envato_catalog' | 'client_pasted' | 'team_pick' | null
  itemName: string | null
  thumb: string | null
  pastedUrl: string | null
  locked: boolean
}

/** Lina: "Template" card under the request summary. Before a pick, after a pick, locked. */
export function TemplateCard({ pick, lang, showDone }: { pick: TemplateCardPick; lang: Lang; showDone: boolean }) {
  const href = `/dashboard/requests/${pick.requestId}/template${lang === 'es' ? '?lang=es' : ''}`
  const doneLine =
    pick.choice === 'team_pick' ? t(lang, 'picker.teampick.done')
      : pick.choice === 'client_pasted' ? t(lang, 'picker.paste.done')
        : pick.choice === 'envato_catalog' ? t(lang, 'picker.done', { name: pick.itemName ?? '' })
          : null
  return (
    <section data-testid="template-card" className="mb-8 max-w-lg rounded-lg border border-gray-200 bg-white px-4 py-4">
      {showDone && doneLine ? (
        <p role="status" data-testid="template-done" className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{doneLine}</p>
      ) : null}
      <h2 className="text-lg font-semibold text-gray-900">{t(lang, 'picker.card.heading')}</h2>
      {pick.choice == null ? (
        <>
          <p className="mt-1 text-sm text-gray-600">{t(lang, 'picker.intro')}</p>
          {pick.locked ? null : (
            <Link href={href} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-[#ba3d3d] px-4 font-semibold text-white">{t(lang, 'picker.card.choose')}</Link>
          )}
        </>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          {pick.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pick.thumb} alt={t(lang, 'picker.card.alt', { name: pick.itemName ?? '' })} className="h-16 w-16 flex-none rounded object-cover" />
          ) : null}
          <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 break-all">
            {pick.choice === 'team_pick' ? t(lang, 'picker.card.teampick') : pick.choice === 'client_pasted' ? pick.pastedUrl : pick.itemName}
          </p>
          {pick.locked ? null : (
            <Link href={href} className="inline-flex min-h-[44px] items-center text-sm text-[#ba3d3d] underline">{t(lang, 'picker.card.change')}</Link>
          )}
        </div>
      )}
      {pick.locked ? <p data-testid="template-locked" className="mt-3 text-sm text-gray-500">🔒 {t(lang, 'picker.locked')}</p> : null}
    </section>
  )
}
