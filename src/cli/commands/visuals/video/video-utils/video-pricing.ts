import { estimateFalPriorityCost, isFalPriorityVideo } from '../video-services/fal-video-service/fal-priority-video-contract'
import type { EstimateVideoCostOptions, FalVideoModel, GeminiVideoModel, GrokVideoModel, ProviderModelSelectionSpec, VideoCostEstimate, VideoMode, VideoProvider } from '~/types'
import { validateFalVideoModel, validateGeminiVideoModel, validateGrokVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getVideoModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { deriveGenerationPricingProviders, VIDEO_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import {
  normalizeGeminiDuration,
  normalizeGeminiResolution,
  normalizeGrokVideoDuration,
  normalizeGrokVideoResolution
} from './video-normalization'
import * as l from '~/utils/app-logger/app-logger'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'
import { requireRegistryRate } from '~/utils/pricing/registry-rate'

export const VIDEO_PRICING_PROVIDERS = deriveGenerationPricingProviders(VIDEO_GENERATION_SELECTION) satisfies readonly ProviderModelSelectionSpec<EstimateVideoCostOptions, VideoProvider>[]

export const VIDEO_PRICING_MODEL_KEYS = passThroughKeys(VIDEO_PRICING_PROVIDERS)

const estimateGeminiModelCost = (
  model: GeminiVideoModel,
  duration: number | undefined,
  resolution: string | undefined,
  mode?: string | undefined
): VideoCostEstimate => {
  const meta = getVideoModelMeta('gemini', model)
  const normalizedResolution = normalizeGeminiResolution(resolution, model)
  const durationSeconds = normalizeGeminiDuration(duration, normalizedResolution, mode as VideoMode | undefined)
  const billedDurationSeconds = durationSeconds
  const costPerSecond = requireRegistryRate(
    meta?.costPerSecondByResolutionCents?.[normalizedResolution] ?? meta?.baseCostPerSecondCents,
    { category: 'video', service: 'gemini', model, field: `costPerSecondByResolutionCents.${normalizedResolution}` }
  )

  return {
    provider: 'gemini',
    model,
    durationSeconds,
    billedDurationSeconds,
    costPerSecond,
    totalCost: billedDurationSeconds * costPerSecond,
    note: duration === undefined
      ? `Approximate estimate using ${normalizedResolution} per-second pricing; unspecified duration budgeted at ${billedDurationSeconds}s`
      : `Approximate estimate using ${normalizedResolution} per-second pricing`
  }
}

const estimateGeminiCost = (model: GeminiVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  return estimateGeminiModelCost(model, options.videoDuration, options.videoResolution, options.videoMode)
}

const estimateGrokCost = (model: GrokVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('grok', model)
  const durationSeconds = normalizeGrokVideoDuration(options.videoDuration)
  const normalizedResolution = normalizeGrokVideoResolution(options.videoResolution, model)
  // 480p is the base rate, so only the upscaled resolutions carry a registry multiplier.
  const resolutionMultiplier = normalizedResolution === '1080p'
    ? requireRegistryRate(meta?.resolutionMultiplier1080p, { category: 'video', service: 'grok', model, field: 'resolutionMultiplier1080p' })
    : normalizedResolution === '720p'
      ? requireRegistryRate(meta?.resolutionMultiplier720p, { category: 'video', service: 'grok', model, field: 'resolutionMultiplier720p' })
      : 1
  const costPerSecond = requireRegistryRate(meta?.baseCostPerSecondCents, { category: 'video', service: 'grok', model, field: 'baseCostPerSecondCents' }) * resolutionMultiplier
  const inputImageCount = Math.max(0, Math.floor(options.grokInputImageCount ?? 0))
  const inputImageCost = inputImageCount * (inputImageCount > 0
    ? requireRegistryRate(meta?.inputImageCostCents, { category: 'video', service: 'grok', model, field: 'inputImageCostCents' })
    : 0)
  const mediaInputCost = inputImageCost
  const totalCost = (durationSeconds * costPerSecond) + mediaInputCost
  const mediaNote = mediaInputCost > 0
    ? ` plus ${mediaInputCost.toFixed(3)}¢ media input charges`
    : ''
  return {
    provider: 'grok',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost,
    note: `Approximate estimate using ${normalizedResolution} per-second pricing${mediaNote}`
  }
}

const estimateFalCost = (model: FalVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  if (isFalPriorityVideo(model)) return estimateFalPriorityCost(model, options)
  const meta = getVideoModelMeta('fal', model)
  const durationSeconds = options.videoDuration ?? 5
  const costPerSecond = requireRegistryRate(meta?.baseCostPerSecondCents, { category: 'video', service: 'fal', model, field: 'baseCostPerSecondCents' })
  return {
    provider: 'fal',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost: durationSeconds * costPerSecond,
    note: 'Estimate using fal.ai published per-second pricing'
  }
}

export const estimateVideoCosts = (options: EstimateVideoCostOptions): VideoCostEstimate[] => {
  const estimates: VideoCostEstimate[] = []
  for (const selection of collectSelections(options, VIDEO_PRICING_PROVIDERS)) {
    switch (selection.service) {
      case 'gemini':
        estimates.push(estimateGeminiCost(validateGeminiVideoModel(selection.model), options))
        break
      case 'grok':
        estimates.push(estimateGrokCost(validateGrokVideoModel(selection.model), options))
        break
      case 'fal':
        estimates.push(estimateFalCost(validateFalVideoModel(selection.model), options))
        break
    }
  }

  if (estimates.length === 0) {
    estimates.push(estimateGeminiModelCost('gemini-omni-1.1-flash', options.videoDuration, options.videoResolution, options.videoMode))
  }

  return estimates
}

export const estimateVideoCost = (options: EstimateVideoCostOptions): VideoCostEstimate => estimateVideoCosts(options)[0]!

export const logVideoEstimate = (estimate: VideoCostEstimate): void => {
  l.write('info', `Estimated ${estimate.durationSeconds}s video with ${estimate.provider}/${estimate.model}: ${estimate.totalCost.toFixed(3)}¢`, {
    category: 'pricing',
    metadata: estimate
  })
}
