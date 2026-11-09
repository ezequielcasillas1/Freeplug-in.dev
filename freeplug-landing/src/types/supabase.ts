export type EvaluationStatus =
  | 'none'
  | 'requested'
  | 'in_review'
  | 'evaluated'
  | 'agreed'

export type ProfileRow = {
  id: string
  stripe_customer_id: string | null
  website_value_target_cents: number | null
  cumulative_website_value_paid_cents: number
  evaluation_status: EvaluationStatus
  evaluation_progress: number
  /** Legacy handoff notes. Not shown in the app since the Sep 25, 2026 buyout decision; column kept. */
  website_transfer_notes: string | null
  website_transfer_acknowledged_at: string | null
  updated_at: string
}

export type WebsiteRequestRow = {
  id: string
  user_id: string
  business_name: string
  contact_phone: string | null
  google_business_url: string | null
  notes: string | null
  /** Owner-set buyout price in cents (null = not quoted). Admin-only write (service role). */
  buyout_price_cents: number | null
  /** Buyout request flag. Set only by the server (service role); customers can't change it. */
  is_buyout: boolean
  status: import('@/lib/consultation/status').WebsiteRequestStatus
  created_at: string
  updated_at: string
}

/** Help-chat change request (migration 20261004150000). Customers read only some columns. */
export type ChangeRequestRow = {
  id: string
  user_id: string
  website_request_id: string | null
  change_type: string
  page: string
  description: string
  photo_name: string | null
  /** Server-set (service role): the plan step when the request came in. */
  plan_step: string | null
  billing: 'included' | 'paid_addon' | 'quote' | 'unknown'
  status: 'pending_review' | 'approved' | 'declined'
  decision_note: string | null
  /** Admin only: the GitHub PR whose review recorded the decision. */
  pr_url: string | null
  decided_at: string | null
  notified_at: string | null
  notify_error: string | null
  created_at: string
  updated_at: string
}

export type ConsultationRow = {
  id: string
  request_id: string
  user_id: string
  path: 'form' | 'live'
  live_method: 'phone' | 'facetime' | 'webcam' | 'text' | null
  contact_number: string | null
  booking_ref: string | null
  booked_at: string | null
  checklist: Record<string, unknown>
  prepared_by: 'client' | 'team'
  ready_for_review_at: string | null
  agreed_at: string | null
  agreed_ip: string | null
  created_at: string
  updated_at: string
}

export type ConsultationConsentRow = {
  id: string
  consultation_id: string
  user_id: string
  channel: 'phone' | 'text'
  phone_number: string
  consent_text: string
  consented_at: string
  ip: string | null
  user_agent: string | null
}
