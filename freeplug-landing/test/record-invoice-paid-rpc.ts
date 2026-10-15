/**
 * Phase 4 L-2 test stand-in for public.record_invoice_paid: the ledger row (legacy insert shape, so existing
 * assertions on the row keep working) and the total increment, as one step. A 23505 from the row insert is
 * the function's duplicate no-op (data false, no increment); any other error is the RPC error.
 */
export type RecordArgs = { p_profile_id: string; p_stripe_invoice_id: string; p_amount_cents: number; p_tip_cents?: number; p_paid_at?: string | null }

export async function recordInvoicePaidRpc(
  a: RecordArgs,
  insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>,
  increment: (amountCents: number) => void
): Promise<{ data: boolean | null; error: { code?: string; message: string } | null }> {
  const row: Record<string, unknown> = {
    profile_id: a.p_profile_id,
    stripe_invoice_id: a.p_stripe_invoice_id,
    amount_cents: a.p_amount_cents,
    tip_cents: a.p_tip_cents ?? 0,
    ...(a.p_paid_at ? { created_at: a.p_paid_at } : {}),
  }
  const { error } = await insert(row)
  if (error?.code === '23505') return { data: false, error: null }
  if (error) return { data: null, error: { code: error.code, message: error.message ?? 'error' } }
  increment(a.p_amount_cents)
  return { data: true, error: null }
}
