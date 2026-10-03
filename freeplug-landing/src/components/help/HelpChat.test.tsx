import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpChat } from './HelpChat'
import { HELP_QUICK_QUESTIONS } from '@/lib/help/help-chat-content'

function setup(
  opts: {
    hasMonthlyEdit?: boolean
    result?: { ok: true; email: string } | { ok: false; error: string }
  } = {}
) {
  const sendRequest = vi
    .fn()
    .mockResolvedValue(opts.result ?? { ok: true, email: 'owner@example.com' })
  render(
    <HelpChat
      email="owner@example.com"
      hasMonthlyEdit={opts.hasMonthlyEdit ?? false}
      sendRequest={sendRequest}
    />
  )
  return { sendRequest }
}

function walkToReview() {
  fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
  fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
  fireEvent.change(screen.getByLabelText('Which page is it on?'), { target: { value: 'Home' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.change(screen.getByLabelText('Describe the change.'), {
    target: { value: 'Swap the hero photo' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' })) // photo is optional
}

describe('HelpChat', () => {
  it('shows the greeting, the not-found line and the locked answer for a quick question', () => {
    setup()
    expect(
      screen.getByText('Hi! Pick a question below, or tell us about a change you need.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'support@freeplug-in.dev' })).toHaveAttribute(
      'href',
      'mailto:support@freeplug-in.dev'
    )
    const q = HELP_QUICK_QUESTIONS[3]
    fireEvent.click(screen.getByRole('button', { name: q.question }))
    expect(screen.getByText(q.answer)).toBeInTheDocument()
  })

  it('walks the 4 steps, reviews, sends and shows the sent message', async () => {
    const { sendRequest } = setup()
    walkToReview()
    expect(
      screen.getByText(
        "Here's your request. We'll review it and tell you the price before any paid work starts."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Your plan includes one small edit each month.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(
        screen.getByText(
          "Got it. We'll email you at owner@example.com after we review your request."
        )
      ).toBeInTheDocument()
    )
    expect(sendRequest).toHaveBeenCalledWith({
      changeType: 'Photos',
      page: 'Home',
      description: 'Swap the hero photo',
      photoName: undefined,
    })
  })

  it('shows the Plus/Pro note only with that add-on, and Edit goes back to step 1', () => {
    setup({ hasMonthlyEdit: true })
    walkToReview()
    expect(screen.getByText('Your plan includes one small edit each month.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('What would you like changed?')).toBeInTheDocument()
  })

  it('shows a server error and stays on review', async () => {
    setup({ result: { ok: false, error: 'Something went wrong.' } })
    walkToReview()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
    )
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })
})
