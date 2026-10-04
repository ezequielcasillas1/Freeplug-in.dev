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
  status: 'submitted' | 'in_review' | 'closed'
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
