import { AppDocument } from '@/app/AppDocument'
import { EN_MESSAGES } from '@/i18n/messages'

/** Unprefixed public page (English, like the root 404): its own document under the pass-through root layout. */
export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDocument lang="en" messages={EN_MESSAGES} now={new Date()}>
      {children}
    </AppDocument>
  )
}
