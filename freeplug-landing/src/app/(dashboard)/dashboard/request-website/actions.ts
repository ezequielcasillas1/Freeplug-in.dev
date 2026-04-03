'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensure-profile'

const requestSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(200),
  contact_phone: z.string().max(50).optional().or(z.literal('')),
  google_business_url: z
    .string()
    .max(2000)
    .default('')
    .refine(
      (s) => {
        const t = s.trim()
        return t === '' || /^https?:\/\/.+/.test(t)
      },
      { message: 'Enter a valid URL (https://…)' }
    ),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type RequestWebsiteState = {
  error?: string
  success?: boolean
}

export async function submitWebsiteRequest(
  _prev: RequestWebsiteState,
  formData: FormData
): Promise<RequestWebsiteState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const parsed = requestSchema.safeParse({
    business_name: String(formData.get('business_name') ?? ''),
    contact_phone: String(formData.get('contact_phone') ?? ''),
    google_business_url: String(formData.get('google_business_url') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  })

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(' ')
    return { error: msg || 'Invalid input.' }
  }

  const v = parsed.data
  const phone = v.contact_phone?.trim() || null
  const gUrl = v.google_business_url.trim() || null
  const notes = v.notes?.trim() || null

  await ensureProfile(user.id)

  const { data: openRow } = await supabase
    .from('website_requests')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['submitted', 'in_review'])
    .maybeSingle()

  if (openRow?.status === 'in_review') {
    return {
      error:
        'Your request is already being reviewed. We will contact you by email or phone.',
    }
  }

  if (openRow?.id && openRow.status === 'submitted') {
    const { error } = await supabase
      .from('website_requests')
      .update({
        business_name: v.business_name.trim(),
        contact_phone: phone,
        google_business_url: gUrl,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', openRow.id)
      .eq('status', 'submitted')

    if (error) {
      return { error: error.message }
    }
  } else {
    const { error } = await supabase.from('website_requests').insert({
      user_id: user.id,
      business_name: v.business_name.trim(),
      contact_phone: phone,
      google_business_url: gUrl,
      notes,
      status: 'submitted',
    })

    if (error) {
      if (error.code === '23505') {
        return {
          error:
            'You already have a request in progress. We will contact you soon.',
        }
      }
      return { error: error.message }
    }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Server configuration is incomplete (missing service role). Your request was saved; profile status could not be updated.',
    }
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('evaluation_progress')
    .eq('id', user.id)
    .single()

  const nextProgress = Math.max(25, prof?.evaluation_progress ?? 0)

  const { error: updErr } = await admin
    .from('profiles')
    .update({
      evaluation_status: 'requested',
      evaluation_progress: nextProgress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updErr) {
    return { error: updErr.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/request-website')
  redirect('/dashboard?submitted=1')
}

/** Closes the user's open website request (submitted or in review) — withdraw / cancel early. */
export async function cancelOwnWebsiteRequest(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }
  const { error } = await supabase.rpc('cancel_own_website_request')
  if (error) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/request-website')
  return { ok: true }
}
