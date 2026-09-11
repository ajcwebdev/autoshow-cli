import type { HostedConcurrencyCoordinator, HostedTtsChunkJob, HostedTtsChunkSchedulerSnapshot, HostedTtsMetricSummary, HostedTtsProviderChunkState, HostedTtsSchedulerJobSummary, HostedTtsSchedulerProviderSummary, HostedTtsSchedulerTelemetry } from '~/types'
import { hasRemainingHostedTtsChunks } from './hosted-tts-job-lifecycle'

const emptyMetricSummary = (): HostedTtsMetricSummary => ({
  totalMs: 0,
  maxMs: 0,
  p50Ms: 0,
  p95Ms: 0
})

const percentile = (sortedSamples: readonly number[], percentileValue: number): number => {
  if (sortedSamples.length === 0) {
    return 0
  }
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedSamples.length) - 1)
  )
  return Math.round(sortedSamples[index] ?? 0)
}

const summarizeMetric = (samples: readonly number[]): HostedTtsMetricSummary => {
  if (samples.length === 0) {
    return emptyMetricSummary()
  }
  const sorted = samples.map((value) => Math.max(0, Math.round(value))).sort((a, b) => a - b)
  return {
    totalMs: sorted.reduce((sum, value) => sum + value, 0),
    maxMs: sorted[sorted.length - 1] ?? 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95)
  }
}

export const projectHostedTtsProviderSnapshot = (state: HostedTtsProviderChunkState, coordinator: HostedConcurrencyCoordinator, sharedHostedPolicy: boolean): HostedTtsChunkSchedulerSnapshot => {
  const hostedLane = sharedHostedPolicy
    ? coordinator.snapshot().lanes.find((lane) => lane.lane.laneKey === state.lane.laneKey)
    : undefined
  const hostedClass = hostedLane?.classes.find((entry) => entry.workClass === 'tts-chunk')
  return {
    provider: state.provider,
    lane: state.lane,
    scopeLabel: state.lane.scopeLabel,
    laneKey: state.lane.laneKey,
    maxLimit: state.maxLimit,
    currentLimit: state.currentLimit,
    active: hostedClass?.active ?? state.active,
    queued: (hostedClass?.queued ?? 0) + state.jobs.reduce(
      (sum, job) => hasRemainingHostedTtsChunks(job)
        ? sum + Math.max(0, job.chunks.length - job.nextChunkIndex)
        : sum,
      0
    ),
    pauseUntilMs: state.pauseUntilMs,
    successStreak: state.successStreak
  }
}

export const projectHostedTtsSchedulerTelemetry = (states: Iterable<HostedTtsProviderChunkState>, coordinator: HostedConcurrencyCoordinator, sharedHostedPolicy: boolean): HostedTtsSchedulerTelemetry => {
  const providers: HostedTtsSchedulerProviderSummary[] = []
  const jobs: HostedTtsSchedulerJobSummary[] = []

  for (const state of states) {
    const hostedLane = sharedHostedPolicy
      ? coordinator.snapshot().lanes.find((lane) => lane.lane.laneKey === state.lane.laneKey)
      : undefined
    const hostedClass = hostedLane?.classes.find((entry) => entry.workClass === 'tts-chunk')
    providers.push({
      provider: state.provider,
      lane: state.lane,
      scopeLabel: state.lane.scopeLabel,
      laneKey: state.lane.laneKey,
      maxLimit: state.maxLimit,
      currentLimit: hostedLane?.currentLimit ?? state.currentLimit,
      startedChunks: state.stats.startedChunks,
      completedChunks: state.stats.completedChunks,
      failedChunks: state.stats.failedChunks,
      retryCount: state.stats.retryCount,
      rateLimitCount: state.stats.rateLimitCount,
      maxActive: hostedClass?.activePeak ?? state.stats.maxActive,
      queueWait: summarizeMetric(state.stats.queueWaitSamplesMs),
      activeLatency: summarizeMetric(state.stats.activeLatencySamplesMs),
      pauseTimeMs: hostedLane?.pauseDurationMs ?? Math.round(state.stats.pauseTimeMs),
      limitChanges: hostedLane
        ? hostedLane.rampTransitions.map((transition) => ({
            atMs: transition.atMs,
            provider: state.provider,
            laneKey: state.lane.laneKey,
            previousLimit: transition.previousLimit,
            nextLimit: transition.nextLimit,
            reason: transition.reason
          }))
        : state.stats.limitChanges.slice()
    })

    for (const job of state.allJobs) {
      jobs.push(summarizeHostedTtsJob(job))
    }
  }

  return {
    providers: providers.sort((a, b) => (a.laneKey ?? a.provider).localeCompare(b.laneKey ?? b.provider)),
    jobs: jobs.sort((a, b) => (a.originalOrder ?? 0) - (b.originalOrder ?? 0)),
    ...(sharedHostedPolicy ? { hostedConcurrency: coordinator.snapshot() } : {})
  }
}

const summarizeHostedTtsJob = (job: HostedTtsChunkJob): HostedTtsSchedulerJobSummary => {
  return {
    provider: job.provider,
    scopeLabel: job.lane.scopeLabel,
    laneKey: job.lane.laneKey,
    chunkCount: job.chunks.length,
    startedChunks: job.startedChunks,
    completedChunks: job.completedChunks,
    failedChunks: job.failedChunks,
    retryCount: job.retryCount,
    rateLimitCount: job.rateLimitCount,
    queueWait: summarizeMetric(job.queueWaitSamplesMs),
    activeLatency: summarizeMetric(job.activeLatencySamplesMs),
    ...(job.jobId ? { jobId: job.jobId } : {}),
    ...(job.label ? { label: job.label } : {}),
    ...(typeof job.inputIndex === 'number' ? { inputIndex: job.inputIndex } : {}),
    ...(typeof job.targetIndex === 'number' ? { targetIndex: job.targetIndex } : {}),
    ...(typeof job.turnIndex === 'number' ? { turnIndex: job.turnIndex } : {}),
    ...(typeof job.segmentIndex === 'number' ? { segmentIndex: job.segmentIndex } : {}),
    ...(typeof job.originalOrder === 'number' ? { originalOrder: job.originalOrder } : {})
  }
}
