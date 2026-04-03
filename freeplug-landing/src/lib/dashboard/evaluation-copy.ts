import type { EvaluationStatus } from '@/types/supabase'

export function evaluationTitle(status: EvaluationStatus): string {
  switch (status) {
    case 'none':
      return 'Get started'
    case 'requested':
      return 'Request received'
    case 'in_review':
      return 'Evaluation in progress'
    case 'evaluated':
      return 'Evaluation complete'
    case 'agreed':
      return 'Agreement in place'
    default:
      return 'Status'
  }
}

export function evaluationDescription(status: EvaluationStatus): string {
  switch (status) {
    case 'none':
      return 'Submit a website request so we can review your business and Google Business presence.'
    case 'requested':
      return 'We received your details. Our team will follow up by email or phone.'
    case 'in_review':
      return 'We are reviewing your business and scope. Thanks for your patience.'
    case 'evaluated':
      return 'We have completed the evaluation. Next steps will be shared with you directly.'
    case 'agreed':
      return 'Terms are in place. Hosting and maintenance billing continues until you cancel, unless we agree otherwise.'
    default:
      return ''
  }
}
