import { isNiche, type Niche } from '@/lib/envato/niche-tags'
import { isFresh, type CatalogCard } from './catalog-lookup'

export const TEMPLATE_CHOICES = ['envato_catalog', 'client_pasted', 'team_pick'] as const
export type TemplateChoice = (typeof TEMPLATE_CHOICES)[number]
export const PASTE_PREFIX = 'https://themeforest.net/item/'
export const PASTE_MAX = 500

/** Error codes map 1:1 to Sable's generic copy keys; no detail ever reaches the client. */
export type PickError = 'save' | 'stale' | 'locked' | 'paste'
export type PickResult = { ok: true } | { ok: false; error: PickError }

export type PickRequestRow = {
  id: string
  user_id: string
  status: string
  business_type: string | null
  template_locked_at: string | null
}

/**
 * Editable before build / license / Lina's approval. website_requests has no build or license
 * fields, so (Aria ruling, Oct 12): status in ('submitted','in_review') AND template_locked_at IS NULL.
 * template_locked_at is set by the admin lock action (Lina approved the pick, or a license was recorded).
 * 'closed' is never editable.
 */
export function isPickEditable(r: Pick<PickRequestRow, 'status' | 'template_locked_at'>): boolean {
  return (r.status === 'submitted' || r.status === 'in_review') && r.template_locked_at == null
}

export function isValidPastedUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  const s = raw.trim()
  if (s.length > PASTE_MAX || !s.startsWith(PASTE_PREFIX) || s.length === PASTE_PREFIX.length) return false
  if (/\s/.test(s)) return false
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && u.hostname === 'themeforest.net' && u.pathname.startsWith('/item/') && !u.username && !u.password
  } catch {
    return false
  }
}

export type PickInput = {
  choice: TemplateChoice
  envatoItemId?: number | null
  pastedUrl?: string | null
  widenLogId?: number | null
  businessType?: string | null
}

export type WidenRow = { id: number; niche: string; request_id: string | null; actor_role: string }

export type PickDeps = {
  userId: () => Promise<string | null>
  loadRequest: (id: string) => Promise<PickRequestRow | null>
  lookupItem: (id: number) => Promise<CatalogCard | null>
  loadWiden: (id: number) => Promise<WidenRow | null>
  write: (id: string, patch: Record<string, unknown>) => Promise<boolean>
  now: () => Date
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A widen counts for this request when the log row is for the request's business type and either
 * names this request or is a team widen (the admin "Widen to general" logs no request id).
 */
export function widenApplies(w: WidenRow | null, requestId: string, niche: Niche): boolean {
  if (!w || w.niche !== niche) return false
  return w.request_id === requestId || (w.request_id == null && w.actor_role === 'team')
}

export async function savePickCore(deps: PickDeps, requestId: unknown, input: PickInput): Promise<PickResult> {
  const fail = (error: PickError): PickResult => ({ ok: false, error })
  try {
    const uid = await deps.userId()
    if (!uid) return fail('save')
    if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return fail('save')
    if (!input || !(TEMPLATE_CHOICES as readonly string[]).includes(input.choice)) return fail('save')

    const req = await deps.loadRequest(requestId)
    if (!req || req.user_id !== uid) return fail('save')
    if (!isPickEditable(req)) return fail('locked')

    // business_type: saved with the pick only when empty; never inferred from the template.
    let type: Niche
    const patch: Record<string, unknown> = {}
    if (req.business_type != null) {
      if (!isNiche(req.business_type)) return fail('save')
      type = req.business_type
      if (input.businessType != null && input.businessType !== req.business_type) return fail('save')
    } else {
      if (!isNiche(input.businessType)) return fail('save')
      type = input.businessType
      patch.business_type = type
    }

    const now = deps.now()
    if (input.choice === 'envato_catalog') {
      const id = Number(input.envatoItemId)
      if (!Number.isSafeInteger(id) || id <= 0) return fail('save')
      const item = await deps.lookupItem(id)
      if (!item || !isFresh(item, now.getTime())) return fail('stale')
      if (!item.autoNiches.includes(type)) {
        const wid = input.widenLogId == null ? NaN : Number(input.widenLogId)
        const widen = Number.isSafeInteger(wid) && wid > 0 ? await deps.loadWiden(wid) : null
        if (!widenApplies(widen, requestId, type)) return fail('stale')
      }
      Object.assign(patch, { template_choice: 'envato_catalog', envato_item_id: id, pasted_template_url: null })
    } else if (input.choice === 'client_pasted') {
      if (!isValidPastedUrl(input.pastedUrl)) return fail('paste')
      Object.assign(patch, { template_choice: 'client_pasted', envato_item_id: null, pasted_template_url: input.pastedUrl.trim() })
    } else {
      Object.assign(patch, { template_choice: 'team_pick', envato_item_id: null, pasted_template_url: null })
    }
    patch.template_picked_at = now.toISOString()
    return (await deps.write(requestId, patch)) ? { ok: true } : fail('save')
  } catch {
    return fail('save')
  }
}
