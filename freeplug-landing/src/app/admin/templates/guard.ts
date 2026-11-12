import 'server-only'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { assertAdminAccess } from '@/lib/admin/guard'
import { isLocalhostRequest } from '@/lib/admin/localhost-only'
import { createClient } from '@/lib/supabase/server'

/** ADMIN_EMAILS (via assertAdminAccess) AND localhost-only. Returns the admin's email. */
export async function assertTemplatesAccess(): Promise<string> {
  if (!isLocalhostRequest(await headers())) notFound()
  await assertAdminAccess()
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? 'admin'
}
