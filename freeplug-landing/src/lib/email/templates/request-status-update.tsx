import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
  businessName: string
  newStatus: 'submitted' | 'in_review' | 'closed'
  message?: string
}

const statusConfig = {
  submitted: {
    title: 'Request Submitted',
    description: 'We have received your website request and will begin reviewing it shortly.',
    color: '#3b82f6',
  },
  in_review: {
    title: 'Request In Review',
    description:
      'Great news! Our team is now actively reviewing your website request. We will reach out soon with next steps.',
    color: '#f59e0b',
  },
  closed: {
    title: 'Request Closed',
    description:
      'Your website request has been closed. This may mean we have completed our review, moved to a different workflow, or need additional information.',
    color: '#6b7280',
  },
}

export function RequestStatusUpdateEmail({ userName, businessName, newStatus, message }: Props) {
  const config = statusConfig[newStatus]

  return (
    <BaseEmailLayout preview={`${config.title} - ${businessName}`}>
      <Text style={heading}>{config.title}</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        Your website request for <strong>{businessName}</strong> has been updated.
      </Text>

      <Section style={{ ...statusBox, borderLeftColor: config.color }}>
        <Text style={statusLabel}>Current Status</Text>
        <Text style={{ ...statusValue, color: config.color }}>
          {newStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Text>
        <Text style={statusDescription}>{config.description}</Text>
      </Section>

      {message && (
        <Section style={messageBox}>
          <Text style={messageLabel}>Message from our team:</Text>
          <Text style={messageText}>{message}</Text>
        </Section>
      )}

      <Section style={buttonContainer}>
        <Button style={button} href="https://freeplug.dev/dashboard">
          View Dashboard
        </Button>
      </Section>

      <Text style={footerNote}>
        If you have questions, reply to this email or contact our support team.
      </Text>
    </BaseEmailLayout>
  )
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600' as const,
  lineHeight: '32px',
  margin: '0 0 24px',
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const statusBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  borderLeft: '4px solid',
}

const statusLabel = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: '500' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 4px',
}

const statusValue = {
  fontSize: '18px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
}

const statusDescription = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
}

const messageBox = {
  backgroundColor: '#fffbeb',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const messageLabel = {
  color: '#92400e',
  fontSize: '13px',
  fontWeight: '500' as const,
  margin: '0 0 8px',
}

const messageText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
}

const buttonContainer = {
  margin: '32px 0',
}

const button = {
  backgroundColor: '#ba3d3d',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

const footerNote = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: '24px 0 0',
}

export default RequestStatusUpdateEmail
