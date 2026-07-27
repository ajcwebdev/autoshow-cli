import type { SttManifestProviderSummary } from '~/types'

export type SttBatchItemSummary = {
  label: string
  completionStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  providers: SttManifestProviderSummary[]
}
