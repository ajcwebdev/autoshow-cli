export type SetupPerformancePhase =
  | 'archive-preparation'
  | 'configure-generate'
  | 'compile-link'
  | 'install-promote'
  | 'health-check'
  | 'cleanup'

export type SetupPerformancePhaseDetails = Record<string, string | number | boolean | null>

export type SetupPerformancePhaseRecord = {
  component: string
  phase: SetupPerformancePhase
  startedOffsetMs: number
  durationMs: number
  ok: boolean
  details?: SetupPerformancePhaseDetails
}

export type SetupPerformanceOverlap = {
  firstComponent: string
  secondComponent: string
  overlapMs: number
}

export type SetupPerformanceEnvironment = {
  platform: NodeJS.Platform
  osRelease: string
  architecture: string
  logicalCpuCount: number
  sourceBuildParallelJobs: number
  bunVersion: string
  dependencyVersions: Record<string, string>
}

export type SetupPerformanceStepTiming = {
  label: string
  durationMs: number
  ok: boolean
}

export type SetupPerformanceArtifact = {
  schemaVersion: 1
  runId: string
  startedAt: string
  finishedAt: string
  topology: string
  environment: SetupPerformanceEnvironment
  totalDurationMs: number
  healthy: boolean
  phases: SetupPerformancePhaseRecord[]
  compileOverlaps: SetupPerformanceOverlap[]
  stepTimings: SetupPerformanceStepTiming[]
}

export type BeginSetupPerformanceRunOptions = {
  topology: string
  dependencyVersions?: Record<string, string>
  artifactDirectory?: string
}

export type FinishSetupPerformanceRunOptions = {
  healthy: boolean
  stepTimings: readonly SetupPerformanceStepTiming[]
}

export type FinishedSetupPerformanceRun = {
  artifact: SetupPerformanceArtifact
  artifactPath: string
}
