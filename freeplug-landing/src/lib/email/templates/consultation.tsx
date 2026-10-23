import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { emailBaseUrl } from '@/lib/site'
import { BaseEmailLayout } from './base-layout'

type Row = { label: string; value: string }

function Rows({ rows }: { rows: Row[] }) {
  return (
    <Section style={box}>
      {rows.map((r) => (
        <Text key={r.label} style={rowText}>
          <strong>{r.label}:</strong> {r.value}
        </Text>
      ))}
    </Section>
  )
}

/** Client: the team wrote up the live session; please review. */
export function ConsultationSummaryReadyEmail(p: { userName?: string; businessName: string; baseUrl?: string }) {
  const base = emailBaseUrl(p.baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={`Review your summary - ${p.businessName}`}>
      <Text style={heading}>Review your summary</Text>
      <Text style={paragraph}>Hi{p.userName ? ` ${p.userName}` : ''},</Text>
      <Text style={paragraph}>
        Thanks for talking with us about <strong>{p.businessName}</strong>. We wrote up everything we agreed. Please check it
        and click <strong>Looks good</strong>, or tell us what to change. Nothing is built or charged until you confirm.
      </Text>
      <Section style={{ margin: '32px 0' }}>
        <Button style={button} href={`${base}/dashboard/consultation/summary`}>
          Review your summary
        </Button>
      </Section>
    </BaseEmailLayout>
  )
}

/** Client copy of the agreed plan. */
export function ConsultationAgreedClientEmail(p: { userName?: string; businessName: string; rows: Row[]; baseUrl?: string }) {
  const base = emailBaseUrl(p.baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={`Your website plan is confirmed - ${p.businessName}`}>
      <Text style={heading}>Your website plan is confirmed</Text>
      <Text style={paragraph}>Hi{p.userName ? ` ${p.userName}` : ''},</Text>
      <Text style={paragraph}>
        Thanks for confirming the plan for <strong>{p.businessName}</strong>. Here is a copy for your records. We will be in
        touch about the build.
      </Text>
      <Rows rows={p.rows} />
    </BaseEmailLayout>
  )
}

/** Team alert: the client clicked Looks good. */
export function ConsultationAgreedTeamEmail(p: {
  businessName: string
  clientEmail: string
  path: 'form' | 'live'
  agreedAt: string
  rows: Row[]
  baseUrl?: string
}) {
  const base = emailBaseUrl(p.baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={`Consultation agreed - ${p.businessName}`}>
      <Text style={heading}>Consultation agreed: {p.businessName}</Text>
      <Text style={paragraph}>
        {p.clientEmail} clicked Looks good at {p.agreedAt} ({p.path === 'form' ? 'filled in the details' : 'live session'}).
        The request is now Agreed and can move to Building.
      </Text>
      <Rows rows={p.rows} />
      <Section style={{ margin: '32px 0' }}>
        <Button style={button} href={`${base}/admin/consultations`}>
          Open the consultations queue
        </Button>
      </Section>
    </BaseEmailLayout>
  )
}

/** Team alert: a live session was booked. */
export function ConsultationLiveBookedTeamEmail(p: {
  businessName: string
  clientEmail: string
  method: string
  when: string | null
  bookingRef: string | null
  baseUrl?: string
}) {
  const base = emailBaseUrl(p.baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={`Live consultation booked - ${p.businessName}`}>
      <Text style={heading}>Live consultation booked</Text>
      <Rows
        rows={[
          { label: 'Business', value: p.businessName },
          { label: 'Client', value: p.clientEmail },
          { label: 'Method', value: p.method },
          { label: 'When', value: p.when ?? 'See the booking' },
          { label: 'Booking', value: p.bookingRef ?? '—' },
        ]}
      />
      <Section style={{ margin: '32px 0' }}>
        <Button style={button} href={`${base}/admin/consultations`}>
          Open the consultations queue
        </Button>
      </Section>
    </BaseEmailLayout>
  )
}

/** Team: the customer asked to cancel while the site is being built (status unchanged). */
export function ConsultationCancelRequestTeamEmail(p: {
  businessName: string
  clientEmail: string
  requestId: string
  baseUrl?: string
}) {
  const base = emailBaseUrl(p.baseUrl)
  return (
    <BaseEmailLayout baseUrl={base} preview={`Cancel requested during build - ${p.businessName}`}>
      <Text style={heading}>Cancel requested during build</Text>
      <Text style={paragraph}>The customer asked to cancel. The request is still building; nothing was changed.</Text>
      <Rows
        rows={[
          { label: 'Business', value: p.businessName },
          { label: 'Client', value: p.clientEmail },
          { label: 'Request', value: p.requestId },
        ]}
      />
      <Section style={{ margin: '32px 0' }}>
        <Button style={button} href={`${base}/admin/consultations`}>
          Open the consultations queue
        </Button>
      </Section>
    </BaseEmailLayout>
  )
}

const heading = { color: '#1a1a1a', fontSize: '24px', fontWeight: '600' as const, lineHeight: '32px', margin: '0 0 24px' }
const paragraph = { color: '#525f7f', fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' }
const box = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px 20px', margin: '24px 0' }
const rowText = { color: '#334155', fontSize: '14px', lineHeight: '20px', margin: '0 0 6px', whiteSpace: 'pre-wrap' as const }
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
