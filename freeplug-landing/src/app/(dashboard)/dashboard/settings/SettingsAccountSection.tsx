import Link from 'next/link'

export function SettingsAccountSection(props: {
  email: string | null
  heading: string
  emailLabel: string
  help: string
  helpLink: string
}) {
  return (
    <section aria-labelledby="settings-account" className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
      <h2 id="settings-account" className="text-lg font-medium text-gray-900">{props.heading}</h2>
      {props.email ? (
        <p className="text-sm text-gray-700">
          <span className="font-medium">{props.emailLabel}:</span> <span className="break-all">{props.email}</span>
        </p>
      ) : null}
      <p className="text-sm text-gray-600">
        {props.help}{' '}
        <Link href="/dashboard/help" className="text-[#ba3d3d] underline hover:no-underline">
          {props.helpLink}
        </Link>
        .
      </p>
    </section>
  )
}
