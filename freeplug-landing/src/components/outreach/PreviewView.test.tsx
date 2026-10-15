import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ADD_DETAILS_LABEL,
  CALL_ARIA,
  CLAIM_LABEL,
  DETAILS_INTRO,
  DETAILS_SUCCESS,
  EMAIL_ARIA,
  NOT_NOW_LABEL,
  REQUEST_CHANGE_LABEL,
  SEND_DETAILS_LABEL,
  TEXT_ARIA,
} from '@/lib/outreach/copy'
import { claimIsOutline, PreviewView } from './PreviewView'

vi.mock('@/components/turnstile/Turnstile', () => ({ Turnstile: () => null }))
vi.mock('./ScreenshotPicture', () => ({ ScreenshotPicture: () => null }))
vi.mock('@/lib/outreach/client-image', async (orig) => ({
  ...(await orig<typeof import('@/lib/outreach/client-image')>()),
  preparePhoto: async () => new Blob(['jpeg-bytes'], { type: 'image/jpeg' }),
}))
// Server actions: plain stand-ins.
vi.mock('@/app/preview/actions', () => ({
  sendPreviewDetailsAction: async () => ({ ok: true, submissionId: 'sub-1' }),
  uploadPreviewPhotoAction: async () => ({ ok: true, photoId: 'photo-1' }),
  sendPreviewChangeAction: async () => ({ ok: true }),
  declinePreviewAction: async () => ({ ok: true, message: 'Got it. Your preview stays up until Oct 26.' }),
}))

beforeAll(() => {
  URL.createObjectURL = () => 'blob:local'
  URL.revokeObjectURL = () => {}
})

const RED = 'bg-[#ba3d3d]'

function isShown(el: Element) {
  for (let n: Element | null = el; n; n = n.parentElement) if (n.classList.contains('hidden')) return false
  return true
}
/** Red (filled) buttons and button-links the visitor can see right now. */
function redButtons() {
  return [...document.querySelectorAll('a, button')].filter((el) => el.classList.contains(RED) && isShown(el))
}
const claim = () => screen.getByTestId('claim-button')

function renderPreview() {
  render(
    <PreviewView
      businessName="Gracia's Lawn Service"
      declinedMessage={null}
      prefill={{}}
      services={[{ name: 'Lawn mowing', source: 'On your new website' }]}
      screenshots={{ desktop: null, mobile: null }}
      photosUsed={0}
    />
  )
}

describe('preview banner: exactly one red button (Lina, Sep 27)', () => {
  it('details form open: Claim is outline and "Send my details" is the only red button; after sending Claim is red again', async () => {
    renderPreview()
    expect(redButtons()).toEqual([claim()])
    fireEvent.click(screen.getByRole('button', { name: ADD_DETAILS_LABEL }))
    expect(claim()).toHaveAttribute('data-emphasis', 'outline')
    expect(redButtons().map((b) => b.textContent)).toEqual([SEND_DETAILS_LABEL])

    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await waitFor(() => expect(screen.getByTestId('details-thanks')).toBeInTheDocument())
    expect(claim()).toHaveAttribute('data-emphasis', 'red')
    expect(redButtons()).toEqual([claim()])
    expect(claim()).toHaveTextContent(CLAIM_LABEL)
  })

  it('change-request panel follows the same rule, and "Not right now" keeps Claim red (never zero red buttons)', async () => {
    renderPreview()
    fireEvent.click(screen.getAllByRole('button', { name: REQUEST_CHANGE_LABEL })[0])
    expect(redButtons()).toHaveLength(1)
    expect(redButtons()[0]).not.toBe(claim())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Use our truck photo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(redButtons()).toEqual([claim()]))

    fireEvent.click(screen.getAllByRole('button', { name: NOT_NOW_LABEL })[0])
    await waitFor(() => expect(screen.getByTestId('banner-body')).toHaveTextContent('Your preview stays up'))
    expect(redButtons()).toEqual([claim()])
  })

  it('the sticky phone Claim bar uses the same rule', () => {
    const none = { details: false, change: false }
    expect(claimIsOutline(null, none)).toBe(false)
    expect(claimIsOutline('details', none)).toBe(true)
    expect(claimIsOutline('change', none)).toBe(true)
    expect(claimIsOutline('details', { details: true, change: false })).toBe(false)
    expect(claimIsOutline('change', { details: false, change: true })).toBe(false)
  })
})

describe('after "Send my details" (Lina, Sep 27)', () => {
  it('the thank-you line with a green check replaces the intro, and the sent photos stay below it', async () => {
    renderPreview()
    fireEvent.click(screen.getByRole('button', { name: ADD_DETAILS_LABEL }))
    const panel = screen.getByTestId('details-panel')
    expect(within(panel).getByText(DETAILS_INTRO)).toBeInTheDocument()
    const input = panel.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'truck.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(within(panel).getAllByRole('listitem').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    const thanks = await within(panel).findByTestId('details-thanks')
    expect(thanks).toHaveTextContent(DETAILS_SUCCESS)
    expect(within(thanks).getByTestId('details-thanks-check').getAttribute('class')).toContain('text-green-600')
    expect(within(panel).queryByText(DETAILS_INTRO)).toBeNull()
    // Only one thank-you line (the form's own line is off in the preview).
    expect(within(panel).getAllByText(DETAILS_SUCCESS)).toHaveLength(1)
    const box = within(panel).getByTestId('photo-box')
    expect(thanks.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(within(box).getByRole('img', { name: 'Photo 1 uploaded' })).toBeInTheDocument())
  })

  it('closing and reopening the panel keeps the sent state', async () => {
    renderPreview()
    const open = () => fireEvent.click(screen.getByRole('button', { name: ADD_DETAILS_LABEL }))
    open()
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await screen.findByTestId('details-thanks')
    open()
    expect(screen.getByTestId('details-panel')).toHaveClass('hidden')
    open()
    expect(screen.getByTestId('details-panel')).not.toHaveClass('hidden')
    expect(screen.getByTestId('details-thanks')).toBeInTheDocument()
    expect(redButtons()).toEqual([claim()])
  })
})

describe('phone contact buttons (Lina, Sep 27)', () => {
  it('Call / Text / Email are bordered and not red', () => {
    renderPreview()
    for (const name of [CALL_ARIA, TEXT_ARIA]) {
      const a = screen.getByRole('link', { name })
      expect(a.className).toContain('border')
      expect(a.className).not.toMatch(/#ba3d3d/)
    }
    const phoneEmail = within(screen.getByTestId('phone-links')).getByRole('link', { name: EMAIL_ARIA })
    expect(phoneEmail.className).toContain('border')
    expect(phoneEmail.className).not.toMatch(/#ba3d3d/)
  })
})
