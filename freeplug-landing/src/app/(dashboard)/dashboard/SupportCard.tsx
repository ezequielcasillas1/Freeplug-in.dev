import { MessageCircle, Mail, HelpCircle, ExternalLink } from 'lucide-react'

export function SupportCard() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
        Need Help?
      </h2>
      <div className="space-y-3">
        <a
          href="mailto:support@freeplug-in.dev"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
        >
          <div className="rounded-lg bg-blue-50 p-2">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 group-hover:text-[#ba3d3d]">
              Email Support
            </p>
            <p className="text-xs text-gray-500">support@freeplug-in.dev</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </a>

        <a
          href="/dashboard/help"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
        >
          <div className="rounded-lg bg-purple-50 p-2">
            <HelpCircle className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 group-hover:text-[#ba3d3d]">
              Help Center
            </p>
            <p className="text-xs text-gray-500">FAQs and guides</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </a>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50">
          <div className="rounded-lg bg-green-50 p-2">
            <MessageCircle className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Response Time</p>
            <p className="text-xs text-gray-500">Usually within 24 hours</p>
          </div>
        </div>
      </div>
    </div>
  )
}
