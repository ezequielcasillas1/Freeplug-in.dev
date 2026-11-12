import { test, expect, vi } from 'vitest'
const upd = vi.fn(() => ({ eq: async () => ({ error: null }) }))
let admin = true
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: async () => { if (!admin) throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ update: upd }) }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
import { adminSetProfileCumulativeWebsiteValuePaid as setPaid } from '@/app/admin/actions'
import { parseBuyoutPriceInput } from '@/lib/buyout/buyout'
test('dump', async () => {
  process.env.ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID = 'true'
  const P = '44444444-4444-4444-8444-444444444444', out: any = {}
  for (const v of ['0','1','2001','21474836','21474837','-1','1.5','abc']) { const r: any = await setPaid(P, v); out[v] = r.ok ? 'ok' : r.error }
  out.writes = (upd.mock.calls as any[]).map(c => c[0].cumulative_website_value_paid_cents)
  admin = false; try { out.nonAdmin = await setPaid(P, '5') } catch (e: any) { out.nonAdmin = 'threw ' + e.message }
  out.buyout = Object.fromEntries(['0','1','2000','2001'].map(a => { const r: any = parseBuyoutPriceInput(a); return [a, r.ok ? r.cents : r.error] }))
  expect(out).toEqual({})
})
