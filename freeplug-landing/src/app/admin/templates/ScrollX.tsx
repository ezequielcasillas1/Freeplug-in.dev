/**
 * Horizontal scroll box for wide admin tables (Vera's Low at 375 px, Lina's design note Oct 12):
 * the table scrolls inside this box so the page never gets wider than the viewport, and a light
 * fade on the right edge shows there is more. Pin the name column with STICKY_FIRST_TH / _TD.
 * (DashboardNav uses overflow-x-auto too but has no fade or sticky column to reuse.)
 */
export const STICKY_FIRST_TH = 'sticky left-0 z-10 bg-zinc-50'
export const STICKY_FIRST_TD = 'sticky left-0 z-10 bg-white'

export function ScrollX({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="relative max-w-full" data-testid={testId ?? 'scroll-x'}>
      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">{children}</div>
      <div
        aria-hidden="true"
        data-testid="scroll-x-fade"
        className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r bg-gradient-to-l from-white to-transparent sm:hidden"
      />
    </div>
  )
}
