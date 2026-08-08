import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { HostedOcrProfileDisqualificationReason, HostedOcrProfileEstimate, HostedOcrSchedulerTelemetry, HostedOcrThroughputProfile, HostedOcrThroughputProfileStore, OcrConcurrencyMode, PersistHostedOcrProfilesOptions } from '~/types'
import { withProcessLock } from '~/utils/process-lock'

const PROFILE_STORE_VERSION = 2
const MAX_PROFILE_ENTRIES = 500
const MAX_PROFILE_SAMPLES = 100
const HOSTED_OCR_PROFILE_MAX_CAP_CEILING = 48
const PROFILE_LOCK_NAME = 'ocr-throughput-profiles-v1'

export const resolveHostedOcrThroughputProfilePath = (): string =>
  join(homedir(), '.cache', 'autoshow-cli', 'ocr-throughput-profiles-v1.json')

export const resolveHostedOcrPageCountBand = (pageCount: number): string => {
  const pages = Number.isFinite(pageCount) ? Math.max(1, Math.floor(pageCount)) : 1
  if (pages === 1) return '1'
  if (pages <= 10) return '2-10'
  if (pages <= 50) return '11-50'
  if (pages <= 200) return '51-200'
  if (pages <= 1000) return '201-1000'
  return '1001+'
}

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseProfile = (value: unknown): HostedOcrThroughputProfile | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  if (
    typeof value['provider'] !== 'string'
    || typeof value['model'] !== 'string'
    || typeof value['scopeClass'] !== 'string'
    || typeof value['pageCountBand'] !== 'string'
    || (value['ocrConcurrencyMode'] !== 'auto' && value['ocrConcurrencyMode'] !== 'fixed')
    || typeof value['throughputPagesPerMinute'] !== 'number'
    || typeof value['activePeak'] !== 'number'
    || typeof value['retryPressureCount'] !== 'number'
    || typeof value['pauseTimeMs'] !== 'number'
    || (value['completionStatus'] !== 'full' && value['completionStatus'] !== 'incomplete' && value['completionStatus'] !== 'failed')
    || typeof value['firstSeenAt'] !== 'string'
    || typeof value['lastSeenAt'] !== 'string'
    || typeof value['sampleCount'] !== 'number'
  ) {
    return undefined
  }

  const sampleCount = Math.max(1, Math.floor(value['sampleCount']))
  const retryPressureCount = Math.max(0, Math.floor(value['retryPressureCount']))
  const pauseTimeMs = Math.max(0, Math.floor(value['pauseTimeMs']))
  const cleanSampleCount = typeof value['cleanSampleCount'] === 'number'
    ? Math.max(0, Math.floor(value['cleanSampleCount']))
    : value['completionStatus'] === 'full' && retryPressureCount === 0 && pauseTimeMs === 0
      ? sampleCount
      : 0

  return {
    provider: value['provider'],
    model: value['model'],
    scopeClass: value['scopeClass'],
    pageCountBand: value['pageCountBand'],
    ocrConcurrencyMode: value['ocrConcurrencyMode'],
    ...(typeof value['laneTargetCount'] === 'number'
      ? { laneTargetCount: Math.max(1, Math.floor(value['laneTargetCount'])) }
      : {}),
    throughputPagesPerMinute: Math.max(0, value['throughputPagesPerMinute']),
    activePeak: Math.max(0, Math.floor(value['activePeak'])),
    retryPressureCount,
    pauseTimeMs,
    completionStatus: value['completionStatus'],
    firstSeenAt: value['firstSeenAt'],
    lastSeenAt: value['lastSeenAt'],
    sampleCount,
    cleanSampleCount,
    ...(typeof value['raisedMaxCap'] === 'number'
      ? { raisedMaxCap: Math.min(HOSTED_OCR_PROFILE_MAX_CAP_CEILING, Math.max(1, Math.floor(value['raisedMaxCap']))) }
      : {}),
    ...(value['capSource'] === 'exact-clean-sample' || value['capSource'] === 'sparse-observation'
      ? { capSource: value['capSource'] }
      : {}),
    ...(value['sourceConfidence'] === 'none' || value['sourceConfidence'] === 'sparse' || value['sourceConfidence'] === 'healthy'
      ? { sourceConfidence: value['sourceConfidence'] }
      : {}),
    ...(value['disqualificationReason'] === 'retry-pressure'
      || value['disqualificationReason'] === 'paused'
      || value['disqualificationReason'] === 'partial'
      || value['disqualificationReason'] === 'failed'
      || value['disqualificationReason'] === 'incomplete'
      ? { disqualificationReason: value['disqualificationReason'] }
      : {})
  }
}

const parseStore = (value: unknown): HostedOcrThroughputProfileStore => {
  if (!isRecord(value) || value['version'] !== PROFILE_STORE_VERSION || !Array.isArray(value['profiles'])) {
    return { version: PROFILE_STORE_VERSION, profiles: [] }
  }
  return {
    version: PROFILE_STORE_VERSION,
    profiles: value['profiles'].map(parseProfile).filter((entry): entry is HostedOcrThroughputProfile => entry !== undefined)
  }
}

export const readHostedOcrThroughputProfiles = async (
  profilePath = resolveHostedOcrThroughputProfilePath()
): Promise<HostedOcrThroughputProfileStore> => {
  try {
    return parseStore(JSON.parse(await readFile(profilePath, 'utf-8')) as unknown)
  } catch {
    return { version: PROFILE_STORE_VERSION, profiles: [] }
  }
}

export const readHostedOcrThroughputProfilesSync = (
  profilePath = resolveHostedOcrThroughputProfilePath()
): HostedOcrThroughputProfileStore => {
  try {
    if (!existsSync(profilePath)) {
      return { version: PROFILE_STORE_VERSION, profiles: [] }
    }
    return parseStore(JSON.parse(readFileSync(profilePath, 'utf-8')) as unknown)
  } catch {
    return { version: PROFILE_STORE_VERSION, profiles: [] }
  }
}

const profileKey = (
  profile: Pick<HostedOcrThroughputProfile, 'provider' | 'model' | 'scopeClass' | 'pageCountBand' | 'ocrConcurrencyMode' | 'laneTargetCount'>
): string => [
  profile.provider,
  profile.model,
  profile.scopeClass,
  profile.pageCountBand,
  profile.ocrConcurrencyMode,
  String(profile.laneTargetCount ?? 'unknown')
].join('\u0000')

const weightedAverage = (
  oldValue: number,
  oldSamples: number,
  newValue: number
): number => roundMetric(((oldValue * oldSamples) + newValue) / (oldSamples + 1))

const mergeProfiles = (
  existing: HostedOcrThroughputProfile[],
  samples: HostedOcrThroughputProfile[]
): HostedOcrThroughputProfile[] => {
  const byKey = new Map(existing.map((profile) => [profileKey(profile), profile]))

  for (const sample of samples) {
    const key = profileKey(sample)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, sample)
      continue
    }

    const oldSamples = Math.max(1, current.sampleCount)
    byKey.set(key, {
      ...current,
      throughputPagesPerMinute: weightedAverage(current.throughputPagesPerMinute, oldSamples, sample.throughputPagesPerMinute),
      activePeak: Math.max(current.activePeak, sample.activePeak),
      retryPressureCount: Math.round(weightedAverage(current.retryPressureCount, oldSamples, sample.retryPressureCount)),
      pauseTimeMs: Math.round(weightedAverage(current.pauseTimeMs, oldSamples, sample.pauseTimeMs)),
      completionStatus: sample.completionStatus,
      lastSeenAt: sample.lastSeenAt,
      sampleCount: Math.min(MAX_PROFILE_SAMPLES, oldSamples + 1),
      cleanSampleCount: Math.min(
        MAX_PROFILE_SAMPLES,
        (current.cleanSampleCount ?? 0) + (sample.cleanSampleCount ?? 0)
      ),
      laneTargetCount: sample.laneTargetCount ?? current.laneTargetCount,
      raisedMaxCap: Math.max(current.raisedMaxCap ?? 0, sample.raisedMaxCap ?? 0) || undefined,
      capSource: sample.capSource ?? current.capSource,
      sourceConfidence: (current.cleanSampleCount ?? 0) + (sample.cleanSampleCount ?? 0) > 0
        ? 'healthy'
        : sample.sourceConfidence ?? current.sourceConfidence,
      disqualificationReason: (current.cleanSampleCount ?? 0) + (sample.cleanSampleCount ?? 0) > 0
        ? undefined
        : sample.disqualificationReason ?? current.disqualificationReason
    })
  }

  return [...byKey.values()]
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_PROFILE_ENTRIES)
}

const buildProfileSamples = (
  snapshot: HostedOcrSchedulerTelemetry,
  options: PersistHostedOcrProfilesOptions
): HostedOcrThroughputProfile[] => {
  const now = (options.now ?? new Date()).toISOString()
  return snapshot.lanes.flatMap((lane) =>
    lane.targets.flatMap((target) => {
      if (target.completedPages <= 0 || target.pagesPerMinute === null || target.pagesPerMinute <= 0) {
        return []
      }
      const targetCompletionStatus = target.status === 'succeeded'
        ? 'full'
        : target.status === 'failed' || target.status === 'incomplete'
          ? 'incomplete'
          : options.completionStatus
      const disqualificationReason: HostedOcrProfileDisqualificationReason | undefined =
        lane.retryPressureCount > 0
          ? 'retry-pressure'
          : lane.pauseTimeMs > 0
            ? 'paused'
            : target.failedPages > 0 || target.status === 'failed'
              ? 'failed'
              : target.submittedPages > target.completedPages || target.status === 'incomplete'
                ? 'partial'
                : targetCompletionStatus !== 'full'
                  ? 'incomplete'
                  : undefined
      const cleanSample = disqualificationReason === undefined
        && targetCompletionStatus === 'full'
        && target.submittedPages > 0
        && target.completedPages >= target.submittedPages
        && lane.retryPressureCount === 0
        && lane.pauseTimeMs === 0
      const raisedMaxCap = cleanSample
        ? Math.min(HOSTED_OCR_PROFILE_MAX_CAP_CEILING, Math.max(lane.activePeak, lane.currentCap) + 2)
        : undefined
      const laneTargetCount = Math.max(1, lane.targets.filter((candidate) => candidate.submittedPages > 0).length)
      return [{
        provider: target.service,
        model: target.model,
        scopeClass: lane.scopeLabel,
        pageCountBand: resolveHostedOcrPageCountBand(target.submittedPages || target.completedPages),
        ocrConcurrencyMode: lane.mode,
        laneTargetCount,
        throughputPagesPerMinute: roundMetric(target.pagesPerMinute),
        activePeak: lane.activePeak,
        retryPressureCount: lane.retryPressureCount,
        pauseTimeMs: lane.pauseTimeMs,
        completionStatus: targetCompletionStatus,
        firstSeenAt: now,
        lastSeenAt: now,
        sampleCount: 1,
        cleanSampleCount: cleanSample ? 1 : 0,
        ...(typeof raisedMaxCap === 'number' ? { raisedMaxCap } : {}),
        capSource: cleanSample ? 'exact-clean-sample' : 'sparse-observation',
        sourceConfidence: cleanSample ? 'healthy' : 'sparse',
        ...(disqualificationReason ? { disqualificationReason } : {})
      }]
    })
  )
}

export const persistHostedOcrThroughputProfiles = async (
  snapshot: HostedOcrSchedulerTelemetry | undefined,
  options: PersistHostedOcrProfilesOptions
): Promise<void> => {
  if (!snapshot || snapshot.lanes.length === 0) {
    return
  }
  const samples = buildProfileSamples(snapshot, options)
  if (samples.length === 0) {
    return
  }

  const profilePath = options.profilePath ?? resolveHostedOcrThroughputProfilePath()
  await withProcessLock(PROFILE_LOCK_NAME, async () => {
    const store = await readHostedOcrThroughputProfiles(profilePath)
    const nextStore: HostedOcrThroughputProfileStore = {
      version: PROFILE_STORE_VERSION,
      profiles: mergeProfiles(store.profiles, samples)
    }
    await mkdir(dirname(profilePath), { recursive: true })
    const tempPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, JSON.stringify(nextStore, null, 2) + '\n')
    await rename(tempPath, profilePath)
  })
}

const scoreProfile = (
  profile: HostedOcrThroughputProfile,
  input: {
    provider: string
    model: string
    scopeClass: string
    pageCountBand: string
    ocrConcurrencyMode: OcrConcurrencyMode
    laneTargetCount?: number | undefined
  }
): number => {
  if (profile.provider !== input.provider || profile.ocrConcurrencyMode !== input.ocrConcurrencyMode) {
    return -1
  }
  let score = 0
  if (profile.model === input.model) score += 8
  if (profile.scopeClass === input.scopeClass) score += 4
  if (profile.pageCountBand === input.pageCountBand) score += 2
  if (typeof input.laneTargetCount === 'number') {
    if (profile.laneTargetCount === input.laneTargetCount) score += 2
    else if (typeof profile.laneTargetCount === 'number') score -= 2
  }
  if (profile.completionStatus === 'full') score += 2
  return score
}

export const findHostedOcrThroughputProfile = (
  input: {
    provider: string
    model: string
    pageCount: number
    ocrConcurrencyMode: OcrConcurrencyMode
    scopeClass?: string | undefined
    laneTargetCount?: number | undefined
    profilePath?: string | undefined
  }
): HostedOcrProfileEstimate | undefined => {
  const scopeClass = input.scopeClass ?? 'env-api-key'
  const pageCountBand = resolveHostedOcrPageCountBand(input.pageCount)
  const profiles = readHostedOcrThroughputProfilesSync(input.profilePath).profiles
  const match = profiles
    .map((profile) => ({
      profile,
      score: scoreProfile(profile, {
        provider: input.provider,
        model: input.model,
        scopeClass,
        pageCountBand,
        ocrConcurrencyMode: input.ocrConcurrencyMode,
        laneTargetCount: input.laneTargetCount
      })
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) =>
      right.score - left.score
      || right.profile.sampleCount - left.profile.sampleCount
      || Date.parse(right.profile.lastSeenAt) - Date.parse(left.profile.lastSeenAt)
    )[0]?.profile

  if (!match) {
    return undefined
  }

  return {
    profile: match,
    confidence: (match.cleanSampleCount ?? 0) >= 1
      && match.completionStatus === 'full'
      && match.disqualificationReason === undefined
      ? 'healthy'
      : 'sparse'
  }
}
