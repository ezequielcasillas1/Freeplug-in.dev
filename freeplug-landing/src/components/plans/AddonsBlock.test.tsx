import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { HostingCheckoutCard } from './HostingCheckoutCard'
import { AddonsBlock } from './AddonsBlock'
import { ADDONS, type AddonId, type PlanStepId } from '@/lib/plans/ladder'
import type { AddonPreviewResponse, ChangeAddonResponse, PlanPreviewResponse } from '@/app/(dashboard)/dashboard/billing-actions'
import { addonChargeNote, addonPerkLine, BIG_CHANGE_BIGGER_NOTE, TIP_SLIDER_LABEL } from '@/lib/plans/ladder-copy'

afterEach(() => {
  vi.unstubAllGlobals()
})

const row = (c: HTMLElement, id: PlanStepId) => c.querySelector(`[data-plan-step="${id}"]`) as HTMLElement
const pickStep = (c: HTMLElement, id: PlanStepId) => fireEvent.click(within(row(c, id)).getByRole('radio'))
const sw = (id: AddonId) => screen.getByTestId(`addon-switch-${id}`)
const slider = () => screen.getByRole('slider', { name: TIP_SLIDER_LABEL }) as HTMLInputElement
const breakdown = () => screen.getByTestId('plan-total-breakdown').textContent
const total = () => screen.getByTestId('plan-total-amount').textContent

describe('add-ons block, new checkout (Lina approved + Aria updates, Oct 4)', () => {
  it('three cards under the step list and before the tip: two switches, Visitor snapshot Coming soon (no switch)', () => {
    const { container } = render(<HostingCheckoutCard />)
    const block = screen.getByTestId('addons-block')
    expect(within(block).getAllByRole('switch')).toHaveLength(2)
    expect(sw('small_edit')).toHaveAttribute('aria-checked', 'false')
    expect(sw('big_change')).toHaveTextContent('$5.75/month')
    const soon = screen.getByTestId('addon-coming-soon')
    expect(soon).toHaveTextContent('Visitor snapshot')
    expect(soon).toHaveTextContent('Coming soon')
    expect(within(soon).queryByRole('switch')).toBeNull()
    expect(block).not.toHaveTextContent(/Quote alert/i)
    // order: step list (fieldset) -> add-ons -> tip
    const fieldset = container.querySelector('fieldset')!
    expect(fieldset.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(block.compareDocumentPosition(screen.getByTestId('tip-area')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // whole card is the tap target (>= 44px)
    expect(sw('small_edit').className).toMatch(/min-h-\[44px\]/)
  })

  it('cap note only while Starter is selected; the block stays on every step', () => {
    const { container } = render(<HostingCheckoutCard />)
    expect(screen.getByTestId('addons-cap-note')).toHaveTextContent('up to $15/month on Starter')
    pickStep(container, 'priority')
    expect(screen.getByTestId('addons-block')).toBeInTheDocument()
    expect(screen.queryByTestId('addons-cap-note')).toBeNull()
    pickStep(container, 'fast_lane')
    expect(screen.queryByTestId('addons-cap-note')).toBeNull()
  })

  it("Sable's lines: perk (plain on Starter/Priority, 'one more' on Fast lane), Big change gray line; no charge note at checkout", () => {
    const { container } = render(<HostingCheckoutCard />)
    expect(sw('small_edit')).toHaveTextContent(addonPerkLine('small_edit'))
    expect(sw('big_change')).toHaveTextContent(BIG_CHANGE_BIGGER_NOTE)
    expect(screen.queryByTestId('addon-charge-note')).toBeNull()
    pickStep(container, 'priority')
    expect(sw('small_edit')).toHaveTextContent(addonPerkLine('small_edit'))
    pickStep(container, 'fast_lane')
    expect(sw('small_edit')).toHaveTextContent("One more small edit on top of the one your plan includes. Unused edits don't roll over.")
  })

  it('on = brand border + tint; one total in the action area; the tip card shows only the tip', () => {
    render(<HostingCheckoutCard />)
    expect(breakdown()).toBe('Starter $35')
    expect(total()).toBe('$35/month')
    fireEvent.click(sw('small_edit'))
    expect(sw('small_edit')).toHaveAttribute('aria-checked', 'true')
    expect(sw('small_edit').className).toMatch(/border-\[#ba3d3d\]/)
    expect(breakdown()).toBe('Starter $35 · Add-ons $5')
    fireEvent.click(sw('big_change'))
    expect(breakdown()).toBe('Starter $35 · Add-ons $10.75')
    expect(total()).toBe('$45.75/month')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('No tip')
    fireEvent.change(slider(), { target: { value: String(35 + 4) } })
    expect(breakdown()).toBe('Starter $35 · Add-ons $10.75 · Tip $4')
    expect(total()).toBe('$49.75/month')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('$4 tip')
    expect(screen.getAllByTestId('plan-total')).toHaveLength(1)
  })

  it('Starter tip max = floor($54 - $35 - add-ons): $19, $14, $13, $8', () => {
    render(<HostingCheckoutCard />)
    expect(slider().max).toBe(String(35 + 19))
    fireEvent.click(sw('small_edit'))
    expect(slider().max).toBe(String(35 + 14))
    fireEvent.click(sw('small_edit'))
    fireEvent.click(sw('big_change'))
    expect(slider().max).toBe(String(35 + 13))
    fireEvent.click(sw('small_edit'))
    expect(slider().max).toBe(String(35 + 8))
  })

  it('never lowers a tip silently: inline confirm under the card, switch not flipped, focus on Turn on, Esc cancels', () => {
    render(<HostingCheckoutCard />)
    fireEvent.change(slider(), { target: { value: String(35 + 19) } })
    fireEvent.click(sw('small_edit'))
    const box = screen.getByTestId('addon-confirm')
    expect(box).toHaveAttribute('data-addon', 'small_edit')
    expect(box).toHaveTextContent('Your tip goes down to $14. Turn on +1 small edit?')
    expect(sw('small_edit')).toHaveAttribute('aria-checked', 'false')
    expect(document.activeElement).toBe(screen.getByTestId('addon-confirm-button'))
    expect(screen.getByTestId('addon-confirm-button')).toHaveTextContent('Turn on')
    expect(screen.getByTestId('addon-confirm-button').className).toMatch(/min-h-\[44px\]/)
    expect(screen.getByTestId('addon-cancel').className).toMatch(/min-h-\[44px\]/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('addon-confirm')).toBeNull()
    expect(sw('small_edit')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('$19 tip')
  })

  it('Turn on lowers the tip to the new max and flips the switch; Cancel leaves both alone', () => {
    render(<HostingCheckoutCard />)
    fireEvent.change(slider(), { target: { value: String(35 + 19) } })
    fireEvent.click(sw('big_change'))
    fireEvent.click(screen.getByTestId('addon-cancel'))
    expect(sw('big_change')).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw('big_change'))
    expect(screen.getByTestId('addon-confirm')).toHaveTextContent('Your tip goes down to $13. Turn on Big change?')
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    expect(sw('big_change')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('tip-total')).toHaveTextContent('$13 tip')
    expect(total()).toBe('$53.75/month')
  })

  it('a tip that still fits: no confirm', () => {
    render(<HostingCheckoutCard />)
    fireEvent.change(slider(), { target: { value: String(35 + 8) } })
    fireEvent.click(sw('small_edit'))
    fireEvent.click(sw('big_change'))
    expect(screen.queryByTestId('addon-confirm')).toBeNull()
    expect(total()).toBe('$53.75/month')
  })

  it('checkout sends the picks with the plan and tip (only when there are some)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'stop' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<HostingCheckoutCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ planStep: 'starter', tipDollars: 0 })
    fireEvent.click(sw('big_change'))
    fireEvent.click(sw('small_edit'))
    fireEvent.change(slider(), { target: { value: String(35 + 2) } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({ planStep: 'starter', tipDollars: 2, addons: ['big_change', 'small_edit'] })
  })

  it('the claim flow (choose plan) never shows add-ons', () => {
    render(<HostingCheckoutCard bare onChoosePlan={async () => null} chooseLabel="Choose" />)
    expect(screen.queryByTestId('addons-block')).toBeNull()
  })
})

// ------------------------------------------------------------------ live plan
type PreviewFn = (id: AddonId, action: 'on' | 'off') => Promise<AddonPreviewResponse>
type ChangeFn = (id: AddonId, action: 'on' | 'off' | 'keep', opts?: { prorationDate?: number; tipDropTo?: number }) => Promise<ChangeAddonResponse>
function live(over: Partial<React.ComponentProps<typeof AddonsBlock> & { mode: 'live' }> = {}, preview?: PreviewFn) {
  const onPreview = vi.fn<PreviewFn>(
    preview ??
      (async (_id, action) =>
        action === 'on'
          ? { ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 575, fullCents: 575, nextAmountCents: 6075, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0 }
          : { ok: true, action: 'off', endDate: 'November 3, 2026', nextAmountCents: 5500, nextDate: 'November 3, 2026' })
  )
  const onChange = vi.fn<ChangeFn>(async () => ({ ok: true, message: 'Add-on is on.' }))
  const utils = render(<AddonsBlock mode="live" stepId="priority" current={[]} ending={[]} endDate={null} onPreview={onPreview} onChange={onChange} {...over} />)
  return { ...utils, onPreview, onChange }
}

describe('add-ons block, live plan', () => {
  it("Sable's charge note: a gray line under the perk line on each live add-on card, prices from ADDONS; none on Coming soon", () => {
    live()
    for (const a of ADDONS) {
      const card = sw(a.id)
      const perk = within(card).getByTestId('addon-perk')
      const note = within(card).getByTestId('addon-charge-note')
      expect(note).toHaveTextContent(addonChargeNote(a.monthlyCents))
      expect(note.className).toMatch(/text-gray-500/)
      expect(perk.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(sw('small_edit')).toHaveTextContent('Turning it on charges $5 today for this billing period, then $5 each month. Any account credit is used first. If you turn it off, it stays on until the period ends.')
    expect(sw('big_change')).toHaveTextContent('Turning it on charges $5.75 today for this billing period, then $5.75 each month. Any account credit is used first. If you turn it off, it stays on until the period ends.')
    expect(within(screen.getByTestId('addon-coming-soon')).queryByTestId('addon-charge-note')).toBeNull()
  })

  it('turn on: the real amount today (Sable 9:05), then the server change with the preview time', async () => {
    const { onChange } = live()
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    expect(box).toHaveTextContent('Turn on Big change?')
    expect(box).toHaveTextContent("We'll charge $5.75 today for this billing period.")
    expect(box).toHaveTextContent('Then $60.75/month starting November 3, 2026.')
    expect(document.activeElement).toBe(screen.getByTestId('addon-confirm-button'))
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('big_change', 'on', { prorationDate: 1_790_000_000, tipDropTo: undefined }))
    expect(await screen.findByTestId('addons-notice')).toHaveTextContent('Add-on is on.')
  })

  it('turn on with a Starter tip drop: asks first and sends the confirmed tip', async () => {
    const { onChange } = live({ stepId: 'starter' }, async () => ({
      ok: true,
      action: 'on',
      prorationDate: 1_790_000_000,
      amountDueCents: 500,
      fullCents: 500,
      nextAmountCents: 5400,
      nextDate: 'November 3, 2026',
      tipDollarsNow: 19,
      tipDollarsAfter: 14,
    }))
    fireEvent.click(sw('small_edit'))
    expect(await screen.findByTestId('addon-confirm')).toHaveTextContent('Your tip goes down to $14 starting November 3, 2026. Turn on +1 small edit?')
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('small_edit', 'on', { prorationDate: 1_790_000_000, tipDropTo: 14 }))
  })

  it('the server says the tip must drop (changed since the preview): asks again with its number, never silent', async () => {
    const { onChange } = live({ stepId: 'starter' })
    onChange.mockResolvedValueOnce({ ok: false, message: 'x', code: 'tip_drop_needed', tipDollars: 8 })
    fireEvent.click(sw('big_change'))
    fireEvent.click(await screen.findByTestId('addon-confirm-button'))
    expect(await screen.findByText('Your tip goes down to $8 starting November 3, 2026. Turn on Big change?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('big_change', 'on', { prorationDate: 1_790_000_000, tipDropTo: 8 }))
  })

  it('turn off: at period end, confirmed first', async () => {
    const { onChange } = live({ current: ['small_edit'] })
    expect(sw('small_edit')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw('small_edit'))
    expect(await screen.findByTestId('addon-confirm')).toHaveTextContent('Turn off +1 small edit? It stays on until November 3, 2026, then it ends.')
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('small_edit', 'off', { prorationDate: undefined, tipDropTo: undefined }))
  })

  it('an add-on set to end: "Ends <date> · Keep it"; other off cards wait, on cards can still be turned off', async () => {
    const { onChange } = live({ current: ['small_edit', 'big_change'], ending: ['big_change'], endDate: 'November 3, 2026' })
    expect(screen.getByTestId('addon-ending')).toHaveTextContent('Ends November 3, 2026')
    expect(screen.queryByTestId('addon-switch-big_change')).toBeNull()
    expect(sw('small_edit')).not.toBeDisabled()
    expect(screen.getByTestId('addons-lock-note')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('addon-keep-big_change'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('big_change', 'keep'))
  })

  it('a removal pending: an off card is disabled', () => {
    live({ current: ['small_edit'], ending: ['small_edit'], endDate: 'November 3, 2026' })
    expect(sw('big_change')).toBeDisabled()
  })

  it('a step switch planned: every switch waits, with the note', () => {
    live({ current: ['small_edit'], lockedBySwitch: true, lockedBySwitchDate: 'November 3, 2026' })
    expect(sw('small_edit')).toBeDisabled()
    expect(sw('big_change')).toBeDisabled()
    expect(screen.getByTestId('addons-lock-note')).toHaveTextContent('You can change add-ons after your switch on November 3, 2026.')
  })

  it('grandfathered plan: the note only', () => {
    live({ legacy: true })
    expect(screen.getByTestId('addons-legacy')).toBeInTheDocument()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('Esc while checking drops the late preview (no confirm, no focus move)', async () => {
    let resolve!: (v: AddonPreviewResponse) => void
    live({}, () => new Promise<AddonPreviewResponse>((r) => (resolve = r)))
    fireEvent.click(sw('small_edit'))
    expect(screen.getByTestId('addon-calculating')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => resolve({ ok: true, action: 'on', prorationDate: 1, amountDueCents: 500, fullCents: 500, nextAmountCents: 1, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    expect(screen.queryByTestId('addon-confirm')).toBeNull()
  })

  it('account credit, part (Aria 2b / Sable 9:05): "after your account credit"', async () => {
    live({}, async () => ({ ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 375, fullCents: 575, nextAmountCents: 6075, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    expect(box).toHaveTextContent("We'll charge $3.75 today, after your account credit.")
    expect(box).toHaveTextContent('Then $60.75/month starting November 3, 2026.')
  })

  it('account credit covers it all: "Nothing is charged today."', async () => {
    live({}, async () => ({ ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 0, fullCents: 575, nextAmountCents: 6075, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    expect(box).toHaveTextContent('Nothing is charged today. Your account credit covers it.')
    expect(box).toHaveTextContent('Then $60.75/month.')
    expect(box).not.toHaveTextContent(/We'll charge/)
  })

  it('the Stripe preview failed: "up to" the full price, Confirm still sends the proration date', async () => {
    const { onChange } = live({}, async () => ({ ok: false, message: 'x', prorationDate: 1_790_000_123, fallback: { priceCents: 575, nextAmountCents: null, nextDate: null } }))
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    expect(box).toHaveTextContent('Turn on Big change?')
    expect(box).toHaveTextContent("We'll charge up to $5.75 today for this billing period.")
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('big_change', 'on', { prorationDate: 1_790_000_123, tipDropTo: undefined }))
  })

  it('paid but not added yet (self-heal): the "finishing" line as a notice, not an error', async () => {
    const msg = "Your payment went through. We're finishing turning on Big change. Refresh in a moment to see it. If it can't be added, we'll refund the charge automatically."
    const { onChange } = live()
    onChange.mockResolvedValueOnce({ ok: false, code: 'finishing', message: msg })
    fireEvent.click(sw('big_change'))
    fireEvent.click(await screen.findByTestId('addon-confirm-button'))
    expect(await screen.findByTestId('addons-notice')).toHaveTextContent(msg)
    expect(screen.queryByTestId('addon-confirm')).toBeNull()
  })

  it('a step switch planned with no date known: the dateless lock line', () => {
    live({ lockedBySwitch: true, lockedBySwitchDate: null })
    expect(screen.getByTestId('addons-lock-note')).toHaveTextContent('You can change add-ons after your plan switch.')
  })

  it('small charge under $0.50 (Aria 9:27, ruling 3): "$0.35 will be added to your next charge.", no "charge" line; Confirm still sends', async () => {
    const { onChange } = live({}, async () => ({ ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 35, fullCents: 575, nextAmountCents: 6075, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    expect(box).toHaveTextContent('Turn on Big change?')
    expect(box).toHaveTextContent('$0.35 will be added to your next charge.')
    expect(box).not.toHaveTextContent(/We'll charge|Nothing is charged/)
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('big_change', 'on', { prorationDate: 1_790_000_000, tipDropTo: undefined }))
  })

  it.each([
    [49, '$0.49 will be added to your next charge.'],
    [50, "We'll charge $0.50 today, after your account credit."],
    [1, '$0.01 will be added to your next charge.'],
  ])('the $0.50 edge: %i cents -> %s', async (cents, line) => {
    live({}, async () => ({ ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: cents, fullCents: 575, nextAmountCents: 6075, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('big_change'))
    expect(await screen.findByTestId('addon-confirm')).toHaveTextContent(line)
  })

  it('discount or tax (Aria 9:27, ruling 2): Confirm is refused with exactly the price line, the switch stays off', async () => {
    const { onChange } = live({}, async () => ({ ok: false, message: 'x', prorationDate: 1_790_000_123, fallback: { priceCents: 575, nextAmountCents: null, nextDate: null } }))
    onChange.mockResolvedValueOnce({ ok: false, message: "We couldn't confirm this price. Please try again, or email support@freeplug-in.dev and we'll help." })
    fireEvent.click(sw('big_change'))
    expect(await screen.findByTestId('addon-confirm')).toHaveTextContent("We'll charge up to $5.75 today for this billing period.")
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    expect(await screen.findByTestId('addons-error')).toHaveTextContent("We couldn't confirm this price. Please try again, or email support@freeplug-in.dev and we'll help.")
    expect(sw('big_change')).toHaveAttribute('aria-checked', 'false')
  })

  it('a refused preview shows the server message', async () => {
    live({}, async () => ({ ok: false, message: 'Turn off an add-on first', prorationDate: null }))
    fireEvent.click(sw('small_edit'))
    expect(await screen.findByText('Turn off an add-on first')).toBeInTheDocument()
  })
})

describe('Plans card with a live plan and add-ons', () => {
  function card(over: Partial<React.ComponentProps<typeof HostingCheckoutCard>> = {}) {
    const onPreviewChange = vi.fn(async (): Promise<PlanPreviewResponse> => ({ ok: true, prorationDate: 1_790_000_000, amountDueCents: 1953, nextAmountCents: 7575, nextDate: 'November 3, 2026', addons: ['small_edit', 'big_change'] }))
    const utils = render(
      <HostingCheckoutCard
        currentPlanLines={['Starter · $35/month + $10.75 add-ons']}
        currentStepId="starter"
        renewalDate="November 3, 2026"
        onChangePlan={vi.fn(async () => ({ ok: true, message: 'done' }))}
        onPreviewChange={onPreviewChange}
        currentAddons={['small_edit', 'big_change']}
        onPreviewAddon={vi.fn()}
        onChangeAddon={vi.fn()}
        stickyOnPhone
        {...over}
      />
    )
    return { ...utils, onPreviewChange }
  }

  it("L-2 (Sable 9:29): the add-on lines follow the CURRENT plan, not the row: a Starter customer on the Fast lane row sees the Starter lines", () => {
    const { container } = card({ currentAddons: [] })
    const plain = addonPerkLine('small_edit')
    const onTop = addonPerkLine('small_edit', { withIncludedEdit: true })
    expect(plain).toBe("One small edit by us each billing period, like new hours, a photo swap or a price change. Unused edits don't roll over.")
    expect(within(sw('small_edit')).getByTestId('addon-perk')).toHaveTextContent(plain)
    expect(screen.getByTestId('addons-cap-note')).toBeInTheDocument()
    for (const id of ['fast_lane', 'priority'] as const) {
      pickStep(container, id)
      expect(within(sw('small_edit')).getByTestId('addon-perk')).toHaveTextContent(plain)
      expect(within(sw('small_edit')).getByTestId('addon-perk')).not.toHaveTextContent(onTop)
      expect(screen.getByTestId('addons-cap-note')).toBeInTheDocument() // still on Starter: the Starter cap applies
    }
  })

  it('L-2: "on top of the one your plan includes" only once the customer is actually on Fast lane (any row)', () => {
    const { container } = card({ currentStepId: 'fast_lane', currentPlanLines: ['Fast lane · $65/month'], currentAddons: [] })
    const onTop = addonPerkLine('small_edit', { withIncludedEdit: true })
    expect(within(sw('small_edit')).getByTestId('addon-perk')).toHaveTextContent(onTop)
    expect(screen.queryByTestId('addons-cap-note')).toBeNull()
    pickStep(container, 'starter')
    expect(within(sw('small_edit')).getByTestId('addon-perk')).toHaveTextContent(onTop)
    expect(screen.queryByTestId('addons-cap-note')).toBeNull()
  })

  it('the one total counts the live add-ons (and the tip only on the current step)', () => {
    const { container } = card({ currentTipDollars: 4 })
    expect(breakdown()).toBe('Starter $35 · Add-ons $10.75 · Tip $4')
    expect(total()).toBe('$49.75/month')
    pickStep(container, 'priority')
    expect(breakdown()).toBe('Priority $55 · Add-ons $10.75')
    expect(total()).toBe('$65.75/month')
  })

  it('upgrade confirm: one gray line "Your add-ons stay on: …"', async () => {
    const { container } = card()
    pickStep(container, 'priority')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Priority now' }))
    expect(await screen.findByTestId('upgrade-confirm-extra')).toHaveTextContent('Your add-ons stay on: +1 small edit, Big change.')
  })

  it('no add-ons on: no stay-on line', async () => {
    const { container } = card({ currentAddons: [], onPreviewChange: vi.fn(async () => ({ ok: true as const, prorationDate: 1, amountDueCents: 1, nextAmountCents: 5500, nextDate: 'November 3, 2026', addons: [] })) })
    pickStep(container, 'priority')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Priority now' }))
    await screen.findByTestId('upgrade-confirm')
    expect(screen.queryByText(/Your add-ons stay on/)).toBeNull()
  })
})

describe('Vera M-1 (Aria a, Lina + Sable): a small amount carried from the last change lands on this charge', () => {
  const carried = async (_id: AddonId, action: 'on' | 'off'): Promise<AddonPreviewResponse> =>
    action === 'on'
      ? { ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 535, fullCents: 500, carriedCents: 35, nextAmountCents: 6575, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0 }
      : { ok: true, action: 'off', endDate: 'November 3, 2026', nextAmountCents: 5500, nextDate: 'November 3, 2026' }

  it('line 1 bold "$5.35 today", line 2 its own gray small line "$5.00 + $0.35 left from your last change" (no parentheses), then the monthly line', async () => {
    const { onChange } = live({}, carried)
    fireEvent.click(sw('small_edit'))
    const box = await screen.findByTestId('addon-confirm')
    const totalLine = within(box).getByTestId('addon-today-total')
    const split = within(box).getByTestId('addon-today-breakdown')
    expect(totalLine.textContent).toBe('$5.35 today')
    expect(totalLine.className).toMatch(/font-bold/)
    expect(split.textContent).toBe('$5.00 + $0.35 left from your last change')
    expect(split.className).toMatch(/text-gray-500/)
    expect(split.className).toMatch(/text-xs/)
    expect(box.textContent).not.toMatch(/[()]/)
    expect(totalLine.compareDocumentPosition(split) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(box).toHaveTextContent('Then $65.75/month starting November 3, 2026.')
    expect(box).not.toHaveTextContent(/We'll charge|next charge|next bill/)
    expect(screen.getByTestId('addons-live')).toHaveTextContent('Turn on +1 small edit? $5.35 today $5.00 + $0.35 left from your last change Then $65.75/month')
    fireEvent.click(screen.getByTestId('addon-confirm-button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('small_edit', 'on', { prorationDate: 1_790_000_000, tipDropTo: undefined }))
  })

  it('nothing carried: no bold total and no gray line (the approved charge line only)', async () => {
    live({}, async () => ({ ok: true, action: 'on', prorationDate: 1, amountDueCents: 500, fullCents: 500, carriedCents: 0, nextAmountCents: 6000, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('small_edit'))
    const box = await screen.findByTestId('addon-confirm')
    expect(within(box).queryByTestId('addon-today-total')).toBeNull()
    expect(within(box).queryByTestId('addon-today-breakdown')).toBeNull()
    expect(box).toHaveTextContent("We'll charge $5 today for this billing period.")
  })

  it('the phone sticky bar shows the same total while the confirm is open, and drops it on Cancel', async () => {
    render(
      <HostingCheckoutCard
        currentPlanLines={['Priority · $55/month']}
        currentStepId="priority"
        renewalDate="November 3, 2026"
        onChangePlan={vi.fn(async () => ({ ok: true, message: 'done' }))}
        onPreviewChange={vi.fn()}
        currentAddons={['big_change']}
        onPreviewAddon={vi.fn(carried)}
        onChangeAddon={vi.fn()}
        stickyOnPhone
      />
    )
    expect(screen.queryByTestId('sticky-addon-today')).toBeNull()
    fireEvent.click(sw('small_edit'))
    const box = await screen.findByTestId('addon-confirm')
    const bar = await screen.findByTestId('sticky-addon-today')
    expect(bar.textContent).toBe('$5.35 today')
    expect(bar.textContent).toBe(within(box).getByTestId('addon-today-total').textContent)
    expect(bar.className).toMatch(/sm:hidden/)
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByTestId('sticky-addon-today')).toBeNull())
  })
})

describe('Lina (Oct 4): the Plans phone sticky bar', () => {
  const preview = async (_id: AddonId, action: 'on' | 'off'): Promise<AddonPreviewResponse> =>
    action === 'on'
      ? { ok: true, action: 'on', prorationDate: 1_790_000_000, amountDueCents: 535, fullCents: 500, carriedCents: 35, nextAmountCents: 6575, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0 }
      : { ok: true, action: 'off', endDate: 'November 3, 2026', nextAmountCents: 5500, nextDate: 'November 3, 2026' }
  const card = (onPreviewAddon = preview) =>
    render(
      <HostingCheckoutCard
        currentPlanLines={['Priority · $60.75/month']}
        currentStepId="priority"
        renewalDate="November 3, 2026"
        onChangePlan={vi.fn(async () => ({ ok: true, message: 'done' }))}
        onPreviewChange={vi.fn()}
        currentAddons={['big_change']}
        onPreviewAddon={vi.fn(onPreviewAddon)}
        onChangeAddon={vi.fn()}
        stickyOnPhone
      />
    )

  it('sits directly in the card content (no mb-3 wrapper), sticky at bottom 0, white, 1px top border, safe-area padding, above the cards', () => {
    const { container } = card()
    // M-1: only the totals stick on phones; the buttons (switch-area) follow it in the normal flow.
    const bar = screen.getByTestId('sticky-totals')
    expect(screen.getByTestId('switch-area').className).not.toMatch(/sticky/)
    const shell = container.firstElementChild as HTMLElement
    expect(bar.parentElement).toBe(shell) // a wrapper would trap the sticky inside its own height
    expect(shell.className).not.toMatch(/overflow-(hidden|auto|scroll)/)
    const cls = bar.className.split(/\s+/)
    for (const c of ['sticky', 'bottom-0', 'z-10', 'bg-white', 'border-t', 'border-zinc-200', 'pb-[max(0.75rem,env(safe-area-inset-bottom))]', 'max-sm:mb-3', 'max-sm:[&_p]:whitespace-normal']) expect(cls).toContain(c)
    expect(bar.className).not.toMatch(/max-h-|overflow-hidden/) // Vera: no cap; the bar grows to fit
    // Desktop (sm+) it's a normal block again.
    for (const c of ['sm:static', 'sm:border-0', 'sm:bg-transparent']) expect(cls).toContain(c)
    // Nothing else in the card sits above it.
    expect(container.querySelectorAll('[class*="z-2"],[class*="z-3"],[class*="z-4"],[class*="z-5"]')).toHaveLength(0)
  })

  it('Lina: opening the confirm scrolls its Turn on/Cancel row into view, kept above the phone bar (scroll margin = measured bar height, --sticky-bar-h)', async () => {
    const scroll = vi.fn()
    const orig = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      card()
      fireEvent.click(sw('small_edit'))
      const actions = await screen.findByTestId('addon-confirm-actions')
      await waitFor(() => expect(scroll.mock.contexts).toContain(actions))
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
      expect(actions.className).toMatch(/max-sm:scroll-mb-\[var\(--sticky-bar-h,90px\)\]/)
      expect(within(actions).getByTestId('addon-confirm-button')).toBeInTheDocument()
      expect(within(actions).getByTestId('addon-cancel')).toBeInTheDocument()
      expect(document.activeElement).toBe(within(actions).getByTestId('addon-confirm-button'))
    } finally {
      Element.prototype.scrollIntoView = orig
    }
  })

  it('Vera 375: the bar grows after the confirm opens (49 -> 73px); a second scroll runs once the new height is published', async () => {
    const observers: Array<() => void> = []
    const origRO = globalThis.ResizeObserver
    const origRect = Element.prototype.getBoundingClientRect
    const origScroll = Element.prototype.scrollIntoView
    globalThis.ResizeObserver = class {
      constructor(private cb: () => void) {}
      observe() {
        observers.push(() => this.cb())
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    // The bar is 49px with the monthly total, 73px once the "today" line is in it.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const h = this.getAttribute('data-testid') === 'sticky-totals' ? (this.querySelector('[data-testid="sticky-addon-today"]') ? 73 : 49) : 0
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: h, width: 0, height: h, toJSON: () => ({}) } as DOMRect
    }
    // Record the published --sticky-bar-h (the scroll margin's value) at each scroll.
    const offsets: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) {
      if (this.getAttribute('data-testid') === 'addon-confirm-actions') offsets.push(screen.getByTestId('checkout-card-shell').style.getPropertyValue('--sticky-bar-h'))
    }
    try {
      card()
      expect(screen.getByTestId('checkout-card-shell').style.getPropertyValue('--sticky-bar-h')).toBe('49px')
      fireEvent.click(sw('small_edit'))
      await screen.findByTestId('sticky-addon-today')
      expect(offsets).toEqual(['49px']) // first scroll, before the bar has grown
      act(() => observers.forEach((fire) => fire())) // the ResizeObserver reports the taller bar
      await waitFor(() => expect(offsets).toEqual(['49px', '73px']))
      expect(screen.getByTestId('addon-confirm-actions').className).toMatch(/max-sm:scroll-mb-\[var\(--sticky-bar-h,90px\)\]/)
      // No further scroll without a height change.
      act(() => observers.forEach((fire) => fire()))
      expect(offsets).toHaveLength(2)
    } finally {
      globalThis.ResizeObserver = origRO
      Element.prototype.getBoundingClientRect = origRect
      Element.prototype.scrollIntoView = origScroll
    }
  })

  it('confirm open: the bar swaps to the after-change totals (bold "$5.35 today" + the new monthly); Cancel restores the current ones', async () => {
    card()
    const amount = () => screen.getByTestId('plan-total-amount')
    expect(amount().textContent).toBe('$60.75/month')
    expect(amount().dataset.totals).toBe('current')
    expect(screen.queryByTestId('sticky-addon-today')).toBeNull()

    fireEvent.click(sw('small_edit'))
    const box = await screen.findByTestId('addon-confirm')
    await waitFor(() => expect(amount().textContent).toBe('$65.75/month'))
    expect(amount().dataset.totals).toBe('after')
    // The breakdown above it adds up to the same after-change total (Priority $55 + add-ons $10.75).
    expect(screen.getByTestId('plan-total-breakdown').textContent).toBe('Priority $55 · Add-ons $10.75')
    const today = screen.getByTestId('sticky-addon-today')
    expect(today.textContent).toBe('$5.35 today')
    expect(today.className).toMatch(/font-bold/)
    expect(within(screen.getByTestId('sticky-totals')).getByTestId('sticky-addon-today')).toBe(today)

    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(amount().textContent).toBe('$60.75/month'))
    expect(amount().dataset.totals).toBe('current')
    expect(screen.getByTestId('plan-total-breakdown').textContent).toBe('Priority $55 · Add-ons $5.75')
    expect(screen.queryByTestId('sticky-addon-today')).toBeNull()
  })

  it('nothing carried: still "{total} today" in the bar; under $0.50 (lands on the next charge): no today line', async () => {
    const { unmount } = card(async () => ({ ok: true, action: 'on', prorationDate: 1, amountDueCents: 500, fullCents: 500, carriedCents: 0, nextAmountCents: 6575, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('small_edit'))
    expect((await screen.findByTestId('sticky-addon-today')).textContent).toBe('$5 today')
    unmount()
    card(async () => ({ ok: true, action: 'on', prorationDate: 1, amountDueCents: 35, fullCents: 500, carriedCents: 0, nextAmountCents: 6575, nextDate: null, tipDollarsNow: 0, tipDollarsAfter: 0 }))
    fireEvent.click(sw('small_edit'))
    await screen.findByTestId('addon-confirm')
    await waitFor(() => expect(screen.getByTestId('plan-total-amount').textContent).toBe('$65.75/month'))
    expect(screen.queryByTestId('sticky-addon-today')).toBeNull()
  })

  it('turning one off: the bar shows the monthly total after it ends, no today line; Cancel restores', async () => {
    card()
    fireEvent.click(sw('big_change'))
    const box = await screen.findByTestId('addon-confirm')
    await waitFor(() => expect(screen.getByTestId('plan-total-amount').textContent).toBe('$55/month'))
    expect(screen.getByTestId('plan-total-breakdown').textContent).not.toMatch(/Add-ons \$5\.75/)
    expect(screen.queryByTestId('sticky-addon-today')).toBeNull()
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByTestId('plan-total-amount').textContent).toBe('$60.75/month'))
  })
})
