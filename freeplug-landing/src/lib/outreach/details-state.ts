import { displayPhone, normalizePhone } from './phone'
import { DETAIL_KEYS, type DetailKey, type PrefillMap } from './schemas'

/**
 * State rules for the "Add your details" / "Confirm your details" form (Lina + Rio):
 *   * a pre-filled field is answered after "Looks right", or after "Edit" once it has a value
 *     (clearing the optional address also counts as an answer);
 *   * a blank field is answered once it has a value; a blank address is optional and not counted;
 *   * every service is answered once it has Keep or Remove; added services start as Keep;
 *   * photos never count.
 * Pre-filled values are always editable (never locked), e.g. hours we could not confirm.
 * Only answered fields are sent (Vera r2 bug 2): an untouched pre-filled value is not a
 * confirmation, so it is left out of the submission and stays "pre-filled" in claim step 2.
 */
export type FieldState = {
  key: DetailKey
  value: string
  source: string | null
  mode: 'prefilled' | 'confirmed' | 'editing' | 'blank'
}
export type ServiceState = {
  name: string
  choice: 'keep' | 'remove' | null
  added: boolean
  /** The answer before Remove was tapped, so Undo can put it back (Vera QA #7, 12:49 AM). */
  beforeRemove?: 'keep' | null
}

/** Remove: remembers the answer it had (Keep or unanswered) for Undo. */
export function removeService(s: ServiceState): ServiceState {
  if (s.choice === 'remove') return s
  return { ...s, choice: 'remove', beforeRemove: s.choice }
}

/** Undo: back to exactly the state before Remove (Keep stays Keep, unanswered stays unanswered). */
export function undoRemoveService(s: ServiceState): ServiceState {
  if (s.choice !== 'remove') return s
  return { name: s.name, added: s.added, choice: s.beforeRemove ?? null }
}

const same = (key: DetailKey, a: string, b: string) =>
  key === 'phone' ? (normalizePhone(a) ?? a.trim()) === (normalizePhone(b) ?? b.trim()) : a.trim() === b.trim()

/**
 * Starting state. `initial` holds what was sent from the preview, which (since Vera r2 bug 2) is
 * only what the person confirmed or edited there: the same value as the pre-fill loads as
 * confirmed ("Looks right" pressed, source line kept), a different value loads as their edit.
 * Everything not sent stays pre-filled and needs an answer. Phones show as 512-555-0142.
 */
export function initialFieldStates(prefill: PrefillMap, initial: Partial<Record<DetailKey, string>> = {}): FieldState[] {
  return DETAIL_KEYS.map((key) => {
    const p = prefill[key]
    const show = (v: string) => (key === 'phone' ? displayPhone(v.trim()) : v)
    const sent = initial[key]?.trim()
    if (sent && p?.value && same(key, sent, p.value)) return { key, value: show(p.value), source: p.source || null, mode: 'confirmed' }
    if (sent) return { key, value: show(sent), source: null, mode: 'editing' }
    if (p?.value) return { key, value: show(p.value), source: p.source || null, mode: 'prefilled' }
    return { key, value: '', source: null, mode: 'blank' }
  })
}

export function initialServiceStates(services: string[], initial: { name: string; keep: boolean }[] = []): ServiceState[] {
  const byName = new Map(initial.map((s) => [s.name, s.keep]))
  const out: ServiceState[] = services.map((name) => ({
    name,
    choice: byName.has(name) ? (byName.get(name) ? 'keep' : 'remove') : null,
    added: false,
  }))
  for (const s of initial) {
    if (!services.includes(s.name)) out.push({ name: s.name, choice: s.keep ? 'keep' : 'remove', added: true })
  }
  return out
}

function wasPrefilled(f: FieldState, prefill: PrefillMap): boolean {
  return Boolean(prefill[f.key]?.value)
}

export function isFieldAnswered(f: FieldState, prefill: PrefillMap): boolean {
  if (f.mode === 'confirmed') return true
  if (f.value.trim()) return f.mode !== 'prefilled'
  return f.key === 'address' && f.mode === 'editing' && wasPrefilled(f, prefill)
}

export function isFieldCounted(f: FieldState, prefill: PrefillMap): boolean {
  return !(f.key === 'address' && !wasPrefilled(f, prefill) && f.mode === 'blank' && !f.value.trim())
}

export function checkedCounts(fields: FieldState[], services: ServiceState[], prefill: PrefillMap): { n: number; total: number } {
  const counted = fields.filter((f) => isFieldCounted(f, prefill))
  const n = counted.filter((f) => isFieldAnswered(f, prefill)).length + services.filter((s) => s.choice !== null).length
  return { n, total: counted.length + services.length }
}

/** Claim step 2 unlock: everything answered and the four required fields have values. */
export function canConfirm(fields: FieldState[], services: ServiceState[], prefill: PrefillMap): boolean {
  const { n, total } = checkedCounts(fields, services, prefill)
  const required: DetailKey[] = ['phone', 'hours', 'service_area', 'quote_email']
  return n === total && required.every((k) => fields.find((f) => f.key === k)?.value.trim())
}

/** The phone field's value is not a valid 10-digit number (empty is fine: the field is optional here). */
export function phoneInvalid(fields: FieldState[]): boolean {
  const f = fields.find((x) => x.key === 'phone')
  if (!f || f.mode === 'prefilled') return false
  const v = f.value.trim()
  return v !== '' && normalizePhone(v) === null
}

/**
 * What is sent: only answered fields with a value (confirmed, edited, or a blank field filled in).
 * Untouched pre-filled values are left out (Vera r2 bug 2). The phone goes as 512-555-0142.
 */
export function toSubmission(fields: FieldState[], services: ServiceState[]) {
  const out: Partial<Record<DetailKey, string>> = {}
  for (const f of fields) {
    if (f.mode === 'prefilled') continue
    const v = f.value.trim()
    if (!v) continue
    out[f.key] = f.key === 'phone' ? (normalizePhone(v) ?? v) : v
  }
  return {
    fields: out,
    services: services.filter((s) => s.choice !== null).map((s) => ({ name: s.name, keep: s.choice === 'keep' })),
  }
}
