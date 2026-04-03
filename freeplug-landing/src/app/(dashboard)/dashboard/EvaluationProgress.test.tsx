import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvaluationProgress } from './EvaluationProgress'

vi.mock('next/link', () => ({
  default ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  },
}))

vi.mock('./billing-actions', () => ({
  openBillingPortal: vi.fn(async () => {}),
}))

vi.mock('./AcknowledgeTransferButton', () => ({
  AcknowledgeTransferButton: () => (
    <button type="button">I&apos;ve reviewed this handoff</button>
  ),
}))

const baseProps = {
  status: 'in_review' as const,
  progress: 50,
  targetCents: 100_00,
  paidCents: 100_00,
  milestoneReached: true,
  stripeCustomerId: null,
  intakeClosed: undefined,
  websiteTransferNotes: null,
  websiteTransferAcknowledgedAt: null,
}

describe('EvaluationProgress — website value milestone and transfer handoff', () => {
  it('shows the website value reached message when milestoneReached is true', () => {
    render(
      <EvaluationProgress
        {...baseProps}
        milestoneReached
        paidCents={100_00}
        targetCents={100_00}
      />
    )
    expect(screen.getByText('Website value reached')).toBeInTheDocument()
  })

  it('does not show the milestone banner when milestoneReached is false', () => {
    render(
      <EvaluationProgress
        {...baseProps}
        milestoneReached={false}
        paidCents={50_00}
        targetCents={100_00}
      />
    )
    expect(screen.queryByText('Website value reached')).not.toBeInTheDocument()
  })

  it('shows Website keys & transfer and posts handoff text when milestone met and notes exist', () => {
    const handoff = 'DNS: example.com → CNAME target\nRepo: git@github.com/org/site.git'
    render(
      <EvaluationProgress
        {...baseProps}
        milestoneReached
        websiteTransferNotes={handoff}
      />
    )
    expect(screen.getByText('Website keys & transfer')).toBeInTheDocument()
    expect(screen.getByText(/CNAME target/)).toBeInTheDocument()
  })

  it('hides handoff block when milestone met but notes are empty or whitespace', () => {
    const { rerender } = render(
      <EvaluationProgress
        {...baseProps}
        milestoneReached
        websiteTransferNotes="   "
      />
    )
    expect(screen.queryByText('Website keys & transfer')).not.toBeInTheDocument()

    rerender(
      <EvaluationProgress {...baseProps} milestoneReached websiteTransferNotes="" />
    )
    expect(screen.queryByText('Website keys & transfer')).not.toBeInTheDocument()
  })

  it('shows milestone and handoff on closed-intake layout when both apply', () => {
    render(
      <EvaluationProgress
        {...baseProps}
        intakeClosed={{ businessName: 'Acme' }}
        milestoneReached
        websiteTransferNotes="SSH key: ssh-ed25519 AAAA…"
      />
    )
    expect(screen.getByText('Request closed')).toBeInTheDocument()
    expect(screen.getByText('Website value reached')).toBeInTheDocument()
    expect(screen.getByText('Website keys & transfer')).toBeInTheDocument()
    expect(screen.getByText(/SSH key: ssh-ed25519/)).toBeInTheDocument()
  })
})
