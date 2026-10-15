import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ host: 'freeplug-preview.example.workers.dev' })) }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ auth: { getUser } })) }))

import { notFound } from 'next/navigation'
import { assertAdminAccess, isAdminAccessAllowed } from './guard'

describe('admin route guard (production)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com')
    // A real allowlisted admin session, so only the flag decides.
    getUser.mockResolvedValue({ data: { user: { email: 'admin@example.com' } } })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns 404 when ADMIN_ROUTE_ENABLED="false"', async () => {
    vi.stubEnv('ADMIN_ROUTE_ENABLED', 'false')
    expect(await isAdminAccessAllowed()).toBe(false)
    await expect(assertAdminAccess()).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('returns 404 when ADMIN_ROUTE_ENABLED is unset', async () => {
    delete process.env.ADMIN_ROUTE_ENABLED
    expect(process.env.ADMIN_ROUTE_ENABLED).toBeUndefined()
    expect(await isAdminAccessAllowed()).toBe(false)
    await expect(assertAdminAccess()).rejects.toThrow('404')
    expect(notFound).toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('control: allows the allowlisted admin when ADMIN_ROUTE_ENABLED="true"', async () => {
    vi.stubEnv('ADMIN_ROUTE_ENABLED', 'true')
    expect(await isAdminAccessAllowed()).toBe(true)
    await expect(assertAdminAccess()).resolves.toBeUndefined()
    expect(notFound).not.toHaveBeenCalled()
  })
})
