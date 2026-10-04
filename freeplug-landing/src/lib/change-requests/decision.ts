import { z } from 'zod'

/**
 * /admin Approve / Decline (Aria flow update, Oct 4 ~3 PM CT): records Ezequiel's PR verdict.
 * Admin only (service role). Approve charges nothing and starts nothing; it only sets the status.
 */
export const DECISION_NOTE_MAX = 500
export const GITHUB_PR_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/[0-9]+$/

const decisionSchema = z.object({
  id: z.string().uuid('Invalid request id'),
  decision: z.enum(['approved', 'declined'], { message: 'Pick Approve or Decline' }),
  note: z.string().trim().max(DECISION_NOTE_MAX, `Keep the note under ${DECISION_NOTE_MAX} characters`),
  prUrl: z
    .string()
    .trim()
    .max(300, 'PR link is too long')
    .refine((s) => s === '' || GITHUB_PR_URL.test(s), { message: 'PR link must look like https://github.com/<owner>/<repo>/pull/<number>' }),
})

export type DecisionInput = { id: string; decision: 'approved' | 'declined'; note: string | null; prUrl: string | null }

export function parseDecisionForm(formData: FormData): { ok: true; value: DecisionInput } | { ok: false; error: string } {
  const parsed = decisionSchema.safeParse({
    id: String(formData.get('id') ?? ''),
    decision: String(formData.get('decision') ?? ''),
    note: String(formData.get('note') ?? ''),
    prUrl: String(formData.get('pr_url') ?? ''),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(' ') }
  const v = parsed.data
  return { ok: true, value: { id: v.id, decision: v.decision, note: v.note || null, prUrl: v.prUrl || null } }
}

/** The row update for a decision (only from pending_review; the caller filters on status). */
export function decisionPatch(v: DecisionInput, now: Date = new Date()) {
  const at = now.toISOString()
  return { status: v.decision, decision_note: v.note, pr_url: v.prUrl, decided_at: at, updated_at: at }
}
