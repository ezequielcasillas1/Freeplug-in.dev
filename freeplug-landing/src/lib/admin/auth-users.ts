import type { SupabaseClient } from '@supabase/supabase-js'

export type AuthUserSummary = {
  email: string | null
  /** From user_metadata when present */
  displayName: string | null
}

/** Resolve Supabase Auth emails/names for dashboard user ids (service role). */
export async function getAuthSummariesByUserIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, AuthUserSummary>> {
  const map = new Map<string, AuthUserSummary>()
  const unique = [...new Set(userIds.filter(Boolean))]
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data?.user) {
        map.set(id, { email: null, displayName: null })
        return
      }
      const u = data.user
      const meta = u.user_metadata as Record<string, unknown> | undefined
      const name =
        (typeof meta?.full_name === 'string' && meta.full_name) ||
        (typeof meta?.name === 'string' && meta.name) ||
        null
      map.set(id, { email: u.email ?? null, displayName: name })
    })
  )
  return map
}
