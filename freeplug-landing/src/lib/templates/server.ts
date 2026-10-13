import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listCatalogForType, listGeneralCatalog, lookupCatalogItem, type CatalogCard } from './catalog-lookup'
import { mergeWidenedItems, widenApplies, type PickDeps, type PickRequestRow, type WidenRow } from './pick'
import type { Niche } from '@/lib/envato/niche-tags'

/**
 * The customer picker's only service-role entry point (allowlisted in eslint.config.mjs). Callers get
 * narrow functions, never the client itself.
 */
export function getCatalogItem(id: number): Promise<CatalogCard | null> {
  return lookupCatalogItem(createAdminClient(), id)
}

export function listTemplatesForType(type: string): Promise<CatalogCard[]> {
  return listCatalogForType(createAdminClient(), type)
}

async function findWidenRows(db: ReturnType<typeof createAdminClient>, requestId: string, niche: Niche): Promise<WidenRow[]> {
  const { data, error } = await db
    .from('template_widen_log')
    .select('id, niche, request_id, actor_role')
    .eq('niche', niche)
    .or(`request_id.eq.${requestId},request_id.is.null`)
    .order('id', { ascending: false })
    .limit(50)
  if (error) throw new Error('widen lookup failed')
  return ((data ?? []) as WidenRow[]).map((w) => ({ ...w, id: Number(w.id) }))
}

/**
 * Grid for the customer picker (M1): templates tagged for the type, plus general templates when a widen
 * applies to this request (a client widen naming it, or a team widen for the type). Returns the widen id
 * so the pick action can be given it. Caller has already checked ownership of requestId.
 */
export type PickerTemplate = CatalogCard & { general: boolean }

export async function listPickerTemplates(requestId: string, type: Niche): Promise<{ items: PickerTemplate[]; widenLogId: number | null }> {
  const db = createAdminClient()
  // L3 (Jace): other_local IS the general type, so it lists every general template, untagged as General.
  if (type === 'other_local') return { items: (await listGeneralCatalog(db)).map((c) => ({ ...c, general: false })), widenLogId: null }
  const tagged = await listCatalogForType(db, type)
  const widen = (await findWidenRows(db, requestId, type)).find((w) => widenApplies(w, requestId, type)) ?? null
  if (!widen) return { items: tagged.map((c) => ({ ...c, general: false })), widenLogId: null }
  return { items: mergeWidenedItems(tagged, await listGeneralCatalog(db)), widenLogId: widen.id }
}

/** Real wiring for savePickCore: session from the cookie client, every read/write via the service-role client. */
export async function pickDeps(): Promise<PickDeps> {
  const supabase = await createClient()
  const db = createAdminClient()
  return {
    userId: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    loadRequest: async (id) => {
      const { data, error } = await db
        .from('website_requests')
        .select('id, user_id, status, business_type, template_locked_at, template_choice, envato_item_id')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error('load failed')
      return (data as PickRequestRow | null) ?? null
    },
    lookupItem: (id) => lookupCatalogItem(db, id),
    loadWiden: async (id) => {
      const { data, error } = await db.from('template_widen_log').select('id, niche, request_id, actor_role').eq('id', id).maybeSingle()
      if (error) throw new Error('widen lookup failed')
      return data ? ({ ...(data as WidenRow), id: Number((data as WidenRow).id) }) : null
    },
    findWidens: (requestId, niche) => findWidenRows(db, requestId, niche),
    // Conditional write: re-checks owner + editable in the same UPDATE so a lock/close can't race the save.
    write: async (id, patch) => {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) return false
      const { data, error } = await db
        .from('website_requests')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .in('status', ['submitted', 'in_review'])
        .is('template_locked_at', null)
        .select('id')
      return !error && (data?.length ?? 0) === 1
    },
    now: () => new Date(),
  }
}

