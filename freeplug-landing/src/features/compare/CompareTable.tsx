import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { COMPARE_CELLS, COMPARE_GROUP_LABEL, COMPARE_ROWS, type CompareGroup, type CompareRow } from '@/lib/compare/data'

const ACCENT = 'bg-[#ba3d3d]/5 shadow-[inset_3px_0_0_#ba3d3d]'

/** Server-rendered compare table (desktop) + stacked cards (mobile). Every row is in the HTML. */
export function CompareTable({ groups }: { groups?: readonly CompareGroup[] }) {
  const t = useTranslations('public.compare')
  const rows = COMPARE_ROWS.filter((r) => !groups || groups.includes(r.group))
  const cell = (r: CompareRow, k: string) => {
    const key = `rows.${r.id}.${k}`
    return t.has(key) ? <span>{t(key)}</span> : <span className="italic text-gray-400">{t('notStated')}</span>
  }
  const name = (r: CompareRow) =>
    r.source ? (
      <a href={r.source} target="_blank" rel="nofollow noopener" className="font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2 hover:text-[#ba3d3d]">
        {r.name}
        <span className="sr-only"> {t('sourceHint')}</span>
      </a>
    ) : (
      <span className="font-semibold text-gray-900">{r.name}</span>
    )
  const cols = ['colUpfront', 'colMonthly', 'colCounts', 'colOwn', 'colWork'] as const
  // Group boundaries (a label before the first row of each non-Freeplug group).
  const withLabels = rows.map((r, i) => ({ r, label: r.group !== 'freeplug' && rows[i - 1]?.group !== r.group ? COMPARE_GROUP_LABEL[r.group] : null }))

  return (
    <div data-testid="compare-table">
      {/* Desktop */}
      <Card className="hidden lg:block border-zinc-200 p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky top-16 z-10 bg-white px-4 py-3 font-semibold text-gray-900 border-b border-zinc-200 rounded-tl-xl">{t('colCompany')}</th>
              {cols.map((c) => (
                <th key={c} scope="col" className="sticky top-16 z-10 bg-white px-4 py-3 font-semibold text-gray-900 border-b border-zinc-200 last:rounded-tr-xl">{t(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withLabels.map(({ r, label }) => (
              <RowFragment key={r.id} label={label ? t(label) : null}>
                <tr data-company={r.id} className={cn('border-b border-zinc-100 align-top text-gray-700', r.group === 'freeplug' && ACCENT)}>
                  <th scope="row" className="px-4 py-3 font-normal">{name(r)}</th>
                  {COMPARE_CELLS.map((k) => (
                    <td key={k} className="px-4 py-3">{cell(r, k)}</td>
                  ))}
                  <td className="px-4 py-3">{t(r.work)}</td>
                </tr>
              </RowFragment>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: stacked cards */}
      <ul className="lg:hidden space-y-3">
        {withLabels.map(({ r, label }) => (
          <li key={r.id} data-company-card={r.id}>
            {label ? <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{t(label)}</p> : null}
            <Card className={cn('p-4 border-zinc-200', r.group === 'freeplug' && ACCENT)}>
              <h3 className="text-base mb-2">{name(r)}</h3>
              <dl className="space-y-1.5 text-sm">
                {COMPARE_CELLS.map((k, i) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-gray-500">{t(cols[i])}</dt>
                    <dd className="text-right text-gray-700">{cell(r, k)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('colWork')}</dt>
                  <dd className="text-right text-gray-700">{t(r.work)}</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RowFragment({ label, children }: { label: string | null; children: React.ReactNode }) {
  return (
    <>
      {label ? (
        <tr>
          <th colSpan={6} scope="colgroup" className="px-4 pt-5 pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{label}</th>
        </tr>
      ) : null}
      {children}
    </>
  )
}
