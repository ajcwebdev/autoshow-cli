export type ProviderLaneIdentity<TService extends string = string> = Readonly<{
  service: TService
  scopeLabel: string
  laneKey: string
}>

export type ProviderLaneWorkContext = Readonly<object>

export type ProviderLaneAdmissionToken<
  TService extends string = string,
  TContext extends ProviderLaneWorkContext = ProviderLaneWorkContext
> = Readonly<{
  lane: ProviderLaneIdentity<TService>
  workId: string
  unitIndex: number
  context: TContext
}>

export type ProviderLaneCompletionStatus = 'succeeded' | 'failed' | 'canceled'

export type ProviderLaneCompletion<TAdmission extends ProviderLaneAdmissionToken = ProviderLaneAdmissionToken> = Readonly<{
  admission: TAdmission
  status: ProviderLaneCompletionStatus
}>

export type ProviderLanePressureFeedback = Readonly<{
  reason: string
  delayMs?: number | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
}>

export type ProviderLaneCancellation = Readonly<{
  kind: 'work' | 'lane' | 'run'
  reason: unknown
}>

export type ProviderLaneTelemetry = Readonly<{
  lane: ProviderLaneIdentity
  active: number
  maxActive: number
  admitted: number
  completed: number
  failed: number
  canceled: number
  retryPressureCount: number
}>
