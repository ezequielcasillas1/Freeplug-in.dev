import { Text, Button, Section } from '@react-email/components'
import * as React from 'react'
import { BaseEmailLayout } from './base-layout'

type Props = {
  userName?: string
}

export function WelcomeEmail({ userName }: Props) {
  return (
    <BaseEmailLayout preview="Welcome to Freeplug.dev - Let's build your online presence">
      <Text style={heading}>Welcome to Freeplug.dev!</Text>
      <Text style={paragraph}>
        Hi{userName ? ` ${userName}` : ''},
      </Text>
      <Text style={paragraph}>
        Thank you for joining Freeplug.dev! We are excited to help you establish and grow your
        online presence with professional website hosting and maintenance services.
      </Text>
      <Text style={paragraph}>Here is what you can do next:</Text>
      <Section style={list}>
        <Text style={listItem}>1. Submit a website request from your dashboard</Text>
        <Text style={listItem}>2. Our team will review your business details</Text>
        <Text style={listItem}>3. Choose a hosting plan that fits your needs</Text>
        <Text style={listItem}>4. Watch your online presence grow</Text>
      </Section>
      <Section style={buttonContainer}>
        <Button style={button} href="https://freeplug.dev/dashboard">
          Go to Dashboard
        </Button>
      </Section>
      <Text style={paragraph}>
        If you have any questions, just reply to this email or reach out to our support team.
      </Text>
      <Text style={signature}>
        — The Freeplug.dev Team
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

const list = {
  margin: '0 0 24px',
  padding: '0',
}

const listItem = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 8px',
  paddingLeft: '8px',
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

const signature = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500' as const,
  margin: '24px 0 0',
}

export default WelcomeEmail
