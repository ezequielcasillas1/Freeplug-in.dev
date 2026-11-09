import { NextResponse, type NextRequest } from 'next/server'
import { rateCheck, type RateRule } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const dynamic = 'force-dynamic'

/** Reports bigger than this are dropped unread (a real CSP report is well under 4 KB). */
export const CSP_REPORT_MAX_BYTES = 8 * 1024
/** 60 reports per client IP per 10 minutes (the unknown-ip bucket shares one budget). */
export const CSP_REPORT_LIMIT: RateRule = { bucket: 'csp_report_ip', limit: 60, windowSeconds: 600 }

const noContent = () => new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } })

/** Pick only the fields worth logging; never the whole body, cut to a safe length. */
function summarize(body: unknown): Record<string, string> {
  const raw = (body && typeof body === 'object' && 'csp-report' in body ? (body as Record<string, unknown>)['csp-report'] : Array.isArray(body) ? (body[0] as { body?: unknown })?.body : body) as Record<string, unknown> | undefined
  const out: Record<string, string> = {}
  for (const k of ['document-uri', 'documentURL', 'violated-directive', 'effectiveDirective', 'effective-directive', 'blocked-uri', 'blockedURL', 'disposition']) {
    const v = raw?.[k]
    if (typeof v === 'string') out[k] = v.slice(0, 200)
  }
  return out
}

/**
 * POST /api/csp-report: Content-Security-Policy-Report-Only violation reports (report-uri in
 * src/lib/outreach/headers.ts). Logs a short summary only, nothing stored. Size-capped and rate limited;
 * always answers 204 so it gives nothing away.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > CSP_REPORT_MAX_BYTES) return noContent()
  if (!(await rateCheck(CSP_REPORT_LIMIT, clientIpFrom(request.headers)))) return noContent()
  let text: string
  try {
    text = await request.text()
  } catch {
    return noContent()
  }
  if (text.length > CSP_REPORT_MAX_BYTES) return noContent()
  try {
    console.warn('[csp-report]', JSON.stringify(summarize(JSON.parse(text))))
  } catch {
    // not JSON: ignore
  }
  return noContent()
}
