export type AdaptiveProviderGroup =
  | `transcribe/${string}`
  | `extract/${string}`
  | `url/${string}`
  | `write/${string}`
  | `tts/${string}`
  | `image/${string}`
  | `video/${string}`
  | `music/${string}`

export type AdaptiveProviderGroupKind = AdaptiveProviderGroup extends `${infer Kind}/${string}` ? Kind : never

export type AdaptiveProviderFlagValue = {
  flag: string
  value: string | null
}

export type AdaptivePressureKind = 'rate-limit' | 'timeout' | 'transient'

export type AdaptiveConcurrencyConfig = {
  stateDir: string
  initialProviderLimit: number
  groupInitialLimits: Record<string, number>
  rateLimitCooldownMs: number
  transientCooldownMs: number
  successStreakToIncrease: number
  acquirePollMs: number
  lockWaitMs: number
  lockStaleMs: number
}

export type AdaptiveCommandAttemptRecord = {
  attempt: number
  exitCode: number
  pressure: AdaptivePressureKind
  groups: AdaptiveProviderGroup[]
}

export type AdaptiveLeaseState = {
  pid: number
  acquiredAtMs: number
  expiresAtMs: number
  command: string
}

export type AdaptiveGroupState = {
  limit: number
  maxLimit: number
  cooldownUntilMs: number
  successStreak: number
  failureStreak: number
  leases: Record<string, AdaptiveLeaseState>
}

export type AdaptiveSchedulerState = {
  schemaVersion: 1
  updatedAt: string
  groups: Record<string, AdaptiveGroupState>
}

export type AdaptiveConcurrencySnapshot = {
  groups: Record<string, {
    limit: number
    maxLimit: number
    active: number
    cooldownUntilMs: number
    successStreak: number
    failureStreak: number
  }>
}

export type AdaptiveLease = {
  id: string
  groups: AdaptiveProviderGroup[]
  release: () => Promise<void>
}

export type SimpleMediaCommand = 'tts' | 'image' | 'video' | 'music'
