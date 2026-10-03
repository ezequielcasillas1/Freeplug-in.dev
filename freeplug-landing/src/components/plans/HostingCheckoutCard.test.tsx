import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { CONFIRM_OPEN_MS, HostingCheckoutCard } from './HostingCheckoutCard'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import {
  CHANGE_PLAN_HELP_DOWN,
  CHANGE_PLAN_HELP_UP,
  COMING_SOON_LABEL,
  EVERYTHING_IN,
  LADDER_HEADING,
  MOST_POPULAR_LABEL,
  PERK_LINES,
  STEP_BLURBS,
  UPGRADE_CALCULATING,
  UPGRADE_PREVIEW_EXPIRED,
  TIP_SLIDER_LABEL,
  UPGRADE_CONFIRM_ZERO,
  UPGRADE_CONFIRM_LINE,
  UPGRADE_REPLACES_PENDING,
  PLAN_CHANGE_TIP_ENDS,
  PLAN_CHANGE_TIP_ENDS_ON,
  TIP_CHANGE_PENDING,
  TIP_CHANGE_NOTE,
  TIP_LOCKED_NOTE,
  TIP_SLIDER_HINT,
} from '@/lib/plans/ladder-copy'
import type { PlanPreviewResponse } from '@/app/(dashboard)/dashboard/billing-actions'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const row = (c: HTMLElement, id: PlanStepId) => c.querySelector(`[data-plan-step="${id}"]`) as HTMLElement
const pickStep = (c: HTMLElement, id: PlanStepId) => fireEvent.click(within(row(c, id)).getByRole('radio'))
const sellable = PLAN_STEPS.filter((s) => s.sellable)
const soon = PLAN_STEPS.filter((s) => !s.sellable)

describe('HostingCheckoutCard rows (Lina §0)', () => {
  it('six steps from ladder.ts: name and price apart, perks once, no blurbs, no Most popular, no old amount slider or add-ons', () => {
    const { container } = render(<HostingCheckoutCard />)
    for (const [i, s] of PLAN_STEPS.entries()) {
      const r = row(container, s.id)
      expect(r).toHaveTextContent(s.name)
      expect(r).toHaveTextContent(`$${s.monthlyCents / 100}/month`)
      expect(r).not.toHaveTextContent(`${s.name} · $`)
      expect(r).not.toHaveTextContent(STEP_BLURBS[s.id])
      for (const perk of s.adds) expect(r).toHaveTextContent(PERK_LINES[perk])
      if (i > 0) expect(within(r).getAllByText(EVERYTHING_IN(PLAN_STEPS[i - 1].name))).toHaveLength(1)
    }
    expect(screen.queryByText(MOST_POPULAR_LABEL)).toBeNull()
    // The only range input is the tipping system's slider (optional tip), never the old $35-$100 amount slider.
    const ranges = container.querySelectorAll('input[type="range"]')
    expect(ranges).toHaveLength(1)
    expect(screen.getByTestId('tip-area').contains(ranges[0])).toBe(true)
    expect(container).not.toHaveTextContent(/\bBasic\b|\bPlus\b|\bPro\b/)
    expect(container).not.toHaveTextContent(/add-on|backup|downtime|uptime|99\.9/i)
  })

  it('Coming soon steps: no radio, not a label, grey text instead of opacity, amber badge, under the divider', () => {
    const { container } = render(<HostingCheckoutCard />)
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(sellable.map((s) => s.id))
    const group = screen.getByTestId('coming-soon-group')
    for (const s of soon) {
      const r = row(container, s.id)
      expect(group.contains(r)).toBe(true)
      expect(r.tagName).toBe('DIV')
      expect(within(r).queryByRole('radio')).toBeNull()
      expect(within(r).getByTestId('coming-soon')).toHaveTextContent(COMING_SOON_LABEL)
      expect(r.className).not.toMatch(/opacity/)
      expect(r.className).toMatch(/text-gray-600/)
    }
    expect((row(container, 'starter').querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('selected row: brand border + ring + tint; whole row is the label, p-4 and min 44px', () => {
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'priority')
    const r = row(container, 'priority')
    expect(r.tagName).toBe('LABEL')
    expect(r.className).toMatch(/border-\[#ba3d3d\]/)
    expect(r.className).toMatch(/ring-1/)
    expect(r.className).toMatch(/bg-\[#ba3d3d\]\/5/)
    expect(r.className).toMatch(/p-4/)
    expect(r.className).toMatch(/min-h-\[44px\]/)
    expect(row(container, 'starter').className).not.toMatch(/ring-1/)
  })

  it('phone: the Coming soon group is behind one disclosure', () => {
    render(<HostingCheckoutCard />)
    const toggle = screen.getByTestId('coming-soon-toggle')
    expect(toggle).toHaveTextContent(`Plans coming soon (${soon.length})`)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel.className).toMatch(/(^| )hidden( |$)/)
    expect(panel.className).toMatch(/sm:grid/)
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel.className).not.toMatch(/(^| )hidden( |$)/)
  })

  it('columns layout: sellable steps in lg columns; stacked by default', () => {
    const { container, unmount } = render(<HostingCheckoutCard layout="columns" />)
    expect(row(container, 'starter').parentElement!.className).toMatch(new RegExp(`lg:grid-cols-${sellable.length}`))
    unmount()
    const { container: c2 } = render(<HostingCheckoutCard />)
    expect(row(c2, 'starter').parentElement!.className).not.toMatch(/lg:grid-cols/)
  })
})

describe('round 5 (Lina): radio accent and Coming soon contrast', () => {
  it('every ladder radio uses the brand accent color', () => {
    const { container } = render(<HostingCheckoutCard />)
    const radios = container.querySelectorAll('input[type=radio]')
    expect(radios.length).toBeGreaterThan(0)
    for (const r of radios) expect(r.className).toMatch(/(^|\s)accent-\[#ba3d3d\](\s|$)/)
  })

  it('Coming soon rows: all text gray-600 or darker (no gray-300/400/500, no opacity)', () => {
    const { container } = render(<HostingCheckoutCard />)
    const soon = container.querySelectorAll('[data-sellable=false]')
    expect(soon.length).toBe(3)
    for (const row of soon) {
      for (const el of [row, ...row.querySelectorAll('*')]) {
        const cls = el.getAttribute('class') ?? ''
        expect(cls).not.toMatch(/text-(gray|zinc)-(300|400|500)\b|opacity-/)
      }
    }
  })
})

describe('checkout and claim modes', () => {
  it('checkout posts only the chosen step id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'stop' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'priority')
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/checkout/hosting')
    expect(JSON.parse(init.body as string)).toEqual({ planStep: 'priority', tipDollars: 0 })
    expect(await screen.findByText('stop')).toBeInTheDocument()
  })

  it('claim step 3 (bare + sticky): no own heading, the button names the pick, the note sits above it, nothing charged', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onChoosePlan = vi.fn(async () => null)
    const { container } = render(
      <HostingCheckoutCard bare stickyOnPhone onChoosePlan={onChoosePlan} chooseLabelFor={(n) => `Choose ${n}`} noteAboveButton="No charge until live." />
    )
    expect(screen.queryByRole('heading', { name: LADDER_HEADING })).toBeNull()
    expect(screen.getByRole('button', { name: 'Choose Starter' })).toBeInTheDocument()
    pickStep(container, 'priority')
    const btn = screen.getByRole('button', { name: 'Choose Priority' })
    const note = screen.getByText('No charge until live.')
    expect(note.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const bar = screen.getByTestId('pay-area')
    expect(bar.className).toMatch(/sticky bottom-0/)
    expect(bar.className).toMatch(/sm:static/)
    expect(bar.contains(note)).toBe(true)
    expect(within(bar).getByTestId('sticky-summary')).toHaveTextContent('Priority · $55/month')
    fireEvent.click(btn)
    await waitFor(() => expect(onChoosePlan).toHaveBeenCalledWith({ planStep: 'priority', tipDollars: 0 }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('with a live plan and no switching: the Current plan strip and Manage billing', () => {
    render(<HostingCheckoutCard currentPlanLines={['Starter · $35.00/month']} />)
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument()
    expect(screen.getByTestId('plan-strip')).toHaveTextContent('Current plan: Starter · $35.00/month')
  })
})

type ChangeFn = (step: PlanStepId, pd?: number) => Promise<{ ok: boolean; message: string; code?: 'stale_preview' }>
function switching(over: Partial<React.ComponentProps<typeof HostingCheckoutCard>> = {}) {
  const onChangePlan = vi.fn<ChangeFn>(async () => ({ ok: true, message: 'done' }))
  const onPreviewChange = vi.fn(async (): Promise<PlanPreviewResponse> => ({ ok: true, prorationDate: 1_790_000_000, amountDueCents: 1953, nextAmountCents: 6500, nextDate: 'November 3, 2026' }))
  const utils = render(
    <HostingCheckoutCard
      currentPlanLines={['Freeplug Hosting: Starter · $35.00/month']}
      currentStepId="starter"
      renewalDate="November 3, 2026"
      onChangePlan={onChangePlan}
      onPreviewChange={onPreviewChange}
      stickyOnPhone
      {...over}
    />
  )
  return { ...utils, onChangePlan, onPreviewChange }
}

describe('switching card: direction-aware button (Lina §3a)', () => {
  it('selected = current: disabled "Choose a different plan to switch", no help line', () => {
    switching()
    expect(screen.getByRole('button', { name: 'Choose a different plan to switch' })).toBeDisabled()
    expect(screen.queryByTestId('switch-help')).toBeNull()
  })

  it('higher: "Switch to <Name> now" + the up line; lower: "Switch to <Name> on <date>" + the down line', () => {
    const { container } = switching({ currentStepId: 'priority', currentPlanLines: ['Priority · $55.00/month'] })
    pickStep(container, 'fast_lane')
    expect(screen.getByRole('button', { name: 'Switch to Fast lane now' })).toBeEnabled()
    expect(screen.getByTestId('switch-help')).toHaveTextContent(CHANGE_PLAN_HELP_UP)
    pickStep(container, 'starter')
    expect(screen.getByRole('button', { name: 'Switch to Starter on November 3, 2026' })).toBeEnabled()
    expect(screen.getByTestId('switch-help')).toHaveTextContent(CHANGE_PLAN_HELP_DOWN)
  })

  it('Lina round 5b: the downgrade button uses the short date ("Nov 3"); the hint line under it keeps the full date', () => {
    const { container } = switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month + $6 tip'], currentTipDollars: 6, renewalDateShort: 'Nov 3' })
    pickStep(container, 'starter')
    const btn = screen.getByRole('button', { name: 'Switch to Starter on Nov 3' })
    expect(btn).toBeEnabled()
    expect(btn).not.toHaveTextContent('2026')
    expect(screen.getByTestId('switch-help-tip')).toHaveTextContent(PLAN_CHANGE_TIP_ENDS_ON('$6', 'November 3, 2026'))
    // Priority is also below Fast lane: same short form
    pickStep(container, 'priority')
    expect(screen.getByRole('button', { name: 'Switch to Priority on Nov 3' })).toBeEnabled()
  })

  it('a downgrade has no confirm: one tap calls the server action, no preview', async () => {
    const { container, onChangePlan, onPreviewChange } = switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65.00/month'] })
    pickStep(container, 'starter')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Starter on November 3, 2026' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('starter', undefined))
    expect(onPreviewChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('upgrade-confirm')).toBeNull()
  })

  it('a grandfathered plan: direction from what it costs now (a $55 plan: Starter is lower, Fast lane higher)', () => {
    const { container } = switching({ currentStepId: null, currentMonthlyCents: 5500, currentPlanLines: ['Hosting + Pro add-on · $55.00/month'] })
    expect(screen.queryByTestId('current-step')).toBeNull()
    expect(screen.getByRole('button', { name: 'Switch to Starter on November 3, 2026' })).toBeEnabled()
    pickStep(container, 'fast_lane')
    expect(screen.getByRole('button', { name: 'Switch to Fast lane now' })).toBeEnabled()
  })

  it('a customer on a Coming soon step: a normal row with "Your current plan", group open; can still move down', () => {
    const { container } = switching({ currentStepId: 'growth', currentPlanLines: ['Growth partner · $100.00/month'] })
    const r = row(container, 'growth')
    expect(r.tagName).toBe('LABEL')
    expect(within(r).getByTestId('current-step')).toBeInTheDocument()
    expect((within(r).getByRole('radio') as HTMLInputElement).disabled).toBe(false)
    expect(within(row(container, 'leads')).queryByRole('radio')).toBeNull()
    expect(screen.queryByTestId('coming-soon-toggle')).toBeNull()
    pickStep(container, 'priority')
    expect(screen.getByRole('button', { name: 'Switch to Priority on November 3, 2026' })).toBeEnabled()
  })

  it('pending downgrade: the amber box with Keep <current> on top, Starts badge on the target, no Manage billing', async () => {
    const { container, onChangePlan } = switching({
      currentStepId: 'fast_lane',
      currentPlanLines: ['Fast lane · $65.00/month'],
      pendingChange: { stepId: 'starter', date: 'November 3, 2026' },
    })
    const box = screen.getByTestId('pending-change')
    expect(box).toHaveTextContent('Changing to Starter on November 3, 2026. You keep your current plan until then.')
    for (const c of ['rounded-xl', 'border-amber-200', 'bg-amber-50', 'text-amber-950']) expect(box.classList.contains(c)).toBe(true)
    expect(screen.getByTestId('plan-strip').contains(box)).toBe(true)
    expect(box.compareDocumentPosition(row(container, 'starter')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(row(container, 'starter')).getByTestId('starts-badge')).toHaveTextContent('Starts November 3, 2026')
    expect(screen.queryByRole('button', { name: 'Manage billing' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Choose a different plan to switch' })).toBeDisabled()
    fireEvent.click(within(box).getByRole('button', { name: 'Keep Fast lane' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('fast_lane'))
  })
})

describe('upgrade confirm states (Lina §3a, Aria 1:34 PM)', () => {
  it('loading shows "Checking the amount…" with a spinner and never an amount; then the confirm line, focus on Confirm', async () => {
    let resolve!: (v: PlanPreviewResponse) => void
    const { container, onChangePlan } = switching({ onPreviewChange: vi.fn(() => new Promise<PlanPreviewResponse>((r) => (resolve = r))) })
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    const calc = screen.getByTestId('upgrade-calculating')
    expect(within(calc).getByRole('button')).toBeDisabled()
    expect(within(calc).getByRole('button')).toHaveTextContent(UPGRADE_CALCULATING)
    expect(calc.querySelector('.animate-spin')).not.toBeNull()
    expect(within(calc).getByRole('button')).not.toHaveTextContent('$')
    expect(screen.getByTestId('switch-area')).not.toHaveTextContent(/today/)
    expect(screen.getByTestId('confirm-live')).toHaveTextContent(UPGRADE_CALCULATING)
    expect(onChangePlan).not.toHaveBeenCalled()
    await act(async () => resolve({ ok: true, prorationDate: 1_790_000_000, amountDueCents: 1953, nextAmountCents: 6500, nextDate: 'November 3, 2026' }))
    const line = "Switch to Fast lane now? We'll charge $19.53 today, then $65/month starting November 3, 2026."
    const confirm = screen.getByTestId('upgrade-confirm')
    expect(confirm).toHaveTextContent(line)
    const live = screen.getByTestId('confirm-live')
    expect(live).toHaveAttribute('role', 'status')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent(line)
    const confirmBtn = within(confirm).getByRole('button', { name: 'Confirm' })
    expect(confirmBtn.className).toMatch(/w-full/)
    expect(document.activeElement).toBe(confirmBtn)
    // Confirm sits first, Cancel under it; the whole thing is in the sticky bar on phones
    const cancelBtn = within(confirm).getByRole('button', { name: 'Not now' })
    expect(confirmBtn.compareDocumentPosition(cancelBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByTestId('switch-area').className).toMatch(/sticky bottom-0/)
    expect(onChangePlan).not.toHaveBeenCalled()
  })

  it('Confirm sends the previewed proration date; the result shows and the button comes back', async () => {
    const { container, onChangePlan } = switching()
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('fast_lane', 1_790_000_000))
    expect(await screen.findByText('done')).toBeInTheDocument()
    expect(screen.queryByTestId('upgrade-confirm')).toBeNull()
    expect(onChangePlan).toHaveBeenCalledTimes(1)
  })

  it("preview failed: the same layout with \"We'll charge the difference for the rest of this billing period today\", Confirm still sends the server's date", async () => {
    const { container, onChangePlan } = switching({ onPreviewChange: vi.fn(async (): Promise<PlanPreviewResponse> => ({ ok: false, reason: 'preview_failed', prorationDate: 1_790_000_123 })) })
    pickStep(container, 'priority')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Priority now' }))
    const confirm = await screen.findByTestId('upgrade-confirm')
    expect(confirm).toHaveTextContent("Switch to Priority now? We'll charge the difference for the rest of this billing period today.")
    expect(confirm).not.toHaveTextContent('$')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('priority', 1_790_000_123))
  })

  it('a network error during the preview also falls back (no date: the server charges at Confirm time)', async () => {
    const { container, onChangePlan } = switching({ onPreviewChange: vi.fn(async () => Promise.reject(new Error('offline'))) })
    pickStep(container, 'priority')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Priority now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('priority', undefined))
  })

  it('Cancel and Esc close it and return focus to the switch button; nothing is charged', async () => {
    const { container, onChangePlan } = switching()
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    const again = await screen.findByRole('button', { name: 'Switch to Fast lane now' })
    await waitFor(() => expect(document.activeElement).toBe(again))
    fireEvent.click(again)
    await screen.findByRole('button', { name: 'Confirm' })
    fireEvent.keyDown(document, { key: 'Escape' })
    // generous timeouts: this flaked once under a loaded box (Arkitect run, Oct 3 4:07 PM)
    const third = await screen.findByRole('button', { name: 'Switch to Fast lane now' }, { timeout: 5000 })
    await waitFor(() => expect(document.activeElement).toBe(third), { timeout: 5000 })
    expect(screen.queryByTestId('confirm-expired')).toBeNull()
    expect(onChangePlan).not.toHaveBeenCalled()
  }, 20_000) // the whole test needs room too: under a parallel full run it hit vitest's 5 s default (Oct 3 4:2x PM)

  it('expiry: after CONFIRM_OPEN_MS the confirm closes to the button with one grey line; a tap previews again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { container, onPreviewChange, onChangePlan } = switching()
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    await screen.findByRole('button', { name: 'Confirm' })
    expect(CONFIRM_OPEN_MS).toBeLessThan(600_000)
    await act(async () => {
      vi.advanceTimersByTime(CONFIRM_OPEN_MS + 1)
    })
    expect(screen.queryByTestId('upgrade-confirm')).toBeNull()
    expect(screen.getByTestId('confirm-expired')).toHaveTextContent(UPGRADE_PREVIEW_EXPIRED)
    expect(screen.getByTestId('confirm-expired').className).toMatch(/text-gray-500/)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    await screen.findByRole('button', { name: 'Confirm' })
    expect(onPreviewChange).toHaveBeenCalledTimes(2)
    expect(onChangePlan).not.toHaveBeenCalled()
  })

  it('the server refusing a stale amount closes the confirm the same way (grey line, no error)', async () => {
    const { container, onChangePlan } = switching()
    onChangePlan.mockResolvedValueOnce({ ok: false, message: UPGRADE_PREVIEW_EXPIRED, code: 'stale_preview' })
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(await screen.findByTestId('confirm-expired')).toHaveTextContent(UPGRADE_PREVIEW_EXPIRED)
    expect(screen.getByRole('button', { name: 'Switch to Fast lane now' })).toBeEnabled()
  })

  it('picking another step while the confirm is open closes it (the amount was for the old pick)', async () => {
    const { container } = switching()
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    await screen.findByRole('button', { name: 'Confirm' })
    pickStep(container, 'priority')
    expect(screen.queryByTestId('upgrade-confirm')).toBeNull()
    expect(screen.getByRole('button', { name: 'Switch to Priority now' })).toBeEnabled()
  })
})

// ------------------------------------------------------------------ the tipping system (Oct 3)

describe('the tipping system: slider before checkout and in the claim flow', () => {
  const slider = () => screen.getByRole('slider', { name: TIP_SLIDER_LABEL }) as HTMLInputElement

  it('a labelled range input from the step price (no tip) to the range max, aria-valuetext in dollars, $1 steps, readable total', () => {
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'fast_lane')
    const r = slider()
    expect(r).toHaveAttribute('min', '65')
    expect(r).toHaveAttribute('max', '74')
    expect(r).toHaveAttribute('step', '1')
    expect(r.value).toBe('65')
    expect(r).toHaveAttribute('aria-valuetext', '$65 a month, no tip')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('$65/month, no tip')
    fireEvent.change(r, { target: { value: '70' } })
    expect(r).toHaveAttribute('aria-valuetext', '$70 a month, including a $5 tip')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('$65 + $5 tip = $70/month')
  })

  it('checkout passes the tip dollars (quantity) with the step; a new pick resets the slider to the step price', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'stop' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'starter')
    fireEvent.change(slider(), { target: { value: '42' } })
    pickStep(container, 'priority')
    expect(slider().value).toBe('55')
    fireEvent.change(slider(), { target: { value: '58' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ planStep: 'priority', tipDollars: 3 })
  })

  it('claim step 3: the chosen tip goes to the claim (stored with the plan; charged at publish)', async () => {
    const onChoosePlan = vi.fn(async () => null)
    const { container } = render(<HostingCheckoutCard bare stickyOnPhone onChoosePlan={onChoosePlan} chooseLabelFor={(n) => `Choose ${n}`} />)
    pickStep(container, 'fast_lane')
    fireEvent.change(slider(), { target: { value: '72' } })
    expect(screen.getByTestId('sticky-summary')).toHaveTextContent('Fast lane · $65 + $7 tip = $72/month')
    fireEvent.click(screen.getByRole('button', { name: 'Choose Fast lane' }))
    await waitFor(() => expect(onChoosePlan).toHaveBeenCalledWith({ planStep: 'fast_lane', tipDollars: 7 }))
  })

  it('Aria 3:43 PM E: claim customers get the same tip box on our page before checkout, starting at $0 (untouched = no tip)', async () => {
    const onChoosePlan = vi.fn(async () => null)
    const { container } = render(<HostingCheckoutCard bare stickyOnPhone onChoosePlan={onChoosePlan} chooseLabelFor={(n) => `Choose ${n}`} />)
    pickStep(container, 'priority')
    expect(slider()).toHaveAttribute('aria-valuetext', '$55 a month, no tip')
    expect(screen.getByTestId('tip-ends').textContent).toBe('No tip$9 tip')
    expect(screen.getByRole('button', { name: 'Lower tip by $1' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Choose Priority' }))
    await waitFor(() => expect(onChoosePlan).toHaveBeenCalledWith({ planStep: 'priority', tipDollars: 0 }))
  })

  it('nudge: within $5 of the next sellable step it offers the switch; the button picks that step (tip reset)', () => {
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'starter')
    fireEvent.change(slider(), { target: { value: '49' } })
    expect(screen.queryByTestId('tip-nudge')).toBeNull()
    fireEvent.change(slider(), { target: { value: '50' } })
    expect(screen.getByTestId('tip-nudge')).toHaveTextContent('Priority is $55 a month and adds a place ahead of lower plans when you ask for changes. Want that instead? Keeping your tip is fine too.')
    fireEvent.click(screen.getByRole('button', { name: 'Choose Priority' }))
    expect(row(container, 'priority')).toHaveAttribute('data-selected', 'true')
    expect(slider().value).toBe('55')
    // Fast lane's next step (Leads) is not sold: no nudge
    pickStep(container, 'fast_lane')
    fireEvent.change(slider(), { target: { value: '74' } })
    expect(screen.queryByTestId('tip-nudge')).toBeNull()
  })

  it('Lina round 5b: hint between the total and the bar; end labels are tip amounts ("No tip" / "$<max> tip") in every state', () => {
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'starter')
    const area = screen.getByTestId('tip-slider')
    const hint = within(area).getByTestId('tip-hint')
    expect(hint).toHaveTextContent(TIP_SLIDER_HINT)
    expect(hint).toHaveTextContent("Pick a tip if you'd like, or leave it at No tip.")
    // DOM order: total line, hint, bar
    const total = within(area).getByTestId('tip-total')
    expect(total.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hint.compareDocumentPosition(slider()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slider().getAttribute('aria-describedby')).toContain(hint.id)
    const ends = () => within(screen.getByTestId('tip-slider')).getByTestId('tip-ends')
    expect(ends().textContent).toBe('No tip$19 tip') // Starter $35: tips 0..19, never "$35"/"$54"
    // nudge state (Starter $50 total): still tip amounts
    fireEvent.change(slider(), { target: { value: '50' } })
    expect(screen.getByTestId('tip-nudge')).toBeInTheDocument()
    expect(ends().textContent).toBe('No tip$19 tip')
    expect(ends()).not.toHaveTextContent(/\$(35|50|54)\b/)
    pickStep(container, 'priority')
    expect(ends().textContent).toBe('No tip$9 tip')
    pickStep(container, 'fast_lane')
    expect(ends().textContent).toBe('No tip$9 tip')
  })

  it('Lina round 5b: − / + buttons beside the bar change the tip by $1, clamp, disable at their end, 44×44, aria-labels', () => {
    const { container } = render(<HostingCheckoutCard />)
    pickStep(container, 'priority')
    const minus = screen.getByRole('button', { name: 'Lower tip by $1' })
    const plus = screen.getByRole('button', { name: 'Raise tip by $1' })
    for (const b of [minus, plus]) expect(b.className).toMatch(/\bh-11\b.*\bw-11\b|\bw-11\b.*\bh-11\b/)
    expect(minus).toBeDisabled() // no tip yet
    fireEvent.click(plus)
    expect(slider().value).toBe('56')
    expect(slider()).toHaveAttribute('aria-valuetext', '$56 a month, including a $1 tip')
    expect(minus).toBeEnabled()
    fireEvent.click(minus)
    expect(slider().value).toBe('55')
    expect(slider()).toHaveAttribute('aria-valuetext', '$55 a month, no tip')
    fireEvent.change(slider(), { target: { value: '63' } })
    fireEvent.click(plus)
    expect(slider().value).toBe('64') // the $9 max
    expect(plus).toBeDisabled()
    fireEvent.click(plus)
    expect(slider().value).toBe('64')
    // bar layout: − range + in one row
    const rowEl = slider().parentElement!
    expect(rowEl.firstElementChild).toBe(minus)
    expect(rowEl.lastElementChild).toBe(plus)
    expect(slider().className).toContain('accent-[#ba3d3d]')
  })

  it('claim step 3 (bare): the same slider with hint, tip end labels and ± buttons', () => {
    const { container } = render(<HostingCheckoutCard bare stickyOnPhone onChoosePlan={vi.fn(async () => null)} chooseLabelFor={(n) => `Choose ${n}`} />)
    pickStep(container, 'starter')
    expect(screen.getByTestId('tip-hint')).toHaveTextContent(TIP_SLIDER_HINT)
    expect(screen.getByTestId('tip-ends').textContent).toBe('No tip$19 tip')
    fireEvent.click(screen.getByRole('button', { name: 'Raise tip by $1' }))
    expect(screen.getByTestId('sticky-summary')).toHaveTextContent('Starter · $35 + $1 tip = $36/month')
  })

  it('with a live plan there is no checkout slider (the tip box handles tips)', () => {
    const { container } = switching()
    expect(screen.queryByTestId('tip-area')).toBeNull()
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(0) // no tip box without its actions
  })
})

describe("the tipping system: Sable's confirm lines (Oct 3 2:20 PM)", () => {
  const preview = (amountDueCents: number) => vi.fn(async (): Promise<PlanPreviewResponse> => ({ ok: true, prorationDate: 1_790_000_000, amountDueCents, nextAmountCents: 6500, nextDate: 'November 3, 2026' }))

  it('exactly $0.00 today: the zero line; a partial credit keeps the normal line with the real amount', async () => {
    const zero = switching({ onPreviewChange: preview(0) })
    pickStep(zero.container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    expect(await screen.findByTestId('upgrade-confirm')).toHaveTextContent(UPGRADE_CONFIRM_ZERO('Fast lane', '$65', 'November 3, 2026'))
    zero.unmount()
    const partial = switching({ onPreviewChange: preview(1) })
    pickStep(partial.container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    expect(await screen.findByTestId('upgrade-confirm')).toHaveTextContent(UPGRADE_CONFIRM_LINE('Fast lane', '$0.01', '$65', 'November 3, 2026'))
    expect(screen.queryByTestId('upgrade-confirm-extra')).toBeNull()
  })

  it('under the upgrade confirm: "replaces your planned switch" only with a pending downgrade, and the tip line only with a tip', async () => {
    const { container } = switching({
      currentStepId: 'priority',
      currentPlanLines: ['Priority · $55/month + $4 tip'],
      pendingChange: { stepId: 'starter', date: 'November 3, 2026' },
      currentTipDollars: 4,
    })
    pickStep(container, 'fast_lane')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Fast lane now' }))
    const extra = await screen.findByTestId('upgrade-confirm-extra')
    expect(extra).toHaveTextContent(UPGRADE_REPLACES_PENDING('Starter'))
    expect(extra).toHaveTextContent(PLAN_CHANGE_TIP_ENDS('$4'))
    // read out with the confirm line
    expect(screen.getByTestId('confirm-live')).toHaveTextContent(PLAN_CHANGE_TIP_ENDS('$4'))
  })

  it('downgrade (no confirm): the tip line sits under the downgrade button, and in the pending box once planned', () => {
    const { container, unmount } = switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month + $6 tip'], currentTipDollars: 6 })
    pickStep(container, 'priority')
    expect(screen.getByTestId('switch-help-tip')).toHaveTextContent(PLAN_CHANGE_TIP_ENDS_ON('$6', 'November 3, 2026'))
    pickStep(container, 'starter')
    expect(screen.getByTestId('switch-help-tip')).toBeInTheDocument()
    unmount()
    switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month + $6 tip'], currentTipDollars: 6, pendingChange: { stepId: 'priority', date: 'November 3, 2026' } })
    expect(screen.getByTestId('pending-tip-ends')).toHaveTextContent(PLAN_CHANGE_TIP_ENDS_ON('$6', 'November 3, 2026'))
  })

  it('no tip: no tip lines anywhere', () => {
    const { container } = switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month'], pendingChange: { stepId: 'priority', date: 'November 3, 2026' } })
    pickStep(container, 'starter')
    expect(screen.queryByTestId('switch-help-tip')).toBeNull()
    expect(screen.queryByTestId('pending-tip-ends')).toBeNull()
  })
})

describe('the tipping system: tip box on the Plans page (next bill, no modal)', () => {
  let previews = 0
  const tipActions = () => ({
    onPreviewTip: vi.fn(async (t: number) => ({ ok: true as const, tipDollars: t, nextAmountCents: 6500 + t * 100, nextDate: 'November 3, 2026', confirmId: `confirm-${++previews}` })),
    onChangeTip: vi.fn(async () => ({ ok: true, message: 'server' })),
  })

  it('Update tip -> "Your next bill will be $X on <date>." -> Confirm -> "Your tip is updated. …" (nothing charged today)', async () => {
    const a = tipActions()
    switching({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month + $2 tip'], currentTipDollars: 2, ...a })
    const box = screen.getByTestId('tip-change-box')
    const r = within(box).getByRole('slider') as HTMLInputElement
    expect(r.value).toBe('67')
    expect(within(box).getByTestId('tip-change-button')).toBeDisabled() // unchanged
    expect(box).toHaveTextContent(TIP_CHANGE_NOTE)
    expect(box).toHaveTextContent('To stop your tip, set it to No tip.')
    expect(within(box).getByTestId('tip-hint')).toHaveTextContent(TIP_SLIDER_HINT)
    expect(within(box).getByTestId('tip-ends').textContent).toBe('No tip$9 tip')
    fireEvent.change(r, { target: { value: '71' } })
    fireEvent.click(within(box).getByTestId('tip-change-button'))
    expect(await within(box).findByTestId('tip-change-confirm')).toHaveTextContent('Your next bill will be $71 on November 3, 2026.')
    expect(a.onPreviewTip).toHaveBeenCalledWith(6)
    fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(a.onChangeTip).toHaveBeenCalledWith(6, expect.stringMatching(/^confirm-\d+$/)))
    expect(await within(box).findByTestId('tip-change-notice')).toHaveTextContent('Your tip is updated. Your next bill will be $71 on November 3, 2026.')
  })

  it('Vera B2: every Confirm sends the confirm id of ITS preview (one Stripe key per Confirm), so A -> B -> A gets new ids', async () => {
    const a = tipActions()
    switching({ currentStepId: 'fast_lane', currentPlanLines: ['x'], currentTipDollars: 2, ...a })
    const box = screen.getByTestId('tip-change-box')
    const r = within(box).getByRole('slider') as HTMLInputElement
    for (const total of [71, 69, 71]) {
      fireEvent.change(r, { target: { value: String(total) } })
      fireEvent.click(within(box).getByTestId('tip-change-button'))
      await within(box).findByTestId('tip-change-confirm')
      fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(within(box).queryByTestId('tip-change-confirm')).toBeNull())
    }
    const ids = a.onChangeTip.mock.calls.map((c) => (c as unknown[])[1])
    expect(a.onChangeTip.mock.calls.map((c) => (c as unknown[])[0])).toEqual([6, 4, 6])
    expect(new Set(ids).size).toBe(3)
  })

  it('a planned switch locks the tip (Lina round 5b: no bar, one read-only row + the ends-on note); a grandfathered plan gets no tip box', () => {
    const a = tipActions()
    const { unmount } = switching({ currentStepId: 'fast_lane', currentPlanLines: ['x'], currentTipDollars: 2, pendingChange: { stepId: 'priority', date: 'November 3, 2026' }, ...a })
    const box = screen.getByTestId('tip-change-box')
    expect(within(box).queryByRole('slider')).toBeNull()
    expect(within(box).queryByTestId('tip-ends')).toBeNull()
    expect(within(box).queryByRole('button', { name: /tip by \$1/ })).toBeNull()
    expect(within(box).getByTestId('tip-locked-amount')).toHaveTextContent('$2 tip a month')
    expect(within(box).getByTestId('tip-locked').querySelector('svg')).not.toBeNull() // the Lock icon
    expect(within(box).getByTestId('tip-locked-note')).toHaveTextContent(TIP_LOCKED_NOTE('November 3, 2026'))
    expect(within(box).getByTestId('tip-locked-note')).toHaveTextContent(
      'Your tip ends on November 3, 2026, when your planned switch starts. You can choose a new tip after that.'
    )
    expect(within(box).queryByTestId('tip-change-button')).toBeNull()
    // the amber box above keeps its tip-ends line
    expect(screen.getByTestId('pending-tip-ends')).toHaveTextContent(PLAN_CHANGE_TIP_ENDS_ON('$2', 'November 3, 2026'))
    unmount()
    // no tip while locked: "No tip" and Sable's pending line (nothing ends)
    const u2 = switching({ currentStepId: 'fast_lane', currentPlanLines: ['x'], currentTipDollars: 0, pendingChange: { stepId: 'priority', date: 'November 3, 2026' }, ...a })
    expect(screen.getByTestId('tip-locked-amount')).toHaveTextContent('No tip')
    expect(screen.getByTestId('tip-locked-note')).toHaveTextContent(TIP_CHANGE_PENDING)
    u2.unmount()
    switching({ currentStepId: null, currentMonthlyCents: 5500, currentPlanLines: ['Website hosting + Pro add-on · $55.00/month'], ...a })
    expect(screen.queryByTestId('tip-change-box')).toBeNull()
  })

  it('Aria 3:43 PM D: a grandfathered (legacy) plan gets no tip slider until it moves to a ladder step; then the tip box appears at $0', () => {
    const a = tipActions()
    const legacy = switching({ currentStepId: null, currentMonthlyCents: 5000, currentPlanLines: ['Website hosting + Pro add-on · $50.00/month'], ...a })
    expect(screen.queryByTestId('tip-change-box')).toBeNull()
    expect(screen.queryByTestId('tip-area')).toBeNull()
    expect(legacy.container.querySelectorAll('input[type="range"]')).toHaveLength(0)
    legacy.unmount()
    // after "Switch to Priority" lands (the webhook writes the step), the tip box is there, starting at no tip
    switching({ currentStepId: 'priority', currentMonthlyCents: 5500, currentPlanLines: ['Freeplug Hosting: Priority · $55.00/month'], currentTipDollars: 0, ...a })
    const box = screen.getByTestId('tip-change-box')
    expect(within(box).getByRole('slider')).toHaveAttribute('aria-valuetext', '$55 a month, no tip')
  })
})
