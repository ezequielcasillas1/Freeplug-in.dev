import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpChat } from './HelpChat'
import { HELP_QUICK_QUESTIONS } from '@/lib/help/help-chat-content'
import { HELP_CHAT_INCLUDED_EDIT_NOTE, starterSmallEditAddonLine } from '@/lib/plans/ladder-copy'

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
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  describe('Starter without +1 small edit (Sable, Oct 4 8:31 AM)', () => {
    const LINE = "Small edits are $5 with the +1 small edit add-on. Turn it on and we'll take care of it this month. You can turn it off anytime."
    const AI = 'Or make the change yourself with the AI builder, at no extra cost.'
    it('showAiEditQuota false (today): the add-on line only, no AI-builder sentence', () => {
      setup({ smallEditAddonNote: starterSmallEditAddonLine(false) })
      walkToReview()
      expect(screen.getByTestId('small-edit-addon-note')).toHaveTextContent(LINE)
      expect(screen.getByTestId('small-edit-addon-note')).not.toHaveTextContent(AI)
    })
    it('showAiEditQuota true: the AI-builder sentence follows', () => {
      setup({ smallEditAddonNote: starterSmallEditAddonLine(true) })
      walkToReview()
      expect(screen.getByTestId('small-edit-addon-note')).toHaveTextContent(`${LINE} ${AI}`)
    })
    it('Sable 9:05: a "Go to Plans" link right after the line, to the Plans page', () => {
      setup({ smallEditAddonNote: starterSmallEditAddonLine(false) })
      walkToReview()
      const note = screen.getByTestId('small-edit-addon-note')
      const link = screen.getByRole('link', { name: 'Go to Plans' })
      expect(link).toHaveAttribute('href', '/dashboard/plans')
      expect(note).toContainElement(link)
      expect(note).toHaveTextContent(`${LINE} Go to Plans`)
    })
    it('the default follows the flag in ladder.ts (false on a5806f0)', () => {
      expect(starterSmallEditAddonLine()).toBe(LINE)
    })
    it('a plan with the included edit shows that note instead', () => {
      setup({ hasIncludedEdit: true, smallEditAddonNote: starterSmallEditAddonLine(false) })
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
