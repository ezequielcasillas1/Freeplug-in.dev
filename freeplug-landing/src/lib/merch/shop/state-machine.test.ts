import { describe, expect, it } from 'vitest'
import { initialShopOrderStatus, shouldAutoRefundHeld, shouldQueuePrintify } from './state-machine'

describe('shop order state machine', () => {
  it('routes custom pass + autosend to paid_cancellable', () => {
    expect(initialShopOrderStatus({ designMode: 'custom', moderation: 'pass', autosend: true })).toBe('paid_cancellable')
  })

  it('routes held moderation to held_moderation', () => {
    expect(initialShopOrderStatus({ designMode: 'custom', moderation: 'held', autosend: true })).toBe('held_moderation')
  })

  it('queues printify after cancel window', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(shouldQueuePrintify('paid_cancellable', past)).toBe(true)
  })

  it('auto-refunds held after deadline', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(shouldAutoRefundHeld('held_moderation', past)).toBe(true)
  })
})
