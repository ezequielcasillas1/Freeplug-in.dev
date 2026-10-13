import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'
import * as React from 'react'
import { emailBaseUrl, SUPPORT_EMAIL } from '@/lib/site'

type Props = {
  preview: string
  children: React.ReactNode
  /** Site base URL for links; defaults to NEXT_PUBLIC_APP_URL, then https://freeplug-in.dev. */
  baseUrl?: string
}

export function BaseEmailLayout({ preview, children, baseUrl }: Props) {
  const base = emailBaseUrl(baseUrl)
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Freeplug</Text>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Freeplug. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href={base} style={footerLink}>
                Visit our website
              </Link>
              {' · '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                Contact support
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '24px 32px',
  borderBottom: '1px solid #e6ebf1',
}

const logo = {
  color: '#ba3d3d',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '0',
}

const content = {
  padding: '32px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const footer = {
  padding: '0 32px',
}

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0 0 8px',
}

const footerLink = {
  color: '#ba3d3d',
  textDecoration: 'none',
}
