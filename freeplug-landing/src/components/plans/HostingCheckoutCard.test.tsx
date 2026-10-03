import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { HostingCheckoutCard } from './HostingCheckoutCard'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { MOST_POPULAR_LABEL, PERK_LINES } from '@/lib/plans/ladder-copy'

afterEach(() => vi.unstubAllGlobals())

describe('HostingCheckoutCard (hosting ladder, Oct 3)', () => {
  it('shows the six fixed steps with prices from ladder.ts, no slider and no add-ons', () => {
    const { container } = render(<HostingCheckoutCard />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(PLAN_STEPS.map((s) => s.id))
    for (const s of PLAN_STEPS) {
      const card = container.querySelector(`[data-plan-step="${s.id}"]`) as HTMLElement
      expect(card).toHaveTextContent(`${s.name} · $${s.monthlyCents / 100}`)
      for (const perk of s.adds) expect(card).toHaveTextContent(PERK_LINES[perk])
    }
    expect(container.querySelector('input[type="range"]')).toBeNull()
    expect(container).not.toHaveTextContent(/\bBasic\b|\bPlus\b|\bPro\b/)
    expect(container).not.toHaveTextContent(/add-on|backup|downtime|uptime|99\.9/i)
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getAllByText(MOST_POPULAR_LABEL)).toHaveLength(1)
  })

  it('checkout posts only the chosen step id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'stop' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<HostingCheckoutCard />)
    fireEvent.click(within(container.querySelector('[data-plan-step="get_found"]') as HTMLElement).getByRole('radio'))
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/checkout/hosting')
    expect(JSON.parse(init.body as string)).toEqual({ planStep: 'get_found' })
    expect(await screen.findByText('stop')).toBeInTheDocument()
  })

  it('choose-plan mode (claim step 3) hands the step to the callback and charges nothing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onChoosePlan = vi.fn(async () => null)
    const { container } = render(<HostingCheckoutCard onChoosePlan={onChoosePlan} chooseLabel="Save my plan" />)
    fireEvent.click(within(container.querySelector('[data-plan-step="priority"]') as HTMLElement).getByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Save my plan' }))
    await waitFor(() => expect(onChoosePlan).toHaveBeenCalledWith({ planStep: 'priority' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('with a live plan: Manage billing instead of checkout', () => {
    render(<HostingCheckoutCard currentPlanLines={['Starter · $35.00/month']} />)
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument()
    expect(screen.getByText('Current plan: Starter · $35.00/month')).toBeInTheDocument()
  })
})

describe('HostingCheckoutCard switch mode (live plan)', () => {
  it('marks the current step, disables switching to it, and calls the server action for another step', async () => {
    const onChangePlan = vi.fn(async () => ({ ok: true, message: 'done' }))
    const { container } = render(
      <HostingCheckoutCard currentPlanLines={['Freeplug Hosting: Leads · $75.00/month']} currentStepId="leads" onChangePlan={onChangePlan} />
    )
    expect(within(container.querySelector('[data-plan-step="leads"]') as HTMLElement).getByTestId('current-step')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to Leads' })).toBeDisabled()
    fireEvent.click(within(container.querySelector('[data-plan-step="priority"]') as HTMLElement).getByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Priority' }))
    await waitFor(() => expect(onChangePlan).toHaveBeenCalledWith('priority'))
    expect(await screen.findByRole('status')).toHaveTextContent('done')
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument()
  })

  it('a grandfathered plan has no current step marked and starts on Starter', () => {
    render(<HostingCheckoutCard currentPlanLines={['Hosting + Pro add-on · $55.00/month']} currentStepId={null} onChangePlan={vi.fn()} />)
    expect(screen.queryByTestId('current-step')).toBeNull()
    expect(screen.getByRole('button', { name: 'Switch to Starter' })).toBeEnabled()
  })
})
