import type { HostedConcurrencyMode, HostedOcrSchedulerAdmission, HostedOcrSchedulerLaneState, HostedOcrService, OcrConcurrencyMode, ProviderLaneIdentity } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { createProviderLaneIdentity } from '~/cli/commands/command-shared/provider-lane-contract'
import { HOSTED_OCR_DEFAULT_SCOPE_LABEL, resolveHostedOcrInitialCaps, resolveHostedOcrLaneCapsFromProfiles, resolveHostedOcrLaneProfileRefresh } from './hosted-ocr-cap-policy'

export interface HostedOcrLaneRegistryPolicy {
  mode: OcrConcurrencyMode
  fixedCap: number | undefined
  documentPages: number
  profilePath: string | undefined
  sharedHostedPolicy: boolean
  hostedConcurrencyMode: HostedConcurrencyMode
}

export const resolveHostedOcrLaneIdentity = (
  admission: HostedOcrSchedulerAdmission
): ProviderLaneIdentity<HostedOcrService> => {
  if (admission.lane) {
    if (admission.lane.service !== admission.service) {
      throw InternalError(
        `Hosted OCR lane service ${admission.lane.service} does not match admission service ${admission.service}.`,
        { stage: 'ocr:scheduler', retryable: false }
      )
    }
    const identity = createProviderLaneIdentity(
      admission.service,
      admission.lane.scopeLabel,
      HOSTED_OCR_DEFAULT_SCOPE_LABEL
    )
    if (admission.lane.laneKey !== identity.laneKey) {
      throw InternalError(
        'Hosted OCR lane key does not match its service and scope label.',
        { stage: 'ocr:scheduler', retryable: false }
      )
    }
    return identity
  }
  const identity = createProviderLaneIdentity(
    admission.service,
    admission.scopeLabel,
    HOSTED_OCR_DEFAULT_SCOPE_LABEL
  )
  if (admission.laneKey && admission.laneKey !== identity.laneKey) {
    throw InternalError(
      'Hosted OCR lane key does not match its service and scope label.',
      { stage: 'ocr:scheduler', retryable: false }
    )
  }
  return identity
}

export const getOrCreateHostedOcrLane = (
  lanes: Map<string, HostedOcrSchedulerLaneState>,
  policy: HostedOcrLaneRegistryPolicy,
  admission: HostedOcrSchedulerAdmission,
  targetKey: string
): HostedOcrSchedulerLaneState => {
  const laneIdentity = resolveHostedOcrLaneIdentity(admission)
  const existing = lanes.get(laneIdentity.laneKey)
  if (existing) {
    const refresh = resolveHostedOcrLaneProfileRefresh(
      existing,
      resolveHostedOcrRegistryCaps(policy,
        admission,
        laneIdentity.scopeLabel,
        prospectiveHostedOcrLaneTargetCount(existing, targetKey)
      )
    )
    if (refresh) Object.assign(existing, refresh)
    return existing
  }

  const capResolution = resolveHostedOcrRegistryCaps(policy,
    admission,
    laneIdentity.scopeLabel,
    1
  )
  const caps = resolveHostedOcrInitialCaps({
    mode: policy.mode,
    documentPages: policy.documentPages,
    maxCap: capResolution.maxCap,
    sharedHostedPolicy: policy.sharedHostedPolicy,
    hostedConcurrencyMode: policy.hostedConcurrencyMode
  })
  const lane: HostedOcrSchedulerLaneState = {
    lane: laneIdentity,
    laneKey: laneIdentity.laneKey,
    service: admission.service,
    scopeLabel: laneIdentity.scopeLabel,
    mode: policy.mode,
    ...caps,
    capSource: capResolution.capSource,
    sourceConfidence: capResolution.sourceConfidence,
    ...(typeof capResolution.profileSampleCount === 'number'
      ? { profileSampleCount: capResolution.profileSampleCount }
      : {}),
    ...(typeof capResolution.profileRaisedMaxCap === 'number'
      ? { profileRaisedMaxCap: capResolution.profileRaisedMaxCap }
      : {}),
    ...(typeof capResolution.profileDisqualificationReason === 'string'
      ? {
          profileDisqualificationReason:
            capResolution.profileDisqualificationReason
        }
      : {}),
    active: 0,
    activePeak: 0,
    cleanSuccessPages: 0,
    cleanFastRampEnabled: true,
    retryPressureCount: 0,
    retryEvents: [],
    pauseUntilMs: 0,
    pauseTimeMs: 0,
    submittedPages: 0,
    completedPages: 0,
    failedPages: 0,
    targetOrder: [],
    roundRobinCursor: 0,
    queues: new Map(),
    targets: new Map(),
    documentTargets: new Map()
  }
  lanes.set(lane.laneKey, lane)
  return lane
}

export const prospectiveHostedOcrLaneTargetCount = (
  lane: HostedOcrSchedulerLaneState,
  targetKey: string
): number => {
  return Math.max(
    1,
    lane.targets.size + (lane.targets.has(targetKey) ? 0 : 1)
  )
}

export const resolveHostedOcrRegistryCaps = (
  policy: HostedOcrLaneRegistryPolicy,
  admission: HostedOcrSchedulerAdmission,
  scopeLabel: string,
  laneTargetCount: number
) => {
  return resolveHostedOcrLaneCapsFromProfiles({
    admission,
    mode: policy.mode,
    fixedCap: policy.fixedCap,
    runPages: policy.documentPages,
    scopeLabel,
    laneTargetCount,
    profilePath: policy.profilePath
  })
}
