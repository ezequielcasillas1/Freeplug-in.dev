import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TipChangeBox } from './TipChangeBox'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { TIP_CHANGE_BUTTON, UPGRADE_CALCULATING } from '@/lib/plans/ladder-copy'
import type { TipPreviewResponse } from '@/app/(dashboard)/dashboard/billing-actions'

// Esc during "Checking the amount…" in the tip box: the same behaviour and tests as the plan-switch
// card (HostingCheckoutCard.test.tsx, Vera aaec23d report findings 1 and 2).

const fastLane = PLAN_STEPS.find((s) => s.id === 'fast_lane')!
const okPreview = (t: number): TipPreviewResponse => ({ ok: true, tipDollars: t, nextAmountCents: 6500 + t * 100, nextDate: 'November 3, 2026', confirmId: 'confirm-1' })
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

/** A tip box with a preview that resolves (or rejects) only when the test says so. */
function tipBox() {
  let resolve!: (v: TipPreviewResponse) => void
  let reject!: (e: unknown) => void
  const onPreviewTip = vi.fn((): Promise<TipPreviewResponse> => new Promise<TipPreviewResponse>((res, rej) => ((resolve = res), (reject = rej))))
  const onChangeTip = vi.fn(async () => ({ ok: true, message: 'server' }))
  render(<TipChangeBox step={fastLane} currentTipDollars={2} locked={false} onPreviewTip={onPreviewTip} onChangeTip={onChangeTip} />)
  const box = screen.getByTestId('tip-change-box')
  fireEvent.change(within(box).getByRole('slider'), { target: { value: '71' } })
  fireEvent.click(within(box).getByTestId('tip-change-button'))
  expect(within(box).getByTestId('tip-change-button')).toHaveTextContent(UPGRADE_CALCULATING)
  return { box, onPreviewTip, onChangeTip, resolve: (v: TipPreviewResponse) => resolve(v), reject: (e: unknown) => reject(e) }
}

/** Esc while loading, then wait until focus is back on Update tip. */
async function escDuringLoading() {
  const t = tipBox()
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(document.activeElement, 'Esc while loading should return focus to Update tip').toBe(within(t.box).getByTestId('tip-change-button')))
  return t
}

/** jsdom has no default actions: in a browser, Enter on a focused button clicks it. */
function pressEnter() {
  const el = document.activeElement as HTMLElement | null
  if (!el) return
  fireEvent.keyDown(el, { key: 'Enter' })
  if (el instanceof HTMLButtonElement && !el.disabled) fireEvent.click(el)
}

/** Sends Escape from a MutationObserver the moment find() returns an element (before passive effects). */
function escOnInsert(find: () => HTMLElement | null) {
  const sent: { at: HTMLElement | null; focusedAtSend: boolean | null; stop: () => void } = { at: null, focusedAtSend: null, stop: () => mo.disconnect() }
  const mo = new MutationObserver(() => {
    const el = find()
    if (!el || sent.at) return
    sent.at = el
    sent.focusedAtSend = document.activeElement === el
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  mo.observe(document.body, { childList: true, subtree: true })
  return sent
}

describe('TipChangeBox: Esc while "Checking the amount…"', () => {
  it('cancels back to Update tip and returns focus to it; nothing is changed', async () => {
    const { box, onPreviewTip, onChangeTip } = await escDuringLoading()
    const button = within(box).getByTestId('tip-change-button')
    expect(button).toHaveTextContent(TIP_CHANGE_BUTTON)
    expect(button).toBeEnabled()
    expect(within(box).queryByTestId('tip-change-confirm')).toBeNull()
    expect(within(box).getByTestId('tip-change-live')).toHaveTextContent('')
    expect((within(box).getByRole('slider') as HTMLInputElement).value).toBe('71') // the picked tip stays
    expect(onPreviewTip).toHaveBeenCalledTimes(1)
    expect(onChangeTip).not.toHaveBeenCalled()
  })

  it('the preview resolving after that Esc is ignored: no confirm opens and focus stays on Update tip', async () => {
    const { box, resolve, onChangeTip } = await escDuringLoading()
    await act(async () => {
      resolve(okPreview(6))
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(within(box).queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(within(box).queryByTestId('tip-change-confirm')).toBeNull()
    expect(within(box).getByTestId('tip-change-live')).toHaveTextContent('')
    expect(document.activeElement).toBe(within(box).getByTestId('tip-change-button'))
    expect(onChangeTip).not.toHaveBeenCalled()
  })

  it('a late preview error or network failure after that Esc is dropped too (no error line)', async () => {
    const a = await escDuringLoading()
    await act(async () => {
      a.resolve({ ok: false, message: 'late preview error' })
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(a.box).not.toHaveTextContent('late preview error')
    // again, with the preview rejecting
    fireEvent.click(within(a.box).getByTestId('tip-change-button'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(within(a.box).getByTestId('tip-change-button')).toHaveTextContent(TIP_CHANGE_BUTTON))
    await act(async () => {
      a.reject(new Error('offline'))
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(a.box).not.toHaveTextContent('Network error. Try again.')
    expect(within(a.box).queryByTestId('tip-change-confirm')).toBeNull()
  })

  it('Enter after the late preview does not confirm (focus is on Update tip, not Confirm)', async () => {
    const { resolve, onChangeTip } = await escDuringLoading()
    await act(async () => {
      resolve(okPreview(6))
      await new Promise((r) => setTimeout(r, 0))
    })
    pressEnter()
    await flush()
    expect(onChangeTip).not.toHaveBeenCalled()
  })
})

describe('TipChangeBox: Esc on the confirm step', () => {
  it('Esc the instant Confirm is inserted still closes it and returns focus to Update tip (useLayoutEffect)', async () => {
    const onPreviewTip = vi.fn(async (t: number) => okPreview(t))
    const onChangeTip = vi.fn(async () => ({ ok: true, message: 'server' }))
    render(<TipChangeBox step={fastLane} currentTipDollars={2} locked={false} onPreviewTip={onPreviewTip} onChangeTip={onChangeTip} />)
    const box = screen.getByTestId('tip-change-box')
    fireEvent.change(within(box).getByRole('slider'), { target: { value: '71' } })
    const sent = escOnInsert(() => within(box).queryByRole('button', { name: 'Confirm' }))
    fireEvent.click(within(box).getByTestId('tip-change-button'))
    await waitFor(() => expect(sent.at).not.toBeNull())
    sent.stop()
    expect(sent.focusedAtSend, 'the tip Confirm should already have focus when it is in the DOM').toBe(true)
    await waitFor(() => expect(within(box).queryByTestId('tip-change-confirm')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(within(box).getByTestId('tip-change-button')))
    expect(onChangeTip).not.toHaveBeenCalled()
  })

  it('control: after the preview, Confirm has focus and Enter confirms with the previewed tip', async () => {
    const onPreviewTip = vi.fn(async (t: number) => okPreview(t))
    const onChangeTip = vi.fn(async () => ({ ok: true, message: 'server' }))
    render(<TipChangeBox step={fastLane} currentTipDollars={2} locked={false} onPreviewTip={onPreviewTip} onChangeTip={onChangeTip} />)
    const box = screen.getByTestId('tip-change-box')
    fireEvent.change(within(box).getByRole('slider'), { target: { value: '71' } })
    fireEvent.click(within(box).getByTestId('tip-change-button'))
    const confirm = await within(box).findByRole('button', { name: 'Confirm' })
    expect(document.activeElement).toBe(confirm)
    pressEnter()
    await waitFor(() => expect(onChangeTip).toHaveBeenCalledWith(6, 'confirm-1'))
  })
})

/** Previews that resolve one by one, in any order (each open gets its own). */
function queuedTipBox() {
  const pending: Array<(v: TipPreviewResponse) => void> = []
  const onPreviewTip = vi.fn((): Promise<TipPreviewResponse> => new Promise<TipPreviewResponse>((r) => pending.push(r)))
  const onChangeTip = vi.fn(async () => ({ ok: true, message: 'server' }))
  render(<TipChangeBox step={fastLane} currentTipDollars={2} locked={false} onPreviewTip={onPreviewTip} onChangeTip={onChangeTip} />)
  const box = screen.getByTestId('tip-change-box')
  fireEvent.change(within(box).getByRole('slider'), { target: { value: '71' } })
  /** Open n answers "$<dollars>" with confirm id confirm-<n>. */
  const resolve = async (n: number, dollars: number) => {
    await act(async () => {
      pending[n]({ ok: true, tipDollars: 6, nextAmountCents: dollars * 100, nextDate: 'November 3, 2026', confirmId: `confirm-${n}` })
      await new Promise((r) => setTimeout(r, 0))
    })
  }
  const button = () => within(box).getByTestId('tip-change-button')
  return { box, button, onPreviewTip, onChangeTip, resolve }
}

describe("Vera's loading cases on the tip box (a-c, mirrored in HostingCheckoutCard.test.tsx)", () => {
  it('(a) Enter while "Checking the amount…" is showing does nothing', async () => {
    const t = queuedTipBox()
    t.button().focus()
    fireEvent.click(t.button())
    expect(t.button()).toHaveTextContent(UPGRADE_CALCULATING)
    pressEnter()
    fireEvent.keyDown(document, { key: 'Enter' })
    await flush()
    expect(t.button()).toHaveTextContent(UPGRADE_CALCULATING)
    expect(t.button()).toBeDisabled()
    expect(within(t.box).queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(t.onPreviewTip).toHaveBeenCalledTimes(1)
    expect(t.onChangeTip).not.toHaveBeenCalled()
  })

  it('(b) Esc, then reopen: the confirm shows the fresh preview, and the late result from the first open never appears', async () => {
    const t = queuedTipBox()
    fireEvent.click(t.button())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(t.button()))
    fireEvent.click(t.button()) // reopen
    await t.resolve(1, 72) // the fresh preview
    const confirm = await within(t.box).findByTestId('tip-change-confirm')
    expect(confirm).toHaveTextContent('Your next bill will be $72 on November 3, 2026.')
    await t.resolve(0, 71) // the first open's result, late
    expect(within(t.box).getByTestId('tip-change-confirm')).toHaveTextContent('Your next bill will be $72 on November 3, 2026.')
    expect(t.box).not.toHaveTextContent('$71 on')
    // Confirm sends the fresh preview's confirm id, not the stale one
    expect(document.activeElement).toBe(within(t.box).getByRole('button', { name: 'Confirm' }))
    pressEnter()
    await waitFor(() => expect(t.onChangeTip).toHaveBeenCalledWith(6, 'confirm-1'))
    expect(t.onChangeTip).toHaveBeenCalledTimes(1)
  })

  it('(c) two quick opens in a row: only the newest preview gets through', async () => {
    const t = queuedTipBox()
    // A double click starts one preview: the button is disabled while it loads.
    fireEvent.click(t.button())
    fireEvent.click(t.button())
    expect(t.onPreviewTip).toHaveBeenCalledTimes(1)
    // Open, Esc, open again before the first answers; the first then answers while the second loads.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(t.button()).toBeEnabled())
    fireEvent.click(t.button())
    expect(t.onPreviewTip).toHaveBeenCalledTimes(2)
    await t.resolve(0, 71)
    expect(t.button()).toHaveTextContent(UPGRADE_CALCULATING) // the old answer is not shown
    expect(within(t.box).queryByTestId('tip-change-confirm')).toBeNull()
    await t.resolve(1, 72)
    expect(await within(t.box).findByTestId('tip-change-confirm')).toHaveTextContent('Your next bill will be $72 on November 3, 2026.')
    expect(t.box).not.toHaveTextContent('$71 on')
    fireEvent.click(within(t.box).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(t.onChangeTip).toHaveBeenCalledWith(6, 'confirm-1'))
  })
})
