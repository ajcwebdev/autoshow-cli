import type { EstimateVideoCostOptions, FalVideoModel, GeminiVideoModel, GlmVideoModel, GrokVideoModel, LtxVideoModel, LumalabsVideoModel, MinimaxVideoModel, ReplicateVideoModel, RunwayVideoModel, VideoCostEstimate } from '~/types'
import { validateFalVideoModel, validateGeminiVideoModel, validateGlmVideoModel, validateGrokVideoModel, validateLtxVideoModel, validateLumalabsVideoModel, validateMinimaxVideoModel, validateReplicateVideoModel, validateRunwayVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getVideoModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  normalizeGeminiDuration,
  normalizeGeminiResolution,
  normalizeGlmDuration,
  normalizeGrokVideoDuration,
  normalizeGrokVideoExtensionDuration,
  normalizeGrokVideoResolution,
  normalizeLtxVideoDuration,
  normalizeLtxVideoSize,
  normalizeMinimaxDuration,
  normalizeMinimaxResolution,
  normalizeReplicateVideoResolution,
  resolveReplicateBilledDuration,
  normalizeRunwayDuration,
  normalizeLumaVideoDuration,
  normalizeLumaVideoResolution,
  isReplicateSeedanceVideoModel,
  isReplicateAlephVideoModel,
  isMinimaxHailuoModel
} from './video-normalization'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

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

const estimateMinimaxCost = (model: MinimaxVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('minimax', model)
  const normalizedResolution = normalizeMinimaxResolution(model, options.videoResolution)
  const normalizedDuration = normalizeMinimaxDuration(model, normalizedResolution, options.videoDuration)
  const fixedCost = meta?.fixedCostByResolutionDurationCents?.[normalizedResolution]?.[String(normalizedDuration)]
  if (typeof fixedCost === 'number') {
    return {
      provider: 'minimax',
      model,
      durationSeconds: normalizedDuration,
      billedDurationSeconds: normalizedDuration,
      costPerSecond: normalizedDuration > 0 ? fixedCost / normalizedDuration : 0,
      totalCost: fixedCost,
      note: `Exact estimate using published ${normalizedResolution}/${normalizedDuration}s pricing`
    }
  }

  const blockSize = meta?.blockSizeSec ?? 6
  const blockCount = Math.max(1, Math.ceil(normalizedDuration / blockSize))
  const blockCost720 = meta?.blockCost720pCents ?? 0
  const blockCost1080 = meta?.blockCost1080pCents ?? blockCost720
  const blockCost = normalizedResolution === '1080p' ? blockCost1080 : blockCost720
  const billedDurationSeconds = blockCount * blockSize
  const totalCost = blockCount * blockCost

  let note = `Approximate estimate billed in ${blockSize}-second blocks`
  if (!isMinimaxHailuoModel(model)) {
    note = `${note}; ${model} currently normalized to 720p/6s`
  } else if (normalizedResolution === '1080p') {
    note = `${note}; 1080p currently supports 6s generation`
  }

  return {
    provider: 'minimax',
    model,
    durationSeconds: normalizedDuration,
    billedDurationSeconds,
    costPerSecond: billedDurationSeconds > 0 ? totalCost / billedDurationSeconds : 0,
    totalCost,
    note
  }
}

const estimateGeminiCost = (model: GeminiVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  return estimateGeminiModelCost(model, options.videoDuration, options.videoResolution, options.videoMode)
}

const estimateGlmCost = (model: GlmVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('glm', model)
  const durationSeconds = normalizeGlmDuration(model, options.videoDuration)
  const totalCost = meta?.baseJobFeeCents ?? 0
  return {
    provider: 'glm',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond: durationSeconds > 0 ? totalCost / durationSeconds : 0,
    totalCost,
    note: 'Flat per-video estimate'
  }
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

const estimateRunwayCost = (model: RunwayVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('runway', model)
  const durationSeconds = normalizeRunwayDuration(options.videoDuration)
  const costPerSecond = meta?.baseCostPerSecondCents ?? 12
  return {
    provider: 'runway',
    model,
    durationSeconds,
    billedDurationSeconds: durationSeconds,
    costPerSecond,
    totalCost: durationSeconds * costPerSecond,
    note: 'Estimate uses Runway credits at $0.01 per credit'
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
  const size = normalizeLtxVideoSize(model, options.videoSize, options.videoResolution, options.videoAspectRatio)
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
  const durationSeconds = isReplicateAlephVideoModel(model) && options.replicateInputVideoDurationSeconds !== undefined
    ? options.replicateInputVideoDurationSeconds
    : resolveReplicateBilledDuration(model, options.videoDuration)
  const hasVideoInput = isReplicateSeedanceVideoModel(model)
    && Math.max(0, Math.floor(options.replicateVideoReferenceVideoCount ?? 0)) > 0
  const generateAudio = options.replicateVideoGenerateAudio === true
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
  const geminiModels = options.geminiVideoModels ?? (options.geminiVideoModel ? [options.geminiVideoModel] : [])
  const minimaxModels = options.minimaxVideoModels ?? (options.minimaxVideoModel ? [options.minimaxVideoModel] : [])
  const glmModels = options.glmVideoModels ?? (options.glmVideoModel ? [options.glmVideoModel] : [])
  const grokModels = options.grokVideoModels ?? (options.grokVideoModel ? [options.grokVideoModel] : [])
  const runwayModels = options.runwayVideoModels ?? (options.runwayVideoModel ? [options.runwayVideoModel] : [])
  const ltxModels = options.ltxVideoModels ?? (options.ltxVideoModel ? [options.ltxVideoModel] : [])
  const replicateModels = options.replicateVideoModels ?? (options.replicateVideoModel ? [options.replicateVideoModel] : [])
  const lumalabsModels = options.lumalabsVideoModels ?? (options.lumalabsVideoModel ? [options.lumalabsVideoModel] : [])
  const falModels = options.falVideoModels ?? (options.falVideoModel ? [options.falVideoModel] : [])

  const estimates: VideoCostEstimate[] = []

  for (const rawModel of geminiModels) {
    const model = validateGeminiVideoModel(rawModel)
    estimates.push(estimateGeminiCost(model, options))
  }

  for (const rawModel of minimaxModels) {
    const model = validateMinimaxVideoModel(rawModel)
    estimates.push(estimateMinimaxCost(model, options))
  }

  for (const rawModel of glmModels) {
    const model = validateGlmVideoModel(rawModel)
    estimates.push(estimateGlmCost(model, options))
  }

  for (const rawModel of grokModels) {
    const model = validateGrokVideoModel(rawModel)
    estimates.push(estimateGrokCost(model, options))
  }

  for (const rawModel of runwayModels) {
    const model = validateRunwayVideoModel(rawModel)
    estimates.push(estimateRunwayCost(model, options))
  }

  for (const rawModel of ltxModels) {
    const model = validateLtxVideoModel(rawModel)
    estimates.push(estimateLtxCost(model, options))
  }

  for (const rawModel of replicateModels) {
    const model = validateReplicateVideoModel(rawModel)
    estimates.push(estimateReplicateCost(model, options))
  }

  for (const rawModel of lumalabsModels) {
    const model = validateLumalabsVideoModel(rawModel)
    estimates.push(estimateLumalabsCost(model, options))
  }

  for (const rawModel of falModels) {
    const model = validateFalVideoModel(rawModel)
    estimates.push(estimateFalCost(model, options))
  }

  if (estimates.length === 0) {
    estimates.push(estimateGeminiModelCost('veo-3.1-fast-generate-preview', options.videoDuration, options.videoResolution, options.videoMode))
  }

  return estimates
}

export const estimateVideoCost = (options: EstimateVideoCostOptions): VideoCostEstimate => {
  const geminiModelRaw = options.geminiVideoModels?.[0] ?? options.geminiVideoModel
  const minimaxModelRaw = options.minimaxVideoModels?.[0] ?? options.minimaxVideoModel
  const glmModelRaw = options.glmVideoModels?.[0] ?? options.glmVideoModel
  const grokModelRaw = options.grokVideoModels?.[0] ?? options.grokVideoModel
  const runwayModelRaw = options.runwayVideoModels?.[0] ?? options.runwayVideoModel
  const ltxModelRaw = options.ltxVideoModels?.[0] ?? options.ltxVideoModel
  const replicateModelRaw = options.replicateVideoModels?.[0] ?? options.replicateVideoModel
  const lumalabsModelRaw = options.lumalabsVideoModels?.[0] ?? options.lumalabsVideoModel
  const falModelRaw = options.falVideoModels?.[0] ?? options.falVideoModel

  if (typeof geminiModelRaw === 'string' && geminiModelRaw.length > 0) {
    const model = validateGeminiVideoModel(geminiModelRaw)
    return estimateGeminiCost(model, options)
  }

  if (typeof minimaxModelRaw === 'string' && minimaxModelRaw.length > 0) {
    const model = validateMinimaxVideoModel(minimaxModelRaw)
    return estimateMinimaxCost(model, options)
  }

  if (typeof glmModelRaw === 'string' && glmModelRaw.length > 0) {
    const model = validateGlmVideoModel(glmModelRaw)
    return estimateGlmCost(model, options)
  }

  if (typeof grokModelRaw === 'string' && grokModelRaw.length > 0) {
    const model = validateGrokVideoModel(grokModelRaw)
    return estimateGrokCost(model, options)
  }

  if (typeof runwayModelRaw === 'string' && runwayModelRaw.length > 0) {
    const model = validateRunwayVideoModel(runwayModelRaw)
    return estimateRunwayCost(model, options)
  }

  if (typeof ltxModelRaw === 'string' && ltxModelRaw.length > 0) {
    const model = validateLtxVideoModel(ltxModelRaw)
    return estimateLtxCost(model, options)
  }

  if (typeof replicateModelRaw === 'string' && replicateModelRaw.length > 0) {
    const model = validateReplicateVideoModel(replicateModelRaw)
    return estimateReplicateCost(model, options)
  }

  if (typeof lumalabsModelRaw === 'string' && lumalabsModelRaw.length > 0) {
    const model = validateLumalabsVideoModel(lumalabsModelRaw)
    return estimateLumalabsCost(model, options)
  }


  if (typeof falModelRaw === 'string' && falModelRaw.length > 0) {
    const model = validateFalVideoModel(falModelRaw)
    return estimateFalCost(model, options)
  }

  return estimateGeminiModelCost('veo-3.1-fast-generate-preview', options.videoDuration, options.videoResolution, options.videoMode)
}

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
