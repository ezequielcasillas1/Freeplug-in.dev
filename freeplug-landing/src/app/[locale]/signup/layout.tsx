import { AuthFrame } from '@/app/(auth)/AuthFrame'

/** Sign-up moved under [locale] (it is public and in the sitemap); same frame as the auth pages. */
export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>
}
