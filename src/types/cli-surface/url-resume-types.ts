import type { HtmlArticleBackend, UrlArticleTarget } from '~/types'

export type UrlArticleResumePlan = {
  requestedTargets: UrlArticleTarget[]
  targetsToRun: UrlArticleTarget[]
  skippedSuccessfulTargets: UrlArticleTarget[]
  requestedBackends: HtmlArticleBackend[]
  backendsToRun: HtmlArticleBackend[]
  skippedSuccessfulBackends: HtmlArticleBackend[]
}

export type UrlArticleResumeResult = {
  outputDir: string
  requestedBackends: HtmlArticleBackend[]
  backendsToRun: HtmlArticleBackend[]
  skippedSuccessfulBackends: HtmlArticleBackend[]
  completionStatus: 'full' | 'incomplete' | 'failed'
  selectedBackendsComplete: boolean
  succeeded: number
  failed: number
}
