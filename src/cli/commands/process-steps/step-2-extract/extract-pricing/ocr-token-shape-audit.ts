import { resolve } from 'node:path'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { readManifest, resolveManifestRelativePath } from '~/cli/commands/process-steps/pipeline-manifest'
import { readHostedOcrTokenUsageProfiles, resolveHostedOcrModeFromExtractionMethod, resolveHostedOcrTokenPageCountBand } from '../step-2-ocr/ocr-utils/hosted-ocr-token-profiles'
import { isTokenPricedOcrProvider } from '~/types'
import type { AuditOcrTokenShapesOptions, HostedOcrTokenReasoningPolicy, HostedOcrTokenUsageProfile, OcrTokenShapeAuditBucket, OcrTokenShapeAuditMetric, OcrTokenShapeAuditReport, PipelineManifestItem, TokenPricedOcrProvider, TokenShapeSample } from '~/types'
import { selectHostedOcrTokenUsageProfile } from '~/utils/pricing/ocr-token-pricing'
import { isRecord } from '~/utils/rest-client'
import { CLIUsageError } from '~/utils/error-handler'

const MINIMUM_HEALTHY_SAMPLES = 3
const PROMOTION_ERROR_THRESHOLD = 20

const defaultTarget = (provider: TokenPricedOcrProvider, model: string): boolean =>
  provider === 'kimi' || (provider === 'gemini' && model.toLowerCase().includes('pro'))

const targetSelected = (
  provider: TokenPricedOcrProvider,
  model: string,
  includeAllTokenProviders: boolean | undefined
): boolean => includeAllTokenProviders === true || defaultTarget(provider, model)

const reasoningPolicy = (value: unknown): HostedOcrTokenReasoningPolicy => {
  switch (value) {
    case 'default':
    case 'disabled':
    case 'minimal':
    case 'low':
    case 'medium':
    case 'high':
    case 'max':
      return value
    default:
      return 'unspecified'
  }
}

const bucketKey = (value: Pick<TokenShapeSample, 'provider' | 'model' | 'ocrMode' | 'pageCountBand' | 'effectiveReasoningEffort'>): string =>
  [value.provider, value.model, value.ocrMode, value.pageCountBand, value.effectiveReasoningEffort].join('\u0000')

const roundMetric = (value: number): number => Math.round(value * 1000) / 1000

const median = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : sorted[middle]
}

const metricAudit = (
  observed: readonly number[],
  registryTokensPerPage: number,
  profileTokensPerPage: number | undefined,
  reasoningPolicyQualified: boolean
): OcrTokenShapeAuditMetric => {
  const observedMedian = median(observed)
  const deviation = observedMedian === undefined
    ? undefined
    : median(observed.map((value) => Math.abs(value - observedMedian)))
  const errors = observed.map((value) => value === 0
    ? (registryTokensPerPage === 0 ? 0 : 100)
    : Math.abs(value - registryTokensPerPage) / value * 100)
  const medianAbsolutePercentageError = median(errors)
  const directions = observed.map((value) => Math.sign(value - registryTokensPerPage))
  const consistentAbove = directions.length > 0 && directions.every((value) => value > 0)
  const consistentBelow = directions.length > 0 && directions.every((value) => value < 0)
  const consistentDirection = consistentAbove || consistentBelow
  const exceedsPromotionThreshold = (medianAbsolutePercentageError ?? 0) > PROMOTION_ERROR_THRESHOLD
  const promotionEligible = observed.length >= MINIMUM_HEALTHY_SAMPLES
    && reasoningPolicyQualified
    && consistentDirection
    && exceedsPromotionThreshold

  return {
    registryTokensPerPage,
    ...(profileTokensPerPage !== undefined ? { profileTokensPerPage } : {}),
    ...(observedMedian !== undefined ? { medianObservedTokensPerPage: roundMetric(observedMedian) } : {}),
    ...(deviation !== undefined ? { medianAbsoluteDeviation: roundMetric(deviation) } : {}),
    ...(medianAbsolutePercentageError !== undefined ? { medianAbsolutePercentageError: roundMetric(medianAbsolutePercentageError) } : {}),
    direction: observed.length === 0
      ? 'no-individual-evidence'
      : consistentAbove
        ? 'above-registry'
        : consistentBelow
          ? 'below-registry'
          : 'mixed-or-equal',
    consistentDirection,
    exceedsPromotionThreshold,
    promotionEligible
  }
}

const usageBasis = (provider: TokenPricedOcrProvider): OcrTokenShapeAuditBucket['usageBasis'] =>
  provider === 'gemini'
    ? 'candidate-plus-thoughts'
    : provider === 'kimi'
      ? 'reported-prompt-completion'
      : 'canonical-prompt-completion'

const collectManifestItems = async (
  runDirectory: string,
  seen: Set<string>
): Promise<{ items: PipelineManifestItem[], manifestCount: number }> => {
  const directory = resolve(runDirectory)
  if (seen.has(directory)) return { items: [], manifestCount: 0 }
  seen.add(directory)
  const manifest = await readManifest(directory)
  if (!manifest) return { items: [], manifestCount: 0 }

  const items = [...manifest.items]
  let manifestCount = 1
  for (const item of manifest.items) {
    if (!item.child) continue
    const child = await collectManifestItems(resolveManifestRelativePath(directory, item.child.manifestDir), seen)
    items.push(...child.items)
    manifestCount += child.manifestCount
  }
  return { items, manifestCount }
}

const getPartialEntries = (item: PipelineManifestItem): unknown[] =>
  Array.isArray(item.metadata['partialStep2']) ? item.metadata['partialStep2'] : []

const collectSamples = (
  items: readonly PipelineManifestItem[],
  options: Pick<AuditOcrTokenShapesOptions, 'includeAllTokenProviders'>,
  excluded: OcrTokenShapeAuditReport['excludedSamples']
): TokenShapeSample[] => {
  const samples: TokenShapeSample[] = []

  for (const item of items) {
    for (const partial of getPartialEntries(item)) {
      if (!isRecord(partial) || !isTokenPricedOcrProvider(partial['ocrService']) || typeof partial['ocrModel'] !== 'string') continue
      if (targetSelected(partial['ocrService'], partial['ocrModel'], options.includeAllTokenProviders)) excluded.partial += 1
    }

    for (const providerState of item.providers) {
      if (!isTokenPricedOcrProvider(providerState.service) || typeof providerState.model !== 'string') continue
      if (!targetSelected(providerState.service, providerState.model, options.includeAllTokenProviders)) continue
      if (providerState.status === 'failed') {
        excluded.failed += 1
        continue
      }
      if (providerState.status !== 'succeeded') continue
      if (item.status !== 'full') {
        excluded.incomplete += 1
        continue
      }

      const metadata = providerState.metadata
      const promptTokens = metadata['promptTokens']
      const completionTokens = metadata['completionTokens']
      if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') {
        excluded.missingUsage += 1
        continue
      }
      const pageCount = metadata['totalPages']
      if (typeof pageCount !== 'number' || !Number.isFinite(pageCount) || pageCount <= 0 || promptTokens < 0 || completionTokens < 0) {
        excluded.schemaInvalid += 1
        continue
      }

      const pages = Math.max(1, Math.floor(pageCount))
      samples.push({
        provider: providerState.service,
        model: providerState.model,
        ocrMode: resolveHostedOcrModeFromExtractionMethod(
          typeof metadata['extractionMethod'] === 'string' ? metadata['extractionMethod'] : undefined,
          typeof metadata['inputFamily'] === 'string' ? metadata['inputFamily'] : undefined
        ),
        pageCountBand: resolveHostedOcrTokenPageCountBand(pages),
        effectiveReasoningEffort: reasoningPolicy(metadata['effectiveReasoningEffort']),
        promptTokensPerPage: promptTokens / pages,
        completionTokensPerPage: completionTokens / pages
      })
    }
  }
  return samples
}

const buildBucket = (
  identity: Pick<TokenShapeSample, 'provider' | 'model' | 'ocrMode' | 'pageCountBand' | 'effectiveReasoningEffort'>,
  samples: readonly TokenShapeSample[],
  profiles: readonly HostedOcrTokenUsageProfile[]
): OcrTokenShapeAuditBucket => {
  const estimation = getExtractEstimation(identity.provider, identity.model)
  const registryPromptTokensPerPage = estimation.promptTokensPerPage ?? 4000
  const registryCompletionTokensPerPage = estimation.completionTokensPerPage ?? 1000
  const profile = selectHostedOcrTokenUsageProfile(profiles, identity)
  const reasoningPolicyQualified = identity.effectiveReasoningEffort !== 'unspecified'
  const prompt = metricAudit(samples.map((sample) => sample.promptTokensPerPage), registryPromptTokensPerPage, profile?.promptTokensPerPage, reasoningPolicyQualified)
  const completion = metricAudit(samples.map((sample) => sample.completionTokensPerPage), registryCompletionTokensPerPage, profile?.completionTokensPerPage, reasoningPolicyQualified)
  const promotionEligible = prompt.promotionEligible || completion.promotionEligible
  const decision = promotionEligible
    ? 'promote-component-shape'
    : samples.length === 0
      ? 'insufficient-individual-evidence'
      : samples.length < MINIMUM_HEALTHY_SAMPLES
        ? 'insufficient-samples'
        : !reasoningPolicyQualified
          ? 'unqualified-reasoning-policy'
        : !prompt.exceedsPromotionThreshold && !completion.exceedsPromotionThreshold
          ? 'within-tolerance'
          : 'inconsistent-direction'

  return {
    ...identity,
    usageBasis: usageBasis(identity.provider),
    healthySampleCount: samples.length,
    ...(profile ? { profileSampleCount: profile.sampleCount } : {}),
    prompt,
    completion,
    promotionEligible,
    decision
  }
}

export const auditOcrTokenShapes = async (
  options: AuditOcrTokenShapesOptions
): Promise<OcrTokenShapeAuditReport> => {
  const runDirectories = [...new Set(options.runDirectories ?? [])]
  if (runDirectories.length === 0 && options.profilePath === undefined) {
    throw CLIUsageError('OCR token-shape audit requires at least one explicit run directory or an explicit token-profile path.')
  }

  const seen = new Set<string>()
  const items: PipelineManifestItem[] = []
  let canonicalManifestCount = 0
  for (const directory of runDirectories) {
    const collected = await collectManifestItems(directory, seen)
    items.push(...collected.items)
    canonicalManifestCount += collected.manifestCount
  }
  const profiles = options.profilePath === undefined
    ? []
    : (await readHostedOcrTokenUsageProfiles(options.profilePath)).profiles.filter((profile) =>
        targetSelected(profile.provider, profile.model, options.includeAllTokenProviders))
  const excludedSamples: OcrTokenShapeAuditReport['excludedSamples'] = {
    failed: 0,
    partial: 0,
    incomplete: 0,
    missingUsage: 0,
    schemaInvalid: 0
  }
  const samples = collectSamples(items, options, excludedSamples)
  const identities = new Map<string, Pick<TokenShapeSample, 'provider' | 'model' | 'ocrMode' | 'pageCountBand' | 'effectiveReasoningEffort'>>()
  for (const sample of samples) identities.set(bucketKey(sample), sample)
  for (const profile of profiles) identities.set(bucketKey(profile), profile)

  const buckets = [...identities.values()]
    .map((identity) => buildBucket(identity, samples.filter((sample) => bucketKey(sample) === bucketKey(identity)), profiles))
    .sort((left, right) =>
      left.provider.localeCompare(right.provider)
      || left.model.localeCompare(right.model)
      || left.ocrMode.localeCompare(right.ocrMode)
      || left.pageCountBand.localeCompare(right.pageCountBand)
      || left.effectiveReasoningEffort.localeCompare(right.effectiveReasoningEffort)
    )

  return {
    schemaVersion: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    evidenceGate: {
      minimumHealthySamples: MINIMUM_HEALTHY_SAMPLES,
      medianAbsolutePercentageErrorThreshold: PROMOTION_ERROR_THRESHOLD,
      requiresConsistentDirection: true
    },
    sources: {
      explicitRunDirectoryCount: runDirectories.length,
      canonicalManifestCount,
      explicitProfileProvided: options.profilePath !== undefined
    },
    excludedSamples,
    buckets
  }
}
