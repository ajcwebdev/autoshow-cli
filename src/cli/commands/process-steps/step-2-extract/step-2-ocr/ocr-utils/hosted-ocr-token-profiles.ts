import { isRecord } from '~/utils/rest-client'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { isTokenPricedOcrProvider } from '~/types'
import type { ExtractionMetadata, HostedOcrTokenReasoningPolicy, HostedOcrTokenUsageEstimate, HostedOcrTokenUsageProfile, HostedOcrTokenUsageProfileStore, PartialExtractionMetadata, PersistHostedOcrProfilesOptions, TokenPricedOcrProvider } from '~/types'
import { projectHostedOcrTokenUsageEstimate, selectHostedOcrTokenUsageProfile } from '~/utils/pricing/ocr-token-pricing'
import { roundMetric } from '~/utils/value-helpers'
import { createJsonProfileStore } from '~/utils/json-profile-store'

const TOKEN_PROFILE_STORE_VERSION = 2
const MAX_TOKEN_PROFILE_ENTRIES = 500
const MAX_TOKEN_PROFILE_SAMPLES = 100
const TOKEN_PROFILE_LOCK_NAME = 'ocr-token-usage-profiles-v2'
const DEFAULT_OCR_INPUT_TOKENS_PER_PAGE = 4000
const DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE = 1000

const resolveHostedOcrTokenUsageProfilePath = (): string =>
  join(homedir(), '.cache', 'autoshow-cli', 'ocr-token-usage-profiles-v2.json')

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

const REASONING_POLICIES = new Set<HostedOcrTokenReasoningPolicy>([
  'default',
  'disabled',
  'minimal',
  'low',
  'medium',
  'high',
  'max',
  'unspecified'
])

const parseReasoningPolicy = (value: unknown): HostedOcrTokenReasoningPolicy =>
  typeof value === 'string' && REASONING_POLICIES.has(value as HostedOcrTokenReasoningPolicy)
    ? value as HostedOcrTokenReasoningPolicy
    : 'unspecified'


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
    effectiveReasoningEffort: parseReasoningPolicy(value['effectiveReasoningEffort']),
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

const tokenUsageProfileStore = createJsonProfileStore({
  publishPolicy: {
    lockName: TOKEN_PROFILE_LOCK_NAME,
    maxEntries: MAX_TOKEN_PROFILE_ENTRIES,
    compareForRetention: (left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
  },
  version: TOKEN_PROFILE_STORE_VERSION,
  acceptVersions: [1],
  parseEntry: parseProfile,
  resolvePath: resolveHostedOcrTokenUsageProfilePath
})

export const readHostedOcrTokenUsageProfiles: (
  profilePath?: string | undefined
) => Promise<HostedOcrTokenUsageProfileStore> = tokenUsageProfileStore.read

const readHostedOcrTokenUsageProfilesSync: (
  profilePath?: string | undefined
) => HostedOcrTokenUsageProfileStore = tokenUsageProfileStore.readSync

const profileKey = (
  profile: Pick<HostedOcrTokenUsageProfile, 'provider' | 'model' | 'ocrMode' | 'pageCountBand' | 'effectiveReasoningEffort'>
): string => [
  profile.provider,
  profile.model,
  profile.ocrMode,
  profile.pageCountBand,
  profile.effectiveReasoningEffort
].join('\u0000')

const weightedAverage = (oldValue: number, oldSamples: number, newValue: number): number =>
  roundMetric(((oldValue * oldSamples) + newValue) / (oldSamples + 1))

const mergeProfiles = (
  existing: HostedOcrTokenUsageProfile[],
  samples: readonly HostedOcrTokenUsageProfile[]
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
    effectiveReasoningEffort: metadata.effectiveReasoningEffort ?? 'unspecified',
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

  await tokenUsageProfileStore.publish(samples, mergeProfiles, options.profilePath)
}

const findHostedOcrTokenUsageProfile = (
  input: {
    provider: TokenPricedOcrProvider
    model: string
    pageCount: number
    ocrMode?: string | undefined
    profilePath?: string | undefined
    effectiveReasoningEffort?: HostedOcrTokenReasoningPolicy | undefined
  }
): HostedOcrTokenUsageProfile | undefined => {
  const ocrMode = input.ocrMode ?? 'unknown'
  const pageCountBand = resolveHostedOcrTokenPageCountBand(input.pageCount)
  return selectHostedOcrTokenUsageProfile(
    readHostedOcrTokenUsageProfilesSync(input.profilePath).profiles,
    {
      provider: input.provider,
      model: input.model,
      ocrMode,
      pageCountBand,
      effectiveReasoningEffort: input.effectiveReasoningEffort ?? 'unspecified'
    }
  )
}

export const resolveHostedOcrTokenUsageEstimate = (
  input: {
    provider: TokenPricedOcrProvider
    model: string
    pageCount: number
    ocrMode?: string | undefined
    profilePath?: string | undefined
    effectiveReasoningEffort?: HostedOcrTokenReasoningPolicy | undefined
    registryPromptTokensPerPage: number
    registryCompletionTokensPerPage: number
  }
): HostedOcrTokenUsageEstimate => {
  const pageCount = Math.max(0, Math.floor(input.pageCount))
  const ocrMode = input.ocrMode ?? 'unknown'
  const pageCountBand = resolveHostedOcrTokenPageCountBand(pageCount)
  const effectiveReasoningEffort = input.effectiveReasoningEffort ?? 'unspecified'
  const profile = findHostedOcrTokenUsageProfile({
    provider: input.provider,
    model: input.model,
    pageCount,
    ocrMode,
    profilePath: input.profilePath,
    effectiveReasoningEffort
  })
  return projectHostedOcrTokenUsageEstimate({
    pageCount,
    ocrMode,
    pageCountBand,
    effectiveReasoningEffort,
    registryPromptTokensPerPage: input.registryPromptTokensPerPage,
    registryCompletionTokensPerPage: input.registryCompletionTokensPerPage,
    profile
  })
}
