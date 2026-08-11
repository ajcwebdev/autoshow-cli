import type { PipelineItemStatus, SttProviderSummary } from '~/types'

export type SttBatchItemSummary = {
  label: string
  completionStatus: PipelineItemStatus
  providers: SttProviderSummary[]
}
