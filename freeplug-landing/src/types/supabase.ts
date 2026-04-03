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
  /** Admin-only content; shown when website value milestone reached */
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
  status: 'submitted' | 'in_review' | 'closed'
  created_at: string
  updated_at: string
}
