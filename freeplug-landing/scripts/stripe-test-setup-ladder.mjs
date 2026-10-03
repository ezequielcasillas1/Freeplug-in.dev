#!/usr/bin/env node
/**
 * Hosting ladder: Stripe TEST-MODE setup (Owen, Oct 3 2026). Idempotent; safe to re-run.
 *
 *   node scripts/stripe-test-setup-ladder.mjs --env-file <path to a file with STRIPE_SECRET_KEY=...>
 *        [--dry-run]   read only: list what exists and what would be created or changed
 *        [--probe]     also run the proration / Billing Portal probes on a tagged test customer
 *
 * TEST MODE ONLY. The key is read from the --env-file (only the STRIPE_SECRET_KEY line), never
 * from the shell environment, and never printed. Anything but an sk_test_ / rk_test_ key is
 * refused before a single request is made (sk_live_ / rk_live_ by name). Every object Stripe
 * returns must say livemode=false or the script stops. Live prices wait for Ezequiel.
 *
 * What it makes (values come from src/lib/plans/ladder.ts, the one config module):
 *   - 6 Products freeplug_step_<id> ("Freeplug Hosting: <Step>"), each with ONE monthly USD price,
 *     lookup key freeplug_step_<id>_monthly, metadata.plan_step, nickname (Aria section 6.1).
 *     A price that no longer matches the config (amount, currency, interval or product) is
 *     replaced: the new price takes the lookup key (transfer_lookup_key), the old one goes inactive.
 *     Test finding (Oct 3): Stripe refuses a portal configuration listing one product with several
 *     prices of the same interval, and the portal only schedules period-end downgrades between
 *     prices of the SAME product, so a monthly ladder can't get "downgrade at period end" from
 *     the portal. Plan moves therefore happen in the app (src/lib/stripe/change-plan.ts).
 *   - A NON-default Billing Portal configuration (metadata.freeplug_ladder=v1): payment method
 *     update, invoice history, cancel at period end; plan switching OFF (the app does moves, so
 *     nobody gets an immediate mid-month downgrade credit). Id -> STRIPE_PORTAL_CONFIGURATION_ID.
 *   - Retired: the single product freeplug_hosting_ladder from the first test run is archived
 *     once none of its prices is active.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PORTAL_TAG = 'v1'
export const PROBE_EMAIL = 'ladder-probe@example.test'
export const PROBE_TAG = 'ladder-2026-10-03'

export class SetupRefused extends Error {}

/** Masks anything shaped like a Stripe secret/restricted key in a message before it is printed. */
export function redact(text) {
  return String(text).replace(/\b(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_[redacted]')
}

/** Only the prefix is looked at. Throws SetupRefused for anything but a test key. */
export function assertTestKey(key) {
  if (typeof key !== 'string' || key.length === 0) throw new SetupRefused('STRIPE_SECRET_KEY is missing in the env file.')
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    throw new SetupRefused('Refused: this is a LIVE Stripe key. This script runs in test mode only.')
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new SetupRefused('Refused: STRIPE_SECRET_KEY must start with sk_test_ or rk_test_.')
  }
  return key
}

/** Reads ONLY the STRIPE_SECRET_KEY line of an env file. Returns the key; never logs it. */
export function readKeyFromEnvFile(file, read = (p) => readFileSync(p, 'utf8')) {
  if (!file) throw new SetupRefused('Pass --env-file <path>. The key is never read from the shell environment.')
  const text = read(file)
  let key = ''
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?STRIPE_SECRET_KEY\s*=\s*(.*)\s*$/)
    if (m) key = m[1].replace(/^['"]|['"]$/g, '').trim()
  }
  return assertTestKey(key)
}

export function assertTestObject(obj, what) {
  if (!obj || obj.livemode !== false) throw new SetupRefused(`Refused: ${what} is not a test-mode object (livemode must be false).`)
  return obj
}

export const RETIRED_PRODUCT_IDS = ['freeplug_hosting_ladder']

export function priceMatches(price, step, productId = step.productId) {
  const product = typeof price.product === 'string' ? price.product : price.product?.id
  return (
    price.active === true &&
    product === productId &&
    price.currency === 'usd' &&
    price.unit_amount === step.monthlyCents &&
    price.type === 'recurring' &&
    price.recurring?.interval === 'month' &&
    (price.recurring?.interval_count ?? 1) === 1
  )
}

export function desiredPortalConfig() {
  return {
    business_profile: { headline: 'Freeplug hosting plan' },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
      // Plan moves are done in the app: upgrades now + prorated, downgrades at period end.
      subscription_update: { enabled: false },
    },
    metadata: { freeplug_ladder: PORTAL_TAG },
  }
}

/** What Aria's card asked the portal to do (switch between the 6 steps, downgrades at period end). */
export function switchingPortalConfig(PLAN_STEPS, priceIds) {
  return {
    business_profile: { headline: 'Freeplug hosting plan (probe)' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: PLAN_STEPS.map((s) => ({ product: s.productId, prices: [priceIds[s.id]] })),
        schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] },
      },
    },
    metadata: { freeplug_ladder_probe: PORTAL_TAG },
  }
}

async function loadLadder() {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url)
  return jiti.import(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'plans', 'ladder.ts'))
}

/** The idempotent setup. `stripe` is an initialised Stripe client on a test key. */
export async function setupLadder(stripe, ladder, { dryRun = false, log = console.log } = {}) {
  const { PLAN_STEPS, productNameFor } = ladder
  const actions = []

  // Products: one per step
  for (const step of PLAN_STEPS) {
    let product = null
    try {
      product = assertTestObject(await stripe.products.retrieve(step.productId), `product ${step.productId}`)
    } catch (e) {
      if (e instanceof SetupRefused) throw e
      if (e?.statusCode !== 404 && e?.code !== 'resource_missing') throw e
    }
    if (!product) {
      actions.push(`create product ${step.productId}`)
      if (!dryRun) {
        assertTestObject(
          await stripe.products.create(
            { id: step.productId, name: productNameFor(step), metadata: { app: 'freeplug', plan_step: step.id, ladder: '2026-10-03' } },
            { idempotencyKey: `ladder-product-${step.productId}` }
          ),
          `product ${step.productId}`
        )
      }
    } else if (!product.active || product.name !== productNameFor(step)) {
      actions.push(`update product ${step.productId} (active, name)`)
      if (!dryRun) await stripe.products.update(step.productId, { active: true, name: productNameFor(step) })
    }
  }

  // Prices: one monthly price per step product
  const existing = await stripe.prices.list({ lookup_keys: PLAN_STEPS.map((s) => s.lookupKey), limit: 100 })
  for (const p of existing.data) assertTestObject(p, `price ${p.id}`)
  /** @type {Record<string, string>} */
  const priceIds = {}
  for (const step of PLAN_STEPS) {
    const found = existing.data.find((p) => p.lookup_key === step.lookupKey)
    if (found && priceMatches(found, step)) {
      priceIds[step.id] = found.id
      if (found.metadata?.plan_step !== step.id || found.nickname !== step.name) {
        actions.push(`update price ${found.id} metadata/nickname (${step.lookupKey})`)
        if (!dryRun) await stripe.prices.update(found.id, { metadata: { plan_step: step.id }, nickname: step.name })
      }
      continue
    }
    actions.push(found ? `replace price ${found.id} (${step.lookupKey}: no longer matches the config)` : `create price ${step.lookupKey} ($${step.monthlyCents / 100}/month)`)
    if (dryRun) continue
    const created = assertTestObject(
      await stripe.prices.create({
        product: step.productId,
        currency: 'usd',
        unit_amount: step.monthlyCents,
        recurring: { interval: 'month', interval_count: 1 },
        lookup_key: step.lookupKey,
        transfer_lookup_key: Boolean(found),
        nickname: step.name,
        metadata: { plan_step: step.id },
      }),
      `price ${step.lookupKey}`
    )
    priceIds[step.id] = created.id
    if (found?.active) await stripe.prices.update(found.id, { active: false })
  }

  // Retired single product from the first test run: archive once no price on it is active.
  for (const id of RETIRED_PRODUCT_IDS) {
    let old = null
    try {
      old = assertTestObject(await stripe.products.retrieve(id), `product ${id}`)
    } catch (e) {
      if (e instanceof SetupRefused) throw e
    }
    if (!old?.active) continue
    const live = await stripe.prices.list({ product: id, active: true, limit: 100 })
    if (live.data.length === 0) {
      actions.push(`archive retired product ${id}`)
      if (!dryRun) await stripe.products.update(id, { active: false })
    }
  }

  // Billing Portal configuration (never the default one)
  const list = await stripe.billingPortal.configurations.list({ limit: 100 })
  const mine = list.data.find((c) => c.metadata?.freeplug_ladder === PORTAL_TAG && !c.is_default)
  let portal = mine ? assertTestObject(mine, 'portal configuration') : null
  if (mine) {
    actions.push(`update portal configuration ${mine.id}`)
    if (!dryRun) portal = assertTestObject(await stripe.billingPortal.configurations.update(mine.id, { ...desiredPortalConfig(), active: true }), 'portal configuration')
  } else {
    actions.push('create portal configuration (non-default)')
    if (!dryRun) portal = assertTestObject(await stripe.billingPortal.configurations.create(desiredPortalConfig()), 'portal configuration')
  }

  log(`mode: TEST (livemode=false on every object)${dryRun ? ' [dry run]' : ''}`)
  for (const a of actions) log(`  ${dryRun ? 'would ' : ''}${a}`)
  return { priceIds, portalConfigurationId: portal?.id ?? null, actions }
}

async function ensureProbeProduct(stripe, id, name) {
  try {
    return assertTestObject(await stripe.products.retrieve(id), `product ${id}`)
  } catch (e) {
    if (e instanceof SetupRefused) throw e
    return assertTestObject(await stripe.products.create({ id, name, metadata: { freeplug_probe: PROBE_TAG } }), `product ${id}`)
  }
}

/**
 * Proration + plan-move + portal probes, TEST MODE, on ONE tagged test customer (reused on
 * re-runs). Exercises the app's real move code (src/lib/stripe/change-plan.ts) against Stripe.
 */
export async function runProbes(stripe, ladder, setup, { log = console.log } = {}) {
  const { PLAN_STEPS } = ladder
  const { createJiti } = await import('jiti')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const { changePlanStep } = await createJiti(import.meta.url).import(path.join(here, '..', 'src', 'lib', 'stripe', 'change-plan.ts'))
  const priceIdFor = async (id) => setup.priceIds[id]
  const lk = (sub) => sub.items.data.map((i) => i.price.lookup_key ?? `${i.price.id}(no lookup key)`).join(' + ')
  const out = {}

  const found = await stripe.customers.list({ email: PROBE_EMAIL, limit: 10 })
  let customer = found.data.find((c) => c.metadata?.freeplug_probe === PROBE_TAG)
  if (!customer) customer = await stripe.customers.create({ email: PROBE_EMAIL, name: 'Ladder probe (test mode)', metadata: { freeplug_probe: PROBE_TAG } })
  assertTestObject(customer, 'probe customer')
  const cleanSubs = async () => {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })
    for (const s of subs.data) {
      if (s.schedule) await stripe.subscriptionSchedules.release(typeof s.schedule === 'string' ? s.schedule : s.schedule.id).catch(() => undefined)
      if (!['canceled', 'incomplete_expired'].includes(s.status)) await stripe.subscriptions.cancel(s.id)
    }
  }
  await cleanSubs()
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })
  const fresh = (id) => stripe.subscriptions.retrieve(id)

  // A) Ladder subscription: Starter -> Leads (upgrade now, prorated) -> Priority (downgrade at period end) -> Leads (cancels the pending downgrade)
  let sub = assertTestObject(
    await stripe.subscriptions.create({ customer: customer.id, items: [{ price: setup.priceIds.starter }], metadata: { type: 'hosting', plan_step: 'starter', freeplug_probe: PROBE_TAG } }),
    'probe subscription'
  )
  out.A_created = { status: sub.status, items: lk(sub) }
  const preview = await stripe.invoices.createPreview({
    customer: customer.id,
    subscription: sub.id,
    subscription_details: { items: [{ id: sub.items.data[0].id, price: setup.priceIds.leads }], proration_behavior: 'always_invoice' },
  })
  out.A_upgradePreview = { amount_due: preview.amount_due, lines: preview.lines.data.map((l) => ({ amount: l.amount, description: l.description })) }
  const up = await changePlanStep({ stripe, priceIdFor }, sub, 'leads')
  sub = await fresh(sub.id)
  const upInv = await stripe.invoices.retrieve(typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice.id)
  out.A_upgrade = { result: up, itemsNow: lk(sub), invoice: { status: upInv.status, total: upInv.total, billing_reason: upInv.billing_reason, lines: upInv.lines.data.map((l) => ({ amount: l.amount, description: l.description })) } }
  const down = await changePlanStep({ stripe, priceIdFor }, sub, 'priority')
  sub = await fresh(sub.id)
  const sched = await stripe.subscriptionSchedules.retrieve(typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
  out.A_downgrade = {
    result: down,
    itemsNow: lk(sub),
    periodEnd: new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
    schedulePhases: sched.phases.map((p) => ({ start: new Date(p.start_date * 1000).toISOString(), prices: p.items.map((i) => (typeof i.price === 'string' ? i.price : i.price.id)) })),
    nextPhaseIsPriority: sched.phases[1]?.items[0]?.price === setup.priceIds.priority,
  }
  const back = await changePlanStep({ stripe, priceIdFor }, sub, 'leads')
  sub = await fresh(sub.id)
  out.A_cancelPendingDowngrade = { result: back, scheduleAfter: sub.schedule ?? null, itemsNow: lk(sub) }

  // Portal session on the ladder configuration (switching off): payment method, invoices, cancel.
  const session = async (label, params) => {
    try {
      const s = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: 'https://example.test/dashboard', ...params })
      return { label, ok: true, configuration: s.configuration, flow: s.flow?.type ?? null }
    } catch (e) {
      return { label, ok: false, error: redact(`${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 220)}`) }
    }
  }
  out.portal = [await session('ladder configuration, plain session', { configuration: setup.portalConfigurationId })]

  // What Aria's card asked for: a portal config switching between the 6 step products with
  // period-end downgrades. Created as a separate, tagged probe configuration, then deactivated.
  let probeCfg = null
  try {
    const all = await stripe.billingPortal.configurations.list({ limit: 100 })
    probeCfg = all.data.find((c) => c.metadata?.freeplug_ladder_probe === PORTAL_TAG) ?? null
    const want = switchingPortalConfig(PLAN_STEPS, setup.priceIds)
    probeCfg = probeCfg
      ? await stripe.billingPortal.configurations.update(probeCfg.id, { ...want, active: true })
      : await stripe.billingPortal.configurations.create(want)
    const su = probeCfg.features.subscription_update
    out.switchingConfig = { accepted: true, id: probeCfg.id, schedule_at_period_end: su.schedule_at_period_end, products: su.products?.length, proration_behavior: su.proration_behavior }
    out.portal.push(
      await session('switching config: confirm downgrade leads -> priority', {
        configuration: probeCfg.id,
        flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: { subscription: sub.id, items: [{ id: sub.items.data[0].id, price: setup.priceIds.priority }] } },
      }),
      await session('switching config: confirm upgrade leads -> growth', {
        configuration: probeCfg.id,
        flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: { subscription: sub.id, items: [{ id: sub.items.data[0].id, price: setup.priceIds.growth }] } },
      })
    )
  } catch (e) {
    out.switchingConfig = { accepted: false, error: redact(`${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 220)}`) }
  } finally {
    if (probeCfg?.active) await stripe.billingPortal.configurations.update(probeCfg.id, { active: false }).catch(() => undefined)
  }
  await stripe.subscriptions.cancel(sub.id)

  // B) Grandfathered plan (old dashboard checkout shape: ad-hoc hosting price + "Pro add-on").
  const legacyHosting = await ensureProbeProduct(stripe, 'freeplug_probe_legacy_hosting', 'Website hosting (probe, legacy shape)')
  const legacyAddon = await ensureProbeProduct(stripe, 'freeplug_probe_legacy_addon_pro', 'Pro add-on (probe, legacy shape)')
  let legacy = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      { price_data: { currency: 'usd', product: legacyHosting.id, unit_amount: 4000, recurring: { interval: 'month' } } },
      { price_data: { currency: 'usd', product: legacyAddon.id, unit_amount: 1500, recurring: { interval: 'month' } } },
    ],
    metadata: { type: 'hosting', freeplug_probe: PROBE_TAG },
  })
  out.B_legacyCreated = { status: legacy.status, items: lk(legacy) }
  out.portal.push(
    await session('legacy plan: ladder configuration, plain session', { configuration: setup.portalConfigurationId }),
    await session('legacy plan: Stripe default configuration, subscription_update flow', { flow_data: { type: 'subscription_update', subscription_update: { subscription: legacy.id } } })
  )
  const lDown = await changePlanStep({ stripe, priceIdFor }, legacy, 'starter')
  legacy = await fresh(legacy.id)
  out.B_legacyDowngradeToStarter = { result: lDown, itemsNow: lk(legacy), schedule: legacy.schedule ? 'attached' : null }
  const lUp = await changePlanStep({ stripe, priceIdFor }, legacy, 'growth')
  legacy = await fresh(legacy.id)
  const lInv = await stripe.invoices.retrieve(typeof legacy.latest_invoice === 'string' ? legacy.latest_invoice : legacy.latest_invoice.id)
  out.B_legacyUpgradeToGrowth = { result: lUp, itemsNow: lk(legacy), schedule: legacy.schedule ?? null, invoice: { status: lInv.status, total: lInv.total, lines: lInv.lines.data.map((l) => ({ amount: l.amount, description: l.description })) } }

  // Ladder portal config readback
  const cfg = await stripe.billingPortal.configurations.retrieve(setup.portalConfigurationId)
  out.ladderPortalConfig = {
    id: cfg.id,
    is_default: cfg.is_default,
    active: cfg.active,
    subscription_update: cfg.features.subscription_update.enabled,
    cancel: { enabled: cfg.features.subscription_cancel.enabled, mode: cfg.features.subscription_cancel.mode },
    payment_method_update: cfg.features.payment_method_update.enabled,
    invoice_history: cfg.features.invoice_history.enabled,
  }

  await cleanSubs()
  out.cleanup = { subscriptions: 'all probe subscriptions canceled, schedules released', customer: `${customer.id} kept (metadata.freeplug_probe=${PROBE_TAG})` }
  log(JSON.stringify(out, null, 2))
  return out
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const key = readKeyFromEnvFile(arg('--env-file'))
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key, { maxNetworkRetries: 2 })
  const ladder = await loadLadder()
  const setup = await setupLadder(stripe, ladder, { dryRun: argv.includes('--dry-run') })
  for (const s of ladder.PLAN_STEPS) console.log(`  ${s.productId} / ${s.lookupKey} -> ${setup.priceIds[s.id] ?? '(missing)'}`)
  console.log(`portal configuration: ${setup.portalConfigurationId ?? '(none yet)'}`)
  if (setup.portalConfigurationId) console.log(`set STRIPE_PORTAL_CONFIGURATION_ID=${setup.portalConfigurationId} (not a secret)`)
  if (argv.includes('--probe') && !argv.includes('--dry-run')) await runProbes(stripe, ladder, setup)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => {
    // Never print the key: messages from this script don't contain it; Stripe errors are trimmed.
    console.error(redact(e instanceof SetupRefused ? e.message : `Stripe setup failed: ${e?.type ?? ''} ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 200)}`))
    process.exit(e instanceof SetupRefused ? 2 : 1)
  })
}
