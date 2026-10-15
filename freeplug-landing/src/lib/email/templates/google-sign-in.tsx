import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'
import { emailBaseUrl } from '@/lib/site'

type Props = {
  baseUrl?: string
}

/** Sent instead of a reset link when a password reset is requested for a Google-only account. */
export function GoogleSignInEmail({ baseUrl }: Props) {
  const loginUrl = `${emailBaseUrl(baseUrl)}/login`
  return (
    <BaseEmailLayout baseUrl={baseUrl} preview="Your Freeplug account uses Google sign-in">
      <Text style={heading}>Sign in with Google</Text>
      <Text style={paragraph}>
        We received a request to reset the password for your Freeplug account. Your account
        signs in with Google, so there is no Freeplug password to reset.
      </Text>
      <Text style={paragraph}>
        On the login page, choose <strong>Continue with Google</strong> and use this email
        address.
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={loginUrl}>
          Go to log in
        </Button>
      </Section>

      <Text style={paragraph}>
        If you didn&apos;t request this, you can safely ignore this email.
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

export default GoogleSignInEmail
