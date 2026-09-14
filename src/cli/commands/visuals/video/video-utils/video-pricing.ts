import { estimateFalPriorityCost, isFalPriorityVideo } from '../video-services/fal-video-service/fal-priority-video-contract'
import type { EstimateVideoCostOptions, FalVideoModel, GeminiVideoModel, GrokVideoModel, LtxVideoModel, LumalabsVideoModel, ProviderModelSelectionSpec, ReplicateVideoModel, VideoCostEstimate, VideoMode, VideoProvider } from '~/types'
import { validateFalVideoModel, validateGeminiVideoModel, validateGrokVideoModel, validateLtxVideoModel, validateLumalabsVideoModel, validateReplicateVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getVideoModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { deriveGenerationPricingProviders, VIDEO_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import {
  normalizeGeminiDuration,
  normalizeGeminiResolution,
  normalizeGrokVideoDuration,
  normalizeGrokVideoResolution,
  normalizeLtxVideoResolution,
  normalizeLtxVideoDuration,
  normalizeLtxVideoSize,
  normalizeReplicateVideoResolution,
  resolveReplicateBilledDuration,
  normalizeLumaVideoDuration,
  normalizeLumaVideoResolution,
  isReplicateSeedanceVideoModel
} from './video-normalization'
import * as l from '~/utils/app-logger/app-logger'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'

export const VIDEO_PRICING_PROVIDERS = deriveGenerationPricingProviders(VIDEO_GENERATION_SELECTION) satisfies readonly ProviderModelSelectionSpec<EstimateVideoCostOptions, VideoProvider>[]

export const VIDEO_PRICING_MODEL_KEYS = passThroughKeys(VIDEO_PRICING_PROVIDERS)

const GEMINI_MODEL_COST_FALLBACKS: Record<GeminiVideoModel, { cents720p: number, cents1080p: number }> = {
  'veo-3.1-lite-generate-preview': { cents720p: 5, cents1080p: 8 }
}

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
  const fallback = GEMINI_MODEL_COST_FALLBACKS[model]
  const costPerSecond = normalizedResolution === '1080p'
    ? (meta?.baseCostPerSecondCents !== undefined
      ? meta.baseCostPerSecondCents * (meta.resolutionMultiplier1080p ?? 1)
      : fallback.cents1080p)
    : (meta?.baseCostPerSecondCents ?? fallback.cents720p)

  return {
    provider: 'gemini',
    model,
    durationSeconds,
    billedDurationSeconds,
    costPerSecond,
    totalCost: billedDurationSeconds * costPerSecond,
    note: `Approximate estimate using ${normalizedResolution} per-second pricing${normalizedResolution === '1080p' ? '; 1080p is normalized to 8s' : ''}`
  }
}

const estimateGeminiCost = (model: GeminiVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  return estimateGeminiModelCost(model, options.videoDuration, options.videoResolution, options.videoMode)
}

const estimateGrokCost = (model: GrokVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('grok', model)
  const durationSeconds = normalizeGrokVideoDuration(options.videoDuration)
  const normalizedResolution = normalizeGrokVideoResolution(options.videoResolution, model)
  const resolutionMultiplier = normalizedResolution === '1080p'
    ? (meta?.resolutionMultiplier1080p ?? 3.125)
    : normalizedResolution === '720p'
      ? (meta?.resolutionMultiplier720p ?? 1.75)
      : 1
  const costPerSecond = (meta?.baseCostPerSecondCents ?? 8) * resolutionMultiplier
  const inputImageCount = Math.max(0, Math.floor(options.grokInputImageCount ?? 0))
  const inputImageCost = inputImageCount * (meta?.inputImageCostCents ?? 1)
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

const getLtxSizeResolutionMultiplier = (size: string): number => {
  if (size === '3840x2160' || size === '2160x3840') return 4
  if (size === '2560x1440' || size === '1440x2560') return 2
  return 1
}

const estimateLtxCost = (model: LtxVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('ltx', model)
  const mode = options.videoMode
  const size = normalizeLtxVideoSize(model, options.videoResolution, options.videoAspectRatio)
  const durationSeconds = normalizeLtxVideoDuration(model, size, options.videoDuration, mode)
  const costPerSecond = meta?.costPerSecondByResolutionCents?.[normalizeLtxVideoResolution(options.videoResolution, model)]
    ?? (meta?.baseCostPerSecondCents ?? 0) * getLtxSizeResolutionMultiplier(size)

  return {
    provider: 'ltx',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost: durationSeconds * costPerSecond,
    note: `Approximate estimate using ${size} per-second pricing`
  }
}

const getReplicateCostPerSecond = (
  model: ReplicateVideoModel,
  resolution: string,
  hasVideoInput: boolean,
  generateAudio: boolean
): number => {
  const meta = getVideoModelMeta('replicate', model)
  const audioRate = generateAudio
    ? meta?.audioCostPerSecondByResolutionCents?.[resolution]
    : undefined
  const videoInputRate = hasVideoInput
    ? meta?.videoInputCostPerSecondByResolutionCents?.[resolution]
    : undefined
  const nonVideoRate = meta?.costPerSecondByResolutionCents?.[resolution] ?? meta?.baseCostPerSecondCents
  return audioRate ?? videoInputRate ?? nonVideoRate ?? 0
}

const estimateLumalabsCost = (model: LumalabsVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('lumalabs', model)
  const resolution = normalizeLumaVideoResolution(options.videoResolution)
  const durationSeconds = normalizeLumaVideoDuration(options.videoDuration) === '10s' ? 10 : 5
  const fixedCost = meta?.fixedCostByResolutionDurationCents?.[resolution]?.[String(durationSeconds)]
  const totalCost = typeof fixedCost === 'number' ? fixedCost : 0
  return {
    provider: 'lumalabs',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond: durationSeconds > 0 ? totalCost / durationSeconds : 0,
    totalCost,
    note: `Estimate using published Luma Labs ${resolution}/${durationSeconds}s video generation pricing`
  }
}

const estimateFalCost = (model: FalVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  if (isFalPriorityVideo(model)) return estimateFalPriorityCost(model, options)
  const meta = getVideoModelMeta('fal', model)
  const durationSeconds = options.videoDuration ?? 5
  const costPerSecond = meta?.baseCostPerSecondCents ?? 26
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

export const estimateReplicateCost = (model: ReplicateVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const resolution = normalizeReplicateVideoResolution(model, options.videoResolution)
  const durationSeconds = resolveReplicateBilledDuration(model, options.videoDuration)
  const hasVideoInput = isReplicateSeedanceVideoModel(model)
    && Math.max(0, Math.floor(options.replicateVideoReferenceVideoCount ?? 0)) > 0
  const generateAudio = options.videoGenerateAudio === true
  const costPerSecond = getReplicateCostPerSecond(model, resolution, hasVideoInput, generateAudio)
  const totalCost = durationSeconds * costPerSecond
  const videoInputNote = hasVideoInput ? ' video-input' : ''
  const audioNote = generateAudio ? ' with native audio' : ''
  return {
    provider: 'replicate',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost,
    note: options.videoDuration === -1
      ? `Approximate estimate using ${resolution}${videoInputNote}${audioNote} per-second pricing; intelligent duration budgeted at ${durationSeconds}s`
      : `Approximate estimate using ${resolution}${videoInputNote}${audioNote} per-second pricing`
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
      case 'ltx':
        estimates.push(estimateLtxCost(validateLtxVideoModel(selection.model), options))
        break
      case 'replicate':
        estimates.push(estimateReplicateCost(validateReplicateVideoModel(selection.model), options))
        break
      case 'lumalabs':
        estimates.push(estimateLumalabsCost(validateLumalabsVideoModel(selection.model), options))
        break
      case 'fal':
        estimates.push(estimateFalCost(validateFalVideoModel(selection.model), options))
        break
    }
  }

  if (estimates.length === 0) {
    estimates.push(estimateGeminiModelCost('veo-3.1-lite-generate-preview', options.videoDuration, options.videoResolution, options.videoMode))
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
