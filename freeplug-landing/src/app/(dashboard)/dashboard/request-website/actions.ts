'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensure-profile'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'
import {
  CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE,
  closeBlockedPlanEndingMessage,
  getActiveSubscriptionStatus,
} from '@/lib/stripe/active-subscription'
import { HELP_CHAT_LIMIT, rateCheck } from '@/lib/rate-limit'
import { ERROR_TOO_MANY_TRIES } from '@/lib/outreach/copy'

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

type RequestValues = z.infer<typeof requestSchema>
type ServerSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Saves the signed-in user's website request: updates their open (submitted) request or inserts a
 * new one, then marks their profile as requested. Shared by the request form (Plans page
 * "Request maintenance") and the Help chat change request. Not exported: server-only helper.
 */
async function saveWebsiteRequest(
  supabase: ServerSupabase,
  userId: string,
  v: RequestValues
): Promise<RequestWebsiteState> {
  const phone = v.contact_phone?.trim() || null
  const gUrl = v.google_business_url.trim() || null
  const notes = v.notes?.trim() || null

  await ensureProfile(userId)

  const { data: openRow } = await supabase
    .from('website_requests')
    .select('id, status')
    .eq('user_id', userId)
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
      user_id: userId,
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
    .eq('id', userId)
    .single()

  const nextProgress = Math.max(25, prof?.evaluation_progress ?? 0)

  const { error: updErr } = await admin
    .from('profiles')
    .update({
      evaluation_status: 'requested',
      evaluation_progress: nextProgress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updErr) {
    return { error: updErr.message }
  }

  return { success: true }
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

  const saved = await saveWebsiteRequest(supabase, user.id, parsed.data)
  if (saved.error) {
    return saved
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/request-website')
  redirect('/dashboard?submitted=1')
}

const changeRequestSchema = z.object({
  changeType: z.enum(CHANGE_TYPES),
  page: z.string().trim().min(1, 'Tell us which page it is on.').max(200),
  description: z.string().trim().min(1, 'Describe the change.').max(2000),
  /** File name only. The request path has no file storage, so the photo itself is not uploaded. */
  photoName: z.string().trim().max(200).optional(),
})

export type HelpChangeRequestInput = z.input<typeof changeRequestSchema>

export type HelpChangeRequestResult = { ok: true; email: string } | { ok: false; error: string }

/**
 * Help chat "Send request": stores the change on the same website request the Plans page
 * "Request maintenance" form uses (appended to the open request's notes, or a new request that
 * reuses the business details of the latest one). No email is sent and nothing is charged.
 */
export async function sendHelpChangeRequest(
  input: HelpChangeRequestInput
): Promise<HelpChangeRequestResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const parsed = changeRequestSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(' ')
    return { ok: false, error: msg || 'Invalid input.' }
  }
  const c = parsed.data

  // Shared limiter (Aria, section 3): 10 help-chat requests per hour per user.
  if (!(await rateCheck(HELP_CHAT_LIMIT, user.id))) {
    return { ok: false, error: ERROR_TOO_MANY_TRIES }
  }

  const { data: latest } = await supabase
    .from('website_requests')
    .select('status, business_name, contact_phone, google_business_url, notes')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest?.business_name?.trim()) {
    return {
      ok: false,
      error: 'Start a website request first, then you can ask for changes here.',
    }
  }

  const changeBlock = [
    'Change request (Help chat):',
    `Type: ${c.changeType}`,
    `Page: ${c.page}`,
    `Change: ${c.description}`,
    c.photoName ? `Photo: ${c.photoName} (chosen in the chat; not uploaded)` : null,
  ]
    .filter(Boolean)
    .join('\n')

  // Keep the open request's details and notes; start fresh notes on a new request.
  const isOpen = latest.status === 'submitted' || latest.status === 'in_review'
  const existingNotes = isOpen ? latest.notes?.trim() ?? '' : ''
  const notes = existingNotes ? `${existingNotes}\n\n${changeBlock}` : changeBlock
  if (notes.length > 5000) {
    return {
      ok: false,
      error: 'Your request notes are full. Email support@freeplug-in.dev with this change.',
    }
  }

  const saved = await saveWebsiteRequest(supabase, user.id, {
    business_name: latest.business_name,
    contact_phone: latest.contact_phone ?? '',
    google_business_url: latest.google_business_url ?? '',
    notes,
  })
  if (saved.error) {
    return { ok: false, error: saved.error }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/request-website')
  return { ok: true, email: user.email ?? '' }
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

  // Closing does not touch Stripe billing, so refuse while a plan is still active or trialing.
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr) {
    return { ok: false, error: 'Could not verify your billing status. Try again later.' }
  }
  const customerId = prof?.stripe_customer_id
  if (customerId) {
    try {
      const plan = await getActiveSubscriptionStatus(customerId)
      if (plan.active) {
        return {
          ok: false,
          error: plan.setToEnd
            ? closeBlockedPlanEndingMessage(plan.endsAt)
            : CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE,
        }
      }
    } catch (e) {
      console.error(
        '[request-website/close] subscription lookup failed',
        e instanceof Error ? e.message : e
      )
      return { ok: false, error: 'Could not verify your billing status. Try again later.' }
    }
  }

  // Users can no longer call the close RPC directly (EXECUTE is service_role only), so the close
  // runs with the service-role client, scoped to the verified user id, after the checks above.
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Server configuration is incomplete. Try again later.' }
  }
  const { error } = await admin.rpc('cancel_website_request_for_user', { p_user_id: user.id })
  if (error) {
    if (error.message === 'No open request to close.') {
      return { ok: false, error: error.message }
    }
    console.error('[request-website/close] close failed', error.message)
    return { ok: false, error: 'Could not close your request. Try again later.' }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/request-website')
  return { ok: true }
}
