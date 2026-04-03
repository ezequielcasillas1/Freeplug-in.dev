type Props = {
  hint?: string | null
}

export function AdminConfigError({ hint }: Props) {
  return (
    <div className="text-red-700 text-sm space-y-2">
      <p>
        Admin needs <code className="bg-zinc-200 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code className="bg-zinc-200 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in{' '}
        <code className="bg-zinc-200 px-1 rounded">freeplug-landing/.env.local</code>, then restart{' '}
        <code className="bg-zinc-200 px-1 rounded">npm run dev</code>.
      </p>
      {hint ? <p className="text-zinc-600 font-mono text-xs">{hint}</p> : null}
    </div>
  )
}
