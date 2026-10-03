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
  it('six steps from ladder.ts: name and price apart, perks once, no blurbs, no Most popular, no slider or add-ons', () => {
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
    expect(container.querySelector('input[type="range"]')).toBeNull()
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
    expect(JSON.parse(init.body as string)).toEqual({ planStep: 'priority' })
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
    await waitFor(() => expect(onChoosePlan).toHaveBeenCalledWith({ planStep: 'priority' }))
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
    const third = await screen.findByRole('button', { name: 'Switch to Fast lane now' })
    await waitFor(() => expect(document.activeElement).toBe(third))
    expect(screen.queryByTestId('confirm-expired')).toBeNull()
    expect(onChangePlan).not.toHaveBeenCalled()
  })

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
