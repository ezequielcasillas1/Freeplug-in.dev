import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpChat } from './HelpChat'
import { HELP_QUICK_QUESTIONS } from '@/lib/help/help-chat-content'
import { HELP_CHAT_INCLUDED_EDIT_NOTE, starterSmallEditAddonLine } from '@/lib/plans/ladder-copy'
import { EDITS_COPY_EN } from '@/lib/plans/edits-copy'

function setup(
  opts: {
    hasIncludedEdit?: boolean
    smallEditAddonNote?: string | null
    result?: { ok: true; email: string } | { ok: false; error: string }
  } = {}
) {
  const sendRequest = vi
    .fn()
    .mockResolvedValue(opts.result ?? { ok: true, email: 'owner@example.com' })
  render(
    <HelpChat
      email="owner@example.com"
      hasIncludedEdit={opts.hasIncludedEdit ?? false}
      smallEditAddonNote={opts.smallEditAddonNote ?? null}
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
    expect(screen.queryByText(HELP_CHAT_INCLUDED_EDIT_NOTE)).toBeNull()
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
    setup({ hasIncludedEdit: true })
    walkToReview()
    expect(screen.getByText(HELP_CHAT_INCLUDED_EDIT_NOTE)).toBeInTheDocument()
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
    // The error is set inside the send transition: under load the alert can render a tick before the
    // button leaves "Sending…" (seen in Arkitect verify runs), so wait for the button, don't race it.
    expect(await screen.findByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  describe('small-edit answer (Oct 18: edit pack replaces the +1 small edit add-on)', () => {
    const LINE = EDITS_COPY_EN.helpSmallEditAnswer
    it('the new answer, with its "Go to Plans" link right after it', () => {
      setup({ smallEditAddonNote: LINE })
      walkToReview()
      const note = screen.getByTestId('small-edit-addon-note')
      const link = screen.getByRole('link', { name: 'Go to Plans' })
      expect(link).toHaveAttribute('href', '/dashboard/plans')
      expect(note).toContainElement(link)
      expect(note).toHaveTextContent(`${LINE} Go to Plans`)
      expect(note).not.toHaveTextContent('+1 small edit')
    })
    it('the Starter line is the edit pack line now', () => {
      expect(starterSmallEditAddonLine()).toBe('Need more edits this month? Add the $5 edit pack for 3 more.')
    })
    it('the edit field shows the hint, the examples and the maintenance note with its link', () => {
      setup()
      fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
      fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
      fireEvent.change(screen.getByLabelText('Which page is it on?'), { target: { value: 'Home' } })
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByTestId('edit-field-hint')).toHaveTextContent("Edits are small updates to what's already on your site.")
      expect(screen.getByTestId('edit-field-examples')).toHaveTextContent('For example: Update your hours · Swap a photo · Change a price')
      expect(screen.getByTestId('edit-field-note')).toHaveTextContent(EDITS_COPY_EN.fieldNote)
      expect(screen.getByTestId('edit-field-maintenance-link')).toHaveAttribute('href', '/dashboard/request-website?focus=maintenance')
    })
    it('a plan with the included edit shows that note instead', () => {
      setup({ hasIncludedEdit: true, smallEditAddonNote: LINE })
      walkToReview()
      expect(screen.queryByTestId('small-edit-addon-note')).toBeNull()
    })
    it('no line without the prop (other plans)', () => {
      setup()
      walkToReview()
      expect(screen.queryByTestId('small-edit-addon-note')).toBeNull()
    })
  })
})
