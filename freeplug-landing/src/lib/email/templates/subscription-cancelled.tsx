import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
  planName: string
  endDate: string
  totalPaidToDate?: string
}

export function SubscriptionCancelledEmail({
  userName,
  planName,
  endDate,
  totalPaidToDate,
}: Props) {
  return (
    <BaseEmailLayout preview={`Your ${planName} subscription has been cancelled`}>
      <Text style={heading}>Subscription Cancelled</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        We are sorry to see you go. Your <strong>{planName}</strong> subscription has been
        cancelled.
      </Text>

      <Section style={infoBox}>
        <Text style={infoText}>
          Your access continues until <strong>{endDate}</strong>. After this date, your website
          will no longer be hosted on our platform.
        </Text>
      </Section>

      {totalPaidToDate && (
        <Section style={progressBox}>
          <Text style={progressTitle}>Your Account History</Text>
          <Text style={progressText}>Total paid to date: {totalPaidToDate}</Text>
          <Text style={progressNote}>
            This amount is credited toward your website value. If you return, your progress is
            preserved.
          </Text>
        </Section>
      )}

      <Text style={subheading}>What happens next?</Text>
      <Section style={list}>
        <Text style={listItem}>
          • Your website will go offline after {endDate}
        </Text>
        <Text style={listItem}>
          • Search engine rankings may be affected if your site is down
        </Text>
        <Text style={listItem}>
          • You can resume your plan anytime from your dashboard
        </Text>
      </Section>

      <Section style={ctaBox}>
        <Text style={ctaTitle}>Changed your mind?</Text>
        <Text style={ctaText}>
          You can reactivate your subscription before {endDate} to keep your website running
          without interruption.
        </Text>
        <Button style={button} href="https://freeplug.dev/dashboard/plans">
          Resume Your Plan
        </Button>
      </Section>

      <Text style={footerNote}>
        If you cancelled by mistake or have questions, please contact our support team.
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

const subheading = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600' as const,
  margin: '24px 0 12px',
}

const infoBox = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
  borderLeft: '4px solid #ef4444',
}

const infoText = {
  color: '#991b1b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
}

const progressBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const progressTitle = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
}

const progressText = {
  color: '#525f7f',
  fontSize: '14px',
  margin: '0 0 4px',
}

const progressNote = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: '8px 0 0',
}

const list = {
  margin: '0 0 24px',
}

const listItem = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 4px',
}

const ctaBox = {
  backgroundColor: '#ecfdf5',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const ctaTitle = {
  color: '#065f46',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
}

const ctaText = {
  color: '#047857',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 16px',
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

export default SubscriptionCancelledEmail
