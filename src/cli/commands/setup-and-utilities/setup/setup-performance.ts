import { mkdir } from 'node:fs/promises'
import { cpus, release } from 'node:os'
import { join } from 'node:path'
import type {
  ActiveSetupPerformanceRun,
  BeginSetupPerformanceRunOptions,
  FinishSetupPerformanceRunOptions,
  FinishedSetupPerformanceRun,
  SetupPerformanceArtifact,
  SetupPerformanceOverlap,
  SetupPerformancePhase,
  SetupPerformancePhaseDetails,
  SetupPerformancePhaseRecord
} from '~/types'
import { RUNTIME_DIR } from '~/utils/runtime-paths'

let activeRun: ActiveSetupPerformanceRun | undefined
let runSequence = 0

const roundMs = (value: number): number => Math.round(value * 100) / 100

const createRunId = (startedAt: Date): string => {
  runSequence += 1
  return `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${runSequence}`
}

export const beginSetupPerformanceRun = (options: BeginSetupPerformanceRunOptions): void => {
  const startedAt = new Date()
  activeRun = {
    runId: createRunId(startedAt),
    startedAt,
    startedMonotonicMs: performance.now(),
    topology: options.topology,
    dependencyVersions: { ...options.dependencyVersions },
    artifactDirectory: options.artifactDirectory ?? join(RUNTIME_DIR, 'setup-performance'),
    phases: []
  }
}

export const recordSetupPerformancePhase = async <T>(
  component: string,
  phase: SetupPerformancePhase,
  run: () => Promise<T>,
  details?: SetupPerformancePhaseDetails
): Promise<T> => {
  const recorder = activeRun
  if (!recorder) return await run()

  const startedMonotonicMs = performance.now()
  let ok = false
  try {
    const value = await run()
    ok = true
    return value
  } finally {
    recorder.phases.push({
      component,
      phase,
      startedOffsetMs: roundMs(startedMonotonicMs - recorder.startedMonotonicMs),
      durationMs: roundMs(performance.now() - startedMonotonicMs),
      ok,
      ...(details ? { details: { ...details } } : {})
    })
  }
}

const computeCompileOverlaps = (phases: readonly SetupPerformancePhaseRecord[]): SetupPerformanceOverlap[] => {
  const compilePhases = phases.filter((phase) => phase.phase === 'compile-link')
  const overlaps: SetupPerformanceOverlap[] = []

  for (let firstIndex = 0; firstIndex < compilePhases.length; firstIndex++) {
    const first = compilePhases[firstIndex]!
    const firstEnd = first.startedOffsetMs + first.durationMs
    for (let secondIndex = firstIndex + 1; secondIndex < compilePhases.length; secondIndex++) {
      const second = compilePhases[secondIndex]!
      if (first.component === second.component) continue
      const secondEnd = second.startedOffsetMs + second.durationMs
      const overlapMs = Math.min(firstEnd, secondEnd) - Math.max(first.startedOffsetMs, second.startedOffsetMs)
      if (overlapMs <= 0) continue
      overlaps.push({
        firstComponent: first.component,
        secondComponent: second.component,
        overlapMs: roundMs(overlapMs)
      })
    }
  }

  return overlaps.sort((a, b) => b.overlapMs - a.overlapMs)
}

export const finishSetupPerformanceRun = async (
  options: FinishSetupPerformanceRunOptions
): Promise<FinishedSetupPerformanceRun | undefined> => {
  const recorder = activeRun
  activeRun = undefined
  if (!recorder) return undefined

  const finishedAt = new Date()
  const logicalCpuCount = Math.max(1, cpus().length)
  const artifact: SetupPerformanceArtifact = {
    schemaVersion: 1,
    runId: recorder.runId,
    startedAt: recorder.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    topology: recorder.topology,
    environment: {
      platform: process.platform,
      osRelease: release(),
      architecture: process.arch,
      logicalCpuCount,
      sourceBuildParallelJobs: Math.max(1, Math.min(logicalCpuCount, 8)),
      bunVersion: Bun.version,
      dependencyVersions: recorder.dependencyVersions
    },
    totalDurationMs: roundMs(performance.now() - recorder.startedMonotonicMs),
    healthy: options.healthy,
    phases: [...recorder.phases].sort((a, b) => a.startedOffsetMs - b.startedOffsetMs),
    compileOverlaps: computeCompileOverlaps(recorder.phases),
    stepTimings: options.stepTimings.map((timing) => ({ ...timing }))
  }

  await mkdir(recorder.artifactDirectory, { recursive: true })
  const artifactPath = join(recorder.artifactDirectory, `${recorder.runId}.json`)
  await Bun.write(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  return { artifact, artifactPath }
}

export const resetSetupPerformanceRunForTests = (): void => {
  activeRun = undefined
}
