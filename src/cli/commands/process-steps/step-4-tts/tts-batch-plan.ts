import { mkdtemp, rename } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { CompletedTtsBatchItem, HostedTtsSchedulerTelemetry, PreparedTtsInput, Step4Metadata, TtsBatchItemAccumulator, TtsBatchPlanItem, TtsTarget } from '~/types'
import { mergeActualCostBreakdowns, mergeEstimatedCostBreakdowns, mergeTimingBreakdowns } from './tts-batch-estimates'
import { getTtsArtifactFileName } from './tts-targets'

export const getInputStem = (inputPath: string): string =>
  basename(inputPath, extname(inputPath)) || 'tts'

export const buildTtsBatchItemStem = (inputPath: string, fallbackLabel: string): string => {
  const slug = sanitizeTitleSlug(getInputStem(inputPath), 180)
  return slug.length > 0 ? slug : fallbackLabel
}

export const getTtsBatchAudioFileName = (
  itemStem: string,
  metadata: Pick<Step4Metadata, 'ttsService' | 'ttsModel' | 'audioFileName'>,
  singleTarget: boolean
): string => {
  const extension = extname(metadata.audioFileName) || '.wav'
  if (singleTarget) {
    return `${itemStem}${extension}`
  }

  const providerArtifact = getTtsArtifactFileName(metadata, false)
  return providerArtifact.startsWith('speech')
    ? `${itemStem}${providerArtifact.slice('speech'.length)}`
    : `${itemStem}-${metadata.ttsService}-${sanitizeTitleSlug(metadata.ttsModel, 120)}${extension}`
}

export const targetOutputFileNamesForStem = (
  itemStem: string,
  targets: TtsTarget[]
): string[] => targets.map((target) =>
  getTtsBatchAudioFileName(
    itemStem,
    {
      ttsService: target.service,
      ttsModel: target.model,
      audioFileName: getTtsArtifactFileName(target, targets.length === 1)
    },
    targets.length === 1
  )
)

export const reserveTtsBatchItemStem = async (
  batchDir: string,
  preferredStem: string,
  targets: TtsTarget[],
  usedStems: Set<string>
): Promise<string> => {
  for (let counter = 1; ; counter += 1) {
    const candidateStem = counter === 1 ? preferredStem : `${preferredStem}-${counter}`
    if (usedStems.has(candidateStem)) {
      continue
    }

    usedStems.add(candidateStem)
    const candidateFileNames = targetOutputFileNamesForStem(candidateStem, targets)
    const hasExistingFile = (await Promise.all(
      candidateFileNames.map(async (fileName) => await Bun.file(join(batchDir, fileName)).exists())
    )).some((exists) => exists)
    if (hasExistingFile) {
      usedStems.delete(candidateStem)
      continue
    }

    return candidateStem
  }
}

export const moveTtsBatchAudioFiles = async (
  workspaceDir: string,
  batchDir: string,
  itemStem: string,
  metadata: Step4Metadata[],
  singleTarget: boolean
): Promise<Step4Metadata[]> => {
  const moved: Step4Metadata[] = []

  for (const entry of metadata) {
    const fileName = getTtsBatchAudioFileName(itemStem, entry, singleTarget)
    const sourcePath = join(workspaceDir, entry.audioFileName)
    const finalPath = join(batchDir, fileName)
    await rename(sourcePath, finalPath)
    moved.push({
      ...entry,
      audioFileName: fileName,
      audioFileSize: Bun.file(finalPath).size
    })
  }

  return moved
}

export const buildTtsBatchSource = (
  items: CompletedTtsBatchItem[],
  batchSource: Record<string, unknown>,
  batchSummary: {
    ok: number
    partial: number
    fail: number
    wallTimeMs: number
    requestedProviders: Array<{ service: string, model: string }>
  },
  schedulerTelemetry?: HostedTtsSchedulerTelemetry | undefined
): Record<string, unknown> => {
  const runs = items.map((item) => item.run)

  return {
    ...batchSource,
    summary: {
      ok: batchSummary.ok,
      partial: batchSummary.partial,
      fail: batchSummary.fail,
      processingTime: batchSummary.wallTimeMs,
      cost: {
        estimated: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.estimated)),
        observedEstimate: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.observedEstimate)),
        actual: mergeActualCostBreakdowns(runs.map((run) => run.cost.actual))
      },
      timing: {
        estimated: mergeTimingBreakdowns(runs.map((run) => run.timing.estimated)),
        actual: mergeTimingBreakdowns(runs.map((run) => run.timing.actual))
      },
      requestedProviders: batchSummary.requestedProviders,
      ...(schedulerTelemetry ? { hostedTtsScheduler: schedulerTelemetry } : {})
    }
  }
}

export const createTtsBatchPlanItems = async (
  batchDir: string,
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[]
): Promise<TtsBatchPlanItem[]> => {
  const usedItemStems = new Set<string>()
  const plans: TtsBatchPlanItem[] = []

  for (let index = 0; index < preparedInputs.length; index++) {
    const prepared = preparedInputs[index] as PreparedTtsInput
    const itemStem = await reserveTtsBatchItemStem(
      batchDir,
      buildTtsBatchItemStem(prepared.inputPath, `item-${index + 1}`),
      targets,
      usedItemStems
    )
    plans.push({
      index,
      prepared,
      itemStem,
      workspaceDir: await mkdtemp(join(batchDir, `.tts-${itemStem}-`))
    })
  }

  return plans
}

export const createTtsBatchAccumulators = (
  plans: TtsBatchPlanItem[]
): TtsBatchItemAccumulator[] =>
  plans.map((plan) => ({
    index: plan.index,
    inputPath: plan.prepared.inputPath,
    itemStem: plan.itemStem,
    characterCount: plan.prepared.ttsCharacterCount,
    metadata: [],
    runs: [],
    errors: [],
    providerStates: new Map()
  }))
