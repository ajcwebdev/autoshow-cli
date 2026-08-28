import type { EstimateVideoCostOptions, FalVideoModel, GeminiVideoModel, GrokVideoModel, LtxVideoModel, LumalabsVideoModel, ProviderModelSelectionSpec, ReplicateVideoModel, VideoCostEstimate, VideoProvider } from '~/types'
import { validateFalVideoModel, validateGeminiVideoModel, validateGrokVideoModel, validateLtxVideoModel, validateLumalabsVideoModel, validateReplicateVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getVideoModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { deriveGenerationPricingProviders, VIDEO_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import {
  normalizeGeminiDuration,
  normalizeGeminiResolution,
  normalizeGrokVideoDuration,
  normalizeGrokVideoExtensionDuration,
  normalizeGrokVideoResolution,
  normalizeLtxVideoDuration,
  normalizeLtxVideoSize,
  normalizeReplicateVideoResolution,
  resolveReplicateBilledDuration,
  normalizeLumaVideoDuration,
  normalizeLumaVideoResolution,
  isReplicateSeedanceVideoModel
} from './video-normalization'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'

export const VIDEO_PRICING_PROVIDERS = deriveGenerationPricingProviders(VIDEO_GENERATION_SELECTION) satisfies readonly ProviderModelSelectionSpec<EstimateVideoCostOptions, VideoProvider>[]

export const VIDEO_PRICING_MODEL_KEYS = passThroughKeys(VIDEO_PRICING_PROVIDERS)

const GEMINI_MODEL_COST_FALLBACKS: Record<GeminiVideoModel, { cents720p: number, cents1080p: number, cents4k: number }> = {
  'veo-3.1-fast-generate-preview': { cents720p: 10, cents1080p: 12, cents4k: 30 },
  'veo-3.1-generate-preview': { cents720p: 40, cents1080p: 40, cents4k: 60 },
  'veo-3.1-lite-generate-preview': { cents720p: 5, cents1080p: 8, cents4k: 8 }
}

const estimateGeminiModelCost = (
  model: GeminiVideoModel,
  duration: number | undefined,
  resolution: string | undefined,
  mode?: string | undefined
): VideoCostEstimate => {
  const meta = getVideoModelMeta('gemini', model)
  const normalizedResolution = mode === 'extend' ? '720p' : normalizeGeminiResolution(resolution, model)
  const normalizedMode: 'reference-to-video' | 'extend' | undefined = mode === 'reference-to-video' || mode === 'extend' ? mode : undefined
  const durationSeconds = normalizeGeminiDuration(duration, normalizedResolution, normalizedMode)
  const billedDurationSeconds = durationSeconds
  const fallback = GEMINI_MODEL_COST_FALLBACKS[model]
  const costPerSecond = normalizedResolution === '4k'
    ? fallback.cents4k
    : normalizedResolution === '1080p'
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
    note: normalizedResolution === '4k'
      ? 'Approximate estimate using 4k execution with fallback per-second pricing; Gemini 4k is normalized to 8s'
      : `Approximate estimate using ${normalizedResolution} per-second pricing${normalizedResolution === '1080p' ? '; 1080p is normalized to 8s' : ''}`
  }
}

const estimateGeminiCost = (model: GeminiVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  return estimateGeminiModelCost(model, options.videoDuration, options.videoResolution, options.videoMode)
}

const estimateGrokCost = (model: GrokVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('grok', model)
  const durationSeconds = options.videoMode === 'extend'
    ? normalizeGrokVideoExtensionDuration(options.videoDuration)
    : normalizeGrokVideoDuration(options.videoDuration)
  const normalizedResolution = normalizeGrokVideoResolution(options.videoResolution, model)
  const resolutionMultiplier = normalizedResolution === '1080p'
    ? (meta?.resolutionMultiplier1080p ?? 1)
    : normalizedResolution === '720p'
      ? (meta?.resolutionMultiplier720p ?? 1.4)
      : 1
  const costPerSecond = (meta?.baseCostPerSecondCents ?? 5) * resolutionMultiplier
  const inputImageCount = Math.max(0, Math.floor(options.grokInputImageCount ?? 0))
  const inputImageCost = inputImageCount * (meta?.inputImageCostCents ?? 0.2)
  const inputVideoDurationSeconds = typeof options.grokInputVideoDurationSeconds === 'number' && Number.isFinite(options.grokInputVideoDurationSeconds)
    ? Math.max(0, options.grokInputVideoDurationSeconds)
    : 0
  const inputVideoCost = inputVideoDurationSeconds * (meta?.inputVideoCostPerSecondCents ?? 1)
  const mediaInputCost = inputImageCost + inputVideoCost
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
  const isExtend = mode === 'extend'
  const costPerSecond = isExtend
    ? 10
    : (meta?.baseCostPerSecondCents ?? 0) * getLtxSizeResolutionMultiplier(size)

  return {
    provider: 'ltx',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost: durationSeconds * costPerSecond,
    note: isExtend
      ? 'Approximate Pro-only extension estimate; LTX may also bill context frames from the input video'
      : `Approximate estimate using ${size} per-second pricing`
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
  const meta = getVideoModelMeta('fal', model)
  const durationSeconds = options.videoDuration ?? 5
  const costPerSecond = meta?.baseCostPerSecondCents ?? (model === 'minimax/h3' ? 26 : 0.5)
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
      ? `Approximate estimate using ${resolution}${videoInputNote}${audioNote} per-second pricing; intelligent duration estimated as 5s`
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
    estimates.push(estimateGeminiModelCost('veo-3.1-fast-generate-preview', options.videoDuration, options.videoResolution, options.videoMode))
  }

  return estimates
}

export const estimateVideoCost = (options: EstimateVideoCostOptions): VideoCostEstimate => estimateVideoCosts(options)[0]!

export const logVideoEstimate = (estimate: VideoCostEstimate): void => {
  const entries: Array<readonly [string, string]> = [
    ['Provider', estimate.provider],
    ['Model', estimate.model],
    ['Requested Duration', `${estimate.durationSeconds}s`],
    ['Billed Duration', `${estimate.billedDurationSeconds}s`],
    ['Cost Per Second', `${estimate.costPerSecond.toFixed(3)}¢`],
    ['Total Cost', `${estimate.totalCost.toFixed(3)}¢`],
    ...(estimate.note ? [['Note', estimate.note] as const] : [])
  ]
  l.write('info', `Estimated video cost for ${estimate.provider}/${estimate.model}`, {
    category: 'pricing',
    humanTable: createKeyValueTable(entries),
    metadata: estimate
  })
}
