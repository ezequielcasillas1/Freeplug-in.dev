import { Check, Link2, Sparkles } from 'lucide-react'
import { changeRequestMailto, t, type Lang } from '@/lib/templates/copy'

export type ReadOnlyCard = { kind: 'item'; name: string; thumb: string | null } | { kind: 'paste'; url: string } | { kind: 'team' }

/**
 * After the pick window (Lina, Oct 13): only the chosen template as one full-width card with the Selected
 * tag, then the read-only note and the "Request a change" mailto link. The rest of the grid is hidden.
 * At 375 the note and link stack and the link is a full-width 44px tap target.
 */
export function ReadOnlyPick({ lang, requestId, card }: { lang: Lang; requestId: string; card: ReadOnlyCard | null }) {
  return (
    <section data-testid="picker-readonly" className="mt-6">
      {card ? (
        <div data-testid="readonly-card" className="relative w-full overflow-hidden rounded-lg border-2 border-[#ba3d3d] bg-white sm:flex">
          <div className="relative aspect-[4/3] w-full bg-gray-100 sm:w-80 sm:shrink-0 flex items-center justify-center">
            {card.kind === 'item' && card.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.thumb} alt={t(lang, 'picker.card.alt', { name: card.name })} className="h-full w-full object-cover" />
            ) : card.kind === 'paste' ? <Link2 aria-hidden className="h-12 w-12 text-gray-500" /> : card.kind === 'team' ? <Sparkles aria-hidden className="h-12 w-12 text-gray-500" /> : null}
          </div>
          <div className="p-4 min-w-0">
            <span data-testid="selected-tag" className="inline-flex items-center gap-1 rounded-full bg-[#ba3d3d] px-2.5 py-0.5 text-xs font-semibold text-white">
              <Check aria-hidden className="h-3.5 w-3.5" />{t(lang, 'picker.card.selected')}
            </span>
            <h2 className={`mt-2 font-semibold text-gray-900 ${card.kind === 'paste' ? 'break-all' : 'break-words'}`}>
              {card.kind === 'item' ? card.name : card.kind === 'paste' ? card.url : t(lang, 'picker.teampick.title')}
            </h2>
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p data-testid="readonly-note" className="text-gray-700">{t(lang, 'picker.window.readonly')}</p>
        <a
          data-testid="change-request-link"
          href={changeRequestMailto(lang, requestId)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#ba3d3d] px-4 font-semibold text-[#ba3d3d] sm:w-auto sm:shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]"
        >
          {t(lang, 'picker.window.change')}
        </a>
      </div>
    </section>
  )
}
