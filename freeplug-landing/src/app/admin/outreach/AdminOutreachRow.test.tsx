import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_CANCEL_BUTTON, ADMIN_PUBLISH_BUTTON } from '@/lib/outreach/copy'
import { ADMIN_STALE_NOTE } from '@/lib/outreach/admin-labels'
import { AdminOutreachRow, type AdminOutreachRowView } from './AdminOutreachRow'

const calls = vi.hoisted(() => ({ deletePhotos: [] as string[], rejects: [] as string[] }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
// Server actions: plain stand-ins (the row only calls them on click).
vi.mock('./actions', () => ({
  applySubmissionAction: async () => ({ ok: true }),
  deleteApprovedPhotoFilesAction: async (id: string) => (calls.deletePhotos.push(id), { ok: true, deleted: 2 }),
  extendLinkAction: async () => ({ ok: true }),
  publishSiteAction: async () => ({ ok: true }),
  rejectSubmissionAction: async (id: string) => (calls.rejects.push(id), { ok: true }),
  reviewChangeRequestAction: async () => ({ ok: true }),
  revokeLinkAction: async () => ({ ok: true }),
  submissionPhotosAction: async () => [],
  unclaimAndReissueAction: async () => ({ ok: true }),
}))

function row(over: Partial<AdminOutreachRowView> = {}): AdminOutreachRowView {
  return {
    id: 'site-1',
    businessName: "Gracia's Lawn Service",
    status: { label: 'Claimed, waiting to publish', tone: 'amber' },
    expiresAt: '2026-10-26T05:00:00Z',
    claimerEmail: 'gracia@example.com',
    planLine: '$35/month',
    cardSaved: false,
    live: false,
    liveUrl: null,
    publishStatus: 'none',
    publishError: null,
    photoCount: 3,
    storedApprovedPhotoCount: 0,
    customerConfirmedAt: null,
    submissions: [],
    closedPreview: [],
    changes: [],
    ...over,
  }
}

describe('admin outreach row: Publish (Jace/Lina, Sep 27)', () => {
  it('no card on file: no Publish button', () => {
    render(<AdminOutreachRow row={row({ cardSaved: false })} />)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('card saved: a red Publish button that opens "This starts billing for {Business}."', () => {
    render(<AdminOutreachRow row={row({ cardSaved: true })} />)
    const publish = screen.getByRole('button', { name: 'Publish' })
    expect(publish.classList.contains('bg-[#ba3d3d]')).toBe(true)
    fireEvent.click(publish)
    const confirm = screen.getByTestId('publish-confirm')
    expect(within(confirm).getByText("This starts billing for Gracia's Lawn Service.")).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: ADMIN_PUBLISH_BUTTON })).toBeDisabled()
    expect(within(confirm).getByRole('button', { name: ADMIN_CANCEL_BUTTON })).toBeInTheDocument()
    // One red button at a time: the row's Publish hides while confirming.
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('no Publish while publishing is in flight, once live, or without a claimer', () => {
    const { rerender } = render(<AdminOutreachRow row={row({ cardSaved: true, publishStatus: 'processing' })} />)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    rerender(<AdminOutreachRow row={row({ cardSaved: true, live: true, publishStatus: 'live' })} />)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    rerender(<AdminOutreachRow row={row({ cardSaved: true, claimerEmail: null })} />)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })
})

describe('admin outreach row: labels (Sable, Sep 27 12:35 AM)', () => {
  it('shows form labels instead of database keys, and the new stale note', () => {
    render(
      <AdminOutreachRow
        row={row({
          submissions: [
            {
              id: 'sub-1',
              source: 'preview',
              fields: { quote_email: 'quotes@example.com', service_area: 'San Marcos', hours: '8-5', phone: '512-555-0100' },
              services: [],
              photoCount: 0,
              photosMoved: 0,
              submittedAt: '2026-09-27T05:00:00Z',
              stale: true,
            },
          ],
        })}
      />
    )
    const sub = screen.getByTestId('pending-submission')
    for (const label of ['Quote-request email:', 'Service area:', 'Hours:', 'Phone:']) expect(within(sub).getByText(label)).toBeInTheDocument()
    expect(sub.textContent).not.toMatch(/quote_email|service_area/)
    expect(sub.textContent).toContain(ADMIN_STALE_NOTE)
    expect(sub.textContent).not.toContain('(cannot apply)')
  })

  it("cleanup link uses Sable's 1:02 AM wording and only shows while approved photos have a stored copy", () => {
    const { rerender } = render(<AdminOutreachRow row={row({ storedApprovedPhotoCount: 0 })} />)
    expect(screen.queryByTestId('delete-photos-link')).toBeNull()
    rerender(<AdminOutreachRow row={row({ storedApprovedPhotoCount: 2 })} />)
    expect(screen.getByRole('button', { name: 'Delete 2 approved photos from storage' })).toBeInTheDocument()
    rerender(<AdminOutreachRow row={row({ storedApprovedPhotoCount: 1 })} />)
    expect(screen.getByRole('button', { name: 'Delete 1 approved photo from storage' })).toBeInTheDocument()
  })

  it('cleanup asks first: Cancel deletes nothing, "Delete photos" deletes', async () => {
    calls.deletePhotos.length = 0
    render(<AdminOutreachRow row={row({ storedApprovedPhotoCount: 2, cardSaved: true })} />)
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 approved photos from storage' }))
    const confirm = screen.getByTestId('delete-photos-confirm')
    // One red button at a time: Publish hides while the cleanup confirmation is open.
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(confirm).toHaveTextContent("These photos are already on the site. This deletes Freeplug's stored copies and can't be undone.")
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('delete-photos-confirm')).toBeNull()
    expect(calls.deletePhotos).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 approved photos from storage' }))
    fireEvent.click(within(screen.getByTestId('delete-photos-confirm')).getByRole('button', { name: 'Delete photos' }))
    await waitFor(() => expect(calls.deletePhotos).toEqual(['site-1']))
    await waitFor(() => expect(screen.queryByTestId('delete-photos-confirm')).toBeNull())
  })
})

describe('admin outreach row: round 4 (Sable 1:18 AM)', () => {
  const sub = (over: Partial<AdminOutreachRowView['submissions'][number]> = {}): AdminOutreachRowView['submissions'][number] => ({
    id: 'sub-1',
    source: 'customer',
    fields: {},
    services: [],
    photoCount: 0,
    photosMoved: 0,
    submittedAt: '2026-09-27T06:00:00Z',
    stale: false,
    ...over,
  })

  it('services: "Remove: {name}" and "Add: {name}", never ~~name~~ (Vera r2 bug 8)', () => {
    render(
      <AdminOutreachRow
        row={row({
          submissions: [
            sub({
              services: [
                { name: 'Lawn mowing', keep: true, added: false },
                { name: 'Bush trimming', keep: false, added: false },
                { name: 'Gutter cleaning', keep: true, added: true },
              ],
            }),
          ],
        })}
      />
    )
    const line = screen.getByTestId('submission-services')
    expect(line).toHaveTextContent('Services: Lawn mowing, Remove: Bush trimming, Add: Gutter cleaning')
    expect(line.textContent).not.toContain('~~')
  })

  it('an old preview row whose photos were carried shows the note and keeps "View n photos"', () => {
    render(<AdminOutreachRow row={row({ submissions: [sub({ source: 'preview', stale: true, photoCount: 3, photosMoved: 2 })] })} />)
    expect(screen.getByTestId('photos-moved-note')).toHaveTextContent("These photos moved to the customer's confirmed details, so approve them there.")
    expect(screen.getByRole('button', { name: 'View 3 photos' })).toBeInTheDocument()
  })

  it('no note when nothing moved', () => {
    render(<AdminOutreachRow row={row({ submissions: [sub({ source: 'preview', photoCount: 3 })] })} />)
    expect(screen.queryByTestId('photos-moved-note')).toBeNull()
  })

  it('a phone stored in another format is shown as 512-555-0142', () => {
    render(<AdminOutreachRow row={row({ submissions: [sub({ fields: { phone: '(512) 555 0142' } })] })} />)
    expect(screen.getByTestId('pending-submission')).toHaveTextContent('Phone: 512-555-0142')
  })
})

describe('admin outreach row: Reject asks first when photos go with it (Sable 1:34 AM, Vera r3 NEW-1)', () => {
  const sub = (over: Partial<AdminOutreachRowView['submissions'][number]> = {}): AdminOutreachRowView['submissions'][number] => ({
    id: 'cust-1',
    source: 'customer',
    fields: { phone: '512-555-0142' },
    services: [],
    photoCount: 4,
    photosMoved: 0,
    submittedAt: '2026-09-27T06:00:00Z',
    stale: false,
    ...over,
  })

  it('shows the 1:34 AM text and buttons, hides Publish, and Cancel rejects nothing', async () => {
    calls.rejects.length = 0
    render(<AdminOutreachRow row={row({ cardSaved: true, submissions: [sub()] })} />)
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const box = screen.getByTestId('reject-confirm')
    expect(box).toHaveTextContent("Reject these details? This also rejects the 4 photos sent with them, and they can't be approved later.")
    const red = within(box).getByRole('button', { name: 'Reject details and photos' })
    expect(red.classList.contains('bg-[#ba3d3d]')).toBe(true)
    expect(within(box).getByRole('button', { name: 'Cancel' }).classList.contains('bg-[#ba3d3d]')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('reject-confirm')).toBeNull()
    expect(calls.rejects).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject details and photos' }))
    await waitFor(() => expect(calls.rejects).toEqual(['cust-1']))
  })

  it('one photo uses the singular line', () => {
    render(<AdminOutreachRow row={row({ submissions: [sub({ photoCount: 1 })] })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByTestId('reject-confirm')).toHaveTextContent(
      "Reject these details? This also rejects the 1 photo sent with them, and it can't be approved later."
    )
  })

  it('a row without photos (or whose photos all moved) rejects straight away', async () => {
    calls.rejects.length = 0
    render(<AdminOutreachRow row={row({ submissions: [sub({ id: 'p-1', source: 'preview', photoCount: 3, photosMoved: 3, stale: true })] })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.queryByTestId('reject-confirm')).toBeNull()
    await waitFor(() => expect(calls.rejects).toEqual(['p-1']))
  })

  it('long unbroken values wrap instead of widening the page', () => {
    render(<AdminOutreachRow row={row({ submissions: [sub({ fields: { hours: 'x'.repeat(60) } })] })} />)
    const dd = screen.getByText('x'.repeat(60))
    expect(dd.className).toContain('break-words')
    expect(dd.parentElement!.className).toContain('min-w-0')
    expect(dd.closest('dl')!.className).toContain('grid-cols-1')
  })
})

describe('admin outreach row: closed old preview rows (Sable 1:36 AM, Lina)', () => {
  it('each closed row is one grey line with the send time and the outcome line, no Apply/Reject, no badge', () => {
    render(
      <AdminOutreachRow
        row={row({
          closedPreview: [
            { id: 'a', submittedAt: '2026-09-27T05:40:00Z', outcome: 'applied' },
            { id: 'b', submittedAt: '2026-09-27T05:45:00Z', outcome: 'rejected' },
            { id: 'c', submittedAt: '2026-09-27T05:50:00Z', outcome: 'no_photos' },
          ],
        })}
      />
    )
    const lines = screen.getAllByTestId('closed-preview-row').map((l) => l.textContent)
    expect(lines[0]).toMatch(/^From the preview · Sep 27, 2026, 12:40 AM CT · These photos moved to the customer's confirmed details and were approved there\.$/)
    expect(lines[1]).toContain("These photos moved to the customer's confirmed details and were rejected with them.")
    expect(lines[2]).toContain("Replaced by the customer's confirmed details.")
    for (const l of screen.getAllByTestId('closed-preview-row')) expect(l.className).toContain('text-gray-500')
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
    expect(screen.queryByText('Details to review')).toBeNull()
  })
})
