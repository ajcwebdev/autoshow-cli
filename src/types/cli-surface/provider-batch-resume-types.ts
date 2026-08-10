import type { AggregateTimingOptions, PipelineItemRecord, PipelineManifest, ProviderCompletionStatus, ProviderIdentity, ProviderResumeEntry, ProviderResumeProcessResult, ResumeTarget, StepEstimate } from '~/types'

export type ProviderResumeSnapshot = {
  manifestPath: string
  manifest: PipelineManifest
  records: PipelineItemRecord[]
}

export type ProviderResumePriceConfig<
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>,
  TOptions extends object
> = Pick<ProviderBatchResumeConfig<TTarget, TEntry, undefined, TOptions>, 'stepLabel' | 'readItemRecord' | 'parseRecord'> & {
  buildEstimates: (
    entry: TEntry,
    opts: TOptions
  ) => StepEstimate[] | Promise<StepEstimate[]>
  getAggregateTimingOptions?: ((opts: TOptions) => AggregateTimingOptions) | undefined
}

export type ProviderResumePassContextInput<TEntry, TOptions extends object> = {
  target: ResumeTarget
  opts: TOptions
  parsedEntries: Array<TEntry | undefined>
}

export type ProviderResumeProcessEntryInput<TEntry, TContext, TOptions extends object> = {
  target: ResumeTarget
  opts: TOptions
  entry: TEntry
  index: number
  entryCount: number
  providerLabels: string[]
  context: TContext
}

export type ProviderResumeNoMatchingDetailInput<TEntry, TContext, TOptions extends object> = {
  target: ResumeTarget
  opts: TOptions
  entry: TEntry
  index: number
  entryCount: number
  context: TContext
}

export type ProviderResumePassHookInput<TContext, TOptions extends object> = {
  target: ResumeTarget
  opts: TOptions
  context: TContext
}

export type ProviderResumeRecordHookInput<TContext, TOptions extends object> = ProviderResumePassHookInput<TContext, TOptions> & {
  record: PipelineItemRecord
}

export type ProviderResumeResultHookInput<TContext, TOptions extends object> = ProviderResumePassHookInput<TContext, TOptions> & {
  result: ProviderResumeProcessResult
}

export type ProviderBatchResumeConfig<
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>,
  TContext = undefined,
  TOptions extends object = object
> = {
  stepLabel: string
  parseRecord: (record: unknown) => Promise<TEntry | undefined>
  readItemRecord: (outputDir: string) => Promise<PipelineItemRecord>
  processingDetail?: string
  getProviderLabels: (targets: TTarget[]) => string[]
  processEntry: (
    input: ProviderResumeProcessEntryInput<TEntry, TContext, TOptions>
  ) => Promise<ProviderResumeProcessResult>
  createPassContext?: (
    input: ProviderResumePassContextInput<TEntry, TOptions>
  ) => TContext | Promise<TContext>
  formatNoMatchingDetail?: (
    input: ProviderResumeNoMatchingDetailInput<TEntry, TContext, TOptions>
  ) => string
  normalizeAlreadyFullRecord?: (record: PipelineItemRecord) => PipelineItemRecord
  classifyNoMatchingRecord?: (record: PipelineItemRecord) => ProviderCompletionStatus
  onNoMatchingRecord?: (input: ProviderResumeRecordHookInput<TContext, TOptions>) => void | Promise<void>
  onProcessedResult?: (input: ProviderResumeResultHookInput<TContext, TOptions>) => void | Promise<void>
  afterPass?: (input: ProviderResumePassHookInput<TContext, TOptions>) => void | Promise<void>
}
