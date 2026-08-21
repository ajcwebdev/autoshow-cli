import type { ProviderLaneAdmissionToken, ProviderLaneCompletionStatus, ProviderLaneIdentity, ProviderLanePressureFeedback } from '~/types'

const HOSTED_CONCURRENCY_MODES = ['ramp', 'immediate'] as const

export type HostedConcurrencyMode = typeof HOSTED_CONCURRENCY_MODES[number]

export type HostedConcurrencyWorkClass =
  | 'provider-target'
  | 'ocr-page'
  | 'stt-segment'
  | 'tts-chunk'
  | 'url'
  | 'llm'
  | 'image'
  | 'video'
  | 'music'
  | 'comic-llm'
  | 'comic-image'
  | 'comic-qa'
  | 'sound-effect'
  | (string & {})

export type HostedConcurrencyAdmission = Readonly<{
  provider: string
  accountLabel?: string | undefined
  lane?: ProviderLaneIdentity | undefined
  workClass: HostedConcurrencyWorkClass
  configuredLimit: number
  workId: string
  unitIndex: number
  context?: Readonly<Record<string, unknown>> | undefined
  abortSignal?: AbortSignal | undefined
}>

export type HostedConcurrencyAdmissionToken = ProviderLaneAdmissionToken<string, Readonly<Record<string, unknown>>> & Readonly<{
  workClass: HostedConcurrencyWorkClass
  configuredLimit: number
  admittedAtMs: number
  recoveryProbe: boolean
}>

type HostedConcurrencyRampTransitionReason =
  | 'startup-ramp'
  | 'recovery-ramp'
  | 'rate-limit'
  | 'registered-cap'

export type HostedConcurrencyRampTransition = Readonly<{
  atMs: number
  previousLimit: number
  nextLimit: number
  reason: HostedConcurrencyRampTransitionReason
}>

export type HostedConcurrencyPressureEvent = Readonly<{
  atMs: number
  workId: string
  unitIndex: number
  workClass: HostedConcurrencyWorkClass
  status?: number | undefined
  reason: string
  retryAfterMs?: number | undefined
  backoffMs: number
  previousLimit: number
  nextLimit: number
}>

export type HostedConcurrencyClassTelemetry = Readonly<{
  workClass: HostedConcurrencyWorkClass
  configuredLimit: number
  active: number
  activePeak: number
  queued: number
}>

export type HostedConcurrencyLaneTelemetry = Readonly<{
  lane: ProviderLaneIdentity
  configuredLimit: number
  currentLimit: number
  active: number
  activePeak: number
  queuedWork: number
  queuedPeak: number
  admitted: number
  completed: number
  failed: number
  canceled: number
  rampTransitions: readonly HostedConcurrencyRampTransition[]
  pressureEvents: readonly HostedConcurrencyPressureEvent[]
  pauseDurationMs: number
  recoveryProbes: number
  recoveryFailures: number
  classes: readonly HostedConcurrencyClassTelemetry[]
}>

export type HostedConcurrencyTelemetry = Readonly<{
  version: 1
  mode: HostedConcurrencyMode
  lanes: readonly HostedConcurrencyLaneTelemetry[]
}>

export type HostedConcurrencyPressureDecision = Readonly<{
  retry: boolean
  delayMs: number
  elapsedMs: number
  remainingBudgetMs: number
  pressureAttempt: number
  reason?: 'recovery-budget-exhausted' | undefined
}>

export type HostedConcurrencyCoordinator = {
  readonly mode: HostedConcurrencyMode
  acquire: (admission: HostedConcurrencyAdmission) => Promise<HostedConcurrencyAdmissionToken>
  release: (token: HostedConcurrencyAdmissionToken, status?: ProviderLaneCompletionStatus) => void
  run: <T>(admission: HostedConcurrencyAdmission, task: (token: HostedConcurrencyAdmissionToken) => Promise<T>) => Promise<T>
  reportRateLimit: (token: HostedConcurrencyAdmissionToken, feedback: ProviderLanePressureFeedback) => HostedConcurrencyPressureDecision
  snapshot: () => HostedConcurrencyTelemetry
  dispose: (reason?: unknown) => void
}

export type HostedConcurrencyCoordinatorOptions = Readonly<{
  mode?: HostedConcurrencyMode | undefined
  rampIntervalMs?: number | undefined
  recoveryBudgetMs?: number | undefined
  now?: (() => number) | undefined
  random?: (() => number) | undefined
  setTimer?: ((callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>) | undefined
  clearTimer?: ((timer: ReturnType<typeof setTimeout>) => void) | undefined
}>

export type HostedConcurrencyRequestOptions = Readonly<{
  coordinator: HostedConcurrencyCoordinator
  admission: HostedConcurrencyAdmission
  classifyPressure?: ((error: unknown) => ProviderLanePressureFeedback | undefined) | undefined
}>

export type ComicHostedScheduling = {
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  concurrency: number
}
