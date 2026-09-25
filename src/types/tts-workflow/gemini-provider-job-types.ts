import type { TtsOptions } from './tts-types'

export type GeminiBatchSlot = {
  key: string
  generationSlotId: string
  itemIndex: number
  model: string
  boundaryAfter?: 'sentence' | 'turn' | undefined
  request: unknown
  requestFingerprint: string
  audioPath?: string | undefined
  audioSha256?: string | undefined
  usage?: import('~/types').Step4Metadata['geminiTtsUsage'] extends (infer T)[] | undefined ? T | undefined : never
  error?: string | undefined
}
export type GeminiProviderJob = {
  schemaVersion: 1
  model: string
  requestFingerprint: string
  keys: string[]
  state: 'prepared' | 'uploading' | 'submitting' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired'
  uploadHandle?: string | undefined
  jobId?: string | undefined
  providerState?: string | undefined
  cancellationRequested?: boolean | undefined
  resultFile?: string | undefined
}
export type GeminiProviderJobRun = {
  schemaVersion: 1
  kind: 'gemini-tts-provider-jobs'
  accountScopeHash: string
  createdAt: string
  items: Array<{ input: string, stem: string }>
  slots: GeminiBatchSlot[]
  jobs: GeminiProviderJob[]
  delivery: Pick<TtsOptions, 'ttsDelivery' | 'ttsExport'>
  outputs: Array<{ itemIndex: number, model: string, path: string }>
}
