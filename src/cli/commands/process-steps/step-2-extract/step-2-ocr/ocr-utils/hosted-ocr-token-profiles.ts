import { isRecord } from '~/utils/rest-client'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { isTokenPricedOcrProvider } from '~/types'
import type { ExtractionMetadata, HostedOcrTokenUsageEstimate, HostedOcrTokenUsageProfile, HostedOcrTokenUsageProfileStore, PartialExtractionMetadata, PersistHostedOcrProfilesOptions, TokenPricedOcrProvider } from '~/types'
import { withProcessLock } from '~/utils/process-lock'

const TOKEN_PROFILE_STORE_VERSION = 1
const MAX_TOKEN_PROFILE_ENTRIES = 500
const MAX_TOKEN_PROFILE_SAMPLES = 100
const TOKEN_PROFILE_LOCK_NAME = 'ocr-token-usage-profiles-v1'
const DEFAULT_OCR_INPUT_TOKENS_PER_PAGE = 4000
const DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE = 1000

export const resolveHostedOcrTokenUsageProfilePath = (): string =>
  join(homedir(), '.cache', 'autoshow-cli', 'ocr-token-usage-profiles-v1.json')

export const resolveHostedOcrTokenPageCountBand = (pageCount: number): string => {
  const pages = Number.isFinite(pageCount) ? Math.max(1, Math.floor(pageCount)) : 1
  if (pages === 1) return '1'
  if (pages <= 10) return '2-10'
  if (pages <= 50) return '11-50'
  if (pages < 200) return '51-199'
  if (pages <= 299) return '200-299'
  if (pages <= 499) return '300-499'
  if (pages <= 1000) return '500-1000'
  return '1001+'
}

export const resolveHostedOcrModeFromExtractionMethod = (
  extractionMethod: string | undefined,
  inputFamily?: string | undefined
): string => {
  if (extractionMethod?.startsWith('pdf+')) return 'pdf'
  if (extractionMethod?.startsWith('image+')) return 'image'
  if (extractionMethod?.startsWith('cbz+')) return 'cbz'
  const normalizedInputFamily = inputFamily?.toLowerCase()
  if (normalizedInputFamily === 'pdf' || normalizedInputFamily === 'image' || normalizedInputFamily === 'cbz') return normalizedInputFamily
  if (!extractionMethod) return 'unknown'
  return 'direct'
}

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}


const parseProfile = (value: unknown): HostedOcrTokenUsageProfile | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  if (
    !isTokenPricedOcrProvider(value['provider'])
    || typeof value['model'] !== 'string'
    || typeof value['ocrMode'] !== 'string'
    || typeof value['pageCountBand'] !== 'string'
    || typeof value['pageCount'] !== 'number'
    || typeof value['observedPromptTokens'] !== 'number'
    || typeof value['observedCompletionTokens'] !== 'number'
    || typeof value['promptTokensPerPage'] !== 'number'
    || typeof value['completionTokensPerPage'] !== 'number'
    || typeof value['estimatedPromptTokens'] !== 'number'
    || typeof value['estimatedCompletionTokens'] !== 'number'
    || typeof value['promptTokenEstimateDelta'] !== 'number'
    || typeof value['completionTokenEstimateDelta'] !== 'number'
    || typeof value['firstSeenAt'] !== 'string'
    || typeof value['lastSeenAt'] !== 'string'
    || typeof value['sampleCount'] !== 'number'
  ) {
    return undefined
  }

  return {
    provider: value['provider'],
    model: value['model'],
    ocrMode: value['ocrMode'],
    pageCountBand: value['pageCountBand'],
    pageCount: Math.max(1, Math.floor(value['pageCount'])),
    observedPromptTokens: Math.max(0, Math.round(value['observedPromptTokens'])),
    observedCompletionTokens: Math.max(0, Math.round(value['observedCompletionTokens'])),
    promptTokensPerPage: Math.max(0, value['promptTokensPerPage']),
    completionTokensPerPage: Math.max(0, value['completionTokensPerPage']),
    estimatedPromptTokens: Math.max(0, Math.round(value['estimatedPromptTokens'])),
    estimatedCompletionTokens: Math.max(0, Math.round(value['estimatedCompletionTokens'])),
    promptTokenEstimateDelta: Math.round(value['promptTokenEstimateDelta']),
    completionTokenEstimateDelta: Math.round(value['completionTokenEstimateDelta']),
    firstSeenAt: value['firstSeenAt'],
    lastSeenAt: value['lastSeenAt'],
    sampleCount: Math.max(1, Math.floor(value['sampleCount'])),
    sourceConfidence: value['sourceConfidence'] === 'healthy' || value['sourceConfidence'] === 'sparse'
      ? value['sourceConfidence']
      : 'sparse',
    ...(value['disqualificationReason'] === 'partial'
      || value['disqualificationReason'] === 'failed'
      || value['disqualificationReason'] === 'incomplete'
      || value['disqualificationReason'] === 'missing-usage'
      ? { disqualificationReason: value['disqualificationReason'] }
      : {})
  }
}

const parseStore = (value: unknown): HostedOcrTokenUsageProfileStore => {
  if (!isRecord(value) || value['version'] !== TOKEN_PROFILE_STORE_VERSION || !Array.isArray(value['profiles'])) {
    return { version: TOKEN_PROFILE_STORE_VERSION, profiles: [] }
  }
  return {
    version: TOKEN_PROFILE_STORE_VERSION,
    profiles: value['profiles'].map(parseProfile).filter((entry): entry is HostedOcrTokenUsageProfile => entry !== undefined)
  }
}

export const readHostedOcrTokenUsageProfiles = async (
  profilePath = resolveHostedOcrTokenUsageProfilePath()
): Promise<HostedOcrTokenUsageProfileStore> => {
  try {
    return parseStore(JSON.parse(await readFile(profilePath, 'utf-8')) as unknown)
  } catch {
    return { version: TOKEN_PROFILE_STORE_VERSION, profiles: [] }
  }
}

export const readHostedOcrTokenUsageProfilesSync = (
  profilePath = resolveHostedOcrTokenUsageProfilePath()
): HostedOcrTokenUsageProfileStore => {
  try {
    if (!existsSync(profilePath)) {
      return { version: TOKEN_PROFILE_STORE_VERSION, profiles: [] }
    }
    return parseStore(JSON.parse(readFileSync(profilePath, 'utf-8')) as unknown)
  } catch {
    return { version: TOKEN_PROFILE_STORE_VERSION, profiles: [] }
  }
}

const profileKey = (
  profile: Pick<HostedOcrTokenUsageProfile, 'provider' | 'model' | 'ocrMode' | 'pageCountBand'>
): string => [
  profile.provider,
  profile.model,
  profile.ocrMode,
  profile.pageCountBand
].join('\u0000')

const weightedAverage = (oldValue: number, oldSamples: number, newValue: number): number =>
  roundMetric(((oldValue * oldSamples) + newValue) / (oldSamples + 1))

const mergeProfiles = (
  existing: HostedOcrTokenUsageProfile[],
  samples: HostedOcrTokenUsageProfile[]
): HostedOcrTokenUsageProfile[] => {
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
      pageCount: Math.round(weightedAverage(current.pageCount, oldSamples, sample.pageCount)),
      observedPromptTokens: Math.round(weightedAverage(current.observedPromptTokens, oldSamples, sample.observedPromptTokens)),
      observedCompletionTokens: Math.round(weightedAverage(current.observedCompletionTokens, oldSamples, sample.observedCompletionTokens)),
      promptTokensPerPage: weightedAverage(current.promptTokensPerPage, oldSamples, sample.promptTokensPerPage),
      completionTokensPerPage: weightedAverage(current.completionTokensPerPage, oldSamples, sample.completionTokensPerPage),
      estimatedPromptTokens: Math.round(weightedAverage(current.estimatedPromptTokens, oldSamples, sample.estimatedPromptTokens)),
      estimatedCompletionTokens: Math.round(weightedAverage(current.estimatedCompletionTokens, oldSamples, sample.estimatedCompletionTokens)),
      promptTokenEstimateDelta: Math.round(weightedAverage(current.promptTokenEstimateDelta, oldSamples, sample.promptTokenEstimateDelta)),
      completionTokenEstimateDelta: Math.round(weightedAverage(current.completionTokenEstimateDelta, oldSamples, sample.completionTokenEstimateDelta)),
      lastSeenAt: sample.lastSeenAt,
      sampleCount: Math.min(MAX_TOKEN_PROFILE_SAMPLES, oldSamples + 1),
      sourceConfidence: 'healthy',
      disqualificationReason: undefined
    })
  }

  return [...byKey.values()]
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_TOKEN_PROFILE_ENTRIES)
}

const buildProfileSample = (
  metadata: ExtractionMetadata,
  options: PersistHostedOcrProfilesOptions
): HostedOcrTokenUsageProfile | undefined => {
  if (options.completionStatus !== 'full') {
    return undefined
  }
  if (!isTokenPricedOcrProvider(metadata.ocrService) || typeof metadata.ocrModel !== 'string') {
    return undefined
  }
  if (typeof metadata.promptTokens !== 'number' || typeof metadata.completionTokens !== 'number') {
    return undefined
  }
  const pageCount = Math.max(1, Math.floor(metadata.totalPages))
  const promptTokens = Math.max(0, Math.round(metadata.promptTokens))
  const completionTokens = Math.max(0, Math.round(metadata.completionTokens))
  const estimation = getExtractEstimation(metadata.ocrService, metadata.ocrModel)
  const estimatedPromptTokens = Math.round(pageCount * (estimation.promptTokensPerPage ?? DEFAULT_OCR_INPUT_TOKENS_PER_PAGE))
  const estimatedCompletionTokens = Math.round(pageCount * (estimation.completionTokensPerPage ?? DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE))
  const now = (options.now ?? new Date()).toISOString()

  return {
    provider: metadata.ocrService,
    model: metadata.ocrModel,
    ocrMode: resolveHostedOcrModeFromExtractionMethod(metadata.extractionMethod, metadata.inputFamily),
    pageCountBand: resolveHostedOcrTokenPageCountBand(pageCount),
    pageCount,
    observedPromptTokens: promptTokens,
    observedCompletionTokens: completionTokens,
    promptTokensPerPage: roundMetric(promptTokens / pageCount),
    completionTokensPerPage: roundMetric(completionTokens / pageCount),
    estimatedPromptTokens,
    estimatedCompletionTokens,
    promptTokenEstimateDelta: promptTokens - estimatedPromptTokens,
    completionTokenEstimateDelta: completionTokens - estimatedCompletionTokens,
    firstSeenAt: now,
    lastSeenAt: now,
    sampleCount: 1,
    sourceConfidence: 'healthy'
  }
}

export const persistHostedOcrTokenUsageProfiles = async (
  metadata: ExtractionMetadata | ExtractionMetadata[] | PartialExtractionMetadata[] | undefined,
  options: PersistHostedOcrProfilesOptions
): Promise<void> => {
  const entries = metadata === undefined
    ? []
    : Array.isArray(metadata)
      ? metadata
      : [metadata]
  const samples = entries
    .filter((entry): entry is ExtractionMetadata => !('status' in entry))
    .map((entry) => buildProfileSample(entry, options))
    .filter((entry): entry is HostedOcrTokenUsageProfile => entry !== undefined)
  if (samples.length === 0) {
    return
  }

  const profilePath = options.profilePath ?? resolveHostedOcrTokenUsageProfilePath()
  await withProcessLock(TOKEN_PROFILE_LOCK_NAME, async () => {
    const store = await readHostedOcrTokenUsageProfiles(profilePath)
    const nextStore: HostedOcrTokenUsageProfileStore = {
      version: TOKEN_PROFILE_STORE_VERSION,
      profiles: mergeProfiles(store.profiles, samples)
    }
    await mkdir(dirname(profilePath), { recursive: true })
    const tempPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, JSON.stringify(nextStore, null, 2) + '\n')
    await rename(tempPath, profilePath)
  })
}

const scoreProfile = (
  profile: HostedOcrTokenUsageProfile,
  input: {
    provider: TokenPricedOcrProvider
    model: string
    ocrMode: string
    pageCountBand: string
  }
): number => {
  if (profile.provider !== input.provider || profile.model !== input.model) {
    return -1
  }
  let score = 0
  if (profile.ocrMode === input.ocrMode) score += 4
  if (profile.pageCountBand === input.pageCountBand) score += 2
  return score
}

export const findHostedOcrTokenUsageProfile = (
  input: {
    provider: TokenPricedOcrProvider
    model: string
    pageCount: number
    ocrMode?: string | undefined
    profilePath?: string | undefined
  }
): HostedOcrTokenUsageProfile | undefined => {
  const ocrMode = input.ocrMode ?? 'unknown'
  const pageCountBand = resolveHostedOcrTokenPageCountBand(input.pageCount)
  return readHostedOcrTokenUsageProfilesSync(input.profilePath).profiles
    .map((profile) => ({
      profile,
      score: scoreProfile(profile, {
        provider: input.provider,
        model: input.model,
        ocrMode,
        pageCountBand
      })
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) =>
      right.score - left.score
      || right.profile.sampleCount - left.profile.sampleCount
      || Date.parse(right.profile.lastSeenAt) - Date.parse(left.profile.lastSeenAt)
    )[0]?.profile
}

export const resolveHostedOcrTokenUsageEstimate = (
  input: {
    provider: TokenPricedOcrProvider
    model: string
    pageCount: number
    ocrMode?: string | undefined
    profilePath?: string | undefined
    registryPromptTokensPerPage: number
    registryCompletionTokensPerPage: number
  }
): HostedOcrTokenUsageEstimate => {
  const pageCount = Math.max(0, Math.floor(input.pageCount))
  const registryPromptTokens = Math.max(0, Math.round(pageCount * input.registryPromptTokensPerPage))
  const registryCompletionTokens = Math.max(0, Math.round(pageCount * input.registryCompletionTokensPerPage))
  const ocrMode = input.ocrMode ?? 'unknown'
  const pageCountBand = resolveHostedOcrTokenPageCountBand(pageCount)
  const profile = findHostedOcrTokenUsageProfile({
    provider: input.provider,
    model: input.model,
    pageCount,
    ocrMode,
    profilePath: input.profilePath
  })

  if (!profile) {
    return {
      promptTokens: registryPromptTokens,
      completionTokens: registryCompletionTokens,
      tokenEstimateSource: 'registry',
      tokenEstimateConfidence: 'none'
    }
  }

  const exactMatch = profile.ocrMode === ocrMode && profile.pageCountBand === pageCountBand
  if (exactMatch && profile.sourceConfidence === 'healthy') {
    return {
      promptTokens: Math.max(0, Math.round(pageCount * profile.promptTokensPerPage)),
      completionTokens: Math.max(0, Math.round(pageCount * profile.completionTokensPerPage)),
      tokenEstimateSource: 'profile',
      tokenEstimateConfidence: profile.sourceConfidence,
      tokenProfileSampleCount: profile.sampleCount,
      tokenProfilePromptTokensPerPage: profile.promptTokensPerPage,
      tokenProfileCompletionTokensPerPage: profile.completionTokensPerPage
    }
  }

  const sampleWeight = Math.max(1, Math.min(2, profile.sampleCount))
  const promptTokensPerPage = ((profile.promptTokensPerPage * sampleWeight) + (input.registryPromptTokensPerPage * 2)) / (sampleWeight + 2)
  const completionTokensPerPage = ((profile.completionTokensPerPage * sampleWeight) + (input.registryCompletionTokensPerPage * 2)) / (sampleWeight + 2)
  return {
    promptTokens: Math.max(0, Math.round(pageCount * promptTokensPerPage)),
    completionTokens: Math.max(0, Math.round(pageCount * completionTokensPerPage)),
    tokenEstimateSource: 'blended-profile',
    tokenEstimateConfidence: profile.sourceConfidence,
    tokenProfileSampleCount: profile.sampleCount,
    tokenProfilePromptTokensPerPage: profile.promptTokensPerPage,
    tokenProfileCompletionTokensPerPage: profile.completionTokensPerPage
  }
}
