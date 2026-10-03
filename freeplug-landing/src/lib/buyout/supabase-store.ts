import type { SupabaseClient } from '@supabase/supabase-js'
import type { BuyoutStore } from './buyout'

const OPEN_STATUSES = ['submitted', 'in_review']

/**
 * BuyoutStore on the existing website_requests table. Pass the service-role client: the caller has
 * already verified the user, and every query is scoped to that user id. is_buyout can only be set by
 * the service role (database trigger), and the customer's own RLS policy can't update a request
 * that is in review.
 */
export function supabaseBuyoutStore(db: SupabaseClient): BuyoutStore {
  return {
    async getOpenRequest(userId) {
      const { data, error } = await db
        .from('website_requests')
        .select('id, notes, updated_at, is_buyout')
        .eq('user_id', userId)
        .in('status', OPEN_STATUSES)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
    async getLatestDetails(userId) {
      const { data, error } = await db
        .from('website_requests')
        .select('business_name, contact_phone, google_business_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
    async markBuyoutIfUnchanged(row, notes, now) {
      const { data, error } = await db
        .from('website_requests')
        .update({ is_buyout: true, notes, updated_at: now.toISOString() })
        .eq('id', row.id)
        .eq('updated_at', row.updated_at)
        .in('status', OPEN_STATUSES)
        .select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },
    async insertRequest(userId, details, notes) {
      const { error } = await db.from('website_requests').insert({
        user_id: userId,
        business_name: details.business_name,
        contact_phone: details.contact_phone,
        google_business_url: details.google_business_url,
        notes,
        status: 'submitted',
        is_buyout: true,
      })
      if (!error) return 'ok'
      if (error.code === '23505') return 'conflict'
      return { error: error.message }
    },
  }
}
