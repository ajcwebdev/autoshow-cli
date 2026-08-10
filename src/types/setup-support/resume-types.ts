import type { AggregateExplicitEstimateOptions, AggregatedPriceEstimate, BatchProcessResult, ExtractRoute, PipelineItemRecord, ProcessCommand, ProviderCompletionStatus, ProviderIdentity, StepEstimate } from '~/types'

export type ResumeItemSummary = {
  item: string
  status: string
  outputDir: string
  providers: string | string[]
  detail?: string
}

export type ResumeTotals = {
  full: number
  incomplete: number
  failed: number
}

export type ResumeResult = ResumeTotals

export type ResumeDisplayOptions = {
  itemLabel?: string | undefined
}

export type ResumeSuiteSummary = ResumeTotals & {
  directories: number
}

export type ResumeTargetKind = 'extract' | 'write' | 'tts' | 'image' | 'video' | 'music'

export type ResumeTarget = {
  kind: ResumeTargetKind
  extractRoute?: ExtractRoute | undefined
  scope: 'single' | 'batch'
  dir: string
  manifestPath: string
}

export type ResumeHandler<TOptions extends object> = {
  kind: ResumeTargetKind
  hasResumableWork: (
    target: ResumeTarget,
    opts: TOptions,
    explicitFlags: Set<string>
  ) => Promise<boolean>
  resume: (
    target: ResumeTarget,
    opts: TOptions,
    explicitFlags: Set<string>,
    displayOptions?: ResumeDisplayOptions | undefined
  ) => Promise<ResumeResult>
  price: (
    target: ResumeTarget,
    opts: TOptions,
    explicitFlags: Set<string>
  ) => Promise<AggregatedPriceEstimate>
}

export type ExtractRouteResumeHandler<TOptions extends object> = Pick<ResumeHandler<TOptions>, 'hasResumableWork' | 'resume' | 'price'>

export type GenerationModelFieldTable = Record<string, readonly [modelsField: string, modelField: string]>

export type GenerationResumeRunContext<TTarget extends ProviderIdentity, TMetadata> = {
  targets: TTarget[]
  existingEntries: TMetadata[]
  currentManifestMetadata: Record<string, unknown>
}

export type GenerationResumeConfig<TTarget extends ProviderIdentity, TMetadata, TOptions extends object> = {
  kind: ProcessCommand
  metadataKey: string
  stepLabel: string
  providerFlags: readonly string[]
  selectionMode: 'additive-stored' | 'selected-only'
  modelFields?: GenerationModelFieldTable
  parseManifestEntries?: (
    metadata: Record<string, unknown>
  ) => TMetadata[] | undefined
  resolveInput?: (
    target: ResumeTarget,
    currentManifestMetadata: Record<string, unknown>
  ) => string | Promise<string>
  serializeEntries?: (
    entries: TMetadata[]
  ) => unknown
  failureMessage?: (
    failure: 'failed' | 'incomplete',
    providers: ProviderIdentity[]
  ) => string
  getSuccessKey: (entry: TMetadata) => string
  collectTargets: (
    opts: TOptions,
    target: ResumeTarget
  ) => TTarget[]
  runMissingTargets: (
    targets: TTarget[],
    input: string,
    outputDir: string,
    opts: TOptions,
    context: GenerationResumeRunContext<TTarget, TMetadata>
  ) => Promise<TMetadata[]>
  buildEstimates: (
    opts: TOptions,
    input: string,
    context: GenerationResumeRunContext<TTarget, TMetadata>
  ) => StepEstimate[] | Promise<StepEstimate[]>
  priceAggregateOptions?: (
    input: string
  ) => AggregateExplicitEstimateOptions
  rebuildRunMetadata?: (
    metadata: TMetadata[],
    currentManifestMetadata: Record<string, unknown>,
    input: string
  ) => Record<string, unknown>
}

export type ProviderResumeEntry<TTarget extends ProviderIdentity, TSource = unknown> = {
  outputDir: string
  source: TSource
  requestedTargets: TTarget[]
  missingTargets: TTarget[]
  completionStatus: ProviderCompletionStatus
  rawRecord: PipelineItemRecord
}


export type ProviderResumeProcessResult = {
  outputDir: string
  record: PipelineItemRecord
  completionStatus: ProviderCompletionStatus
  detail: string
  level?: 'success' | 'warn' | 'error'
  hasRemainingResumableWork?: boolean
}

export type ProviderResumePassResult = BatchProcessResult & {
  attemptedEntries: number
}

export type ResumeProviderBatchRunOptions = {
  maxPasses?: number | undefined
  ignoreUnresumableEntries?: boolean | undefined
}

export type NormalizedResumeProviderBatchRunOptions = {
  maxPasses: number
  ignoreUnresumableEntries: boolean
}
