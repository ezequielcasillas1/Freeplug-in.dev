import { isMailConfigured } from '@/lib/admin/mail'

export async function AdminMailBanner() {
  const mailOn = isMailConfigured()
  return (
    <p className="text-sm text-zinc-600 max-w-3xl mb-8">
      Account emails come from Supabase Auth. Use <strong>mailto</strong> anytime, or set{' '}
      <code className="bg-zinc-100 px-1 rounded text-xs">RESEND_API_KEY</code> for outbound mail from the app.{' '}
      {mailOn ? (
        <span className="text-emerald-700 font-medium">Email (Resend) is configured.</span>
      ) : (
        <span className="text-amber-800">Email not configured — mailto only.</span>
      )}
    </p>
  )
}
