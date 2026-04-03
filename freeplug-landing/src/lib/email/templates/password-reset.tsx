import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  resetLink: string
  userName?: string
  expiresIn?: string
}

export function PasswordResetEmail({ resetLink, userName, expiresIn = '1 hour' }: Props) {
  return (
    <BaseEmailLayout preview="Reset your Freeplug.dev password">
      <Text style={heading}>Reset Your Password</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        We received a request to reset your password for your Freeplug.dev account. Click the
        button below to create a new password:
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={resetLink}>
          Reset Password
        </Button>
      </Section>

      <Text style={paragraph}>
        This link will expire in <strong>{expiresIn}</strong>. If you didn&apos;t request a
        password reset, you can safely ignore this email — your password will remain unchanged.
      </Text>

      <Section style={securityBox}>
        <Text style={securityTitle}>Security Tips</Text>
        <Text style={securityText}>• Never share this link with anyone</Text>
        <Text style={securityText}>• We will never ask for your password via email</Text>
        <Text style={securityText}>• Use a strong, unique password</Text>
      </Section>

      <Text style={footerNote}>
        If you&apos;re having trouble clicking the button, copy and paste this URL into your
        browser:
      </Text>
      <Text style={linkText}>{resetLink}</Text>
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
  padding: '14px 32px',
}

const securityBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
}

const securityTitle = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
}

const securityText = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 4px',
}

const footerNote = {
  color: '#94a3b8',
  fontSize: '12px',
  margin: '24px 0 8px',
}

const linkText = {
  color: '#ba3d3d',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
  margin: '0',
}

export default PasswordResetEmail
