import type { CostSource, EstimatedCostBreakdown, ExtractionMetadata, ManifestLogActualCostBreakdown, ManifestLogCostEntryLike, PartialExtractionMetadata, Step2Metadata, Step3Metadata, TimingEntryLike, WriteManifestMetadata, WriteStepKind } from '~/types'
import { isCostSource } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { buildMatchKey } from './manifest-log-formatting'

export { isRecord }

export const isStep2Metadata = (value: unknown): value is Step2Metadata =>
  isRecord(value)
  && typeof value['transcriptionService'] === 'string'
  && typeof value['transcriptionModel'] === 'string'

export const isExtractionMetadata = (value: unknown): value is ExtractionMetadata =>
  isRecord(value)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['processingTime'] === 'number'

export const isPartialExtractionMetadata = (value: unknown): value is PartialExtractionMetadata => {
  if (!isRecord(value)) {
    return false
  }
  const record: Record<string, unknown> = value
  if (!isExtractionMetadata(value)) {
    return false
  }
  return record['status'] === 'failed_partial'
    && typeof record['artifactDir'] === 'string'
    && typeof record['completedPages'] === 'number'
    && typeof record['failedPages'] === 'number'
}

export const isStep3Metadata = (value: unknown): value is Step3Metadata =>
  isRecord(value)
  && typeof value['llmService'] === 'string'
  && typeof value['llmModel'] === 'string'

const isCostEntry = (value: unknown): value is ManifestLogCostEntryLike =>
  isRecord(value)
  && typeof value['step'] === 'string'
  && typeof value['provider'] === 'string'
  && typeof value['model'] === 'string'
  && typeof value['cost'] === 'number'

const isTimingEntry = (value: unknown): value is TimingEntryLike =>
  isRecord(value)
  && typeof value['step'] === 'string'
  && typeof value['provider'] === 'string'
  && typeof value['model'] === 'string'
  && typeof value['processingTimeMs'] === 'number'

// Manifests written by this CLI always record one of the known vocabulary values.
// Anything else is left unset so the summary renders an empty source rather than
// asserting a cost provenance the manifest never claimed.
const readManifestCostSource = (value: unknown): CostSource | undefined =>
  isCostSource(value)
    ? value
    : undefined

export const toArray = <T,>(value: unknown, guard: (candidate: unknown) => candidate is T): T[] => {
  if (Array.isArray(value)) {
    return value.filter(guard)
  }

  return guard(value) ? [value] : []
}

export const getPartialStep2Entries = (metadata: WriteManifestMetadata): PartialExtractionMetadata[] =>
  toArray(metadata['partialStep2'], isPartialExtractionMetadata)

export const getEstimatedCostBreakdown = (metadata: WriteManifestMetadata): EstimatedCostBreakdown | undefined => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !isRecord(cost['estimated'])) {
    return undefined
  }

  const estimated = cost['estimated']
  const steps = Array.isArray(estimated['steps']) ? estimated['steps'].filter(isCostEntry) : []
  return typeof estimated['totalCost'] === 'number'
    ? { totalCost: estimated['totalCost'], steps }
    : undefined
}

export const getActualCostBreakdown = (metadata: WriteManifestMetadata): ManifestLogActualCostBreakdown | undefined => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !isRecord(cost['actual'])) {
    return undefined
  }

  const actual = cost['actual']
  const steps = Array.isArray(actual['steps'])
    ? actual['steps'].filter(isCostEntry).map(({ costSource: rawCostSource, ...entry }) => {
        const costSource = readManifestCostSource(rawCostSource)
        return {
          ...entry,
          ...(costSource ? { costSource } : {})
        }
      })
    : []
  return typeof actual['totalCost'] === 'number'
    ? { totalCost: actual['totalCost'], steps }
    : undefined
}

export const getTimingEntries = (
  metadata: WriteManifestMetadata,
  kind: 'estimated' | 'actual'
): TimingEntryLike[] => {
  const timing = metadata['timing']
  if (!isRecord(timing) || !isRecord(timing[kind])) {
    return []
  }

  const section = timing[kind]
  return Array.isArray(section['steps']) ? section['steps'].filter(isTimingEntry) : []
}

export const indexRows = <T extends { step: WriteStepKind, provider: string, model: string },>(
  rows: readonly T[]
): Map<string, T[]> => {
  const indexed = new Map<string, T[]>()

  for (const row of rows) {
    const key = buildMatchKey(row.step, row.provider, row.model)
    const existing = indexed.get(key) ?? []
    existing.push(row)
    indexed.set(key, existing)
  }

  return indexed
}
