import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { emailBaseUrl } from '@/lib/site'
import { BaseEmailLayout } from './base-layout'
import { ADDON_REFUND_EMAIL_HELP, GO_TO_PLANS, addonRefundEmailSubject } from '@/lib/plans/ladder-copy'

type Props = {
  userName?: string
  /** The add-on's name (ADDON_NAMES). */
  addonName: string
  /** addonRefundNote(): why it was refunded, then where the money went (Aria, Oct 4 9:27). */
  note: string
  baseUrl?: string
}

/**
 * Aria, Oct 4 9:27: the self-heal refunded an add-on charge automatically. One plain line says why and
 * where the money went, so it never just looks like it vanished. Copy lines are in ladder-copy.ts (for Sable).
 */
export function AddonRefundedEmail({ userName, addonName, note, baseUrl }: Props) {
  const base = emailBaseUrl(baseUrl)
  const subject = addonRefundEmailSubject(addonName)
  return (
    <BaseEmailLayout baseUrl={base} preview={subject}>
      <Text style={heading}>{subject}</Text>
      <Text style={paragraph}>Hi{userName ? ` ${userName}` : ''},</Text>
      <Section style={infoBox}>
        <Text style={infoText} data-testid="addon-refund-line">
          {note}
        </Text>
      </Section>
      <Text style={paragraph}>{ADDON_REFUND_EMAIL_HELP}</Text>
      <Button style={button} href={`${base}/dashboard/plans`}>
        {GO_TO_PLANS}
      </Button>
    </BaseEmailLayout>
  )
}

const heading = { color: '#1a1a1a', fontSize: '24px', fontWeight: '600' as const, lineHeight: '32px', margin: '0 0 24px' }
const paragraph = { color: '#525f7f', fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px 20px', margin: '24px 0', borderLeft: '4px solid #ba3d3d' }
const infoText = { color: '#1a1a1a', fontSize: '15px', lineHeight: '22px', margin: '0' }
const button = { backgroundColor: '#ba3d3d', borderRadius: '8px', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, padding: '12px 20px', textDecoration: 'none' }
