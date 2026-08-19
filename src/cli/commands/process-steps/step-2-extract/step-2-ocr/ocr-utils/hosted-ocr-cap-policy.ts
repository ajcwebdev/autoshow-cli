import type {
  HostedOcrProfileEstimate,
  HostedOcrSchedulerAdmission,
  HostedOcrSchedulerCapSource,
  HostedOcrSchedulerLaneState,
  HostedOcrSchedulerProfileConfidence,
  HostedOcrSchedulerRetryEvent,
  HostedOcrSchedulerRetryPressure,
  HostedOcrService,
  OcrConcurrencyMode
} from '~/types'
import { createProviderLaneIdentity } from '~/cli/commands/process-steps/provider-lane-contract'
import {
  findHostedOcrThroughputProfile,
  resolveHostedOcrPageCountBand
} from './hosted-ocr-throughput-profiles'

export const HOSTED_OCR_AUTO_INITIAL_CAP = 10
export const HOSTED_OCR_AUTO_MAX_CAP_CEILING = 32
export const HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD = 200
export const HOSTED_OCR_PROFILE_MAX_CAP_CEILING = 48
export const HOSTED_OCR_DEFAULT_SCOPE_LABEL = 'env-api-key'
export const HOSTED_OCR_RETRY_EVENT_LIMIT = 50

const KIMI_PROFILE_HIGH_CAP_THRESHOLD = 13
const KIMI_PROFILE_HIGH_CAP_MIN_CLEAN_SAMPLES = 3

export type HostedOcrLaneCapResolution = {
  maxCap: number
  capSource: HostedOcrSchedulerCapSource
  sourceConfidence: HostedOcrSchedulerProfileConfidence
  profileSampleCount?: number | undefined
  profileRaisedMaxCap?: number | undefined
  profileDisqualificationReason?: string | undefined
}

export type HostedOcrRetryContext = {
  admission?: HostedOcrSchedulerAdmission | undefined
  targetKey?: string | undefined
}

const clamp = (min: number, max: number, value: number): number =>
  Math.min(max, Math.max(min, value))

export const normalizeHostedOcrPositiveInteger = (
  value: number | undefined,
  fallback: number
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.floor(value))
}

export const resolveHostedOcrAutoMaxCap = (pageCount: number): number => {
  const pages = normalizeHostedOcrPositiveInteger(pageCount, 1)
  return clamp(
    HOSTED_OCR_AUTO_INITIAL_CAP,
    HOSTED_OCR_AUTO_MAX_CAP_CEILING,
    Math.ceil(Math.sqrt(pages))
  )
}

export const resolveHostedOcrEstimateCap = (
  pageCount: number,
  mode: OcrConcurrencyMode,
  fixedCap?: number | undefined
): number => {
  if (mode === 'fixed') {
    return normalizeHostedOcrPositiveInteger(fixedCap, HOSTED_OCR_AUTO_INITIAL_CAP)
  }
  const maxCap = resolveHostedOcrAutoMaxCap(pageCount)
  if (
    normalizeHostedOcrPositiveInteger(pageCount, 1)
    >= HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD
  ) {
    return maxCap
  }
  return Math.max(
    HOSTED_OCR_AUTO_INITIAL_CAP,
    Math.round((HOSTED_OCR_AUTO_INITIAL_CAP + maxCap) / 2)
  )
}

export const resolveHostedOcrLaneKey = (
  service: HostedOcrService,
  scopeLabel = HOSTED_OCR_DEFAULT_SCOPE_LABEL
): string =>
  createProviderLaneIdentity(
    service,
    scopeLabel,
    HOSTED_OCR_DEFAULT_SCOPE_LABEL
  ).laneKey

const profileConfidenceRank = (
  confidence: HostedOcrSchedulerProfileConfidence
): number => {
  if (confidence === 'healthy') return 2
  if (confidence === 'sparse') return 1
  return 0
}

const cleanSampleCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0

const profileDisqualification = (
  estimate: HostedOcrProfileEstimate | undefined,
  exactProfileMatch: boolean,
  raisedMaxCap: number | undefined,
  baseMaxCap: number
): string | undefined => {
  if (
    typeof raisedMaxCap === 'number'
    && raisedMaxCap > baseMaxCap
    && estimate?.confidence === 'healthy'
  ) {
    return undefined
  }
  if (estimate?.profile.disqualificationReason) {
    return estimate.profile.disqualificationReason
  }
  if (!exactProfileMatch) return 'profile-not-exact-match'
  if (estimate?.confidence !== 'healthy') return 'profile-not-clean'
  if (typeof raisedMaxCap === 'number' && raisedMaxCap <= baseMaxCap) {
    return 'profile-cap-not-above-auto-cap'
  }
  return 'profile-missing-raised-cap'
}

const kimiProfileDisqualification = (
  admission: HostedOcrSchedulerAdmission,
  estimate: HostedOcrProfileEstimate | undefined,
  exactProfileMatch: boolean,
  raisedMaxCap: number | undefined
): string | undefined => {
  if (admission.service !== 'kimi' || !exactProfileMatch) return undefined
  if (
    (estimate?.profile.retryPressureCount ?? 0) > 0
    || (estimate?.profile.pauseTimeMs ?? 0) > 0
  ) {
    return 'kimi-profile-retry-pressure'
  }
  if (
    typeof raisedMaxCap === 'number'
    && raisedMaxCap >= KIMI_PROFILE_HIGH_CAP_THRESHOLD
    && cleanSampleCount(estimate?.profile.cleanSampleCount)
      < KIMI_PROFILE_HIGH_CAP_MIN_CLEAN_SAMPLES
  ) {
    return 'kimi-profile-needs-clean-samples'
  }
  return undefined
}

export const resolveHostedOcrLaneCaps = (input: {
  admission: HostedOcrSchedulerAdmission
  mode: OcrConcurrencyMode
  fixedCap?: number | undefined
  runPages: number
  scopeLabel: string
  laneTargetCount: number
  profileEstimate?: HostedOcrProfileEstimate | undefined
}): HostedOcrLaneCapResolution => {
  if (input.mode === 'fixed') {
    return {
      maxCap: input.fixedCap ?? HOSTED_OCR_AUTO_INITIAL_CAP,
      capSource: 'fixed',
      sourceConfidence: 'none'
    }
  }

  const runPages = Math.max(1, input.runPages)
  const profilePages = normalizeHostedOcrPositiveInteger(
    input.admission.documentPageCount,
    runPages
  )
  const baseMaxCap = resolveHostedOcrAutoMaxCap(runPages)
  const estimate = input.profileEstimate
  const profile = estimate?.profile
  const exactProfileMatch = profile !== undefined
    && profile.model === input.admission.model
    && profile.scopeClass === input.scopeLabel
    && profile.pageCountBand === resolveHostedOcrPageCountBand(profilePages)
    && (
      profile.laneTargetCount === undefined
      || profile.laneTargetCount === input.laneTargetCount
    )
  const raisedMaxCap =
    exactProfileMatch && typeof profile.raisedMaxCap === 'number'
      ? clamp(
          baseMaxCap,
          HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
          profile.raisedMaxCap
        )
      : undefined
  const kimiReason = kimiProfileDisqualification(
    input.admission,
    estimate,
    exactProfileMatch,
    raisedMaxCap
  )

  if (
    typeof raisedMaxCap === 'number'
    && raisedMaxCap > baseMaxCap
    && estimate?.confidence === 'healthy'
    && kimiReason === undefined
  ) {
    return {
      maxCap: raisedMaxCap,
      capSource: 'profile',
      sourceConfidence: estimate.confidence,
      profileSampleCount: estimate.profile.sampleCount,
      profileRaisedMaxCap: raisedMaxCap
    }
  }

  const disqualificationReason =
    kimiReason
    ?? profileDisqualification(
      estimate,
      exactProfileMatch,
      raisedMaxCap,
      baseMaxCap
    )
  return {
    maxCap: baseMaxCap,
    capSource: 'unprofiled',
    sourceConfidence: estimate?.confidence ?? 'none',
    ...(typeof estimate?.profile.sampleCount === 'number'
      ? { profileSampleCount: estimate.profile.sampleCount }
      : {}),
    ...(typeof disqualificationReason === 'string'
      ? { profileDisqualificationReason: disqualificationReason }
      : {})
  }
}

export const resolveHostedOcrLaneCapsFromProfiles = (input: {
  admission: HostedOcrSchedulerAdmission
  mode: OcrConcurrencyMode
  fixedCap?: number | undefined
  runPages: number
  scopeLabel: string
  laneTargetCount: number
  profilePath?: string | undefined
}): HostedOcrLaneCapResolution => {
  const profilePages = normalizeHostedOcrPositiveInteger(
    input.admission.documentPageCount,
    Math.max(1, input.runPages)
  )
  const profileEstimate = input.mode === 'auto'
    ? findHostedOcrThroughputProfile({
        provider: input.admission.service,
        model: input.admission.model,
        pageCount: profilePages,
        ocrConcurrencyMode: 'auto',
        scopeClass: input.scopeLabel,
        laneTargetCount: input.laneTargetCount,
        profilePath: input.profilePath
      })
    : undefined
  return resolveHostedOcrLaneCaps({ ...input, profileEstimate })
}

export const resolveHostedOcrInitialCaps = (input: {
  mode: OcrConcurrencyMode
  documentPages: number
  maxCap: number
  sharedHostedPolicy: boolean
  hostedConcurrencyMode: 'ramp' | 'immediate'
}): { initialCap: number, currentCap: number, maxCap: number } => {
  const resolvedInitialCap = input.mode === 'fixed'
    ? input.maxCap
    : input.documentPages >= HOSTED_OCR_LARGE_DOCUMENT_THRESHOLD
      ? resolveHostedOcrEstimateCap(input.documentPages, 'auto')
      : HOSTED_OCR_AUTO_INITIAL_CAP
  return {
    initialCap:
      input.sharedHostedPolicy && input.hostedConcurrencyMode === 'ramp'
        ? 1
        : resolvedInitialCap,
    currentCap: input.sharedHostedPolicy
      ? Math.max(resolvedInitialCap, input.maxCap)
      : resolvedInitialCap,
    maxCap: Math.max(resolvedInitialCap, input.maxCap)
  }
}

export const resolveHostedOcrLaneProfileRefresh = (
  lane: HostedOcrSchedulerLaneState,
  resolution: HostedOcrLaneCapResolution
): Partial<HostedOcrSchedulerLaneState> | undefined => {
  if (lane.mode === 'fixed') return undefined
  if (lane.service === 'kimi' && lane.retryPressureCount > 0) {
    return undefined
  }
  if (resolution.maxCap <= lane.maxCap) {
    if (
      lane.capSource !== 'profile'
      && profileConfidenceRank(resolution.sourceConfidence)
        >= profileConfidenceRank(lane.sourceConfidence)
    ) {
      return {
        sourceConfidence: resolution.sourceConfidence,
        profileSampleCount: resolution.profileSampleCount,
        profileDisqualificationReason:
          resolution.profileDisqualificationReason
      }
    }
    return undefined
  }
  return {
    maxCap: resolution.maxCap,
    capSource: resolution.capSource,
    sourceConfidence: resolution.sourceConfidence,
    profileSampleCount: resolution.profileSampleCount,
    profileRaisedMaxCap: resolution.profileRaisedMaxCap,
    profileDisqualificationReason:
      resolution.profileDisqualificationReason
  }
}

export const resolveHostedOcrSuccessRamp = (
  lane: HostedOcrSchedulerLaneState,
  completedPages: number
): Pick<HostedOcrSchedulerLaneState, 'cleanSuccessPages' | 'currentCap'> => {
  let cleanSuccessPages = lane.cleanSuccessPages + completedPages
  let currentCap = lane.currentCap
  while (currentCap < lane.maxCap) {
    const fastRamp =
      lane.cleanFastRampEnabled && lane.retryPressureCount === 0
    const cleanWindowPages = fastRamp
      ? Math.ceil(currentCap / 2)
      : currentCap
    if (cleanSuccessPages < cleanWindowPages) {
      return { cleanSuccessPages, currentCap }
    }
    cleanSuccessPages -= cleanWindowPages
    currentCap = Math.min(
      lane.maxCap,
      currentCap + (fastRamp ? 2 : 1)
    )
  }
  return { cleanSuccessPages, currentCap }
}

export const resolveHostedOcrBackoff = (
  lane: HostedOcrSchedulerLaneState
): Pick<
  HostedOcrSchedulerLaneState,
  'currentCap' | 'cleanSuccessPages' | 'cleanFastRampEnabled'
> => ({
  currentCap: Math.max(1, Math.floor(lane.currentCap / 2)),
  cleanSuccessPages: 0,
  cleanFastRampEnabled: false
})

export const resolveHostedOcrRetryPause = (
  pauseUntilMs: number,
  pressure: HostedOcrSchedulerRetryPressure,
  now: number
): { pauseUntilMs: number, addedPauseTimeMs: number } => {
  const delayMs = pressure.retryAfterMs ?? pressure.delayMs
  if (
    typeof delayMs !== 'number'
    || !Number.isFinite(delayMs)
    || delayMs <= 0
  ) {
    return { pauseUntilMs, addedPauseTimeMs: 0 }
  }
  const nextPauseUntilMs = now + Math.ceil(delayMs)
  const overlapStart = Math.max(now, pauseUntilMs)
  return {
    pauseUntilMs: Math.max(pauseUntilMs, nextPauseUntilMs),
    addedPauseTimeMs: Math.max(0, nextPauseUntilMs - overlapStart)
  }
}

export const isHostedOcrRateLimitPressure = (
  pressure: HostedOcrSchedulerRetryPressure
): boolean => {
  if (pressure.status === 429) return true
  const reason = pressure.reason.toLowerCase()
  return /rate[-\s]?limit|too many requests|provider concurrency/.test(reason)
    && !/billing|insufficient (?:balance|credit)|quota exhaust|authentication|unauthorized/.test(reason)
}

export const buildHostedOcrRetryEvent = (
  lane: HostedOcrSchedulerLaneState,
  pressure: HostedOcrSchedulerRetryPressure,
  context?: HostedOcrRetryContext | undefined
): HostedOcrSchedulerRetryEvent => {
  const delayMs = pressure.retryAfterMs ?? pressure.delayMs
  return {
    reason: pressure.reason,
    ...(context?.targetKey ? { targetKey: context.targetKey } : {}),
    ...(typeof context?.admission?.pageNumber === 'number'
      ? { pageNumber: context.admission.pageNumber }
      : {}),
    ...(typeof delayMs === 'number' ? { delayMs } : {}),
    ...(typeof pressure.status === 'number'
      ? { status: pressure.status }
      : {}),
    ...(typeof pressure.retryAfterMs === 'number'
      ? { retryAfterMs: pressure.retryAfterMs }
      : {}),
    effectiveCap: lane.currentCap
  }
}

export const resolveHostedOcrRetryEvents = (
  retryEvents: readonly HostedOcrSchedulerRetryEvent[],
  event: HostedOcrSchedulerRetryEvent
): HostedOcrSchedulerRetryEvent[] =>
  [...retryEvents, event].slice(-HOSTED_OCR_RETRY_EVENT_LIMIT)

const errorChain = function * (error: unknown): Generator<object> {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    yield current
    current = 'cause' in current
      ? current.cause
      : undefined
  }
}

export const getHostedOcrErrorStatus = (
  error: unknown
): number | undefined => {
  for (const current of errorChain(error)) {
    if (
      'status' in current
      && typeof current.status === 'number'
    ) {
      return current.status
    }
  }
  return undefined
}

export const isHostedOcrTimeoutError = (error: unknown): boolean => {
  for (const current of errorChain(error)) {
    if (current instanceof DOMException && current.name === 'TimeoutError') {
      return true
    }
    if (
      current instanceof Error
      && (
        current.name === 'TimeoutError'
        || /timeout|timed out/i.test(current.message)
      )
    ) {
      return true
    }
  }
  return false
}

export const shouldBackoffHostedOcrError = (error: unknown): boolean =>
  getHostedOcrErrorStatus(error) === 429

export const resolveKimiHostedOcrProfileAfterPressure = (
  lane: HostedOcrSchedulerLaneState,
  documentPages: number
): Partial<HostedOcrSchedulerLaneState> | undefined => {
  if (
    lane.service !== 'kimi'
    || lane.mode !== 'auto'
    || lane.capSource !== 'profile'
  ) {
    return undefined
  }
  const unprofiledCap = resolveHostedOcrAutoMaxCap(
    Math.max(1, documentPages)
  )
  if (lane.maxCap <= unprofiledCap) return undefined
  return {
    maxCap: unprofiledCap,
    capSource: 'unprofiled',
    profileDisqualificationReason: 'kimi-current-retry-pressure',
    profileRaisedMaxCap: undefined,
    currentCap: Math.min(lane.currentCap, unprofiledCap)
  }
}
