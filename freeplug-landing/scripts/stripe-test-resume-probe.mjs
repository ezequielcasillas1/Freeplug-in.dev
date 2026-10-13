#!/usr/bin/env node
/**
 * "Resume plan" against Stripe TEST mode (Vera 5b R1; Aria Oct 3 4:05 PM). TEST MODE ONLY.
 *
 *   node scripts/stripe-test-resume-probe.mjs --env-file <file with STRIPE_SECRET_KEY=sk_test_...>
 *
 * On a scratch test customer (metadata.probe=true, deleted at the end): Starter + $3 tip, the app's
 * in-app cancel (cancelPlanAtPeriodEnd), then
 *   1. the OLD request (cancel_at_period_end:false AND cancel_at:'') -> Stripe refuses it (the bug),
 *   2. the app's resumeEndingSubscriptions -> one update with only cancel_at_period_end:false, and
 *      Stripe reports cancel_at_period_end=false and cancel_at=null afterwards.
 * The key is checked to be sk_test_/rk_test_, never printed, and every object must be livemode=false.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTestKey, assertTestObject, readKeyFromEnvFile, redact, BOT_SECRET_VARS } from './stripe-test-setup-ladder.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

async function main(argv) {
  for (const k of BOT_SECRET_VARS) delete process.env[k]
  const i = argv.indexOf('--env-file')
  const key = assertTestKey(readKeyFromEnvFile(i >= 0 ? argv[i + 1] : undefined))
  // the app's getStripe() reads it from the environment (this process only)
  process.env.STRIPE_SECRET_KEY = key
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key, { maxNetworkRetries: 2 })
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, { alias: { '@': path.join(here, '..', 'src') } })
  const cp = await jiti.import(path.join(here, '..', 'src', 'lib', 'stripe', 'change-plan.ts'))
  const { resumeEndingSubscriptions } = await jiti.import(path.join(here, '..', 'src', 'lib', 'stripe', 'resume-hosting.ts'))
  const ladder = await jiti.import(path.join(here, '..', 'src', 'lib', 'plans', 'ladder.ts'))
  const prices = (await stripe.prices.list({ lookup_keys: [ladder.stepById('starter').lookupKey, ladder.TIP_LOOKUP_KEY], active: true })).data
  const price = (k) => assertTestObject(prices.find((p) => p.lookup_key === k), 'price').id

  const out = {}
  const customer = assertTestObject(await stripe.customers.create({ email: 'resume-probe@example.test', metadata: { probe: 'true', freeplug_probe: 'resume-2026-10-03' } }), 'customer')
  try {
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })
    const sub = assertTestObject(
      await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price(ladder.stepById('starter').lookupKey) }, { price: price(ladder.TIP_LOOKUP_KEY), quantity: 3 }], metadata: { probe: 'true', type: 'hosting' } }),
      'subscription'
    )
    const c = await cp.cancelPlanAtPeriodEnd(stripe, sub)
    let s = await stripe.subscriptions.retrieve(sub.id)
    out.afterCancel = { result: c.kind, cancel_at_period_end: s.cancel_at_period_end, cancel_at: s.cancel_at }
    try {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false, cancel_at: '' })
      out.oldRequest = 'accepted (unexpected)'
    } catch (e) {
      out.oldRequest = `refused: ${String(e?.message ?? e).slice(0, 120)}`
    }
    const resumed = await resumeEndingSubscriptions(stripe, customer.id)
    s = await stripe.subscriptions.retrieve(sub.id)
    out.afterResume = { resumed, cancel_at_period_end: s.cancel_at_period_end, cancel_at: s.cancel_at, status: s.status }
    out.ok = out.afterCancel.cancel_at_period_end === true && !!out.afterCancel.cancel_at && out.oldRequest.startsWith('refused') && resumed === 1 && s.cancel_at_period_end === false && s.cancel_at === null
  } finally {
    await stripe.customers.del(customer.id)
    out.cleanup = `deleted test customer ${customer.id}`
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
}

main(process.argv.slice(2)).catch((e) => {
  console.error(redact(`resume probe failed: ${e?.type ?? ''} ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 300)}`))
  process.exit(1)
})
