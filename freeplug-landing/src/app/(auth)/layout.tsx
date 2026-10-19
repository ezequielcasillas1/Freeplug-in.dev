import { AppTreeDocument } from '@/app/app-document-server'
import { AuthFrame } from './AuthFrame'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppTreeDocument>
      <AuthFrame>{children}</AuthFrame>
    </AppTreeDocument>
  )
}
