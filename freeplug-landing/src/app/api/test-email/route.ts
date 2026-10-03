import { NextResponse } from 'next/server'
import { isAdminAccessAllowed } from '@/lib/admin/guard'
import { isSmtpConfigured, isResendConfigured, sendMail } from '@/lib/email'

export async function GET(request: Request) {
  if (!(await isAdminAccessAllowed())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')

  if (!to) {
    return NextResponse.json(
      { error: 'Missing "to" query param. Use ?to=your@email.com' },
      { status: 400 }
    )
  }

  if (!isSmtpConfigured() && !isResendConfigured()) {
    return NextResponse.json(
      { error: 'SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local)' },
      { status: 500 }
    )
  }

  const result = await sendMail({
    to,
    subject: 'Test Email from Freeplug',
    html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ba3d3d;">SMTP Test Successful!</h1>
          <p>If you're seeing this email, your SMTP email integration is working correctly.</p>
          <p style="color: #666; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    text: `SMTP Test Successful! Your SMTP email integration is working. Sent at: ${new Date().toISOString()}`,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Test email sent to ${to}`,
    emailId: result.id,
  })
}
