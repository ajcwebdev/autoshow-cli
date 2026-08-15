import {
  getImageCost,
  getLlmCost,
  getMusicModelMeta,
  getRetiredModelRate
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { isCostSource } from '~/types'
import type { ActualCostBreakdown, ComputeActualCostsInput, CostSource, ExtractionMetadata, Step2Metadata, Step5Metadata, Step6VideoMetadata, StepCostEntry } from '~/types'
import {
  computeSttCost,
  computeTtsCost,
  parseDurationToSeconds
} from './cost-helpers'
import {
  computeSupadataActualCost,
  getSupadataCreditRateCents
} from './supadata-pricing'
import {
  computeScrapeCreatorsActualCost,
  getScrapeCreatorsCreditRateCents
} from '~/utils/pricing/scrapecreators-pricing'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import {
  isTokenPricedOcrProvider,
  resolveActualExtractCostEntry,
  zeroCostSource
} from './provider-family-resolvers'
import { walkRunSteps } from './run-step-walk'
import { isRecord } from '~/utils/rest-client'

const normalizeDurationSeconds = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0

const normalizeCostSource = (value: unknown, fallback: CostSource): CostSource =>
  isCostSource(value)
    ? value
    : fallback

const resolveSttBillingDurationSeconds = (input: ComputeActualCostsInput): number => {
  if (typeof input.audioDurationSeconds === 'number') {
    return normalizeDurationSeconds(input.audioDurationSeconds)
  }

  if (typeof input.step1?.durationSeconds === 'number') {
    return normalizeDurationSeconds(input.step1.durationSeconds)
  }

  if (input.step1) {
    return normalizeDurationSeconds(parseDurationToSeconds(input.step1.duration))
  }

  return 0
}

const computeActualSttCharge = (
  metadata: Step2Metadata,
  model: string,
  durationSeconds: number,
  sourceUrl: string | undefined
): {
  cost: number
  costSource: CostSource
  inputMetric: string
  inputValue: number
  promptTokens?: number
  completionTokens?: number
} => {
  const service = metadata.transcriptionService

  if (service === 'supadata') {
    const actual = computeSupadataActualCost(
      model,
      durationSeconds,
      metadata.billing?.creditsUsed,
      metadata.billing?.creditRateCents ?? getSupadataCreditRateCents(),
      { sourceUrl }
    )
    return {
      cost: actual.totalCost,
      costSource: metadata.billing?.source ?? 'computed_usage',
      inputMetric: 'credits',
      inputValue: actual.creditsUsed
    }
  }

  if (service === 'scrapecreators') {
    const actual = computeScrapeCreatorsActualCost(
      metadata.billing?.creditsUsed,
      metadata.billing?.creditRateCents ?? getScrapeCreatorsCreditRateCents()
    )
    return {
      cost: actual.totalCost,
      costSource: metadata.billing?.source ?? 'computed_usage',
      inputMetric: 'credits',
      inputValue: actual.creditsUsed
    }
  }

  if (typeof metadata.billing?.totalCost === 'number' && Number.isFinite(metadata.billing.totalCost)) {
    const inputTokens = metadata.billing.inputTokens
    const outputTokens = metadata.billing.outputTokens
    const totalTokens = metadata.billing.totalTokens
    if (
      typeof inputTokens === 'number'
      && Number.isFinite(inputTokens)
      && typeof outputTokens === 'number'
      && Number.isFinite(outputTokens)
    ) {
      return {
        cost: metadata.billing.totalCost,
        costSource: metadata.billing.source ?? 'computed_usage',
        inputMetric: 'tokens',
        inputValue: typeof totalTokens === 'number' && Number.isFinite(totalTokens)
          ? totalTokens
          : inputTokens + outputTokens,
        promptTokens: inputTokens,
        completionTokens: outputTokens
      }
    }

    return {
      cost: metadata.billing.totalCost,
      costSource: metadata.billing.source ?? 'computed_usage',
      inputMetric: 'durationSeconds',
      inputValue: durationSeconds
    }
  }

  return {
    cost: computeSttCost(service, model, durationSeconds),
    costSource: zeroCostSource(service, computeSttCost(service, model, durationSeconds), 'computed_usage'),
    inputMetric: 'durationSeconds',
    inputValue: durationSeconds
  }
}

const countGrokVideoInputImages = (entry: Step6VideoMetadata): number =>
  (entry.inputImage ? 1 : 0) + (entry.referenceImages?.length ?? 0)

const countReplicateVideoInputs = (entry: Step6VideoMetadata): number =>
  (entry.inputVideo ? 1 : 0) + (entry.referenceVideos?.length ?? 0)

const estimateRetiredVideoFallbackCost = (entry: Step6VideoMetadata): number | undefined => {
  const meta = getRetiredModelRate('video', entry.videoGenService, entry.videoGenModel)
  if (!meta) return undefined

  const durationSeconds = typeof entry.videoDuration === 'number' ? entry.videoDuration : 5
  const resolution = entry.videoResolution ?? '720p'
  const resolutionRate = meta.costPerSecondByResolutionCents?.[resolution]
  if (typeof resolutionRate === 'number') return durationSeconds * resolutionRate

  const fixedCost = meta.fixedCostByResolutionDurationCents?.[resolution]?.[String(durationSeconds)]
  if (typeof fixedCost === 'number') return fixedCost

  if (typeof meta.blockSizeSec === 'number') {
    const blockRate = resolution === '1080p'
      ? meta.blockCost1080pCents ?? meta.blockCost720pCents
      : meta.blockCost720pCents
    if (typeof blockRate === 'number') {
      return Math.max(1, Math.ceil(durationSeconds / meta.blockSizeSec)) * blockRate
    }
  }

  if (typeof meta.baseCostPerSecondCents === 'number') {
    const multiplier = resolution === '1080p'
      ? meta.resolutionMultiplier1080p ?? 1
      : resolution === '720p'
        ? meta.resolutionMultiplier720p ?? 1
        : 1
    return durationSeconds * meta.baseCostPerSecondCents * multiplier
  }

  return meta.baseJobFeeCents
}

const estimateActualVideoFallbackCost = (entry: Step6VideoMetadata): number => {
  const retiredCost = estimateRetiredVideoFallbackCost(entry)
  if (typeof retiredCost === 'number') return retiredCost

  const estimate = estimateVideoCost({
    ...(entry.videoGenService === 'gemini' ? { geminiVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'minimax' ? { minimaxVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'glm' ? { glmVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'grok' ? { grokVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'runway' ? { runwayVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'ltx' ? { ltxVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'replicate' ? { replicateVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'lumalabs' ? { lumalabsVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'fal' ? { falVideoModel: entry.videoGenModel } : {}),
    ...(typeof entry.videoDuration === 'number' ? { videoDuration: entry.videoDuration } : {}),
    ...(typeof entry.videoSize === 'string' ? { videoSize: entry.videoSize } : {}),
    ...(typeof entry.videoAspectRatio === 'string' ? { videoAspectRatio: entry.videoAspectRatio } : {}),
    ...(typeof entry.videoResolution === 'string' ? { videoResolution: entry.videoResolution } : {}),
    ...(typeof entry.requestMode === 'string' ? { videoMode: entry.requestMode } : {}),
    ...(entry.videoGenService === 'grok' ? { grokInputImageCount: countGrokVideoInputImages(entry) } : {}),
    ...(entry.videoGenService === 'grok' && typeof entry.inputVideoDurationSeconds === 'number'
      ? { grokInputVideoDurationSeconds: entry.inputVideoDurationSeconds }
      : {}),
    ...(entry.videoGenService === 'replicate' ? { replicateVideoReferenceVideoCount: countReplicateVideoInputs(entry) } : {})
  })
  return estimate.totalCost
}

const computeImageFallbackCost = (
  metadata: Step5Metadata,
  imageCount: number
): number => {
  if (
    metadata.imageService === 'openai'
    && metadata.imageModel === 'gpt-image-2'
  ) {
    const estimate = estimateImageCosts({
      openaiImageModel: metadata.imageModel,
      imageSize: metadata.imageSize,
      imageQuality: metadata.imageQuality
    })[0]
    const costPerImageCents = estimate?.costPerImageCents ?? getImageCost(metadata.imageService, metadata.imageModel)
    return costPerImageCents * imageCount
  }

  return getImageCost(metadata.imageService, metadata.imageModel) * imageCount
}

const buildProviderCostExtractionEntry = (
  metadata: ExtractionMetadata,
  provider: string,
  model: string
): StepCostEntry | undefined => {
  if (typeof metadata.providerCostCents !== 'number') {
    return undefined
  }

  const promptTokens = metadata.promptTokens ?? 0
  const completionTokens = metadata.completionTokens ?? 0
  const tokenValue = promptTokens + completionTokens
  const useTokenInputs = isTokenPricedOcrProvider(provider) || tokenValue > 0
  return {
    step: 'extract',
    provider,
    model,
    cost: metadata.providerCostCents,
    costSource: normalizeCostSource(
      metadata.providerCostSource,
      Array.isArray(metadata.ocrProviderUsage) && metadata.ocrProviderUsage.length > 0
        ? 'provider_usage'
        : 'provider_quote'
    ),
    inputMetric: useTokenInputs ? 'tokens' : 'pages',
    inputValue: useTokenInputs ? tokenValue : metadata.totalPages,
    ...(useTokenInputs ? { promptTokens, completionTokens } : {})
  }
}

const withPartialProviderUsageSource = (
  entry: StepCostEntry | undefined
): StepCostEntry | undefined =>
  entry
    ? {
        ...entry,
        costSource: 'partial_provider_usage'
      }
    : undefined

const addExtractionCostEntry = (
  steps: StepCostEntry[],
  metadata: ExtractionMetadata,
  partial = false
): void => {
  if (metadata.ocrProviderMode === 'pool' && Array.isArray(metadata.ocrPoolTargetUsage)) {
    for (const usage of metadata.ocrPoolTargetUsage.filter(isRecord)) {
      const provider = typeof usage['provider'] === 'string' ? usage['provider'] : undefined
      const model = typeof usage['model'] === 'string' ? usage['model'] : undefined
      if (!provider || !model) continue
      const attemptedPages = typeof usage['attemptedPages'] === 'number'
        ? Math.max(0, Math.floor(usage['attemptedPages']))
        : 0
      const promptTokens = typeof usage['promptTokens'] === 'number' ? usage['promptTokens'] : undefined
      const completionTokens = typeof usage['completionTokens'] === 'number' ? usage['completionTokens'] : undefined
      const providerCostCents = typeof usage['providerCostCents'] === 'number' ? usage['providerCostCents'] : undefined
      const synthetic: ExtractionMetadata = {
        extractionMethod: provider === 'tesseract' ? 'mutool+tesseract' : `${provider}-ocr` as ExtractionMetadata['extractionMethod'],
        totalPages: attemptedPages,
        ocrPages: attemptedPages,
        textPages: 0,
        processingTime: metadata.processingTime,
        dpi: metadata.dpi,
        languages: metadata.languages,
        tokenEstimate: 0,
        ...(provider !== 'tesseract' ? { ocrService: provider, ocrModel: model } : {}),
        ...(promptTokens !== undefined ? { promptTokens } : {}),
        ...(completionTokens !== undefined ? { completionTokens } : {}),
        ...(providerCostCents !== undefined ? { providerCostCents } : {}),
        ...(usage['providerCostSource'] === 'provider_usage' || usage['providerCostSource'] === 'provider_quote' || usage['providerCostSource'] === 'registry_fallback'
          ? { providerCostSource: usage['providerCostSource'] }
          : {}),
        ...(Array.isArray(usage['providerUsage']) ? { ocrProviderUsage: usage['providerUsage'].filter(isRecord) } : {})
      }
      const providerCostEntry = buildProviderCostExtractionEntry(synthetic, provider, model)
      const resolvedEntry = providerCostEntry ?? resolveActualExtractCostEntry(synthetic, provider, model)
      const costEntry = partial ? withPartialProviderUsageSource(resolvedEntry) : resolvedEntry
      if (costEntry) steps.push(costEntry)
    }
    return
  }
  const { provider, model } = resolveExtractionProviderModel(metadata)
  const providerCostEntry = buildProviderCostExtractionEntry(metadata, provider, model)
  const resolvedEntry = providerCostEntry ?? resolveActualExtractCostEntry(metadata, provider, model)
  const entry = partial ? withPartialProviderUsageSource(resolvedEntry) : resolvedEntry
  if (entry) {
    steps.push(entry)
  }
}

export const computeActualCosts = (input: ComputeActualCostsInput): ActualCostBreakdown => {
  const steps: StepCostEntry[] = []
  const durationSeconds = resolveSttBillingDurationSeconds(input)

  walkRunSteps(input, {
    partialStep2Order: 'before-array-stt',
    visitors: {
      stt: (metadata, model) => {
        const actual = computeActualSttCharge(metadata, model, durationSeconds, input.step1?.url)
        steps.push({
          step: 'stt',
          provider: metadata.transcriptionService,
          model,
          cost: actual.cost,
          costSource: actual.costSource,
          inputMetric: actual.inputMetric,
          inputValue: actual.inputValue,
          ...(typeof actual.promptTokens === 'number' ? { promptTokens: actual.promptTokens } : {}),
          ...(typeof actual.completionTokens === 'number' ? { completionTokens: actual.completionTokens } : {})
        })
      },
      extract: metadata => addExtractionCostEntry(steps, metadata),
      partialExtract: metadata => addExtractionCostEntry(steps, metadata, true),
      llm: (metadata) => {
        const registryService = metadata.llmService
        const rates = getLlmCost(registryService, metadata.llmModel)
        const tokenCost = computeTokenCost(
          rates ?? { inputCostPer1MCents: 0, outputCostPer1MCents: 0 },
          metadata.inputTokenCount,
          metadata.outputTokenCount
        )
        steps.push({
          step: 'llm',
          provider: metadata.llmService,
          model: metadata.llmModel,
          cost: tokenCost.totalCost,
          costSource: metadata.tokenCountSource === 'provider_usage'
            ? 'provider_usage'
            : zeroCostSource(metadata.llmService, tokenCost.totalCost, 'computed_usage'),
          inputMetric: 'tokens',
          inputValue: metadata.inputTokenCount + metadata.outputTokenCount,
          promptTokens: metadata.inputTokenCount,
          completionTokens: metadata.outputTokenCount,
          ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
          ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
        })
      },
      tts: (metadata, characterCount) => {
        const ttsCost = computeTtsCost(metadata.ttsService, metadata.ttsModel, characterCount)
        const cloneCost = typeof metadata.cloneCostCents === 'number' ? metadata.cloneCostCents : 0
        steps.push({
          step: 'tts',
          provider: metadata.ttsService,
          model: metadata.ttsModel,
          cost: ttsCost.cost + cloneCost,
          costSource: zeroCostSource(metadata.ttsService, ttsCost.cost + cloneCost, 'computed_usage'),
          inputMetric: 'characters',
          inputValue: characterCount
        })
      },
      image: (metadata) => {
        const imageCount = Math.max(1, metadata.imageCount)
        const cost = typeof metadata.providerCostCents === 'number'
          ? metadata.providerCostCents
          : computeImageFallbackCost(metadata, imageCount)
        steps.push({
          step: 'image',
          provider: metadata.imageService,
          model: metadata.imageModel,
          cost,
          costSource: typeof metadata.providerCostCents === 'number'
            ? normalizeCostSource(metadata.providerCostSource, 'provider_quote')
            : 'registry_fallback',
          inputMetric: 'images',
          inputValue: imageCount
        })
      },
      video: (metadata) => {
        const videoDuration = metadata.videoDuration ?? 0
        const cost = typeof metadata.providerCostCents === 'number'
          ? metadata.providerCostCents
          : estimateActualVideoFallbackCost(metadata)
        steps.push({
          step: 'video',
          provider: metadata.videoGenService,
          model: metadata.videoGenModel,
          cost,
          costSource: typeof metadata.providerCostCents === 'number'
            ? normalizeCostSource(metadata.providerCostSource, 'provider_quote')
            : 'registry_fallback',
          inputMetric: 'durationSeconds',
          inputValue: videoDuration
        })
      },
      music: (metadata) => {
        const meta = getMusicModelMeta(metadata.musicService, metadata.musicModel)
        let cost = 0
        if (typeof metadata.providerCostCents === 'number') {
          cost = metadata.providerCostCents
        } else if (meta) {
          if (typeof meta.costPerTrackCents === 'number') {
            cost = meta.costPerTrackCents
            if (metadata.lyricsSource === 'generated' && typeof meta.lyricsCostPerTrackCents === 'number') {
              cost += meta.lyricsCostPerTrackCents
            }
          } else if (typeof meta.costPerMinuteCents === 'number' && typeof metadata.musicDurationMs === 'number') {
            cost = meta.costPerMinuteCents * (metadata.musicDurationMs / 60000)
          }
        }
        steps.push({
          step: 'music',
          provider: metadata.musicService,
          model: metadata.musicModel,
          cost,
          costSource: typeof metadata.providerCostCents === 'number'
            ? normalizeCostSource(metadata.providerCostSource, 'provider_quote')
            : 'registry_fallback',
          ...(typeof metadata.musicDurationMs === 'number'
            ? { inputMetric: 'durationMs' as const, inputValue: metadata.musicDurationMs }
            : { inputMetric: 'tracks' as const, inputValue: 1 })
        })
      }
    }
  })

  const totalCost = steps.reduce((sum, s) => sum + s.cost, 0)
  return { totalCost, steps }
}
