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
  template_choice?: string | null
  envato_item_id?: number | string | null
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
  /** Widen log rows for this business type that name this request or have no request id. */
  findWidens: (requestId: string, niche: Niche) => Promise<WidenRow[]>
  write: (id: string, patch: Record<string, unknown>) => Promise<boolean>
  now: () => Date
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A widen counts for this request when the log row is for the request's business type and either
 * names this request or is a team widen with no request id (Aria: a team widen applies to every
 * request of that business type; the admin "Widen to general" logs no request id).
 */
export function widenApplies(w: WidenRow | null, requestId: string, niche: Niche): boolean {
  if (!w || w.niche !== niche) return false
  return w.request_id === requestId || (w.request_id == null && w.actor_role === 'team')
}

/**
 * "General local business" template (Aria ruling, Oct 12): tagged other_local, or on no specific niche
 * (auto_niches empty or only other_local). A widen never admits another niche's template.
 * NOTE: the admin "general" view (admin/templates/page.tsx) lists every fresh active item without a
 * niche filter; this customer-side definition is deliberately narrower, per Aria.
 */
export function isGeneralTemplate(item: Pick<CatalogCard, 'autoNiches'>): boolean {
  return item.autoNiches.every((n) => n === 'other_local')
}

/** Item allowed for this type: tagged for it, or general AND covered by an applicable widen. */
export function itemAllowedForType(item: Pick<CatalogCard, 'autoNiches'>, type: Niche, widenOk: boolean): boolean {
  if (item.autoNiches.includes(type)) return true
  // L3 (Jace): other_local is the general type, so every general template fits it without a widen.
  if (type === 'other_local' && isGeneralTemplate(item)) return true
  return widenOk && isGeneralTemplate(item)
}

/**
 * M1 (Lina): niche-tagged items first, then widened general templates flagged general:true (each id once,
 * never another niche's item).
 */
export function mergeWidenedItems<T extends Pick<CatalogCard, 'id' | 'autoNiches'>>(tagged: T[], general: T[]): (T & { general: boolean })[] {
  const seen = new Set(tagged.map((i) => i.id))
  const out: (T & { general: boolean })[] = tagged.map((i) => ({ ...i, general: false }))
  for (const g of general) {
    if (seen.has(g.id) || !isGeneralTemplate(g)) continue
    seen.add(g.id)
    out.push({ ...g, general: true })
  }
  return out
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
      // a different type goes through changeBusinessTypeCore first
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
        if (!itemAllowedForType(item, type, widenApplies(widen, requestId, type))) return fail('stale')
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

export type TypeChangeResult = { ok: true; cleared: boolean } | { ok: false; error: PickError }

/**
 * Change business type (Aria ruling 2): allowed whenever the pick is editable. A catalog pick that
 * doesn't fit the new type (not tagged for it, and not a general template under an applicable widen)
 * is cleared so the customer chooses again; client_pasted and team_pick stay.
 */
export async function changeBusinessTypeCore(deps: PickDeps, requestId: unknown, newType: unknown): Promise<TypeChangeResult> {
  const fail = (error: PickError): TypeChangeResult => ({ ok: false, error })
  try {
    const uid = await deps.userId()
    if (!uid) return fail('save')
    if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return fail('save')
    if (!isNiche(newType)) return fail('save')
    const req = await deps.loadRequest(requestId)
    if (!req || req.user_id !== uid) return fail('save')
    if (!isPickEditable(req)) return fail('locked')
    const patch: Record<string, unknown> = { business_type: newType }
    let cleared = false
    if (req.template_choice === 'envato_catalog' && req.envato_item_id != null) {
      const item = await deps.lookupItem(Number(req.envato_item_id))
      let fits = false
      if (item) {
        if (itemAllowedForType(item, newType, false)) fits = true
        else if (isGeneralTemplate(item)) {
          const widens = await deps.findWidens(requestId, newType)
          fits = widens.some((w) => widenApplies(w, requestId, newType))
        }
      }
      if (!fits) {
        Object.assign(patch, { template_choice: null, envato_item_id: null, pasted_template_url: null, template_picked_at: null })
        cleared = true
      }
    }
    return (await deps.write(requestId, patch)) ? { ok: true, cleared } : fail('save')
  } catch {
    return fail('save')
  }
}
