import { isMailConfigured } from '@/lib/admin/mail'
import { RESET_FALLBACK_WINDOW_HOURS, getResetFallbackStatus } from '@/lib/email/reset-fallback'

/** Admin mail status: Resend configured or not, plus recent password-reset fallbacks to Supabase's mailer. */
export async function AdminMailBanner() {
  const mailOn = isMailConfigured()
  const fallback = await getResetFallbackStatus()
  const degraded = fallback.count > 0
  return (
    <div className="text-sm text-zinc-600 max-w-3xl mb-8 space-y-1" data-testid="admin-mail-banner">
      <p>
        Account emails come from Supabase Auth. Use <strong>mailto</strong> anytime, or set{' '}
        <code className="bg-zinc-100 px-1 rounded text-xs">RESEND_API_KEY</code> for outbound mail from the app.{' '}
        {mailOn ? (
          <span className="text-emerald-700 font-medium">Email (Resend) is configured.</span>
        ) : (
          <span className="text-amber-800 font-medium">Email not configured — mailto only.</span>
        )}
      </p>
      {degraded ? (
        <p className="text-amber-800" data-testid="reset-fallback-warning">
          Email degraded: {fallback.count} password reset{fallback.count === 1 ? '' : 's'} fell back to the
          Supabase mailer in the last {RESET_FALLBACK_WINDOW_HOURS} h
          {fallback.lastReason ? ` (last: ${fallback.lastReason}${fallback.lastAt ? `, ${fallback.lastAt}` : ''})` : ''}
          {fallback.source === 'instance' ? ' — counted on this server instance only' : ''}. Check the server logs.
        </p>
      ) : null}
      {fallback.templateErrors > 0 ? (
        <p className="text-red-700 font-medium" data-testid="reset-template-error">
          Template errors: {fallback.templateErrors} password reset{fallback.templateErrors === 1 ? '' : 's'} could not be
          rendered in the last {RESET_FALLBACK_WINDOW_HOURS} h and went out through the Supabase mailer instead
          {fallback.lastTemplateError ? ` (last: ${fallback.lastTemplateError}${fallback.lastTemplateErrorAt ? `, ${fallback.lastTemplateErrorAt}` : ''})` : ''}
          {fallback.source === 'instance' ? ' — counted on this server instance only' : ''}. Fix the template.
        </p>
      ) : null}
    </div>
  )
}
