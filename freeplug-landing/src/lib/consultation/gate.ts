import type { SupabaseClient } from '@supabase/supabase-js'
import { OPEN_REQUEST_STATUSES } from './status'
import { CONSULTATION_GATE_MESSAGE } from './copy'

/**
 * Per-request "Looks good" gate (Aria's ruling, Oct 22 r2).
 *
 * New build charges and domain purchases that are tied to a website request need agreed_at on
 * that request's consultation. A request is "tied" when it is the customer's open request and it
 * goes through the consultation step: not a buyout (buyouts skip it) and not an outreach claim (the
 * site was already built from a preview, so there's nothing to agree before building).
 *
 * NOT gated: customers with no open request (existing customers), existing subscriptions, plan
 * changes, edits/maintenance. Those code paths never call this.
 */
export type GateRequest = {
  id: string
  status: string
  is_buyout: boolean | null
  source: string | null
}

export type ConsultationGate =
  | { ok: true; requestId: string | null }
  | { ok: false; requestId: string; code: 'consultation_not_agreed'; message: string }

/** Pure rule, shared by the app checks and tests. */
export function requestNeedsAgreement(req: GateRequest | null | undefined): boolean {
  if (!req) return false
  if (!(OPEN_REQUEST_STATUSES as readonly string[]).includes(req.status)) return false
  if (req.is_buyout === true) return false
  if (req.source === 'outreach') return false
  return true
}

export function evaluateGate(
  req: GateRequest | null | undefined,
  consultation: { agreed_at: string | null } | null | undefined
): ConsultationGate {
  if (!req || !requestNeedsAgreement(req)) return { ok: true, requestId: req?.id ?? null }
  if (consultation?.agreed_at) return { ok: true, requestId: req.id }
  return { ok: false, requestId: req.id, code: 'consultation_not_agreed', message: CONSULTATION_GATE_MESSAGE }
}

/**
 * Loads the user's open website request and its consultation (RLS client is fine: own rows) and
 * applies the gate. Fails closed: a read error blocks, so a charge never slips through unchecked.
 */
export async function checkConsultationGate(db: SupabaseClient, userId: string): Promise<ConsultationGate> {
  const { data: req, error } = await db
    .from('website_requests')
    .select('id, status, is_buyout, source')
    .eq('user_id', userId)
    .in('status', [...OPEN_REQUEST_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`consultation gate: ${error.message}`)
  const row = (req ?? null) as GateRequest | null
  if (!requestNeedsAgreement(row)) return { ok: true, requestId: row?.id ?? null }
  const { data: c, error: cErr } = await db
    .from('consultations')
    .select('agreed_at')
    .eq('request_id', row!.id)
    .maybeSingle()
  if (cErr) throw new Error(`consultation gate: ${cErr.message}`)
  return evaluateGate(row, (c ?? null) as { agreed_at: string | null } | null)
}
