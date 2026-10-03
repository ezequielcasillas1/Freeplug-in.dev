#!/usr/bin/env node
/**
 * Hosting ladder: Stripe TEST-MODE setup (Owen, Oct 3 2026). Idempotent; safe to re-run.
 *
 *   node scripts/stripe-test-setup-ladder.mjs --env-file <path to a file with STRIPE_SECRET_KEY=...>
 *        [--dry-run]   read only: list what exists and what would be created or changed
 *        [--probe]     also run the proration / Billing Portal probes on a tagged test customer
 *        [--probe-conditions]  Aria's 12:25 conditions against Stripe with the app's own code:
 *                      failed-card upgrade, upgrade over a pending downgrade, cancel vs downgrade
 *                      both ways, a non-sellable target, and the webhook events Stripe emits
 *        [--tag-probes] archive the probe products and tag every probe leftover metadata.probe=true
 *        [--probe-checkout-expiry]  Aria's 12:56 open-checkout rule on REAL open sessions (probe
 *                      customer only): expires_at = now + 1 h, the expiry of non-sellable steps'
 *                      sessions (idempotent second run), and the sellable session left open
 *        [--probe-upgrade-confirm]  Aria 1:34 PM: preview amount == invoiced amount, pending downgrade,
 *                      stale/future proration_date refused, double Confirm charges once (probe customer)
 *        [--probe-billing]  card-update portal flow and invoice list, with and without a schedule
 *        [--probe-tips]  the tipping system: checkout line items with a tip, tip change next cycle
 *                      (no proration), upgrade with a tip (tip removed, preview == invoice), downgrade
 *                      with a tip (tip dropped in the schedule's next phase), tip change refused while
 *                      a switch is planned, and the change-plan lock (two concurrent confirms over a
 *                      pending downgrade: one upgrade, one charge; needs --lock-db <postgres url>)
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
 *     update only (Aria 4:05 PM; the app uses the dedicated one from scripts/stripe-portal-config.mjs);
 *     plan switching OFF (the app does moves, so
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
/** [Sable] Stripe-visible name of the tip product (shows on invoices and Checkout). */
export const TIP_PRODUCT_NAME = 'Optional monthly tip' // invoice line "4 × Optional monthly tip" (Aria, Oct 3 3:43 PM)

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
    // Card only (Aria, Oct 3 4:05 PM), the same flags as scripts/stripe-portal-config.mjs, whose
    // dedicated configuration is the one the app uses. Plan moves, cancel and resume are in the app.
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: false },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
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

  // The tipping system (Oct 3): ONE recurring $1/month price on a fixed tip product; the tip is the
  // item's quantity (whole dollars). Same replace-if-mismatched rule as the step prices.
  let tipPriceId = null
  if (ladder.TIP_LOOKUP_KEY) {
    const tipProductId = ladder.TIP_PRODUCT_ID
    let tipProduct = null
    try {
      tipProduct = assertTestObject(await stripe.products.retrieve(tipProductId), `product ${tipProductId}`)
    } catch (e) {
      if (e instanceof SetupRefused) throw e
      if (e?.statusCode !== 404 && e?.code !== 'resource_missing') throw e
    }
    if (!tipProduct) {
      actions.push(`create product ${tipProductId}`)
      if (!dryRun) {
        assertTestObject(
          await stripe.products.create(
            { id: tipProductId, name: TIP_PRODUCT_NAME, metadata: { app: 'freeplug', kind: 'tip', ladder: '2026-10-03' } },
            { idempotencyKey: `ladder-product-${tipProductId}` }
          ),
          `product ${tipProductId}`
        )
      }
    } else if (!tipProduct.active || tipProduct.name !== TIP_PRODUCT_NAME) {
      actions.push(`update product ${tipProductId} (active, name)`)
      if (!dryRun) await stripe.products.update(tipProductId, { active: true, name: TIP_PRODUCT_NAME })
    }
    const tipStep = { monthlyCents: ladder.TIP_UNIT_CENTS, productId: tipProductId }
    const tipList = await stripe.prices.list({ lookup_keys: [ladder.TIP_LOOKUP_KEY], limit: 10 })
    for (const p of tipList.data) assertTestObject(p, `price ${p.id}`)
    const foundTip = tipList.data.find((p) => p.lookup_key === ladder.TIP_LOOKUP_KEY)
    if (foundTip && priceMatches(foundTip, tipStep, tipProductId)) {
      tipPriceId = foundTip.id
    } else {
      actions.push(foundTip ? `replace price ${foundTip.id} (${ladder.TIP_LOOKUP_KEY}: no longer matches)` : `create price ${ladder.TIP_LOOKUP_KEY} ($1/month, quantity = tip dollars)`)
      if (!dryRun) {
        const created = assertTestObject(
          await stripe.prices.create({
            product: tipProductId,
            currency: 'usd',
            unit_amount: ladder.TIP_UNIT_CENTS,
            recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
            lookup_key: ladder.TIP_LOOKUP_KEY,
            transfer_lookup_key: Boolean(foundTip),
            nickname: 'Monthly tip ($1 x quantity)',
            metadata: { kind: 'tip' },
          }),
          `price ${ladder.TIP_LOOKUP_KEY}`
        )
        tipPriceId = created.id
        if (foundTip?.active) await stripe.prices.update(foundTip.id, { active: false })
      }
    }
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
  return { priceIds, tipPriceId, portalConfigurationId: portal?.id ?? null, actions }
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

/** Probe leftovers (test mode): customer, products, portal configuration. */
export const PROBE_CUSTOMER_ID = 'cus_VNH3Xkqqq8PPGA'
export const PROBE_PRODUCT_IDS = ['freeplug_probe_legacy_hosting', 'freeplug_probe_legacy_addon_pro']

/**
 * Condition 4 (Aria, Oct 3 12:25): archive (set inactive) the probe products and their prices, and
 * tag every probe leftover metadata.probe=true. TEST MODE ONLY (every object must say
 * livemode=false before it is changed). Nothing is deleted. Returns the change log.
 */
export async function tagProbeLeftovers(stripe, { log = console.log, retiredProductIds = RETIRED_PRODUCT_IDS } = {}) {
  const changes = []
  const note = (what, id, before, after) => changes.push({ what, id, before, after })
  // customer (found by id, or by the probe tag)
  let customer = null
  try {
    customer = await stripe.customers.retrieve(PROBE_CUSTOMER_ID)
  } catch {
    const found = await stripe.customers.list({ email: PROBE_EMAIL, limit: 10 })
    customer = found.data.find((c) => c.metadata?.freeplug_probe === PROBE_TAG) ?? null
  }
  if (customer && !customer.deleted) {
    assertTestObject(customer, 'probe customer')
    if (customer.metadata?.probe !== 'true') {
      const after = await stripe.customers.update(customer.id, { metadata: { probe: 'true' } })
      note('customer', customer.id, { probe: customer.metadata?.probe ?? null }, { probe: after.metadata.probe })
    }
    // live probe subscriptions get the tag too (canceled ones can't be changed and are left as is)
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })
    for (const sub of subs.data) {
      assertTestObject(sub, 'probe subscription')
      if (!['canceled', 'incomplete_expired'].includes(sub.status) && sub.metadata?.probe !== 'true') {
        await stripe.subscriptions.update(sub.id, { metadata: { probe: 'true' } })
        note('subscription', sub.id, { probe: sub.metadata?.probe ?? null }, { probe: 'true' })
      }
    }
  }
  // probe products: archive + tag; their active prices: inactive + tag
  for (const id of [...PROBE_PRODUCT_IDS, ...retiredProductIds]) {
    let product
    try {
      product = assertTestObject(await stripe.products.retrieve(id), `product ${id}`)
    } catch (e) {
      if (e instanceof SetupRefused) throw e
      continue
    }
    const want = { active: false, metadata: { probe: 'true', ...(retiredProductIds.includes(id) ? { freeplug_leftover: 'first test run (single product), replaced by freeplug_step_*' } : {}) } }
    if (product.active !== false || product.metadata?.probe !== 'true') {
      const prices = await stripe.prices.list({ product: id, limit: 100 })
      for (const price of prices.data) {
        assertTestObject(price, `price ${price.id}`)
        if (price.active || price.metadata?.probe !== 'true') {
          await stripe.prices.update(price.id, { active: false, metadata: { probe: 'true' } })
          note('price', price.id, { active: price.active, probe: price.metadata?.probe ?? null }, { active: false, probe: 'true' })
        }
      }
      const after = await stripe.products.update(id, want)
      note('product', id, { active: product.active, probe: product.metadata?.probe ?? null }, { active: after.active, probe: after.metadata.probe })
    }
  }
  // probe portal configuration(s): inactive + tag
  const cfgs = await stripe.billingPortal.configurations.list({ limit: 100 })
  for (const cfg of cfgs.data) {
    assertTestObject(cfg, `portal configuration ${cfg.id}`)
    if (!cfg.metadata?.freeplug_ladder_probe) continue
    if (cfg.active || cfg.metadata?.probe !== 'true') {
      const after = await stripe.billingPortal.configurations.update(cfg.id, { active: false, metadata: { probe: 'true' } })
      note('portal configuration', cfg.id, { active: cfg.active, probe: cfg.metadata?.probe ?? null }, { active: after.active, probe: after.metadata.probe })
    }
  }
  log(JSON.stringify({ tagProbeLeftovers: changes.length ? changes : 'nothing to change (already tagged)' }, null, 2))
  return changes
}

/**
 * Aria's 12:25 plan-switch conditions against Stripe TEST MODE, using the app's own code
 * (src/lib/stripe/change-plan.ts): every subscription is created on the tagged probe customer with
 * metadata.probe=true and canceled at the end. Returns (and logs) what Stripe answered.
 */
export async function runConditionProbes(stripe, ladder, setup, { log = console.log } = {}) {
  const { createJiti } = await import('jiti')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const cp = await createJiti(import.meta.url).import(path.join(here, '..', 'src', 'lib', 'stripe', 'change-plan.ts'))
  const priceIdFor = async (id) => setup.priceIds[id]
  const lk = (sub) => sub.items.data.map((i) => i.price.lookup_key ?? i.price.id).join(' + ')
  const iso = (t) => (t ? new Date(t * 1000).toISOString() : null)
  const out = { startedAt: new Date().toISOString() }
  const customer = assertTestObject(await stripe.customers.retrieve(PROBE_CUSTOMER_ID), 'probe customer')
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  const setDefaultCard = (pm) => stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm } })
  await setDefaultCard(visa.id)
  const tag = { type: 'hosting', freeplug_probe: PROBE_TAG, probe: 'true' }
  const created = []
  const newSub = async (step) => {
    const s = assertTestObject(await stripe.subscriptions.create({ customer: customer.id, items: [{ price: setup.priceIds[step] }], metadata: { ...tag, plan_step: step } }), 'probe subscription')
    created.push(s.id)
    return s
  }
  const fresh = (id) => stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] })
  const since = Math.floor(Date.now() / 1000) - 5

  // C1: upgrade with a failing card (pending_if_incomplete): old plan kept, invoice voided
  let s1 = await newSub('starter')
  const failPm = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customer.id })
  await setDefaultCard(failPm.id)
  const r1 = await cp.changePlanStep({ stripe, priceIdFor }, await fresh(s1.id), 'fast_lane')
  s1 = await fresh(s1.id)
  out.C1_failedCardUpgrade = { result: r1, itemsNow: lk(s1), pending_update: s1.pending_update, latestInvoice: { id: s1.latest_invoice?.id, status: s1.latest_invoice?.status } }
  // retry with a good card: a new request (idempotency key carries the voided invoice id)
  await setDefaultCard(visa.id)
  const r1b = await cp.changePlanStep({ stripe, priceIdFor }, await fresh(s1.id), 'fast_lane')
  s1 = await fresh(s1.id)
  out.C1b_retryWithGoodCard = { result: r1b, itemsNow: lk(s1), invoice: { status: s1.latest_invoice?.status, total: s1.latest_invoice?.total, billing_reason: s1.latest_invoice?.billing_reason } }

  // C2: downgrade pending, shown with its date; then upgrade releases the schedule first
  let s2 = await newSub('priority')
  const d2 = await cp.changePlanStep({ stripe, priceIdFor }, await fresh(s2.id), 'starter')
  s2 = await fresh(s2.id)
  const pend2 = await cp.pendingPlanChange(stripe, s2)
  out.C2_downgradeScheduled = { result: d2, itemsNow: lk(s2), schedule: s2.schedule, pendingShownOnPlansPage: pend2, periodEnd: iso(s2.items.data[0].current_period_end) }
  const u2 = await cp.changePlanStep({ stripe, priceIdFor }, s2, 'fast_lane')
  s2 = await fresh(s2.id)
  out.C2_upgradeOverPendingDowngrade = { result: u2, itemsNow: lk(s2), scheduleAfter: s2.schedule ?? null, invoice: { status: s2.latest_invoice?.status, total: s2.latest_invoice?.total } }

  // C3: failing card while a downgrade is pending: schedule released, upgrade not applied, downgrade put back
  let s3 = await newSub('priority')
  await cp.changePlanStep({ stripe, priceIdFor }, await fresh(s3.id), 'starter')
  s3 = await fresh(s3.id)
  await setDefaultCard(failPm.id)
  const r3 = await cp.changePlanStep({ stripe, priceIdFor }, s3, 'fast_lane')
  await setDefaultCard(visa.id)
  s3 = await fresh(s3.id)
  out.C3_failedUpgradeOverPendingDowngrade = { result: r3, itemsNow: lk(s3), pending_update: s3.pending_update, pendingAfter: await cp.pendingPlanChange(stripe, s3) }

  // C4: downgrade then cancel (s3 still has its downgrade): Stripe refuses a direct cancel; the app releases first
  try {
    await stripe.subscriptions.update(s3.id, { cancel_at_period_end: true })
    out.C4_directCancelWithSchedule = 'allowed'
  } catch (e) {
    out.C4_directCancelWithSchedule = redact(String(e?.message ?? e).slice(0, 220))
  }
  const c4 = await cp.cancelPlanAtPeriodEnd(stripe, s3)
  s3 = await fresh(s3.id)
  out.C4_downgradeThenCancel = { result: c4, cancel_at_period_end: s3.cancel_at_period_end, scheduleAfter: s3.schedule ?? null, itemsNow: lk(s3) }

  // C5: cancel then downgrade: refused by the app, nothing created in Stripe
  const r5 = await cp.changePlanStep({ stripe, priceIdFor }, s3, 'starter')
  s3 = await fresh(s3.id)
  out.C5_cancelThenDowngrade = { result: r5, scheduleAfter: s3.schedule ?? null, cancel_at_period_end: s3.cancel_at_period_end }

  // C6: a non-sellable target is refused before any Stripe write
  const r6 = await cp.changePlanStep({ stripe, priceIdFor }, await fresh(s2.id), 'leads')
  out.C6_nonSellableTarget = { result: r6, itemsNow: lk(await fresh(s2.id)) }

  // C7: what Stripe emits (the webhook is the only thing that changes entitlements)
  await new Promise((r) => setTimeout(r, 5000))
  const events = []
  for await (const e of stripe.events.list({ created: { gte: since }, limit: 100 })) {
    const obj = e.data.object
    const subId = obj.object === 'subscription' ? obj.id : obj.subscription
    if (!created.includes(subId)) continue
    events.push({ sub: subId, type: e.type, changed: e.data.previous_attributes ? Object.keys(e.data.previous_attributes) : undefined })
  }
  out.C7_events = events.reverse()

  for (const id of created) {
    const s = await stripe.subscriptions.retrieve(id)
    if (s.schedule) await stripe.subscriptionSchedules.release(typeof s.schedule === 'string' ? s.schedule : s.schedule.id).catch(() => undefined)
    if (!['canceled', 'incomplete_expired'].includes(s.status)) await stripe.subscriptions.cancel(id)
  }
  out.cleanup = `${created.length} probe subscriptions canceled (metadata.probe=true): ${created.join(', ')}`
  out.finishedAt = new Date().toISOString()
  log(JSON.stringify(out, null, 2))
  return out
}

/** Loads app TS modules for the probes (relative imports only; no server-only modules). */
async function appModule(rel) {
  const { createJiti } = await import('jiti')
  const here = path.dirname(fileURLToPath(import.meta.url))
  return createJiti(import.meta.url).import(path.join(here, '..', 'src', ...rel.split('/')))
}

/**
 * Aria 12:56, open checkouts: real open Checkout Sessions on the probe customer (metadata.probe=true),
 * expired with the app's expireUnsellableCheckoutSessions scoped to that customer. TEST MODE ONLY.
 */
export async function runCheckoutExpiryProbe(stripe, ladder, setup, { log = console.log } = {}) {
  const { checkoutSessionExpiresAt } = await appModule('lib/stripe/checkout-expiry.ts')
  const { expireUnsellableCheckoutSessions } = await appModule('lib/stripe/expire-unsellable-checkouts.ts')
  const out = { startedAt: new Date().toISOString() }
  const customer = assertTestObject(await stripe.customers.retrieve(PROBE_CUSTOMER_ID), 'probe customer')
  const make = async (step, withMeta) => {
    const expiresAt = checkoutSessionExpiresAt()
    const s = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      expires_at: expiresAt,
      line_items: [{ price: setup.priceIds[step], quantity: 1 }],
      success_url: 'https://example.test/probe?ok=1',
      cancel_url: 'https://example.test/probe?cancel=1',
      metadata: { probe: 'true', freeplug_probe: PROBE_TAG, ...(withMeta ? { type: 'hosting', plan_step: step } : {}) },
      subscription_data: { metadata: { probe: 'true', freeplug_probe: PROBE_TAG } },
    })
    assertTestObject(s, 'checkout session')
    return { id: s.id, step, metadata: withMeta ? 'plan_step' : 'none (lookup key)', status: s.status, expires_at: s.expires_at, requested: expiresAt, ttlMinutes: Math.round(((s.expires_at - s.created) / 60) * 10) / 10 }
  }
  out.created = [await make('leads', true), await make('growth', false), await make('starter', true)]
  const quiet = { log: (m) => log(m), customer: customer.id }
  const r1 = await expireUnsellableCheckoutSessions(stripe, quiet)
  out.run1 = r1
  out.afterRun1 = []
  for (const c of out.created) out.afterRun1.push({ id: c.id, step: c.step, status: (await stripe.checkout.sessions.retrieve(c.id)).status })
  out.run2_idempotent = await expireUnsellableCheckoutSessions(stripe, quiet)
  // cleanup: the sellable session is left open by the rule; expire it ourselves
  const starter = out.created.find((c) => c.step === 'starter')
  await stripe.checkout.sessions.expire(starter.id)
  out.cleanup = `expired the sellable (starter) probe session ${starter.id} by hand; all three carry metadata.probe=true`
  out.finishedAt = new Date().toISOString()
  log(JSON.stringify(out, null, 2))
  return out
}

/**
 * Aria 12:56, Manage billing with a schedule: the card-only portal flow and the in-app invoice list,
 * without and then with a schedule, using the app's billing-routing.ts. TEST MODE ONLY.
 */
export async function runBillingProbe(stripe, ladder, setup, { log = console.log } = {}) {
  const br = await appModule('lib/stripe/billing-routing.ts')
  const cp = await appModule('lib/stripe/change-plan.ts')
  const out = { startedAt: new Date().toISOString() }
  const customer = assertTestObject(await stripe.customers.retrieve(PROBE_CUSTOMER_ID), 'probe customer')
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: visa.id } })
  const env = { STRIPE_PORTAL_CONFIGURATION_ID: setup.portalConfigurationId ?? '' }
  const ret = 'https://example.test/dashboard/plans?card=updated'
  let sub = assertTestObject(
    await stripe.subscriptions.create({ customer: customer.id, items: [{ price: setup.priceIds.priority }], metadata: { type: 'hosting', plan_step: 'priority', freeplug_probe: PROBE_TAG, probe: 'true' } }),
    'probe subscription'
  )
  const session = async (label) => {
    try {
      const s = await stripe.billingPortal.sessions.create(br.paymentMethodUpdateSessionParams(customer.id, ret, env))
      return { label, ok: true, configuration: s.configuration, flow: s.flow?.type ?? null, after_completion: s.flow?.after_completion?.type ?? null, redirect: s.flow?.after_completion?.redirect?.return_url ?? null }
    } catch (e) {
      return { label, ok: false, error: redact(`${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 220)}`) }
    }
  }
  out.noSchedule = {
    findScheduledSubscription: await br.findScheduledSubscription(stripe, customer.id),
    cardUpdateSession: await session('card update, no schedule'),
    invoices: (await br.listInvoicesForCustomer(stripe, customer.id, 5)).map((i) => ({ id: i.id, status: i.status, total: i.totalCents, hosted: Boolean(i.hostedUrl), pdf: Boolean(i.pdfUrl) })),
  }
  const down = await cp.changePlanStep({ stripe, priceIdFor: async (id) => setup.priceIds[id] }, sub, 'starter')
  sub = await stripe.subscriptions.retrieve(sub.id)
  out.withSchedule = {
    downgrade: down,
    findScheduledSubscription: await br.findScheduledSubscription(stripe, customer.id),
    manageBillingGoesTo: (await br.findScheduledSubscription(stripe, customer.id)) ? br.PLANS_PENDING_BILLING_PATH : 'Billing Portal',
    cardUpdateSession: await session('card update, with schedule'),
    scheduleStillThere: (await stripe.subscriptions.retrieve(sub.id)).schedule,
  }
  if (sub.schedule) await stripe.subscriptionSchedules.release(typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
  await stripe.subscriptions.cancel(sub.id)
  out.cleanup = `probe subscription ${sub.id} (metadata.probe=true) schedule released and canceled`
  out.finishedAt = new Date().toISOString()
  log(JSON.stringify(out, null, 2))
  return out
}

/**
 * Aria 1:34 PM, upgrade confirm: the previewed amount (invoices.createPreview, always_invoice, a
 * server proration_date) against what the upgrade really invoices with that same proration_date,
 * using the app's change-plan.ts. Also: a pending downgrade underneath, stale/future proration_date
 * refused before any Stripe write, and a double Confirm (concurrent and sequential) charging once.
 * Every subscription is on the tagged probe customer with metadata.probe=true; all are released and
 * canceled at the end. TEST MODE ONLY.
 */
export async function runUpgradeConfirmProbe(stripe, ladder, setup, { log = console.log } = {}) {
  const cp = await appModule('lib/stripe/change-plan.ts')
  const deps = { stripe, priceIdFor: async (id) => setup.priceIds[id], log: (m) => log(redact(m)) }
  const out = { startedAt: new Date().toISOString() }
  const customer = assertTestObject(await stripe.customers.retrieve(PROBE_CUSTOMER_ID), 'probe customer')
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: visa.id } })
  const tag = { type: 'hosting', freeplug_probe: PROBE_TAG, probe: 'true' }
  const created = []
  const newSub = async (step) => {
    const s = assertTestObject(await stripe.subscriptions.create({ customer: customer.id, items: [{ price: setup.priceIds[step] }], metadata: { ...tag, plan_step: step } }), 'probe subscription')
    created.push(s.id)
    return s
  }
  const fresh = (id) => stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] })
  const lk = (sub) => sub.items.data.map((i) => i.price.lookup_key ?? i.price.id).join(' + ')
  const nowSec = () => Math.floor(Date.now() / 1000)
  const invoicesFor = async (subId) => (await stripe.invoices.list({ subscription: subId, limit: 20 })).data.map((i) => ({ id: i.id, billing_reason: i.billing_reason, status: i.status, amount_due: i.amount_due, amount_paid: i.amount_paid }))
  const prorationInvoices = async (subId) => (await invoicesFor(subId)).filter((i) => i.billing_reason === 'subscription_update')
  const userId = 'probe-user'

  // U1: preview, then confirm with the same proration_date: amount due == amount invoiced
  {
    let s = await newSub('starter')
    // a few seconds into the period, so the proration is a real partial amount
    await new Promise((r) => setTimeout(r, 3000))
    const pd = nowSec()
    const preview = await cp.previewPlanStepChange(deps, await fresh(s.id), 'fast_lane', pd)
    const before = await prorationInvoices(s.id)
    const r = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: pd, userId })
    s = await fresh(s.id)
    const after = await prorationInvoices(s.id)
    out.U1_previewEqualsInvoice = {
      preview,
      result: r,
      itemsNow: lk(s),
      invoice: { id: s.latest_invoice?.id, billing_reason: s.latest_invoice?.billing_reason, status: s.latest_invoice?.status, amount_due: s.latest_invoice?.amount_due, amount_paid: s.latest_invoice?.amount_paid },
      prorationInvoicesBefore: before.length,
      prorationInvoicesAfter: after.length,
      match: preview.ok === true && preview.amountDueCents === s.latest_invoice?.amount_due,
    }
  }

  // U2: the same with a pending downgrade underneath (priority -> starter scheduled, then upgrade to fast_lane)
  {
    let s = await newSub('priority')
    const down = await cp.changePlanStep(deps, await fresh(s.id), 'starter')
    s = await fresh(s.id)
    const pending = await cp.pendingPlanChange(stripe, s)
    const pd = nowSec()
    let preview
    try {
      preview = await cp.previewPlanStepChange(deps, s, 'fast_lane', pd)
    } catch (e) {
      preview = { threw: redact(`${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 220)}`) }
    }
    const r = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: pd, userId })
    s = await fresh(s.id)
    out.U2_withPendingDowngrade = {
      downgrade: down,
      pendingBefore: pending,
      preview,
      result: r,
      itemsNow: lk(s),
      scheduleAfter: s.schedule ?? null,
      invoice: { id: s.latest_invoice?.id, billing_reason: s.latest_invoice?.billing_reason, status: s.latest_invoice?.status, amount_due: s.latest_invoice?.amount_due },
      match: preview?.ok === true && preview.amountDueCents === s.latest_invoice?.amount_due,
    }
  }

  // U3: stale (11 min old) and future proration_date: refused before any Stripe write
  {
    let s = await newSub('starter')
    const invBefore = (await invoicesFor(s.id)).length
    const stale = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: nowSec() - 11 * 60, userId })
    const future = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: nowSec() + 120, userId })
    s = await fresh(s.id)
    out.U3_staleAndFutureRefused = { stale, future, itemsNow: lk(s), invoicesBefore: invBefore, invoicesAfter: (await invoicesFor(s.id)).length }
  }

  // U4: double Confirm. (a) concurrent, both from the same pre-update subscription (same idempotency
  // key); (b) a second tap after the first finished (the server re-reads the subscription: "same").
  {
    let s = await newSub('starter')
    await new Promise((r) => setTimeout(r, 2000))
    const pd = nowSec()
    const snapshot = await fresh(s.id)
    const settled = await Promise.allSettled([
      cp.changePlanStep(deps, snapshot, 'fast_lane', { prorationDate: pd, userId }),
      cp.changePlanStep(deps, snapshot, 'fast_lane', { prorationDate: pd, userId }),
    ])
    const concurrent = settled.map((x) => (x.status === 'fulfilled' ? x.value : { rejected: redact(`${x.reason?.code ?? ''} ${String(x.reason?.message ?? x.reason).slice(0, 200)}`) }))
    const afterConcurrent = await prorationInvoices(s.id)
    const sequential = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: pd, userId })
    // (c) the same stale snapshot again after it finished: Stripe replays the stored response
    const replay = await cp.changePlanStep(deps, snapshot, 'fast_lane', { prorationDate: pd, userId })
    s = await fresh(s.id)
    const afterAll = await prorationInvoices(s.id)
    out.U4_doubleSubmit = {
      concurrent,
      prorationInvoicesAfterConcurrent: afterConcurrent,
      sequentialSecondTap: sequential,
      replayOfSameRequest: replay,
      prorationInvoicesAfterAll: afterAll,
      itemsNow: lk(s),
      chargedOnce: afterAll.length === 1 && afterAll[0].amount_paid > 0,
    }
  }

  for (const id of created) {
    const s = await stripe.subscriptions.retrieve(id)
    if (s.schedule) await stripe.subscriptionSchedules.release(typeof s.schedule === 'string' ? s.schedule : s.schedule.id).catch(() => undefined)
    if (!['canceled', 'incomplete_expired'].includes(s.status)) await stripe.subscriptions.cancel(id)
  }
  const left = []
  for (const id of created) {
    const s = await stripe.subscriptions.retrieve(id)
    left.push({ id, status: s.status, schedule: s.schedule ?? null, probe: s.metadata?.probe })
  }
  out.cleanup = { canceled: created.length, check: left }
  out.finishedAt = new Date().toISOString()
  log(JSON.stringify(out, null, 2))
  return out
}

/**
 * The tipping system (Oct 3), against Stripe TEST mode with the app's own code (change-plan.ts,
 * tips.ts). Every subscription is on the tagged probe customer with metadata.probe=true and is
 * released + canceled at the end; the Checkout Session is expired. TEST MODE ONLY.
 *   T1 checkout line items with a tip (quantity = tip dollars; none for $0)
 *   T2 subscription step + tip: tier lookup ignores the tip; invoice tip cents
 *   T3 tip change next cycle, up / to $0 / back, proration none (no invoice, no pending items)
 *   T4 upgrade with a tip: tip item removed, preview == invoice
 *   T5 downgrade with a tip: the schedule's next phase holds only the new step price; tip change refused
 *   T6 lock (with --lock-db): two concurrent confirms over a pending downgrade -> one upgrade, one
 *      charge, the downgrade released, the second answer UPGRADE_IN_PROGRESS with no Stripe call
 */
export async function runTipProbe(stripe, ladder, setup, { log = console.log, lockDb = null } = {}) {
  const cp = await appModule('lib/stripe/change-plan.ts')
  const tips = await appModule('lib/plans/tips.ts')
  if (!setup.tipPriceId) throw new SetupRefused('No tip price (run the setup without --dry-run first).')
  const tipPriceId = setup.tipPriceId
  const deps = { stripe, priceIdFor: async (id) => setup.priceIds[id], tipPriceId: async () => tipPriceId, log: (m) => log(redact(m)) }
  const out = { startedAt: new Date().toISOString(), tipPriceId }
  const customer = assertTestObject(await stripe.customers.retrieve(PROBE_CUSTOMER_ID), 'probe customer')
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: visa.id } })
  const tag = { type: 'hosting', freeplug_probe: PROBE_TAG, probe: 'true' }
  const created = []
  const newSub = async (step, tipDollars) => {
    const items = [{ price: setup.priceIds[step], quantity: 1 }, ...tips.tipLineItems(tipPriceId, tipDollars)]
    const s = assertTestObject(await stripe.subscriptions.create({ customer: customer.id, items, metadata: { ...tag, plan_step: step, tip_dollars: String(tipDollars) } }), 'probe subscription')
    created.push(s.id)
    return s
  }
  const fresh = (id) => stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] })
  const lk = (sub) => sub.items.data.map((i) => `${i.price.lookup_key ?? i.price.id} x${i.quantity}`).join(' + ')
  const invoicesFor = async (subId) => (await stripe.invoices.list({ subscription: subId, limit: 20 })).data
  const pendingItems = async (subId) => (await stripe.invoiceItems.list({ customer: customer.id, pending: true, limit: 50 })).data.filter((ii) => {
    const sub = ii.parent?.subscription_details?.subscription ?? ii.subscription ?? null
    return (typeof sub === 'string' ? sub : sub?.id) === subId
  })
  const nowSec = () => Math.floor(Date.now() / 1000)

  // T1: checkout line items (what /api/checkout/hosting sends), then expire the session
  {
    const fast = ladder.PLAN_STEPS.find((x) => x.id === 'fast_lane')
    const parsed = tips.parseTipDollars(fast, 5)
    const refused = [tips.parseTipDollars(fast, 10), tips.parseTipDollars(fast, -1), tips.parseTipDollars(fast, 2.5), tips.parseTipDollars(ladder.PLAN_STEPS.find((x) => x.id === 'leads'), 1)]
    const session = assertTestObject(
      await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: setup.priceIds.fast_lane, quantity: 1 }, ...tips.tipLineItems(tipPriceId, parsed.tipDollars)],
        success_url: 'https://example.test/probe?ok=1',
        cancel_url: 'https://example.test/probe?cancel=1',
        metadata: { ...tag, plan_step: 'fast_lane', tip_dollars: String(parsed.tipDollars) },
        subscription_data: { metadata: { ...tag, plan_step: 'fast_lane', tip_dollars: String(parsed.tipDollars) } },
      }),
      'checkout session'
    )
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })
    out.T1_checkoutWithTip = {
      parsed,
      refused,
      session: session.id,
      amount_total: session.amount_total,
      lineItems: items.data.map((li) => ({ price: li.price?.lookup_key ?? li.price?.id, quantity: li.quantity, amount_total: li.amount_total })),
      zeroTipLines: tips.tipLineItems(tipPriceId, 0),
      ok: session.amount_total === 7000 && items.data.length === 2,
    }
    await stripe.checkout.sessions.expire(session.id)
  }

  // T2: step + tip subscription (the publish path): tier from the step item only, invoice tip cents
  {
    const s = await fresh((await newSub('starter', 19)).id)
    const inv = await stripe.invoices.retrieve(typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice.id)
    out.T2_subscriptionWithTip = {
      items: lk(s),
      currentLadderStep: cp.currentLadderStep(s)?.id ?? null,
      planMonthlyCents: cp.subscriptionMonthlyCents(s),
      tipDollars: cp.subscriptionTipDollars(s),
      invoice: { id: inv.id, amount_paid: inv.amount_paid, tipCents: tips.invoiceTipCents(inv), lines: inv.lines.data.map((l) => ({ amount: l.amount, product: l.pricing?.price_details?.product ?? null, quantity: l.quantity })) },
      ok: cp.currentLadderStep(s)?.id === 'starter' && cp.subscriptionMonthlyCents(s) === 3500 && tips.invoiceTipCents(inv) === 1900 && inv.amount_paid === 5400,
    }
  }

  // T3: tip changes from the next bill (proration none): up, to $0, back again
  {
    const s0 = await newSub('priority', 3)
    const invBefore = (await invoicesFor(s0.id)).length
    const preview = await cp.previewTipChange(deps, await fresh(s0.id), 9)
    const up = await cp.changeTip(deps, await fresh(s0.id), 9, { userId: 'probe-user' })
    const afterUp = await fresh(s0.id)
    const toZero = await cp.changeTip(deps, afterUp, 0, { userId: 'probe-user' })
    const afterZero = await fresh(s0.id)
    const back = await cp.changeTip(deps, afterZero, 4, { userId: 'probe-user' })
    const afterBack = await fresh(s0.id)
    const outOfRange = await cp.changeTip(deps, afterBack, 10, { userId: 'probe-user' })
    const invAfter = (await invoicesFor(s0.id)).length
    const pend = await pendingItems(s0.id)
    out.T3_tipChangeNextCycle = {
      preview,
      up: { result: up, items: lk(afterUp) },
      toZero: { result: toZero, items: lk(afterZero) },
      back: { result: back, items: lk(afterBack) },
      outOfRange,
      invoicesBefore: invBefore,
      invoicesAfter: invAfter,
      pendingInvoiceItems: pend.length,
      ok: preview.ok && preview.nextAmountCents === 5500 + 900 && invBefore === invAfter && pend.length === 0 && cp.subscriptionTipDollars(afterZero) === 0 && cp.subscriptionTipDollars(afterBack) === 4 && outOfRange.ok === false,
    }
  }

  // T4: upgrade with a tip: the preview includes the tip removal; the tip item is gone after
  {
    let s = await newSub('starter', 10)
    await new Promise((r) => setTimeout(r, 3000))
    const pd = nowSec()
    const preview = await cp.previewPlanStepChange(deps, await fresh(s.id), 'fast_lane', pd)
    const r = await cp.changePlanStep(deps, await fresh(s.id), 'fast_lane', { prorationDate: pd, userId: 'probe-user' })
    s = await fresh(s.id)
    out.T4_upgradeWithTip = {
      preview,
      result: r,
      itemsNow: lk(s),
      tipAfter: cp.subscriptionTipDollars(s),
      invoice: { id: s.latest_invoice?.id, billing_reason: s.latest_invoice?.billing_reason, amount_due: s.latest_invoice?.amount_due, amount_paid: s.latest_invoice?.amount_paid },
      ok: r.ok === true && cp.subscriptionTipDollars(s) === 0 && preview.ok === true && preview.amountDueCents === s.latest_invoice?.amount_due && preview.tipDollars === 10,
    }
  }

  // T5: downgrade with a tip: the next phase holds only the new step price (tip dropped at the switch)
  {
    let s = await newSub('fast_lane', 6)
    const down = await cp.changePlanStep(deps, await fresh(s.id), 'priority')
    s = await fresh(s.id)
    const schedule = await stripe.subscriptionSchedules.retrieve(typeof s.schedule === 'string' ? s.schedule : s.schedule.id)
    const phaseItems = await Promise.all(
      schedule.phases.map(async (ph) => (await Promise.all(ph.items.map(async (i) => {
        const p = typeof i.price === 'string' ? await stripe.prices.retrieve(i.price) : i.price
        return `${p.lookup_key ?? p.id} x${i.quantity}`
      }))).join(' + '))
    )
    const tipChange = await cp.changeTip(deps, s, 2, { userId: 'probe-user' })
    const pending = await cp.pendingPlanChange(stripe, s)
    out.T5_downgradeWithTip = {
      downgrade: down,
      pending,
      itemsNow: lk(s),
      phases: phaseItems,
      tipChangeWhilePending: tipChange,
      ok: down.ok === true && phaseItems.length === 2 && phaseItems[0].includes(ladder.TIP_LOOKUP_KEY) && !phaseItems[1].includes(ladder.TIP_LOOKUP_KEY) && tipChange.ok === false && tipChange.code === 'pending_change',
    }
  }

  // T6: the change-plan lock (local DB only), see runLockProbe
  if (lockDb) out.T6_lock = await runLockProbe(stripe, ladder, setup, { deps, newSub, fresh, lk, lockDb, log })

  for (const id of created) {
    const s = await stripe.subscriptions.retrieve(id)
    if (s.schedule) await stripe.subscriptionSchedules.release(typeof s.schedule === 'string' ? s.schedule : s.schedule.id).catch(() => undefined)
    if (!['canceled', 'incomplete_expired'].includes(s.status)) await stripe.subscriptions.cancel(id)
  }
  const left = []
  for (const id of created) {
    const s = await stripe.subscriptions.retrieve(id)
    left.push({ id, status: s.status, schedule: s.schedule ?? null, probe: s.metadata?.probe })
  }
  out.cleanup = { canceled: created.length, check: left }
  out.allOk = Object.entries(out).filter(([k]) => /^T\d/.test(k)).every(([, v]) => v?.ok === true)
  out.finishedAt = new Date().toISOString()
  log(JSON.stringify(out, null, 2))
  return out
}

/** Local review user 2 (lock rows reference auth.users); the row is released at the end. */
export const LOCK_PROBE_USER_ID = '22d71842-bd8e-49f7-9bea-4ce1e3810742'

/**
 * Lock store on a LOCAL Postgres through psql (the probe has no service-role key and must not read
 * one from the environment). Only 127.0.0.1 / localhost URLs are accepted.
 */
export async function psqlLockStore(url) {
  const u = new URL(url)
  if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw new SetupRefused('--lock-db must be a local Postgres URL.')
  const { execFile } = await import('node:child_process')
  const uuid = /^[0-9a-f-]{36}$/
  const run = (sql) =>
    new Promise((resolve, reject) => {
      const env = { PATH: process.env.PATH ?? '/usr/bin:/bin' }
      execFile('psql', [url, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env }, (err, stdout) => (err ? reject(new Error(String(err.message).slice(0, 200))) : resolve(String(stdout))))
    })
  return {
    async claim(userId, ttl) {
      if (!uuid.test(userId) || !Number.isInteger(ttl)) throw new Error('bad args')
      const outText = await run(`begin; set local role service_role; select public.plan_change_lock_claim('${userId}', ${ttl}); commit;`)
      const id = outText.split('\n').map((l) => l.trim()).find((l) => uuid.test(l))
      return id ?? null
    },
    async release(userId, claimId) {
      if (!uuid.test(userId) || !uuid.test(claimId)) throw new Error('bad args')
      await run(`begin; set local role service_role; select public.plan_change_lock_release('${userId}', '${claimId}'); commit;`)
    },
    async rows(userId) {
      return Number((await run(`select count(*) from public.plan_change_locks where user_id = '${userId}'`)).trim())
    },
  }
}

/**
 * T6: two concurrent Confirms over a pending downgrade, each going through the app's lock
 * (plan-change-lock.ts withPlanChangeLock) exactly like changeHostingPlan: claim first, then read
 * the subscription and call changePlanStep. Expect: one upgrade, one proration charge, the pending
 * downgrade released, and the other request answered in_progress with ZERO Stripe calls.
 */
async function runLockProbe(stripe, ladder, setup, { deps, newSub, fresh, lk, lockDb, log }) {
  const cp = await appModule('lib/stripe/change-plan.ts')
  const lockLib = await appModule('lib/plans/plan-change-lock.ts')
  const store = await psqlLockStore(lockDb)
  let s = await newSub('priority', 4)
  const down = await cp.changePlanStep(deps, await fresh(s.id), 'starter')
  s = await fresh(s.id)
  const pendingBefore = await cp.pendingPlanChange(stripe, s)
  await new Promise((r) => setTimeout(r, 2000))
  const pd = Math.floor(Date.now() / 1000)
  const preview = await cp.previewPlanStepChange(deps, s, 'fast_lane', pd)
  const calls = [0, 0]
  const confirm = (n) =>
    lockLib.withPlanChangeLock(store, LOCK_PROBE_USER_ID, async () => {
      calls[n] += 1 // reached Stripe
      const sub = await fresh(s.id)
      return cp.changePlanStep(deps, sub, 'fast_lane', { prorationDate: pd, userId: 'probe-user' })
    }, (m) => log(redact(m)))
  const [a, b] = await Promise.all([confirm(0), confirm(1)])
  s = await fresh(s.id)
  const invoices = (await stripe.invoices.list({ subscription: s.id, limit: 20 })).data
  const proration = invoices.filter((i) => i.billing_reason === 'subscription_update')
  const lockRowsAfter = await store.rows(LOCK_PROBE_USER_ID)
  const results = [a, b]
  const upgraded = results.filter((r) => r.ok && r.value?.ok && r.value.kind === 'upgraded').length
  const inProgress = results.filter((r) => !r.ok && r.code === 'in_progress').length
  const stripeCallsByLoser = results.map((r, i) => (!r.ok ? calls[i] : null)).filter((x) => x !== null)
  // a third Confirm after both finished: the lock is free again (released in finally)
  const third = await lockLib.withPlanChangeLock(store, LOCK_PROBE_USER_ID, async () => 'claimed', (m) => log(redact(m)))
  return {
    downgrade: down,
    pendingBefore,
    preview,
    results,
    stripeCalls: calls,
    itemsNow: lk(s),
    scheduleAfter: s.schedule ?? null,
    prorationInvoices: proration.map((i) => ({ id: i.id, amount_paid: i.amount_paid, status: i.status })),
    lockRowsAfter,
    thirdAfterRelease: third,
    ok:
      upgraded === 1 &&
      inProgress === 1 &&
      stripeCallsByLoser.every((c) => c === 0) &&
      proration.length === 1 &&
      proration[0].amount_paid === preview.amountDueCents &&
      (s.schedule ?? null) === null &&
      lockRowsAfter === 0 &&
      third.ok === true,
  }
}

/** Bot secrets the box injects into every shell: this script never reads them, and the app code it loads
 * (jiti) and the psql child never see them (Oct 3 audit). */
export const BOT_SECRET_VARS = ['SUPABASE_DB_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDFLARE_API_TOKEN', 'STRIPE_WEBHOOK_SECRET']

async function main(argv) {
  for (const k of BOT_SECRET_VARS) delete process.env[k]
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
  console.log(`  ${ladder.TIP_PRODUCT_ID} / ${ladder.TIP_LOOKUP_KEY} -> ${setup.tipPriceId ?? '(missing)'}`)
  console.log(`portal configuration: ${setup.portalConfigurationId ?? '(none yet)'}`)
  if (setup.portalConfigurationId) console.log(`set STRIPE_PORTAL_CONFIGURATION_ID=${setup.portalConfigurationId} (not a secret)`)
  if (argv.includes('--probe') && !argv.includes('--dry-run')) await runProbes(stripe, ladder, setup)
  if (argv.includes('--probe-conditions') && !argv.includes('--dry-run')) await runConditionProbes(stripe, ladder, setup)
  if (argv.includes('--tag-probes') && !argv.includes('--dry-run')) await tagProbeLeftovers(stripe)
  if (argv.includes('--probe-checkout-expiry') && !argv.includes('--dry-run')) await runCheckoutExpiryProbe(stripe, ladder, setup)
  if (argv.includes('--probe-billing') && !argv.includes('--dry-run')) await runBillingProbe(stripe, ladder, setup)
  if (argv.includes('--probe-upgrade-confirm') && !argv.includes('--dry-run')) await runUpgradeConfirmProbe(stripe, ladder, setup)
  if (argv.includes('--probe-tips') && !argv.includes('--dry-run')) await runTipProbe(stripe, ladder, setup, { lockDb: arg('--lock-db') ?? null })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => {
    // Never print the key: messages from this script don't contain it; Stripe errors are trimmed.
    console.error(redact(e instanceof SetupRefused ? e.message : `Stripe setup failed: ${e?.type ?? ''} ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 200)}`))
    process.exit(e instanceof SetupRefused ? 2 : 1)
  })
}
