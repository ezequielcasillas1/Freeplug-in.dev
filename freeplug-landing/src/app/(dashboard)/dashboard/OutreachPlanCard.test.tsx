import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./billing-actions', () => ({ openBillingPortal: vi.fn(), resumePlan: vi.fn() }))
vi.mock('./buyout-actions', () => ({ requestBuyoutQuote: vi.fn() }))

const { SubscriptionDetails } = await import('./SubscriptionDetails')
const { CancelPlanView } = await import('./cancel/CancelPlanView')

const cancelData = { hasStripeCustomer: false, subscriptions: [], canceledSubscriptions: [], invoiceCount: 0, totalPaidCents: 0, subscriptionsLoaded: true }

describe('dashboard and Cancel page render the same outreach plan card (round 12)', () => {
  it.each(['plan_waiting', 'plan_unavailable', 'choose_plan'] as const)('%s: identical card markup (the Cancel page only adds its help line inside)', (box) => {
    const dash = render(<SubscriptionDetails subscriptions={[]} outreach={{ box }} />)
    const dashCard = dash.getByTestId('outreach-plan-card').cloneNode(true) as HTMLElement
    dash.unmount()
    render(<CancelPlanView data={cancelData} outreachBox={box} />)
    const cancelCard = screen.getByTestId('outreach-plan-card').cloneNode(true) as HTMLElement
    cancelCard.querySelector('[data-testid="cancel-before-live-help"]')?.remove()
    expect(cancelCard.outerHTML).toBe(dashCard.outerHTML)
  })
})
