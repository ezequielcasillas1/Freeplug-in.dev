import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import {
  MERCH_BUNDLE_OBJECT_KEY,
  MERCH_PERSONAL_DEMO_OBJECT_KEY,
  MERCH_STORAGE_BUCKET,
  downloadPrivateObject,
  readMerchBundleBytes,
  readMerchPersonalDemoBytes,
} from './storage'
import { createAdminClient } from '@/lib/supabase/admin'

const noLocal = { MERCH_BUNDLE_LOCAL_PATH: '/nope', MERCH_PERSONAL_DEMO_LOCAL_PATH: '/nope' }

describe('merch private storage (Supabase, bucket merch-private)', () => {
  // Ignore any real .merch-dev-only zips on this machine.
  vi.spyOn(process, 'cwd').mockReturnValue('/nonexistent-merch-test-dir')

  it('uses the private bucket and flat object keys', () => {
    expect(MERCH_STORAGE_BUCKET).toBe('merch-private')
    expect(MERCH_BUNDLE_OBJECT_KEY).toBe('freeplug-font-bundle-v1.zip')
    expect(MERCH_PERSONAL_DEMO_OBJECT_KEY).toBe('freeplug-fonts-personal-demo.zip')
  })

  it('reads the paid bundle from Supabase Storage when no local file', async () => {
    const dl = vi.fn(async () => Buffer.from('zip'))
    const buf = await readMerchBundleBytes(noLocal, dl)
    expect(dl).toHaveBeenCalledWith('merch-private', 'freeplug-font-bundle-v1.zip')
    expect(buf.toString()).toBe('zip')
  })

  it('throws when the bundle object is missing', async () => {
    await expect(readMerchBundleBytes(noLocal, async () => null)).rejects.toThrow()
  })

  it('reads the personal demo from Supabase Storage when no local file', async () => {
    const dl = vi.fn(async () => Buffer.from('demo'))
    const buf = await readMerchPersonalDemoBytes({ ...noLocal }, dl)
    expect(dl).toHaveBeenCalledWith('merch-private', 'freeplug-fonts-personal-demo.zip')
    expect(buf.toString()).toBe('demo')
  })

  it('downloadPrivateObject uses the service-role client and returns null on error', async () => {
    const download = vi.fn(async () => ({ data: null, error: { message: 'not found' } }))
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from: () => ({ download }) } } as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await downloadPrivateObject('merch-private', 'x.zip')).toBeNull()
    const ok = vi.fn(async () => ({ data: { arrayBuffer: async () => new TextEncoder().encode('abc').buffer }, error: null }))
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from: () => ({ download: ok }) } } as never)
    expect((await downloadPrivateObject('merch-private', 'x.zip'))?.toString()).toBe('abc')
  })
})
