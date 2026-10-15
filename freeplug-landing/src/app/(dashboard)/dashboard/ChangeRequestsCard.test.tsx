import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChangeRequestsCard } from './ChangeRequestsCard'
import {
  CHANGE_REQUEST_COPY_KEYS,
  CHANGE_REQUEST_DECLINED_NO_NOTE,
  CHANGE_REQUEST_STATUS_APPROVED,
  CHANGE_REQUEST_STATUS_DECLINED,
  CHANGE_REQUEST_STATUS_PENDING,
  CHANGE_REQUESTS_EMPTY,
  CHANGE_REQUESTS_HEADING,
  changeRequestDeclinedNote,
} from '@/lib/change-requests/copy'

const base = { change_type: 'Photos', page: 'Home', description: 'Swap the hero photo', decided_at: null, created_at: '2026-10-04T20:05:00.000Z' }

describe("change-request copy (Sable's final words, Oct 4 3:14 PM CT)", () => {
  it('is word for word', () => {
    expect(CHANGE_REQUESTS_HEADING).toBe('Your change requests')
    expect(CHANGE_REQUESTS_EMPTY).toBe("You haven't sent any change requests yet.")
    expect(CHANGE_REQUEST_STATUS_PENDING).toBe("Received, we're working on it")
    expect(CHANGE_REQUEST_STATUS_APPROVED).toBe('Approved')
    expect(CHANGE_REQUEST_STATUS_DECLINED).toBe('Not approved')
    expect(changeRequestDeclinedNote('We can only change the hours.')).toBe('Our note: We can only change the hours.')
    expect(CHANGE_REQUEST_DECLINED_NO_NOTE).toBe('Questions? Email support@freeplug-in.dev.')
  })
  it('each string has its own key', () => {
    const keys = Object.values(CHANGE_REQUEST_COPY_KEYS)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(9)
  })
  it('never says "Waiting for approval" and "Approved" never implies when it goes live', () => {
    const all = [CHANGE_REQUESTS_HEADING, CHANGE_REQUESTS_EMPTY, CHANGE_REQUEST_STATUS_PENDING, CHANGE_REQUEST_STATUS_APPROVED, CHANGE_REQUEST_STATUS_DECLINED, CHANGE_REQUEST_DECLINED_NO_NOTE].join(' ')
    expect(all).not.toMatch(/waiting for approval/i)
    expect(CHANGE_REQUEST_STATUS_APPROVED).not.toMatch(/live|today|soon|now|hour|day|will|publish|launch/i)
  })
})

describe('ChangeRequestsCard', () => {
  it('empty list', () => {
    render(<ChangeRequestsCard requests={[]} />)
    expect(screen.getByRole('heading', { name: 'Your change requests' })).toBeInTheDocument()
    expect(screen.getByTestId('change-requests-empty')).toHaveTextContent("You haven't sent any change requests yet.")
  })

  it('one line per request with its status; declined shows the note, or the support line without one', () => {
    render(
      <ChangeRequestsCard
        requests={[
          { ...base, id: 'a', status: 'pending_review', decision_note: null },
          { ...base, id: 'b', status: 'approved', decision_note: 'internal approve note' },
          { ...base, id: 'c', status: 'declined', decision_note: '  That page is not on your site yet.  ' },
          { ...base, id: 'd', status: 'declined', decision_note: null },
        ]}
      />
    )
    const items = screen.getAllByTestId('change-request-item')
    expect(items.map((i) => within(i).getByTestId('change-request-status').textContent)).toEqual([
      "Received, we're working on it",
      'Approved',
      'Not approved',
      'Not approved',
    ])
    expect(within(items[0]).queryByTestId('change-request-detail')).toBeNull()
    // An approve note is never shown to the customer.
    expect(within(items[1]).queryByTestId('change-request-detail')).toBeNull()
    expect(items[1]).not.toHaveTextContent('internal approve note')
    expect(within(items[2]).getByTestId('change-request-detail')).toHaveTextContent('Our note: That page is not on your site yet.')
    expect(within(items[3]).getByTestId('change-request-detail')).toHaveTextContent('Questions? Email support@freeplug-in.dev.')
    expect(items[0]).toHaveTextContent('Photos · Home')
    expect(items[0]).toHaveTextContent('Oct 4, 2026')
    expect(document.body).not.toHaveTextContent(/waiting for approval/i)
  })
})
