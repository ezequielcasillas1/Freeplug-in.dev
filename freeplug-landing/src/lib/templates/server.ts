import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listCatalogForType, lookupCatalogItem, type CatalogCard } from './catalog-lookup'
import type { PickDeps, PickRequestRow, WidenRow } from './pick'

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
    findWidens: async (requestId, niche) => {
      const { data, error } = await db
        .from('template_widen_log')
        .select('id, niche, request_id, actor_role')
        .eq('niche', niche)
        .or(`request_id.eq.${requestId},request_id.is.null`)
        .limit(50)
      if (error) throw new Error('widen lookup failed')
      return ((data ?? []) as WidenRow[]).map((w) => ({ ...w, id: Number(w.id) }))
    },
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

