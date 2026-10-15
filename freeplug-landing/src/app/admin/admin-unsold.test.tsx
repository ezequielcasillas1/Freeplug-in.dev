/**
 * Admin side of Aria's 12:56 open-checkout rule: the expiry action (admin only, reports counts) and
 * the "bought a step not for sale" badge with its Mark reviewed form.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const guard = vi.fn(async () => undefined)
const expireFn = vi.fn()
const updates: Record<string, unknown>[] = []
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: () => guard() }))
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ marker: 'stripe' }) }))
vi.mock('@/lib/stripe/expire-unsellable-checkouts', () => ({ expireUnsellableCheckoutSessions: (...a: unknown[]) => expireFn(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (k: string, v: unknown) => ({
          is: async (k2: string, v2: unknown) => {
            updates.push({ table, patch, filters: [[k, v], [k2, v2]] })
            return { error: null }
          },
        }),
      }),
    }),
  }),
}))

import { adminExpireUnsellableCheckouts, adminExpireUnsellableCheckoutsForm, adminMarkUnsoldPurchaseReviewed } from './actions'
import { AdminUnsoldPurchaseBadge } from './AdminCustomersTable'

const REPORT = { checked: 3, expired: [{ id: 'cs_test_1', step: 'leads' }], alreadyClosed: [], kept: 2 }

describe('adminExpireUnsellableCheckouts', () => {
  beforeEach(() => {
    guard.mockReset()
    guard.mockResolvedValue(undefined)
    expireFn.mockReset()
    updates.length = 0
  })

  it('admin only: a refused guard stops before Stripe', async () => {
    guard.mockRejectedValueOnce(new Error('NOT_FOUND'))
    await expect(adminExpireUnsellableCheckouts()).rejects.toThrow('NOT_FOUND')
    expect(expireFn).not.toHaveBeenCalled()
  })

  it('runs the expiry with the server Stripe client and returns the report', async () => {
    expireFn.mockResolvedValue(REPORT)
    expect(await adminExpireUnsellableCheckouts()).toEqual({ ok: true, report: REPORT })
    expect(expireFn).toHaveBeenCalledWith({ marker: 'stripe' })
  })

  it('form version comes back to Customers with the counts, or an error flag', async () => {
    expireFn.mockResolvedValue(REPORT)
    await expect(adminExpireUnsellableCheckoutsForm()).rejects.toMatchObject({ url: '/admin/customers?checkouts_expired=1&checkouts_closed=0&checkouts_checked=3' })
    expireFn.mockRejectedValue(new Error('stripe down'))
    await expect(adminExpireUnsellableCheckoutsForm()).rejects.toMatchObject({ url: '/admin/customers?checkouts_error=1' })
  })

  it('Mark reviewed sets reviewed_at once (only on an open flag); bad ids ignored', async () => {
    const fd = new FormData()
    fd.set('id', '11111111-2222-4333-8444-555555555555')
    await adminMarkUnsoldPurchaseReviewed(fd)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ table: 'plan_unsold_purchases', filters: [['id', '11111111-2222-4333-8444-555555555555'], ['reviewed_at', null]] })
    const bad = new FormData()
    bad.set('id', 'nope')
    await adminMarkUnsoldPurchaseReviewed(bad)
    expect(updates).toHaveLength(1)
  })
})

describe('AdminUnsoldPurchaseBadge', () => {
  it('shows the step and a Mark reviewed form; nothing without a flag', () => {
    const { container, rerender } = render(<AdminUnsoldPurchaseBadge flag={{ id: 'f1', stepName: 'Growth partner', createdAt: '2026-10-03T18:00:00Z' }} />)
    expect(screen.getByTestId('unsold-purchase-badge').textContent).toContain('Bought Growth partner (not for sale)')
    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeTruthy()
    expect((container.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('f1')
    rerender(<AdminUnsoldPurchaseBadge flag={null} />)
    expect(screen.queryByTestId('unsold-purchase-badge')).toBeNull()
  })
})
