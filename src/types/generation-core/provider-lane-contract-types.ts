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

export type ProviderLanePressureFeedback = Readonly<{
  reason: string
  delayMs?: number | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
}>
