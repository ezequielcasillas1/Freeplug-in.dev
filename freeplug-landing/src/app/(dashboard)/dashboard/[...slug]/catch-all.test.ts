import { describe, expect, it, vi } from 'vitest'

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({ notFound }))

import DashboardCatchAll from './page'

describe('Dashboard catch-all (Oct 31)', () => {
  it('calls notFound() so the dashboard not-found renders in-layout', () => {
    expect(() => DashboardCatchAll()).toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledTimes(1)
  })
})
