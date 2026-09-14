export type CiRunStepPayload = {
  name: string
  number?: number
  status?: string
  conclusion?: string | null
  startedAt?: string | null
  completedAt?: string | null
}

export type CiRunJobPayload = {
  name: string
  databaseId?: number
  url?: string
  status?: string
  conclusion?: string | null
  startedAt?: string | null
  completedAt?: string | null
  steps?: CiRunStepPayload[]
}

export type CiRunPayload = {
  jobs?: CiRunJobPayload[]
  conclusion?: string
  createdAt?: string
  updatedAt?: string
  event?: string
  headBranch?: string
  headSha?: string
  url?: string
  workflowName?: string
  displayTitle?: string
}

export type CiRunStepTiming = {
  name: string
  durationMs: number
  shareOfJob: number
}

export type CiRunJobTiming = {
  name: string
  startOffsetMs: number
  durationMs: number
  conclusion: string
  steps: CiRunStepTiming[]
}

export type CiRunCriticalPathEntry = {
  job: string
  durationMs: number
}

export type CiRunTimingsSummary = {
  run: {
    id?: string
    url: string
    event: string
    branch: string
    sha: string
    wallMs: number
  }
  jobs: CiRunJobTiming[]
  criticalPath: CiRunCriticalPathEntry[]
}

export type CiPriceCommandTiming = {
  command: string
  durationMs: number
  exitCode: number | null
}

export type CiPriceMetricsSummary = {
  count: number
  totalMs: number
  p50Ms: number
  p90Ms: number
  maxMs: number
  slowest: CiPriceCommandTiming[]
}
