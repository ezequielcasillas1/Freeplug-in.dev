import { NextResponse } from 'next/server'
import { recipientFromParams } from '@/lib/unsubscribe/token'
import { defaultOptOutStore, recordOptOut } from '@/lib/unsubscribe/store'

/**
 * RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail providers POST here with the link's query;
 * only a valid SIGNED token is accepted (no plain-email one-click).
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const who = await recipientFromParams({ t: url.searchParams.get('t') ?? undefined })
  if (!who) return NextResponse.json({ ok: false }, { status: 400 })
  const r = await recordOptOut(await defaultOptOutStore(), { email: who.email, source: 'one_click', tokenKind: 'signed', userAgent: request.headers.get('user-agent') })
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 500 })
}
