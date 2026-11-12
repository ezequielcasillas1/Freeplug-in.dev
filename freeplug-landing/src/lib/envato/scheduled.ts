import { createClient } from '@supabase/supabase-js'
import { createEnvatoClient } from './client'
import { SupabaseCatalogStore } from './store-server'
import { syncCatalog, SYNC_DELAY_MS } from './sync'

/** The 3-hour cron: "0 *\/3 * * *". OFF (Gate 1): the trigger is commented out in wrangler.jsonc AND this
 * returns early unless ENVATO_CRON_ENABLED === "true". */
export const ENVATO_CRON = '0 */3 * * *'

export function envatoCronEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ENVATO_CRON_ENABLED === 'true'
}

export async function runScheduledEnvatoSync(env: Record<string, string | undefined> = process.env): Promise<'disabled' | 'ran'> {
  if (!envatoCronEnabled(env)) return 'disabled'
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Supabase server env missing')
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  await syncCatalog({ api: createEnvatoClient({ delayMs: SYNC_DELAY_MS, token: env.ENVATO_API_TOKEN }), store: new SupabaseCatalogStore(db) })
  return 'ran'
}
