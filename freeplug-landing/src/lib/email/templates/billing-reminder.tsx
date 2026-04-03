import { Text, Button, Section, Row, Column } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
  planName: string
  amount: string
  billingDate: string
  daysUntilBilling: number
}

export function BillingReminderEmail({
  userName,
  planName,
  amount,
  billingDate,
  daysUntilBilling,
}: Props) {
  return (
    <BaseEmailLayout
      preview={`Upcoming billing reminder - ${amount} on ${billingDate}`}
    >
      <Text style={heading}>Upcoming Billing Reminder</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        This is a friendly reminder that your next billing is coming up in {daysUntilBilling}{' '}
        {daysUntilBilling === 1 ? 'day' : 'days'}.
      </Text>

      <Section style={detailsBox}>
        <Row>
          <Column style={detailLabel}>Plan</Column>
          <Column style={detailValue}>{planName}</Column>
        </Row>
        <Row>
          <Column style={detailLabel}>Amount</Column>
          <Column style={detailValue}>{amount}</Column>
        </Row>
        <Row>
          <Column style={detailLabel}>Billing date</Column>
          <Column style={detailValue}>{billingDate}</Column>
        </Row>
      </Section>

      <Text style={paragraph}>
        Make sure your payment method is up to date to avoid any interruption to your service.
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href="https://freeplug.dev/dashboard">
          View Dashboard
        </Button>
        <Text style={secondaryLink}>
          or{' '}
          <a href="https://freeplug.dev/dashboard/cancel" style={link}>
            manage your subscription
          </a>
        </Text>
      </Section>

      <Text style={footerNote}>
        If you have questions about your billing, please contact our support team.
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

const detailsBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const detailLabel = {
  color: '#64748b',
  fontSize: '14px',
  padding: '8px 0',
  width: '40%',
}

const detailValue = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500' as const,
  padding: '8px 0',
  textAlign: 'right' as const,
}

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
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

const secondaryLink = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '12px',
  display: 'block',
}

const link = {
  color: '#ba3d3d',
  textDecoration: 'underline',
}

const footerNote = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: '24px 0 0',
}

export default BillingReminderEmail
