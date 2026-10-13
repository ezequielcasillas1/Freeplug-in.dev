/**
 * Manual Envato sync on THIS box against the LOCAL Docker Supabase only (refuses any non-loopback
 * Supabase URL). Imports Lina's shortlist, runs one paced sweep (2.5 s between calls), prints counts.
 * Build+run: npx esbuild scripts/envato-sync-local.ts --bundle --platform=node --format=esm
 *   --alias:@=./src --alias:server-only=./test/server-only-stub.ts --packages=external --outfile=/tmp/envato-sync.mjs
 *   && node /tmp/envato-sync.mjs [--import-only]
 * The token is read from process.env.ENVATO_API_TOKEN and never printed.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createEnvatoClient } from '../src/lib/envato/client'
import { SupabaseCatalogStore } from '../src/lib/envato/store-server'
import { syncCatalog, SYNC_DELAY_MS } from '../src/lib/envato/sync'
import { importShortlist } from '../src/lib/envato/shortlist-import'

function loadEnvLocal() {
  const env: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) throw new Error('Refusing: Supabase URL is not local')
  const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
  const store = new SupabaseCatalogStore(db)
  const path = process.env.ENVATO_SHORTLIST_PATH || '/workspace/lina/envato-shortlist-2026-10-12.json'
  const imp = await importShortlist(store, JSON.parse(readFileSync(path, 'utf8')), path)
  console.log('shortlist', JSON.stringify(imp))
  if (process.argv.includes('--import-only')) return
  const api = createEnvatoClient({ delayMs: SYNC_DELAY_MS })
  const t0 = Date.now()
  const r = await syncCatalog({ api, store, log: (l) => console.log(new Date().toISOString(), l) })
  console.log('result', JSON.stringify({ runId: r.runId, complete: r.complete, error: r.error, calls: r.calls, seen: r.items_seen, changed: r.items_changed, removed: r.items_removed, perCategory: r.perCategory, partitions: r.partitionList, minutes: ((Date.now() - t0) / 60000).toFixed(1) }))
}
main().catch((e) => {
  console.error('sync failed:', e instanceof Error ? e.message : 'error')
  process.exit(1)
})
