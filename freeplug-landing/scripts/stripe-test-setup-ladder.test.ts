// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as setup from './stripe-test-setup-ladder.mjs'
import * as ladder from '../src/lib/plans/ladder'

const { assertTestKey, readKeyFromEnvFile, setupLadder, redact, SetupRefused } = setup

// Fake keys built at runtime so no key-shaped literal sits in the source.
const k = (p: string) => `${p}${'x'.repeat(24)}`

describe('stripe-test-setup-ladder: key handling (test mode only)', () => {
  it.each([k('sk_live_'), k('rk_live_')])('refuses a live key by name', (key) => {
    expect(() => assertTestKey(key)).toThrow(/LIVE Stripe key/)
  })
  it.each([k('pk_test_'), k('mk_'), '', k('sk_tes_')])('refuses anything but sk_test_/rk_test_ (%#)', (key) => {
    expect(() => assertTestKey(key)).toThrow(SetupRefused)
  })
  it.each([k('sk_test_'), k('rk_test_')])('accepts a test key', (key) => {
    expect(assertTestKey(key)).toBe(key)
  })
  it('reads only the STRIPE_SECRET_KEY line of the env file, never the shell env', () => {
    const file = `SUPABASE_SERVICE_ROLE_KEY=abc\n# STRIPE_SECRET_KEY=old\nSTRIPE_SECRET_KEY="${k('sk_test_')}"\nRESEND_API_KEY=re_x\n`
    expect(readKeyFromEnvFile('/x/.env.local', () => file)).toBe(k('sk_test_'))
    expect(() => readKeyFromEnvFile('/x/.env.local', () => `STRIPE_SECRET_KEY=${k('sk_live_')}\n`)).toThrow(/LIVE/)
    expect(() => readKeyFromEnvFile(undefined)).toThrow(/--env-file/)
  })
  it('redacts key-shaped strings from printed errors', () => {
    expect(redact(`Invalid API Key provided: ${k('sk_test_')}`)).toBe('Invalid API Key provided: sk_test_[redacted]')
    expect(redact(k('rk_live_'))).toBe('rk_live_[redacted]')
  })
})

type Price = Record<string, unknown> & { id: string; lookup_key: string; product: string; active: boolean }
function fakeStripe(opts: { livemode?: boolean; retired?: boolean } = {}) {
  const live = opts.livemode ?? false
  const state = {
    products: new Map<string, Record<string, unknown>>(),
    prices: [] as Price[],
    configs: [] as Record<string, unknown>[],
  }
  if (opts.retired) state.products.set('freeplug_hosting_ladder', { id: 'freeplug_hosting_ladder', active: true, livemode: live })
  let n = 0
  const notFound = () => Object.assign(new Error('No such product'), { statusCode: 404, code: 'resource_missing' })
  const stripe = {
    products: {
      retrieve: vi.fn(async (id: string) => {
        const p = state.products.get(id)
        if (!p) throw notFound()
        return p
      }),
      create: vi.fn(async (p: Record<string, unknown> & { id: string }) => {
        const prod = { ...p, active: true, livemode: live }
        state.products.set(p.id, prod)
        return prod
      }),
      update: vi.fn(async (id: string, p: Record<string, unknown>) => Object.assign(state.products.get(id)!, p)),
    },
    prices: {
      list: vi.fn(async (q: { lookup_keys?: string[]; product?: string; active?: boolean }) => ({
        data: state.prices.filter((p) =>
          q.lookup_keys ? q.lookup_keys.includes(p.lookup_key) : p.product === q.product && (q.active === undefined || p.active === q.active)
        ),
      })),
      create: vi.fn(async (p: Record<string, unknown> & { lookup_key: string; product: string; transfer_lookup_key?: boolean }) => {
        if (p.transfer_lookup_key) state.prices.forEach((x) => x.lookup_key === p.lookup_key && (x.lookup_key = `moved_${x.id}`))
        const price: Price = { ...p, id: `price_${++n}`, active: true, type: 'recurring', livemode: live, lookup_key: p.lookup_key, product: p.product }
        state.prices.push(price)
        return price
      }),
      update: vi.fn(async (id: string, p: Record<string, unknown>) => Object.assign(state.prices.find((x) => x.id === id)!, p)),
    },
    billingPortal: {
      configurations: {
        list: vi.fn(async () => ({ data: state.configs })),
        create: vi.fn(async (p: Record<string, unknown>) => {
          const c = { ...p, id: `bpc_${++n}`, is_default: false, active: true, livemode: live }
          state.configs.push(c)
          return c
        }),
        update: vi.fn(async (id: string, p: Record<string, unknown>) => Object.assign(state.configs.find((c) => c.id === id)!, p)),
      },
    },
  }
  return { stripe, state }
}
const quiet = { log: () => undefined }

describe('stripe-test-setup-ladder: idempotent setup (stubbed Stripe)', () => {
  let f: ReturnType<typeof fakeStripe>
  beforeEach(() => {
    f = fakeStripe()
  })

  it('first run: six products, one monthly lookup-key price each (from ladder.ts), the $1 tip price, one non-default portal configuration', async () => {
    const r = await setupLadder(f.stripe, ladder, quiet)
    // 6 steps + the tip + 2 add-ons (Oct 4)
    expect(f.stripe.products.create).toHaveBeenCalledTimes(9)
    expect(f.stripe.prices.create).toHaveBeenCalledTimes(9)
    // The tipping system: ONE recurring $1/month price on the fixed tip product; quantity = tip dollars.
    expect(f.state.products.get(ladder.TIP_PRODUCT_ID)).toMatchObject({ name: setup.TIP_PRODUCT_NAME })
    const tip = f.state.prices.find((x) => x.lookup_key === ladder.TIP_LOOKUP_KEY)!
    expect(tip).toMatchObject({ product: 'freeplug_tip', currency: 'usd', unit_amount: 100, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } })
    expect(r.tipPriceId).toBe(tip.id)
    for (const s of ladder.PLAN_STEPS) {
      expect(f.state.products.get(s.productId)).toMatchObject({ name: `Freeplug Hosting: ${s.name}`, metadata: { plan_step: s.id } })
      const p = f.state.prices.find((x) => x.lookup_key === s.lookupKey)!
      expect(p).toMatchObject({
        product: s.productId,
        currency: 'usd',
        unit_amount: s.monthlyCents,
        recurring: { interval: 'month', interval_count: 1 },
        nickname: s.name,
        metadata: { plan_step: s.id },
      })
      expect(r.priceIds[s.id]).toBe(p.id)
    }
    expect(f.stripe.billingPortal.configurations.create).toHaveBeenCalledTimes(1)
    const cfg = f.stripe.billingPortal.configurations.create.mock.calls[0][0] as ReturnType<typeof setup.desiredPortalConfig>
    // Plan moves happen in the app (change-plan.ts): the portal must not switch plans.
    expect(cfg.features.subscription_update).toEqual({ enabled: false })
    expect(cfg.features.subscription_cancel).toEqual({ enabled: false }) // card only (Aria 4:05 PM)
    expect(cfg.features.payment_method_update).toEqual({ enabled: true })
    expect(cfg).not.toHaveProperty('is_default')
    expect(r.portalConfigurationId).toMatch(/^bpc_/)
  })

  it('second run creates nothing (only refreshes the portal configuration)', async () => {
    await setupLadder(f.stripe, ladder, quiet)
    const r2 = await setupLadder(f.stripe, ladder, quiet)
    // 6 steps + the tip + 2 add-ons (Oct 4)
    expect(f.stripe.products.create).toHaveBeenCalledTimes(9)
    expect(f.stripe.prices.create).toHaveBeenCalledTimes(9)
    expect(f.stripe.billingPortal.configurations.create).toHaveBeenCalledTimes(1)
    expect(r2.actions).toEqual([expect.stringMatching(/^update portal configuration bpc_/)])
  })

  it('a price that drifted from the config is replaced (lookup key transferred, old one inactive)', async () => {
    await setupLadder(f.stripe, ladder, quiet)
    const old = f.state.prices.find((x) => x.lookup_key === 'freeplug_step_leads_monthly')!
    old.unit_amount = 7000
    const r = await setupLadder(f.stripe, ladder, quiet)
    expect(f.stripe.prices.create).toHaveBeenCalledTimes(10)
    expect(f.stripe.prices.create.mock.calls[9][0]).toMatchObject({ lookup_key: 'freeplug_step_leads_monthly', unit_amount: 7500, transfer_lookup_key: true })
    expect(old.active).toBe(false)
    expect(r.priceIds.leads).not.toBe(old.id)
  })

  it('moves lookup keys off the retired single product, then archives it', async () => {
    const g = fakeStripe({ retired: true })
    for (const s of ladder.PLAN_STEPS) {
      g.state.prices.push({ id: `old_${s.id}`, lookup_key: s.lookupKey, product: 'freeplug_hosting_ladder', active: true, currency: 'usd', unit_amount: s.monthlyCents, type: 'recurring', recurring: { interval: 'month', interval_count: 1 }, livemode: false })
    }
    await setupLadder(g.stripe, ladder, quiet)
    expect(g.state.prices.filter((p) => p.product === 'freeplug_hosting_ladder').every((p) => !p.active)).toBe(true)
    expect(g.state.products.get('freeplug_hosting_ladder')?.active).toBe(false)
    for (const s of ladder.PLAN_STEPS) expect(g.state.prices.find((p) => p.lookup_key === s.lookupKey)?.product).toBe(s.productId)
  })

  it('dry run writes nothing', async () => {
    const r = await setupLadder(f.stripe, ladder, { ...quiet, dryRun: true })
    expect(f.stripe.products.create).not.toHaveBeenCalled()
    expect(f.stripe.prices.create).not.toHaveBeenCalled()
    expect(f.stripe.billingPortal.configurations.create).not.toHaveBeenCalled()
    expect(r.actions).toHaveLength(19) // 6 products + 6 prices + tip product + tip price + 2 add-on products + 2 add-on prices + portal
  })

  it('stops if Stripe ever answers with a live-mode object', async () => {
    const live = fakeStripe({ livemode: true })
    await expect(setupLadder(live.stripe, ladder, quiet)).rejects.toThrow(/not a test-mode object/)
    expect(live.stripe.prices.create).not.toHaveBeenCalled()
  })

  it('the probe-only switching configuration is what Aria asked the portal for (kept inactive)', () => {
    const cfg = setup.switchingPortalConfig(ladder.PLAN_STEPS, Object.fromEntries(ladder.PLAN_STEPS.map((s) => [s.id, `price_${s.id}`])))
    expect(cfg.features.subscription_update.products).toHaveLength(6)
    expect(cfg.features.subscription_update.schedule_at_period_end).toEqual({ conditions: [{ type: 'decreasing_item_amount' }] })
    expect(cfg.metadata).toEqual({ freeplug_ladder_probe: 'v1' })
  })
})

describe('stripe-test-setup-ladder: add-ons (Oct 4, --addons-only)', () => {
  it('creates one product + one monthly licensed USD price per ADDONS entry, with the fixed ids and lookup keys; never the portal', async () => {
    const f = fakeStripe()
    const r = await setup.setupAddons(f.stripe, ladder, quiet)
    expect(f.stripe.billingPortal.configurations.list).not.toHaveBeenCalled()
    expect(f.stripe.billingPortal.configurations.create).not.toHaveBeenCalled()
    expect([...f.state.products.keys()].sort()).toEqual(['freeplug_extra_big_change', 'freeplug_extra_small_edit'])
    const small = f.state.prices.find((p) => p.lookup_key === 'freeplug_addon_small_edit_monthly')!
    const big = f.state.prices.find((p) => p.lookup_key === 'freeplug_addon_big_change_monthly')!
    expect(small).toMatchObject({ product: 'freeplug_extra_small_edit', currency: 'usd', unit_amount: 500, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } })
    expect(big).toMatchObject({ product: 'freeplug_extra_big_change', currency: 'usd', unit_amount: 575, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } })
    expect(r.addonPriceIds).toEqual({ small_edit: small.id, big_change: big.id })
  })
  it('idempotent: a second run creates nothing; a drifted price is replaced with the lookup key transferred', async () => {
    const f = fakeStripe()
    await setup.setupAddons(f.stripe, ladder, quiet)
    const again = await setup.setupAddons(f.stripe, ladder, quiet)
    expect(again.actions).toEqual([])
    expect(f.stripe.prices.create).toHaveBeenCalledTimes(2)
    const old = f.state.prices.find((p) => p.lookup_key === 'freeplug_addon_big_change_monthly')!
    old.unit_amount = 600
    await setup.setupAddons(f.stripe, ladder, quiet)
    expect(f.stripe.prices.create.mock.calls[2][0]).toMatchObject({ lookup_key: 'freeplug_addon_big_change_monthly', unit_amount: 575, transfer_lookup_key: true })
    expect(old.active).toBe(false)
  })
  it('stops on a live-mode object', async () => {
    const live = fakeStripe({ livemode: true })
    live.state.products.set('freeplug_extra_small_edit', { id: 'freeplug_extra_small_edit', active: true, livemode: true })
    await expect(setup.setupAddons(live.stripe, ladder, quiet)).rejects.toThrow(/not a test-mode object/)
    expect(live.stripe.prices.create).not.toHaveBeenCalled()
  })
})

describe('stripe-test-setup-ladder: --tag-probes (condition 4, test mode only)', () => {
  function probeFake(live = false) {
    const obj = (o: Record<string, unknown>) => ({ livemode: live, metadata: {}, ...o })
    const state = {
      customer: obj({ id: setup.PROBE_CUSTOMER_ID, metadata: { freeplug_probe: setup.PROBE_TAG } }) as Record<string, unknown> & { metadata: Record<string, string> },
      subs: [obj({ id: 'sub_done', status: 'canceled' }), obj({ id: 'sub_live', status: 'active' })] as Array<Record<string, unknown>>,
      products: new Map<string, Record<string, unknown>>([
        ['freeplug_probe_legacy_hosting', obj({ id: 'freeplug_probe_legacy_hosting', active: true })],
        ['freeplug_probe_legacy_addon_pro', obj({ id: 'freeplug_probe_legacy_addon_pro', active: true })],
        ['freeplug_hosting_ladder', obj({ id: 'freeplug_hosting_ladder', active: false })],
        ['freeplug_step_starter', obj({ id: 'freeplug_step_starter', active: true })],
      ]),
      prices: [obj({ id: 'price_old', product: 'freeplug_hosting_ladder', active: false }), obj({ id: 'price_step', product: 'freeplug_step_starter', active: true })] as Array<Record<string, unknown>>,
      configs: [obj({ id: 'bpc_probe', active: false, metadata: { freeplug_ladder_probe: 'v1' } }), obj({ id: 'bpc_ladder', active: true })] as Array<Record<string, unknown>>,
    }
    const merge = (o: Record<string, unknown>, p: Record<string, unknown>) =>
      Object.assign(o, p, { metadata: { ...(o.metadata as object), ...((p.metadata as object) ?? {}) } })
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => state.customer),
        list: vi.fn(async () => ({ data: [] })),
        update: vi.fn(async (_id: string, p: Record<string, unknown>) => merge(state.customer, p)),
      },
      subscriptions: {
        list: vi.fn(async () => ({ data: state.subs })),
        update: vi.fn(async (id: string, p: Record<string, unknown>) => merge(state.subs.find((s) => s.id === id)!, p)),
      },
      products: {
        retrieve: vi.fn(async (id: string) => {
          const p = state.products.get(id)
          if (!p) throw Object.assign(new Error('No such product'), { statusCode: 404 })
          return p
        }),
        update: vi.fn(async (id: string, p: Record<string, unknown>) => merge(state.products.get(id)!, p)),
      },
      prices: {
        list: vi.fn(async (q: { product: string }) => ({ data: state.prices.filter((p) => p.product === q.product) })),
        update: vi.fn(async (id: string, p: Record<string, unknown>) => merge(state.prices.find((x) => x.id === id)!, p)),
      },
      billingPortal: {
        configurations: {
          list: vi.fn(async () => ({ data: state.configs })),
          update: vi.fn(async (id: string, p: Record<string, unknown>) => merge(state.configs.find((c) => c.id === id)!, p)),
        },
      },
    }
    return { stripe, state }
  }

  it('archives the probe products and tags customer, live probe subs, products, prices and the probe portal config', async () => {
    const f = probeFake()
    const changes = await setup.tagProbeLeftovers(f.stripe, quiet)
    expect(f.state.customer.metadata).toMatchObject({ probe: 'true', freeplug_probe: setup.PROBE_TAG })
    for (const id of setup.PROBE_PRODUCT_IDS) expect(f.state.products.get(id)).toMatchObject({ active: false, metadata: { probe: 'true' } })
    expect(f.state.products.get('freeplug_hosting_ladder')).toMatchObject({ active: false, metadata: { probe: 'true' } })
    expect(f.state.prices.find((p) => p.id === 'price_old')).toMatchObject({ active: false, metadata: { probe: 'true' } })
    expect(f.state.configs[0]).toMatchObject({ id: 'bpc_probe', active: false, metadata: { probe: 'true' } })
    expect(f.stripe.subscriptions.update).toHaveBeenCalledTimes(1)
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith('sub_live', { metadata: { probe: 'true' } })
    expect(changes.length).toBeGreaterThan(0)
    // never touches the six sold step products/prices or the ladder portal configuration
    expect(f.state.products.get('freeplug_step_starter')).toMatchObject({ active: true, metadata: {} })
    expect(f.state.prices.find((p) => p.id === 'price_step')).toMatchObject({ active: true, metadata: {} })
    expect(f.state.configs[1]).toMatchObject({ id: 'bpc_ladder', active: true, metadata: {} })
    // and deletes nothing
    expect(Object.keys(f.stripe.products)).not.toContain('del')
  })

  it('second run changes nothing', async () => {
    const f = probeFake()
    await setup.tagProbeLeftovers(f.stripe, quiet)
    expect(await setup.tagProbeLeftovers(f.stripe, quiet)).toEqual([])
  })

  it('refuses before writing if Stripe answers with a live-mode object', async () => {
    const f = probeFake(true)
    await expect(setup.tagProbeLeftovers(f.stripe, quiet)).rejects.toThrow(/not a test-mode object/)
    expect(f.stripe.customers.update).not.toHaveBeenCalled()
    expect(f.stripe.products.update).not.toHaveBeenCalled()
  })
})
