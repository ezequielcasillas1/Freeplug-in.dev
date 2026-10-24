import Link from 'next/link'
import { authMaintenanceCopy } from '@/lib/auth/signups-paused'

/** "Maintenance in progress" card for /login, /signup, /es/signup while AUTH_MAINTENANCE is on. */
export function AuthMaintenanceCard({ locale }: { locale: 'en' | 'es' }) {
  const c = authMaintenanceCopy(locale)
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200 text-center" data-testid="auth-maintenance">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{c.title}</h1>
      <p className="text-sm text-gray-600 mb-6">{c.body}</p>
      <p>
        <Link href={locale === 'es' ? '/es' : '/'} className="text-sm text-gray-500 hover:text-[#ba3d3d]">
          ← {locale === 'es' ? 'Volver al sitio' : 'Back to site'}
        </Link>
      </p>
    </div>
  )
}
