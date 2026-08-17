import type { ManifestLogIndexedRow, SummaryBaseRow, SummarySection, WriteManifestMetadata, WriteRunSummaryRow } from '~/types'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { formatCost, formatDuration } from '~/utils/app-logger/formatters'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import {
  buildMatchKey,
  buildProviderModelLabel,
  formatPersistedWriteManifestThroughput,
  resolveWhisperModel
} from './manifest-log-formatting'
import {
  getActualCostBreakdown,
  getEstimatedCostBreakdown,
  getPartialStep2Entries,
  getTimingEntries,
  indexRows,
  isExtractionMetadata,
  isStep2Metadata,
  isStep3Metadata,
  isStep4Metadata,
  isStep5Metadata,
  isStep6Metadata,
  isStep7Metadata,
  toArray
} from './manifest-log-metadata'
import { SUMMARY_COLUMNS } from './write-manifest-log-columns'

const buildStep2SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] => {
  const extractionRows = toArray(metadata['step2'], isExtractionMetadata).map((entry) => {
    const { provider, model } = resolveExtractionProviderModel(entry)
    return {
      stepKey: 'extract' as const,
      step: 'Extract',
      provider,
      model,
      providerModel: buildProviderModelLabel(provider, model)
    }
  })
  const partialExtractionRows = getPartialStep2Entries(metadata).map((entry) => {
    const { provider, model } = resolveExtractionProviderModel(entry)
    return {
      stepKey: 'extract' as const,
      step: 'Extract (partial)',
      provider,
      model,
      providerModel: `${buildProviderModelLabel(provider, model)} (failed partial)`
    }
  })
  if (extractionRows.length > 0) {
    return [...extractionRows, ...partialExtractionRows]
  }

  const transcriptionRows = toArray(metadata['step2'], isStep2Metadata).map((entry) => {
    const provider = entry.transcriptionService
    const model = provider === 'whisper'
      ? resolveWhisperModel(entry.transcriptionModel)
      : entry.transcriptionModel
    return {
      stepKey: 'stt' as const,
      step: 'Transcribe',
      provider,
      model,
      providerModel: buildProviderModelLabel(provider, model)
    }
  })
  return [...transcriptionRows, ...partialExtractionRows]
}

const buildStep3SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step3'], isStep3Metadata).map((entry) => ({
    stepKey: 'llm' as const,
    step: 'LLM',
    provider: entry.llmService,
    model: entry.llmModel,
    providerModel: buildProviderModelLabel(entry.llmService, entry.llmModel)
  }))

const buildStep4SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step4'], isStep4Metadata).map((entry) => ({
    stepKey: 'tts' as const,
    step: 'TTS',
    provider: entry.ttsService,
    model: entry.ttsModel,
    providerModel: buildProviderModelLabel(entry.ttsService, entry.ttsModel)
  }))

const buildStep5SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step5'], isStep5Metadata).map((entry) => ({
    stepKey: 'image' as const,
    step: 'Image',
    provider: entry.imageService,
    model: entry.imageModel,
    providerModel: buildProviderModelLabel(entry.imageService, entry.imageModel)
  }))

const buildStep6SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step6'], isStep6Metadata).map((entry) => ({
    stepKey: 'video' as const,
    step: 'Video',
    provider: entry.videoGenService,
    model: entry.videoGenModel,
    providerModel: buildProviderModelLabel(entry.videoGenService, entry.videoGenModel)
  }))

const buildStep7SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step7'], isStep7Metadata).map((entry) => ({
    stepKey: 'music' as const,
    step: 'Music',
    provider: entry.musicService,
    model: entry.musicModel,
    providerModel: buildProviderModelLabel(entry.musicService, entry.musicModel)
  }))

const buildSummaryBaseRows = (metadata: WriteManifestMetadata): ManifestLogIndexedRow<SummaryBaseRow>[] => {
  const occurrenceByKey = new Map<string, number>()
  const orderedRows = [
    ...buildStep2SummaryRows(metadata),
    ...buildStep3SummaryRows(metadata),
    ...buildStep4SummaryRows(metadata),
    ...buildStep5SummaryRows(metadata),
    ...buildStep6SummaryRows(metadata),
    ...buildStep7SummaryRows(metadata)
  ]

  return orderedRows.map((row) => {
    const key = buildMatchKey(row.stepKey, row.provider, row.model)
    const occurrence = occurrenceByKey.get(key) ?? 0
    occurrenceByKey.set(key, occurrence + 1)
    return { key, occurrence, value: row }
  })
}

export const buildRunSummary = (metadata: WriteManifestMetadata): SummarySection | undefined => {
  const baseRows = buildSummaryBaseRows(metadata)
  if (baseRows.length === 0) {
    return undefined
  }

  const estimatedCostRows = indexRows(getEstimatedCostBreakdown(metadata)?.steps ?? [])
  const actualCostRows = indexRows(getActualCostBreakdown(metadata)?.steps ?? [])
  const estimatedTimingRows = indexRows(getTimingEntries(metadata, 'estimated'))
  const actualTimingRows = indexRows(getTimingEntries(metadata, 'actual'))

  const rows = baseRows.map(({ key, occurrence, value }) => {
    const predictedCost = estimatedCostRows.get(key)?.[occurrence]
    const actualCost = actualCostRows.get(key)?.[occurrence]
    const predictedTime = estimatedTimingRows.get(key)?.[occurrence]
    const actualTime = actualTimingRows.get(key)?.[occurrence]

    return {
      step: value.step,
      providerModel: value.providerModel,
      predictedCostCents: predictedCost?.cost ?? null,
      actualCostCents: actualCost?.cost ?? null,
      actualCostSource: actualCost?.costSource ?? null,
      predictedTimeMs: predictedTime?.processingTimeMs ?? null,
      actualTimeMs: actualTime?.processingTimeMs ?? null,
      predictedSpeed: formatPersistedWriteManifestThroughput(predictedTime?.throughputValue, predictedTime?.throughputUnit),
      actualSpeed: formatPersistedWriteManifestThroughput(actualTime?.throughputValue, actualTime?.throughputUnit),
      predictedInputMetric: predictedTime?.inputMetric ?? null,
      predictedInputValue: predictedTime?.inputValue ?? null,
      actualInputMetric: actualTime?.inputMetric ?? null,
      actualInputValue: actualTime?.inputValue ?? null
    } satisfies WriteRunSummaryRow
  })

  return {
    columns: SUMMARY_COLUMNS,
    rows,
    humanTable: createHumanTable(rows.map((row) => ({
      step: row.step,
      providerModel: row.providerModel,
      predCost: row.predictedCostCents === null ? '' : formatCost(row.predictedCostCents),
      actCost: row.actualCostCents === null ? '' : formatCost(row.actualCostCents),
      actSource: row.actualCostSource ?? '',
      predTime: row.predictedTimeMs === null ? '' : formatDuration(row.predictedTimeMs),
      actTime: row.actualTimeMs === null ? '' : formatDuration(row.actualTimeMs),
      predSpeed: row.predictedSpeed ?? '',
      actSpeed: row.actualSpeed ?? ''
    })), SUMMARY_COLUMNS)
  }
}
