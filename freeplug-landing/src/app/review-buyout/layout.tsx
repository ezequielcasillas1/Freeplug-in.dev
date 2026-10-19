import { AppDocument } from '@/app/AppDocument'
import { EN_MESSAGES } from '@/i18n/messages'

/** REVIEW BRANCH ONLY (not in any feature branch): shows the buyout cards without signing in. ?lang=es for Spanish. */
export default async function L({ children }: { children: React.ReactNode }) {
  return (
    <AppDocument lang="en" messages={EN_MESSAGES} now={new Date()}>
      {children}
    </AppDocument>
  )
}
