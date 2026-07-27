import type { ProviderResumeEntry, SttBatchCoordinator, SttTarget } from '~/types'

export type ResumeSttEntry = ProviderResumeEntry<SttTarget, { url?: string, filePath?: string }>

export type SttResumePassContext = {
  batchCoordinator: SttBatchCoordinator | undefined
  partialFailureLabels: Map<string, number>
}
