import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { getTtsEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { splitTextIntoChunks } from './tts-utils/audio-utils'
import { resolveTtsChunkCharacterLimit } from './tts-utils/tts-chunking'
import type { AggregatedPriceEstimate, HostedEstimateJob, PreparedTtsInput, SuccessfulTtsBatchItem, TtsBatchEstimateOptions, TtsBatchEstimateSummary, TtsTarget } from '~/types'
const normalizePositiveInteger = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : 1

const simulateBatchWorkerPool = (
  itemProcessingTimesMs: number[],
  batchConcurrency: number
): number => {
  if (itemProcessingTimesMs.length === 0) {
    return 0
  }

  const workerCount = Math.min(normalizePositiveInteger(batchConcurrency), itemProcessingTimesMs.length)
  const workerLoads = Array.from({ length: workerCount }, () => 0)

  for (const itemTimeMs of itemProcessingTimesMs) {
    let nextWorkerIndex = 0
    for (let index = 1; index < workerLoads.length; index++) {
      if ((workerLoads[index] ?? 0) < (workerLoads[nextWorkerIndex] ?? 0)) {
        nextWorkerIndex = index
      }
    }
    workerLoads[nextWorkerIndex] = (workerLoads[nextWorkerIndex] ?? 0) + Math.max(0, Math.round(itemTimeMs))
  }

  return Math.max(...workerLoads)
}

const getSyntheticChunkLengths = (
  characterCount: number,
  maxChars: number
): number[] => {
  const lengths: number[] = []
  let remaining = Math.max(0, Math.floor(characterCount))
  const normalizedMaxChars = Math.max(1, Math.floor(maxChars))
  while (remaining > normalizedMaxChars) {
    lengths.push(normalizedMaxChars)
    remaining -= normalizedMaxChars
  }
  if (remaining > 0) {
    lengths.push(remaining)
  }
  return lengths
}

const getChunkLengths = (
  prepared: PreparedTtsInput,
  target: TtsTarget
): number[] => {
  const maxChars = target.chunkCharacterLimit ?? resolveTtsChunkCharacterLimit(target.service, target.model)
  if (maxChars === undefined) {
    return [prepared.ttsCharacterCount]
  }
  if (prepared.ttsTimingInputText.trim().length > 0) {
    return splitTextIntoChunks(prepared.ttsTimingInputText, maxChars).map((chunk) => chunk.length)
  }
  return getSyntheticChunkLengths(prepared.ttsCharacterCount, maxChars)
}

const createHostedEstimateJobs = (
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[]
): HostedEstimateJob[] => {
  const jobs: HostedEstimateJob[] = []
  let originalOrder = 0
  for (const [inputIndex, prepared] of preparedInputs.entries()) {
    for (const [targetIndex, target] of targets.entries()) {
      const estimation = getTtsEstimation(target.service, target.model)
      jobs.push({
        provider: target.service,
        durationsMs: getChunkLengths(prepared, target).map((length) =>
          Math.max(0, (length / 1000) * estimation.msPer1KChars)
        ),
        active: 0,
        started: 0,
        completed: 0,
        dispatchDebt: 0,
        lastDispatchSequence: 0,
        originalOrder: inputIndex * targets.length + targetIndex + originalOrder / 1_000_000
      })
      originalOrder += 1
    }
  }
  return jobs
}

const simulateHostedProviderLane = (
  jobs: HostedEstimateJob[],
  ttsChunkConcurrency: number
): number => {
  if (jobs.length === 0) {
    return 0
  }

  const cap = normalizePositiveInteger(ttsChunkConcurrency)
  let now = 0
  let dispatchSequence = 0
  let active: Array<{ job: HostedEstimateJob, finishAt: number }> = []

  const hasRemaining = (job: HostedEstimateJob): boolean => job.started < job.durationsMs.length
  const selectJob = (): HostedEstimateJob | undefined => {
    const runnable = jobs.filter(hasRemaining)
    if (runnable.length === 0) return undefined
    const selected = runnable.slice().sort((left, right) => left.originalOrder - right.originalOrder)[0]
    if (!selected) return undefined
    dispatchSequence += 1
    selected.dispatchDebt = 0
    selected.lastDispatchSequence = dispatchSequence
    return selected
  }

  while (jobs.some((job) => job.completed < job.durationsMs.length) || active.length > 0) {
    while (active.length < cap) {
      const job = selectJob()
      if (!job) break
      const durationMs = job.durationsMs[job.started] ?? 0
      job.started += 1
      job.active += 1
      active.push({ job, finishAt: now + durationMs })
    }

    if (active.length === 0) {
      break
    }

    const nextFinishAt = Math.min(...active.map((entry) => entry.finishAt))
    now = nextFinishAt
    const completed = active.filter((entry) => entry.finishAt <= nextFinishAt)
    active = active.filter((entry) => entry.finishAt > nextFinishAt)
    for (const entry of completed) {
      entry.job.active = Math.max(0, entry.job.active - 1)
      entry.job.completed += 1
    }
  }

  return Math.round(now)
}

const simulateHostedTtsProviderQueues = (
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[],
  ttsChunkConcurrency: number
): number | undefined => {
  const jobs = createHostedEstimateJobs(preparedInputs, targets)
  if (jobs.length === 0) {
    return undefined
  }

  const providers = new Set(jobs.map((job) => job.provider))
  return Math.max(
    ...[...providers].map((provider) =>
      simulateHostedProviderLane(
        jobs
          .filter((job) => job.provider === provider)
          .map((job) => ({ ...job, durationsMs: job.durationsMs.slice() })),
        ttsChunkConcurrency
      )
    )
  )
}

export const buildTtsBatchEstimateSummary = (
  estimates: AggregatedPriceEstimate[],
  batchConcurrency: number,
  ttsChunkConcurrency: number | undefined,
  options: TtsBatchEstimateOptions = {}
): TtsBatchEstimateSummary => {
  const itemProcessingTimesMs = estimates.map((estimate) => estimate.timing?.totalProcessingTimeMs ?? 0)
  const normalizedChunkConcurrency = normalizePositiveInteger(ttsChunkConcurrency)
  const hostedWallTimeMs = options.preparedInputs && options.targets
    ? simulateHostedTtsProviderQueues(options.preparedInputs, options.targets, normalizedChunkConcurrency)
    : undefined

  return {
    inputCount: estimates.length,
    batchConcurrency: normalizePositiveInteger(batchConcurrency),
    ttsChunkConcurrency: normalizedChunkConcurrency,
    totalEstimatedProcessingTimeMs: itemProcessingTimesMs.reduce((sum, itemTimeMs) => sum + itemTimeMs, 0),
    estimatedWallTimeMs: hostedWallTimeMs ?? simulateBatchWorkerPool(itemProcessingTimesMs, batchConcurrency),
    totalEstimatedCost: estimates.reduce((sum, estimate) => sum + estimate.totalEstimatedCost, 0)
  }
}

export const computeSuccessfulTtsBatchActualCost = (
  items: SuccessfulTtsBatchItem[]
): number =>
  items.reduce((sum, item) =>
    sum + computeActualCosts({
      step4: item.metadata,
      ttsCharacterCount: item.characterCount
    }).totalCost
  , 0)
