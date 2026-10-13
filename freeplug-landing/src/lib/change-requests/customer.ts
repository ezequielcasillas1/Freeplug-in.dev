/** Columns the customer may read (column grant in 20261004150000_change_requests.sql). */
export const CUSTOMER_CHANGE_REQUEST_COLUMNS = 'id, change_type, page, description, status, decision_note, decided_at, created_at'

export type CustomerChangeRequest = {
  id: string
  change_type: string
  page: string
  description: string
  status: string
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

/** How many the dashboard lists (newest first). */
export const CUSTOMER_CHANGE_REQUEST_LIMIT = 10
