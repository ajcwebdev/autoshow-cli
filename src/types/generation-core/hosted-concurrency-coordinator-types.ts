import type {
  HostedConcurrencyAdmission,
  HostedConcurrencyAdmissionToken,
  HostedConcurrencyPressureEvent,
  HostedConcurrencyRampTransition,
  HostedConcurrencyWorkClass,
  ProviderLaneIdentity
} from '~/types'

export type ClassState = {
  configuredLimit: number
  active: number
  activePeak: number
}

export type RecoveryState = {
  firstPressureAtMs: number
  pressureAttempt: number
}

export type Waiter = {
  admission: HostedConcurrencyAdmission
  lane: LaneState
  classState: ClassState
  queuedAtMs: number
  recoveryKey: string
  resolve: (token: HostedConcurrencyAdmissionToken) => void
  reject: (error: unknown) => void
  abortListener?: (() => void) | undefined
}

export type TokenState = {
  lane: LaneState
  classState: ClassState
  recoveryKey: string
  released: boolean
  pressureReported: boolean
  recoveryRetryApproved: boolean
  recoveryFailureRecorded: boolean
}

export type LaneState = {
  lane: ProviderLaneIdentity
  configuredLimit: number
  currentLimit: number
  active: number
  activePeak: number
  queuedPeak: number
  admitted: number
  completed: number
  failed: number
  canceled: number
  waiters: Waiter[]
  classes: Map<HostedConcurrencyWorkClass, ClassState>
  rampTransitions: HostedConcurrencyRampTransition[]
  pressureEvents: HostedConcurrencyPressureEvent[]
  recovering: boolean
  recoveryProbeActive: boolean
  rampingAfterRecovery: boolean
  pauseUntilMs: number
  pauseStartedAtMs?: number | undefined
  pauseDurationMs: number
  recoveryProbes: number
  recoveryFailures: number
  nextRampAtMs?: number | undefined
  wakeTimer?: ReturnType<typeof setTimeout> | undefined
  wakeAtMs?: number | undefined
}
