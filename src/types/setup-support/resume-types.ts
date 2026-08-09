import type { AggregateExplicitEstimateOptions, AggregatedPriceEstimate, BatchManifestEntry, BatchProcessResult, ExtractRoute, ProviderCompletionStatus, ProviderIdentity, RunManifestKind, RuntimeOptions, StepEstimate } from '~/types'

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

export type ResumeHandler = {
  kind: ResumeTargetKind
  hasResumableWork: (
    target: ResumeTarget,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<boolean>
  resume: (
    target: ResumeTarget,
    opts: RuntimeOptions,
    explicitFlags: Set<string>,
    displayOptions?: ResumeDisplayOptions | undefined
  ) => Promise<ResumeResult>
  price: (
    target: ResumeTarget,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<AggregatedPriceEstimate>
}

export type ExtractRouteResumeHandler = Pick<ResumeHandler, 'hasResumableWork' | 'resume' | 'price'>

export type GenerationModelFieldTable = Record<string, readonly [modelsField: string, modelField: string]>

export type GenerationResumeConfig<TTarget extends ProviderIdentity, TMetadata> = {
  kind: RunManifestKind
  metadataKey: string
  stepLabel: string
  providerFlags: readonly string[]
  modelFields: GenerationModelFieldTable
  getSuccessKey: (entry: TMetadata) => string
  collectTargets: (opts: RuntimeOptions) => TTarget[]
  runMissingTargets: (
    targets: TTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => Promise<TMetadata[]>
  buildEstimates: (
    opts: RuntimeOptions,
    input: string,
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
  rawEntry: BatchManifestEntry
}


export type ProviderResumeProcessResult = {
  outputDir: string
  metadata: BatchManifestEntry
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
