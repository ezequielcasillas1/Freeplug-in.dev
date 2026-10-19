'use server'

import { headers } from 'next/headers'
import { recipientFromParams } from '@/lib/unsubscribe/token'
import { defaultOptOutStore, recordOptOut } from '@/lib/unsubscribe/store'

export type UnsubscribeState = { status: 'idle' | 'done' | 'error' }

export async function confirmUnsubscribe(_prev: UnsubscribeState, form: FormData): Promise<UnsubscribeState> {
  const who = await recipientFromParams({ t: String(form.get('t') ?? '') || undefined })
  if (!who) return { status: 'error' }
  const ua = (await headers()).get('user-agent')
  const r = await recordOptOut(await defaultOptOutStore(), { email: who.email, source: 'unsubscribe_page', tokenKind: who.kind, userAgent: ua })
  return { status: r.ok ? 'done' : 'error' }
}
