/** Lina: loading = 6 skeleton cards. */
export default function Loading() {
  return (
    <ul data-testid="picker-loading" aria-busy="true" className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="aspect-[4/3] w-full animate-pulse bg-gray-200" />
          <div className="p-4 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" /><div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" /></div>
        </li>
      ))}
    </ul>
  )
}
