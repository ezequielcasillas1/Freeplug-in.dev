import { test, expect } from 'vitest'
import { buyoutCreditCents, ownershipTotals, memoryOwnershipStore, recordRefundObject } from '@/lib/buyout/ownership'
import { parseQuoteAmount } from '@/lib/maintenance-quotes/quotes'
const now = new Date('2026-11-20T12:00:00Z'), d = (n:number)=>new Date(now.getTime()-n*86400000).toISOString(), c=(n:number)=>new Date(now.getTime()-n*86400000+14*86400000).toISOString()
test('r2', async () => {
  const pay = (id:string,amt:number,age:number)=>({kind:'payment' as const,stripe_charge_id:id,amount_cents:amt,clears_at:c(age)})
  const ref = (id:string,amt:number)=>({kind:'refund' as const,stripe_charge_id:id,amount_cents:amt,clears_at:null})
  const out:any = {}
  const s1 = [pay('A',5000,20), pay('B',3000,5), ref('B',-3000)]       // pending B fully refunded
  out.s1 = { credit: buyoutCreditCents(s1,now), ...ownershipTotals(s1,now) }
  const s2 = [pay('A',5000,20), pay('B',3000,5), ref('A',-2000)]       // refund on cleared A
  out.s2 = { credit: buyoutCreditCents(s2,now), ...ownershipTotals(s2,now) }
  const s3 = [pay('A',5000,13), ...[]]; const s4=[pay('A',5000,14)]
  out.d13 = buyoutCreditCents(s3,now); out.d14 = buyoutCreditCents(s4,now)
  const s5 = [pay('A',5000,20), pay('B',3000,5), ref('B',-1000)]       // partial refund on pending
  out.s5 = { credit: buyoutCreditCents(s5,now), ...ownershipTotals(s5,now) }
  const st = memoryOwnershipStore(); st.rows.set('pay:chX',{entry_key:'pay:chX',profile_id:'p',stripe_charge_id:'chX',kind:'payment',source:'invoice',amount_cents:5000,final:false,occurred_at:d(20),clears_at:c(20)})
  out.ref = [await recordRefundObject(st,{id:'re_1',amount:1000,created:1,charge:'chX'},5000), await recordRefundObject(st,{id:'re_1',amount:1000,created:1,charge:'chX'},5000), await recordRefundObject(st,{id:'re_2',amount:4000,created:1,charge:'chX'},5000)]
  out.amt = Object.fromEntries(['49.99','50','100','100.01','-5','abc'].map(a=>[a,parseQuoteAmount(a).ok]))
  expect(out).toEqual({})
})
