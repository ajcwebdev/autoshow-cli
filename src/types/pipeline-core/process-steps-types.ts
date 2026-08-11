import type { HumanLogTable, InputFamily, JsonObject, TimingEntryBase, TimingStepEntry } from '~/types'
export type WriteStepKind = TimingStepEntry['step']

export type WriteManifestMetadata = JsonObject

export type WriteManifestSourceRefs = {
  promptArtifact?: string
  step3RenderedOutput?: string
}

export type WriteRunSummaryRow = {
  step: string
  providerModel: string
  predictedCostCents: number | null
  actualCostCents: number | null
  actualCostSource: string | null
  predictedTimeMs: number | null
  actualTimeMs: number | null
  predictedSpeed: string | null
  actualSpeed: string | null
  predictedInputMetric: string | null
  predictedInputValue: number | null
  actualInputMetric: string | null
  actualInputValue: number | null
}

export type WritePromptUsageRow = {
  step: string
  providerModel: string
  promptSource: string | null
  usage: string | null
}

export type OcrCostCalculationRow = {
  providerModel: string
  pages: number | string | null
  predictedInputs: string | null
  actualInputs: string | null
  rates: string | null
  predictedCostCents: number | null
  actualCostCents: number | null
  deltaCents: number | null
}

export type SummaryBaseRow = {
  stepKey: WriteStepKind
  step: string
  provider: string
  model: string
  providerModel: string
}


export type TimingEntryLike = TimingEntryBase<WriteStepKind, NonNullable<TimingStepEntry['throughputUnit']>>


export type ManifestLogSection<TRow> = {
  columns: readonly string[]
  humanTable: HumanLogTable
  rows: TRow[]
}

export type SummarySection = ManifestLogSection<WriteRunSummaryRow>

export type PromptUsageSection = ManifestLogSection<WritePromptUsageRow>

export type OcrCostCalculationSection = ManifestLogSection<OcrCostCalculationRow>


export type Indexed<T> = {
  index: number
  target: T
}


export type ProviderSuccess<TTarget, TMeta, TResult> = {
  target: TTarget
  metadata: TMeta
  result: TResult
  relativeDir?: string | undefined
}


export type ProviderIdentityBase<TService extends string = string, TModel extends string | null = string> = {
  service: TService
  model: TModel
}

export type ProviderIdentity = ProviderIdentityBase

export type TargetPoolKind = 'hosted' | 'local'

export type TargetSchedulerConcurrency = {
  provider: number
  local: number
}

export type ProviderCompletionStatus = 'full' | 'incomplete' | 'failed'


export type SingleFileRunResult<TMetadata> = {
  filePath: string
  metadata: TMetadata
}

export type SuitePriceSummary = {
  checkedLabel: string
  checkedCount: number
  totalEstimatedCost: number
}


export type ProcessCommandCapabilities = {
  supportsBatchSourceExpansion: boolean
  supportedInputFamilies?: readonly InputFamily[] | undefined
}

export type MediaGenerationStatus = {
  mediaType: 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  status: string
  processingTimeMs?: number
  outputCount?: number
  detail?: string
  artifacts?: readonly {
    artifact: string
    path: unknown
    detail?: unknown
  }[]
}

export type BatchChildDirectoryIdentity = {
  slug?: string | undefined
  title?: string | undefined
  publishedAt?: string | undefined
  fallbackLabel?: string | undefined
}
