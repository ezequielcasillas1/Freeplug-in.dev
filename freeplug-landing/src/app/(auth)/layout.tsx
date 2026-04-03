export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-zinc-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
