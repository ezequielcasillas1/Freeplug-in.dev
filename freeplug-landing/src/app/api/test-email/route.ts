import { NextResponse } from 'next/server'
import { isResendConfigured, getResend, EMAIL_FROM, EMAIL_REPLY_TO } from '@/lib/email'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')

  if (!to) {
    return NextResponse.json(
      { error: 'Missing "to" query param. Use ?to=your@email.com' },
      { status: 400 }
    )
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured in .env.local' },
      { status: 500 }
    )
  }

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to,
      subject: 'Test Email from Freeplug.dev',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ba3d3d;">Resend Test Successful!</h1>
          <p>If you're seeing this email, your Resend integration is working correctly.</p>
          <p style="color: #666; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${to}`,
      emailId: data?.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
