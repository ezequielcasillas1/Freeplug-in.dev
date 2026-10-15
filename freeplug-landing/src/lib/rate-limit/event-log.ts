import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Event counter on the shared public.rate_limit_hits table (service role has select/insert; rate_check()
 * purges rows older than 2 days). Used for the password-reset fallback count on the admin mail banner, so
 * the count is shared by every Workers isolate without a migration. `label` must not contain personal data.
 */
export async function recordEvent(bucket: string, label: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await createAdminClient().from('rate_limit_hits').insert({ bucket, key_hash: label })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' }
  }
}

/** Newest first, at most 1000. Returns null when the database can't be read. */
export async function listEvents(bucket: string, sinceIso: string): Promise<{ label: string; at: string }[] | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('rate_limit_hits')
      .select('key_hash, hit_at')
      .eq('bucket', bucket)
      .gte('hit_at', sinceIso)
      .order('hit_at', { ascending: false })
      .limit(1000)
    if (error || !Array.isArray(data)) return null
    return (data as { key_hash: string; hit_at: string }[]).map((r) => ({ label: r.key_hash, at: r.hit_at }))
  } catch {
    return null
  }
}
