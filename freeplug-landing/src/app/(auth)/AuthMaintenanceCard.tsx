import Link from 'next/link'
import { Info } from 'lucide-react'
import { authMaintenanceCopy } from '@/lib/auth/signups-paused'

const inputCls = 'w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-gray-400 cursor-not-allowed outline-none'

/**
 * In-development notice (Oct 28) for /login, /signup, /es/signup while AUTH_MAINTENANCE is on:
 * a calm card, then the form shown grayed out. There is no <form> element and every control is
 * disabled, so nothing can be submitted; no forgot-password link.
 */
export function AuthMaintenanceCard({ locale, variant = 'login' }: { locale: 'en' | 'es'; variant?: 'login' | 'signup' }) {
  const es = locale === 'es'
  const c = authMaintenanceCopy(locale)
  const fields =
    variant === 'signup'
      ? [
          { id: 'email', label: es ? 'Correo electrónico' : 'Email', type: 'email' },
          { id: 'password', label: es ? 'Contraseña' : 'Password', type: 'password' },
          { id: 'confirm', label: es ? 'Confirmar contraseña' : 'Confirm password', type: 'password' },
        ]
      : [
          { id: 'email', label: es ? 'Correo electrónico' : 'Email', type: 'email' },
          { id: 'password', label: es ? 'Contraseña' : 'Password', type: 'password' },
        ]
  const heading = variant === 'signup' ? (es ? 'Crea tu cuenta' : 'Create your account') : es ? 'Iniciar sesión' : 'Log in'
  return (
    <div className="space-y-4" data-testid="auth-maintenance">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-zinc-200 flex items-start gap-3" role="status">
        <Info size={18} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
        <p className="text-sm text-gray-700">{c.body}</p>
      </div>
      <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200 opacity-60 select-none" aria-disabled="true" data-testid="auth-disabled-form">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{heading}</h1>
        <fieldset disabled className="space-y-4">
          {fields.map((f) => (
            <div key={f.id}>
              <label htmlFor={`indev-${f.id}`} className="block text-sm font-medium text-gray-500 mb-1">
                {f.label}
              </label>
              <input id={`indev-${f.id}`} type={f.type} disabled tabIndex={-1} className={inputCls} />
            </div>
          ))}
          <button type="button" disabled className="w-full rounded-lg bg-zinc-300 px-4 py-3 text-base font-medium text-white cursor-not-allowed">
            {c.button}
          </button>
        </fieldset>
      </div>
      <p className="text-center">
        <Link href={es ? '/es' : '/'} className="text-sm text-gray-500 hover:text-[#ba3d3d]">
          ← {c.back}
        </Link>
      </p>
    </div>
  )
}
