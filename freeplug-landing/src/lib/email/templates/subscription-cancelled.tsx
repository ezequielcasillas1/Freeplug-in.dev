import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { emailBaseUrl } from '@/lib/site'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
  /** Not shown in the current copy; kept so existing callers still type-check. */
  planName?: string
  endDate: string
  totalPaidToDate?: string
  baseUrl?: string
}

/** Copy from Sable (Sep 25, 2026). {endDate} comes from formatBillingDate. */
export const SUBSCRIPTION_CANCELLED_SUBJECT = 'Your Freeplug hosting is canceled'

export function SubscriptionCancelledEmail({
  userName,
  endDate,
  totalPaidToDate,
  baseUrl,
}: Props) {
  const base = emailBaseUrl(baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={SUBSCRIPTION_CANCELLED_SUBJECT}>
      <Text style={heading}>{SUBSCRIPTION_CANCELLED_SUBJECT}</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>Your hosting plan is canceled.</Text>

      <Section style={infoBox}>
        <Text style={infoText}>
          Your website stays online until <strong>{endDate}</strong>, then goes offline.
        </Text>
      </Section>

      {totalPaidToDate && (
        <Section style={progressBox}>
          <Text style={progressTitle}>Your Account History</Text>
          <Text style={progressText}>Total paid to date: {totalPaidToDate}</Text>
        </Section>
      )}

      <Section style={ctaBox}>
        <Text style={ctaTitle}>Changed your mind?</Text>
        <Text style={ctaText}>
          Until {endDate}, you can resume your plan from your dashboard. After that, choose Restart
          hosting in your dashboard and we&apos;ll bring your website back.
        </Text>
        <Button style={button} href={`${base}/dashboard`}>
          Go to your dashboard
        </Button>
      </Section>
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


export default SubscriptionCancelledEmail
