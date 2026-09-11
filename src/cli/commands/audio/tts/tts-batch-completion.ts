import type { CompletedTtsBatchItem, HostedTtsSchedulerTelemetry, PipelineItemRecord, PreparedTtsInput, PreparedTtsRun, Step4Metadata, SuccessfulTtsBatchItem, TtsBatchItemAccumulator, TtsTarget } from '~/types'
import { createPipelineItemFromRecord, updateManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { buildPipelineItemRecord } from '~/cli/commands/sources/metadata/metadata-batch/pipeline-item-record-builder'
import { sanitizeTitleSlug } from '~/cli/commands/sources/download/download-audio/metadata-utils'
import { logBatchCompletion, logBatchItemStatus } from '~/cli/commands/sources/download/download-targets/download-batch/download-batch-summary'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { serializeTtsMetadataEntries } from './script-to-audio/current-render-artifacts'
import { orderedTtsProviderStates, reduceTtsProviderStates, requestedTtsProviders } from './tts-single-run'
import { mergeActualCostBreakdowns, mergeEstimatedCostBreakdowns, mergeTimingBreakdowns } from './tts-batch-estimates'
import { computeSuccessfulTtsBatchActualCost } from './tts-batch-summary'
import { buildTtsBatchSource } from './tts-batch-plan'

export const buildTtsBatchInitialRecords = (
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[],
  accumulators: TtsBatchItemAccumulator[]
): PipelineItemRecord[] =>
  preparedInputs.map((prepared, index) => {
    const accumulator = accumulators[index]
    if (!accumulator) throw UsageError(`Missing TTS batch lifecycle accumulator for item ${index + 1}.`)
    const providerStates = orderedTtsProviderStates(targets, accumulator.providerStates)
    return {
      ...buildPipelineItemRecord(prepared.manifestInputPath),
      input: prepared.manifestInputPath,
      inputKind: 'text',
      characterCount: prepared.ttsCharacterCount,
      completionStatus: reduceTtsProviderStates(providerStates),
      requestedProviders: requestedTtsProviders(targets),
      providerStates
    }
  })

const getTargetOrderKey = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>
): string =>
  'service' in target
    ? `${target.service}\0${target.model}`
    : `${target.ttsService}\0${target.ttsModel}`

const sortTtsMetadataByTargetOrder = (
  metadata: Step4Metadata[],
  targets: TtsTarget[]
): Step4Metadata[] => {
  const orderByKey = new Map<string, number>()
  targets.forEach((target, index) => {
    const key = getTargetOrderKey(target)
    if (!orderByKey.has(key)) {
      orderByKey.set(key, index)
    }
  })
  return metadata.slice().sort((left, right) => {
    const leftOrder = orderByKey.get(getTargetOrderKey(left)) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = orderByKey.get(getTargetOrderKey(right)) ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })
}

const mergePreparedTtsRuns = (
  runs: PreparedTtsRun[],
  metadata: Step4Metadata[]
): PreparedTtsRun => ({
  metadata,
  cost: {
    estimated: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.estimated)),
    observedEstimate: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.observedEstimate)),
    actual: mergeActualCostBreakdowns(runs.map((run) => run.cost.actual))
  },
  timing: {
    estimated: mergeTimingBreakdowns(runs.map((run) => run.timing.estimated)),
    actual: mergeTimingBreakdowns(runs.map((run) => run.timing.actual))
  }
})

interface TtsBatchItemReport {
  level: 'error' | 'warn' | 'success'
  inputPath: string
  status: 'failed' | 'incomplete' | 'done'
  detail?: string
}

export interface TtsBatchCompletion {
  ok: number
  partial: number
  fail: number
  successfulItems: SuccessfulTtsBatchItem[]
  completedItems: CompletedTtsBatchItem[]
  finalRecords: PipelineItemRecord[]
  reports: TtsBatchItemReport[]
}

export const projectTtsBatchCompletion = (
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[],
  accumulators: TtsBatchItemAccumulator[]
): TtsBatchCompletion => {
  let ok = 0
  let partial = 0
  let fail = 0
  const successfulItems: SuccessfulTtsBatchItem[] = []
  const completedItems: CompletedTtsBatchItem[] = []
  const reports: TtsBatchItemReport[] = []
  const finalRecords = buildTtsBatchInitialRecords(preparedInputs, targets, accumulators)
  for (const accumulator of accumulators) {
    const metadata = sortTtsMetadataByTargetOrder(accumulator.metadata, targets)
    const errors = accumulator.errors.map((message) => ({ message }))
    if (metadata.length === 0) {
      fail++
      const failureMessage = accumulator.errors.join('; ') || 'No providers completed'
      finalRecords[accumulator.index] = {
        ...(finalRecords[accumulator.index] ?? {}),
        audioStem: accumulator.itemStem,
        completionStatus: 'failed',
        providerStates: orderedTtsProviderStates(targets, accumulator.providerStates),
        ...(errors.length > 0 ? { errors } : {})
      }
      reports.push({ level: 'error', inputPath: accumulator.inputPath, status: 'failed', detail: failureMessage })
      continue
    }

    const isPartial = metadata.length < targets.length || accumulator.errors.length > 0
    const run = mergePreparedTtsRuns(accumulator.runs, metadata)
    completedItems.push({
      index: accumulator.index,
      inputPath: accumulator.inputPath,
      itemStem: accumulator.itemStem,
      metadata,
      characterCount: accumulator.characterCount,
      run
    })
    successfulItems.push({
      metadata,
      characterCount: accumulator.characterCount
    })
    ok++
    if (isPartial) {
      partial++
      reports.push({ level: 'warn', inputPath: accumulator.inputPath, status: 'incomplete', detail: `${metadata.length}/${targets.length} providers completed` })
    } else {
      reports.push({ level: 'success', inputPath: accumulator.inputPath, status: 'done' })
    }
    finalRecords[accumulator.index] = {
      ...(finalRecords[accumulator.index] ?? {}),
      audioStem: accumulator.itemStem,
      completionStatus: isPartial ? 'incomplete' : 'full',
      tts: serializeTtsMetadataEntries(metadata),
      providerStates: orderedTtsProviderStates(targets, accumulator.providerStates),
      ...(errors.length > 0 ? { errors } : {})
    }
  }

  return { ok, partial, fail, successfulItems, completedItems, finalRecords, reports }
}

export const reportTtsBatchCompletionItems = (completion: TtsBatchCompletion): void => {
  for (const report of completion.reports) {
    logBatchItemStatus(report.level, report.inputPath, report.status, report.detail)
  }
}

export const publishTtsBatchCompletion = async (
  batchDir: string,
  batchSource: Record<string, unknown>,
  targets: TtsTarget[],
  completion: TtsBatchCompletion,
  actualBatchWallTimeMs: number,
  schedulerTelemetry: HostedTtsSchedulerTelemetry | undefined
): Promise<void> => {
  const { ok, partial, fail, successfulItems, completedItems, finalRecords } = completion
  const actualTotalCost = computeSuccessfulTtsBatchActualCost(successfulItems)
  const requestedProviders = targets.map((t) => ({ service: t.service, model: t.model }))

  const completedBatchSource = buildTtsBatchSource(
    completedItems.sort((a, b) => a.index - b.index),
    batchSource,
    {
      ok,
      partial,
      fail,
      wallTimeMs: actualBatchWallTimeMs,
      requestedProviders
    },
    schedulerTelemetry
  )
  await updateManifest(batchDir, (manifest) => {
    if (manifest.command !== 'tts' || manifest.scope !== 'batch' || manifest.items.length !== finalRecords.length) {
      throw UsageError('TTS batch completion can update only its complete canonical batch manifest.')
    }
    const items = finalRecords.map((record, index) => {
      const next = createPipelineItemFromRecord(batchDir, record)
      const current = manifest.items[index]
      if (!current || current.input !== next.input) {
        throw UsageError(`Canonical TTS batch item ${index + 1} changed identity before completion.`)
      }
      return next
    })
    return { ...manifest, source: completedBatchSource, items }
  })
  logBatchCompletion(ok, partial, 0, fail)
  l.report.complete(batchDir, {
    manifest: 'manifest.json',
    ...Object.fromEntries(
      completedItems.flatMap((item) =>
        item.metadata.flatMap((entry) => [
          [
            `audio-${item.itemStem}-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`,
            entry.audioFileName
          ],
          ...(entry.artifactDir
            ? [[
                `render-${item.itemStem}-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`,
                entry.artifactDir
              ]]
            : [])
        ])
      )
    )
  }, {
    totalTimeMs: actualBatchWallTimeMs,
    totalCost: actualTotalCost,
    steps: []
  })

}
