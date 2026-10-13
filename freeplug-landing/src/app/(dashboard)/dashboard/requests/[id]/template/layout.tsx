import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ownership gate OUTSIDE loading.tsx's Suspense boundary, so a non-owner / anonymous / bad id gets a real
 * 404 status (notFound() before any streaming) instead of 200 + not-found content (Vera I1, Jace).
 * page.tsx keeps its own owner check.
 */
export default async function TemplatePickerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data } = await supabase.from('website_requests').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!data) notFound()
  return children
}
