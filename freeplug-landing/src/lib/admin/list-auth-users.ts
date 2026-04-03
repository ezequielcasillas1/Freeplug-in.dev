import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const PER_PAGE = 100
const MAX_PAGES = 20

/** Paginate through Auth users (service role). */
export async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const out: User[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })
    if (error) throw new Error(error.message)
    const batch = data?.users ?? []
    out.push(...batch)
    if (batch.length < PER_PAGE) break
  }
  return out
}
