import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TRACKER_LIVE_WAITING } from '@/lib/outreach/copy'
import { outreachTracker } from '@/lib/outreach/tracker'
import { YourWebsiteCard } from './YourWebsiteCard'

const RED = /#ba3d3d/

describe('"Your website" tracker (Lina/Sable, Sep 27 1:04 AM)', () => {
  it('card saved, not live: steps not reached use a grey outline circle (no red), and the waiting line sits under Live', () => {
    const steps = outreachTracker({ claimed: true, detailsConfirmed: true, hostingSetUp: true, live: false })
    const { container } = render(<YourWebsiteCard steps={steps} liveUrl={null} showPreview liveNote={TRACKER_LIVE_WAITING} />)
    const card = screen.getByTestId('your-website-card')
    const items = [...card.querySelectorAll('ol > li')]
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'done', 'current'])
    const live = items[4]
    const circle = live.querySelector('[data-testid="step-open-circle"]')!
    expect(circle.className).toMatch(/border-2/)
    expect(circle.className).toMatch(/border-zinc-300/)
    // No red dot anywhere in the tracker list.
    expect([...card.querySelectorAll('ol *')].some((el) => RED.test(el.getAttribute('class') ?? ''))).toBe(false)
    const note = screen.getByTestId('live-waiting-note')
    expect(note).toHaveTextContent('Waiting for us to publish your site.')
    expect(note.className).toMatch(/text-gray-500/)
    expect(note.className).toMatch(/text-xs/)
    expect(live.contains(note)).toBe(true)
    expect(container.textContent).not.toMatch(/\bby\b|\bdays?\b|hours?/i) // no timing promise
  })

  it('earlier steps not reached also use the grey outline circle', () => {
    const steps = outreachTracker({ claimed: true, detailsConfirmed: false, hostingSetUp: false, live: false })
    render(<YourWebsiteCard steps={steps} liveUrl={null} showPreview={false} liveNote={TRACKER_LIVE_WAITING} />)
    const items = [...screen.getByTestId('your-website-card').querySelectorAll('ol > li')]
    for (const li of items.slice(2)) expect(li.querySelector('[data-testid="step-open-circle"]')).not.toBeNull()
    expect(items[2].querySelector('[aria-current="step"]')).not.toBeNull()
  })

  it('live: the waiting line is gone and every step is checked', () => {
    const steps = outreachTracker({ claimed: true, detailsConfirmed: true, hostingSetUp: true, live: true })
    // The dashboard passes no note once live; the card also hides it for a done Live step.
    const { rerender } = render(<YourWebsiteCard steps={steps} liveUrl="https://gracia.example" showPreview={false} liveNote={null} />)
    expect(screen.queryByTestId('live-waiting-note')).toBeNull()
    rerender(<YourWebsiteCard steps={steps} liveUrl="https://gracia.example" showPreview={false} liveNote={TRACKER_LIVE_WAITING} />)
    expect(screen.queryByTestId('live-waiting-note')).toBeNull()
    expect(screen.queryByTestId('step-open-circle')).toBeNull()
  })
})
