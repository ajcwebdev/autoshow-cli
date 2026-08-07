import type { AggregatedPriceEstimate, BatchManifestEntry, BatchProcessResult, ExtractRoute, ProviderCompletionStatus, ProviderIdentity, RunManifestKind, RuntimeOptions } from '~/types'

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


export type GenerationResumeConfig<TTarget extends ProviderIdentity, TMetadata> = {
  kind: RunManifestKind
  metadataKey: string
  stepLabel: string
  providerFlags: readonly string[]
  getSuccessKey: (entry: TMetadata) => string
  collectTargets: (opts: RuntimeOptions) => TTarget[]
  collectTargetsForProviders: (
    providers: Array<{ service: string, model: string }>,
    opts: RuntimeOptions
  ) => TTarget[]
  assertStoredMissingProvidersAreActive?: (
    providers: Array<{ service: string, model: string }>
  ) => void
  runMissingTargets: (
    targets: TTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => Promise<TMetadata[]>
  priceTargets: (
    targets: TTarget[],
    input: string,
    opts: RuntimeOptions
  ) => Promise<AggregatedPriceEstimate>
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
