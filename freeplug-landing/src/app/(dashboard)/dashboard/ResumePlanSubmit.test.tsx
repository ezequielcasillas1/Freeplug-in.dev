import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResumePlanSubmit } from './ResumePlanSubmit'

describe('ResumePlanSubmit (Vera B1: no double resume from one form)', () => {
  it('is disabled (and busy) while its form submits, so a double click sends one resume', async () => {
    let finish: () => void = () => undefined
    const action = vi.fn(() => new Promise<void>((r) => { finish = r }))
    render(
      <form action={action}>
        <ResumePlanSubmit>Resume plan</ResumePlanSubmit>
      </form>
    )
    const btn = screen.getByRole('button', { name: 'Resume plan' })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    expect(btn).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(action).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(btn).toBeEnabled())
  })
})
