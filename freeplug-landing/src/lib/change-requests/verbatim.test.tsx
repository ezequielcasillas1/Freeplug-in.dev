import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * Vera + Jace must-have: the customer's exact words are kept for the PR quote. change_requests
 * stores description and page byte for byte; /admin detail and the dashboard show the original;
 * ONLY the webhook payload is scrubbed. (DB round trip: change-req-pgtest verbatim checks.)
 */
const DESCRIPTION = '  Call me at (512) 555-0199 or email josé.ñandú@example.com — swap “Café” → 🌮 tacos\nLine 2\t end  '
const PAGE = '  Menú / Página 2 ☕ '
const ROW = {
  id: '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13', user_id: 'u1', website_request_id: null, change_type: 'Text or prices',
  page: PAGE, description: DESCRIPTION, photo_name: null, plan_step: 'starter', billing: 'included' as const, status: 'pending_review',
  decision_note: null, pr_url: null, decided_at: null, notified_at: null, notify_error: null,
  created_at: '2026-10-10T20:00:00.000Z', updated_at: '2026-10-10T20:00:00.000Z', website_requests: { business_name: 'Café Ñandú' },
}

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/app/admin/change-requests/actions', () => ({ adminDecideChangeRequest: async () => ({}), adminResendChangeRequest: async () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ROW, error: null }) }) }) }) }),
}))

import AdminChangeRequestPage from '@/app/admin/change-requests/[id]/page'
import { ChangeRequestsCard } from '@/app/(dashboard)/dashboard/ChangeRequestsCard'
import { buildChangeRequestPayload } from './payload'

describe('verbatim guarantee: the customer\'s exact words (only the webhook payload is scrubbed)', () => {
  it('admin detail view shows the original, unscrubbed description and page (admin only) so it can be quoted', async () => {
    render(await AdminChangeRequestPage({ params: Promise.resolve({ id: ROW.id }) }))
    const desc = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === DESCRIPTION)
    expect(desc.className).toMatch(/whitespace-pre-wrap/)
    expect(screen.getByText((_, el) => el?.tagName === 'DD' && el.textContent === PAGE)).toBeTruthy()
    expect(document.body.textContent).not.toContain('[removed]')
  })
  it("customer dashboard shows the customer's own words unchanged", () => {
    render(<ChangeRequestsCard requests={[ROW as never]} />)
    expect(screen.getByTestId('change-request-text').textContent).toBe(DESCRIPTION)
  })
  it('the webhook payload is the only scrubbed copy', () => {
    const p = buildChangeRequestPayload({ ...ROW, business_name: 'Café Ñandú' }, 'http://localhost:3381')
    expect(p.description).toContain('[removed]')
    expect(p.description).not.toContain('555-0199')
    expect(p.description).not.toContain('@example.com')
    expect(p.description).toContain('“Café” → 🌮 tacos') // unicode survives the scrub too
    expect(ROW.description).toBe(DESCRIPTION) // building the payload never mutates the row
  })
  it('scrubForWebhook is imported by payload.ts only (nothing else stores or shows scrubbed text)', () => {
    const root = join(process.cwd(), 'src')
    const hits: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && /scrubForWebhook|from '\.\/scrub'|change-requests\/scrub/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(root.length + 1))
      }
    }
    walk(root)
    expect(hits.sort()).toEqual(['lib/change-requests/payload.ts', 'lib/change-requests/scrub.ts'])
  })
})
