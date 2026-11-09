import { test, expect } from 'vitest'
import { buyoutCreditCents, ownershipTotals } from '@/lib/buyout/ownership'
import * as Q from '@/lib/maintenance-quotes/quotes'
const now = new Date('2026-11-20T12:00:00Z'), c=(n:number)=>new Date(now.getTime()+(14-n)*86400000).toISOString()
const pay=(id:string,a:number,age:number)=>({kind:'payment' as const,stripe_charge_id:id,amount_cents:a,clears_at:c(age)})
const adj=(k:'refund'|'dispute',id:string,a:number)=>({kind:k,stripe_charge_id:id,amount_cents:a,clears_at:null})
test('r3',()=>{ const base=[pay('A',5000,20),pay('B',3000,5)]; const f=(r:any[])=>({credit:buyoutCreditCents(r,now),...ownershipTotals(r,now)})
 expect({ s1:f([...base,adj('refund','B',-3000)]), s2:f([...base,adj('refund','A',-2000)]), s3:f([...base,adj('refund','B',-1000)]),
  orphanRefund:f([...base,adj('refund','Z',-999)]), orphanDispute:f([...base,adj('dispute','Z',-999)]),
  confirm:(Q as any).quoteSendConfirmText?.('Acme Bakery',7500), confirm2:(Q as any).quoteSendConfirmText?.('Acme',5050), toast:(Q as any).quoteSentToast?.(new Date('2026-10-18T12:00:00Z')) }).toEqual({}) })
