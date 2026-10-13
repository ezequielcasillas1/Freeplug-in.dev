'use server'

import { readFile } from 'node:fs/promises'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEnvatoClient, envatoTokenConfigured } from '@/lib/envato/client'
import { SupabaseCatalogStore } from '@/lib/envato/store-server'
import { syncCatalog, SYNC_DELAY_MS } from '@/lib/envato/sync'
import { importShortlist } from '@/lib/envato/shortlist-import'
import { isNiche } from '@/lib/envato/niche-tags'
import { assertTemplatesAccess } from './guard'

const DEFAULT_SHORTLIST_PATH = '/workspace/lina/envato-shortlist-2026-10-12.json'

/** "Sync now": one manual sweep in the background on this local server. */
export async function syncNowAction(): Promise<void> {
  await assertTemplatesAccess()
  if (!envatoTokenConfigured()) redirect('/admin/templates?msg=no-token')
  const db = createAdminClient()
  const since = new Date(Date.now() - 45 * 60_000).toISOString()
  const { data: open } = await db.from('envato_sync_runs').select('id').is('finished_at', null).gte('started_at', since).limit(1)
  if (open && open.length) redirect('/admin/templates?msg=sync-running')
  const store = new SupabaseCatalogStore(db)
  void syncCatalog({ api: createEnvatoClient({ delayMs: SYNC_DELAY_MS }), store }).catch(() => {
    // the run row records the error; never log request details (token stays out of logs)
  })
  redirect('/admin/templates?msg=sync-started')
}

export async function importShortlistAction(): Promise<void> {
  await assertTemplatesAccess()
  const path = process.env.ENVATO_SHORTLIST_PATH?.trim() || DEFAULT_SHORTLIST_PATH
  const json = JSON.parse(await readFile(/* turbopackIgnore: true */ path, 'utf8'))
  const r = await importShortlist(new SupabaseCatalogStore(createAdminClient()), json, path)
  revalidatePath('/admin/templates')
  redirect(`/admin/templates?msg=imported-${r.imported}-${r.counts.confirmed}-${r.counts.cut}-${r.counts.unverified}`)
}

export async function decideCleaningAction(form: FormData): Promise<void> {
  const email = await assertTemplatesAccess()
  const id = Number(form.get('id'))
  const decision = form.get('decision')
  if (!Number.isInteger(id) || (decision !== 'yes' && decision !== 'no')) throw new Error('bad decision')
  const matched = String(form.get('matched_tag') ?? '') || null
  await new SupabaseCatalogStore(createAdminClient()).decide({ envato_item_id: id, niche: 'cleaning', decision, matched_tag: matched, decided_by: email })
  revalidatePath('/admin/templates')
}

/** "Widen to general": a reason is required and every widen is logged. */
export async function widenAction(form: FormData): Promise<void> {
  const email = await assertTemplatesAccess()
  const niche = String(form.get('niche') ?? '')
  const reason = String(form.get('reason') ?? '').trim()
  if (!isNiche(niche)) throw new Error('bad niche')
  if (!reason) redirect(`/admin/templates?niche=${niche}&msg=reason-required`)
  const { error } = await createAdminClient()
    .from('template_widen_log')
    .insert({ niche, reason: reason.slice(0, 500), actor_email: email, actor_role: 'team' })
  if (error) throw new Error('widen log write failed')
  redirect(`/admin/templates?niche=${niche}&view=general`)
}
