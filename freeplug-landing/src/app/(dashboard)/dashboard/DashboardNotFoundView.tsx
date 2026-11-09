import Link from 'next/link'

export function DashboardNotFoundView({ heading, body, link }: { heading: string; body: string; link: string }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center space-y-4">
      <span className="inline-block px-3 py-1 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-xs font-semibold uppercase tracking-wider">
        404
      </span>
      <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
      <p className="text-sm text-gray-600">{body}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[#ba3d3d] text-white text-sm font-medium hover:bg-[#a53434] transition-colors"
      >
        {link}
      </Link>
    </section>
  )
}
