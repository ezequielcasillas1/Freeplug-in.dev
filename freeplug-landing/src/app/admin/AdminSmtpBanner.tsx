import { isSmtpConfigured } from '@/lib/admin/mail'

export async function AdminSmtpBanner() {
  const smtpOn = isSmtpConfigured()
  return (
    <p className="text-sm text-zinc-600 max-w-3xl mb-8">
      Account emails come from Supabase Auth. Use <strong>mailto</strong> anytime, or set{' '}
      <code className="bg-zinc-100 px-1 rounded text-xs">SMTP_*</code> in{' '}
      <code className="bg-zinc-100 px-1 rounded text-xs">.env.local</code> for outbound mail.{' '}
      {smtpOn ? (
        <span className="text-emerald-700 font-medium">SMTP is configured.</span>
      ) : (
        <span className="text-amber-800">SMTP not configured — mailto only.</span>
      )}
    </p>
  )
}
