import { Text, Button, Section, Row, Column } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
  amount: string
  planName: string
  invoiceNumber?: string
  paymentDate: string
  nextBillingDate?: string
  totalPaidToDate?: string
  websiteValueProgress?: string
}

export function PaymentReceivedEmail({
  userName,
  amount,
  planName,
  invoiceNumber,
  paymentDate,
  nextBillingDate,
  totalPaidToDate,
  websiteValueProgress,
}: Props) {
  return (
    <BaseEmailLayout preview={`Payment received - ${amount} for ${planName}`}>
      <Text style={heading}>Payment Received</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        Thank you for your payment! Here are the details of your transaction:
      </Text>

      <Section style={detailsBox}>
        <Row>
          <Column style={detailLabel}>Amount</Column>
          <Column style={detailValue}>{amount}</Column>
        </Row>
        <Row>
          <Column style={detailLabel}>Plan</Column>
          <Column style={detailValue}>{planName}</Column>
        </Row>
        <Row>
          <Column style={detailLabel}>Date</Column>
          <Column style={detailValue}>{paymentDate}</Column>
        </Row>
        {invoiceNumber && (
          <Row>
            <Column style={detailLabel}>Invoice</Column>
            <Column style={detailValue}>{invoiceNumber}</Column>
          </Row>
        )}
        {nextBillingDate && (
          <Row>
            <Column style={detailLabel}>Next billing</Column>
            <Column style={detailValue}>{nextBillingDate}</Column>
          </Row>
        )}
      </Section>

      {(totalPaidToDate || websiteValueProgress) && (
        <Section style={progressBox}>
          <Text style={progressTitle}>Your Progress</Text>
          {totalPaidToDate && (
            <Text style={progressText}>Total paid to date: {totalPaidToDate}</Text>
          )}
          {websiteValueProgress && (
            <Text style={progressText}>Website value progress: {websiteValueProgress}</Text>
          )}
        </Section>
      )}

      <Section style={buttonContainer}>
        <Button style={button} href="https://freeplug.dev/dashboard">
          View Dashboard
        </Button>
      </Section>

      <Text style={footerNote}>
        You can view all your invoices and manage your subscription from your dashboard.
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

const progressBox = {
  backgroundColor: '#ecfdf5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
  borderLeft: '4px solid #10b981',
}

const progressTitle = {
  color: '#065f46',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
}

const progressText = {
  color: '#047857',
  fontSize: '14px',
  margin: '0 0 4px',
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

export default PaymentReceivedEmail
