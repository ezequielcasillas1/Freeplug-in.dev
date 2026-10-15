import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { ConfirmEmailBox } from './ConfirmEmailBox'

const LINE = 'First, confirm your email. Open the email we sent to gracia@example.com and tap the link inside.'
const LIMITED = 'Please wait a few minutes and try again.'
const GENERIC = 'Something went wrong. Please try again. If it keeps happening, email support@freeplug-in.dev.'

const reply = (status: number, outcome: string) => new Response(JSON.stringify({ outcome }), { status, headers: { 'content-type': 'application/json' } })

describe('confirm-email box (round 7, Sable 2:08/2:10 AM)', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    refresh.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const tap = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send it again' }))
    })
  }

  it('light amber box with the line naming the given email and a "Send it again" text link', () => {
    render(<ConfirmEmailBox email="gracia@example.com" />)
    const box = screen.getByTestId('confirm-email-box')
    expect(box.className).toMatch(/bg-amber-50/)
    expect(box).toHaveTextContent(LINE)
    const link = screen.getByTestId('resend-link')
    expect(link).toHaveTextContent('Send it again')
    // A text link to look at: underlined, no fill or border.
    expect(link.className).toMatch(/\bunderline\b/)
    expect(link.className).not.toMatch(/\bbg-|\bborder\b/)
  })

  it('tap -> POST /claim/resend with no body (no email from the page) -> "Sent. Check your inbox." replaces the link', async () => {
    fetchMock.mockResolvedValue(reply(200, 'sent'))
    render(<ConfirmEmailBox email="gracia@example.com" />)
    await tap()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/claim/resend')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(await screen.findByTestId('resend-sent')).toHaveTextContent('Sent. Check your inbox.')
    expect(screen.queryByTestId('resend-link')).toBeNull()
  })

  it('"Send it again" keeps a text-link look but has a tap area at least 44px tall, with room in the box (Lina, round 8)', () => {
    render(<ConfirmEmailBox email="gracia@example.com" />)
    const link = screen.getByTestId('resend-link')
    expect(link.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/)
    expect(link.className).toMatch(/(^|\s)inline-flex(\s|$)/)
    // Space between the email line and the link, and the box pads around the tap area.
    expect(link.parentElement!.className).toMatch(/(^|\s)mt-2(\s|$)/)
    expect(screen.getByTestId('confirm-email-box').className).toMatch(/(^|\s)p-4(\s|$)/)
  })

  it('rate limited (every limited case answers "limited") -> Sable 2:22 line in place of the link', async () => {
    fetchMock.mockResolvedValue(reply(429, 'limited'))
    render(<ConfirmEmailBox email="gracia@example.com" />)
    await tap()
    expect(await screen.findByTestId('resend-limited')).toHaveTextContent(LIMITED)
    expect(screen.queryByTestId('resend-link')).toBeNull()
  })

  it('any other failure (502, bad reply, network error) -> the generic error, link kept to try again', async () => {
    for (const r of [() => Promise.resolve(reply(502, 'error')), () => Promise.resolve(new Response('<html>', { status: 500 })), () => Promise.reject(new TypeError('offline'))]) {
      fetchMock.mockReset()
      fetchMock.mockImplementation(r)
      const { unmount } = render(<ConfirmEmailBox email="gracia@example.com" />)
      await tap()
      expect(await screen.findByTestId('resend-error')).toHaveTextContent(GENERIC)
      expect(screen.getByTestId('resend-link')).toBeInTheDocument()
      unmount()
    }
  })

  it('already confirmed -> nothing shown as sent, the page refreshes and moves on', async () => {
    fetchMock.mockResolvedValue(reply(200, 'confirmed'))
    render(<ConfirmEmailBox email="gracia@example.com" />)
    await tap()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('resend-sent')).toBeNull()
  })

  it('signed out (401) -> the generic error, never "Sent"', async () => {
    fetchMock.mockResolvedValue(reply(401, 'signed_out'))
    render(<ConfirmEmailBox email="gracia@example.com" />)
    await tap()
    expect(await screen.findByTestId('resend-error')).toBeInTheDocument()
    expect(screen.queryByTestId('resend-sent')).toBeNull()
  })
})
