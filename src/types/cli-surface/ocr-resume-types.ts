import type { OcrTarget, ProviderResumeEntry, Step1SourceRef } from '~/types'

export type ResumeOcrEntry = ProviderResumeEntry<OcrTarget, Step1SourceRef> & {
  onlyBlockedMissingTargets: boolean
}

export type OcrResumePassContext = {
  resumableIncomplete: number
  resumableFailed: number
}
