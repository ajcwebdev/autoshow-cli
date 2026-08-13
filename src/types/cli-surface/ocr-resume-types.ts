import type { OcrProviderMode, OcrTarget, ProviderResumeEntry, Step1SourceRef } from '~/types'

export type ResumeOcrEntry = ProviderResumeEntry<OcrTarget, Step1SourceRef> & {
  onlyBlockedMissingTargets: boolean
  ocrProviderMode: OcrProviderMode
  unfinishedPageCount?: number | undefined
  reenabledTargets?: OcrTarget[] | undefined
  storedReasoningEffort?: import('~/types').ExtractionOptions['reasoningEffort'] | undefined
}

export type OcrResumePassContext = {
  resumableIncomplete: number
  resumableFailed: number
}
