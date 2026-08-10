import type { EstimateImageCostOptions, EstimateMusicCostOptions, EstimateVideoCostOptions, ImageStepEstimate, MusicStepEstimate, VideoRuntimeOptions, VideoStepEstimate } from '~/types'
import { estimateImageCosts, IMAGE_PRICING_MODEL_KEYS, IMAGE_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCosts, VIDEO_PRICING_MODEL_KEYS, VIDEO_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCosts, MUSIC_PRICING_MODEL_KEYS, MUSIC_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  getImageEstimation,
  getMusicEstimation,
  getVideoEstimation
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'
import { tryResolveLocalVideoDurationSeconds } from '~/cli/commands/process-steps/step-6-video/video-utils/video-media-inputs'
import { collectSelections, hasAnySelection } from '~/utils/pricing/model-selection'
import { pick } from '~/utils/cli-utils'

export const buildImageEstimates = (opts: EstimateImageCostOptions): ImageStepEstimate[] => {
  if (!hasAnySelection(opts, IMAGE_PRICING_PROVIDERS)) return []

  return estimateImageCosts({
    ...pick(opts, IMAGE_PRICING_MODEL_KEYS),
    imageSize: opts.imageSize,
    imageQuality: opts.imageQuality,
    imageCount: opts.imageCount
  }).map((estimate) => {
    const estimation = getImageEstimation(estimate.provider, estimate.model)
    return {
      step: 'image' as const,
      provider: estimate.provider,
      model: estimate.model,
      imageCount: estimate.imageCount,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

type VideoEstimateOptions = EstimateVideoCostOptions & Partial<Pick<
  VideoRuntimeOptions,
  'videoInputImage' | 'videoReferenceImages' | 'videoInputVideo' | 'replicateVideoReferenceVideos'
>>

const countGrokInputImages = (opts: VideoEstimateOptions): number =>
  (opts.videoInputImage ? 1 : 0) + (opts.videoReferenceImages?.length ?? 0)

const countReplicateInputVideos = (opts: VideoEstimateOptions): number =>
  (opts.videoInputVideo ? 1 : 0) + (opts.replicateVideoReferenceVideos?.length ?? 0)

export const buildVideoEstimates = async (opts: VideoEstimateOptions): Promise<VideoStepEstimate[]> => {
  const selections = collectSelections(opts, VIDEO_PRICING_PROVIDERS)
  if (selections.length === 0) return []

  const hasGrokVideo = selections.some((selection) => selection.service === 'grok')
  const grokInputVideoDurationSeconds = hasGrokVideo && opts.videoInputVideo
    ? await tryResolveLocalVideoDurationSeconds(opts.videoInputVideo)
    : undefined
  const replicateInputVideoDurationSeconds = opts.videoInputVideo
    ? await tryResolveLocalVideoDurationSeconds(opts.videoInputVideo)
    : undefined

  return estimateVideoCosts({
    ...pick(opts, VIDEO_PRICING_MODEL_KEYS),
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoAspectRatio: opts.videoAspectRatio,
    videoResolution: opts.videoResolution,
    videoMode: opts.videoMode,
    ...(hasGrokVideo ? { grokInputImageCount: countGrokInputImages(opts) } : {}),
    ...(grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds } : {}),
    replicateVideoReferenceVideoCount: countReplicateInputVideos(opts),
    replicateVideoGenerateAudio: opts.replicateVideoGenerateAudio,
    ...(replicateInputVideoDurationSeconds !== undefined ? { replicateInputVideoDurationSeconds } : {})
  }).map((estimate) => {
    const estimation = getVideoEstimation(estimate.provider, estimate.model)
    return {
      step: 'video' as const,
      provider: estimate.provider,
      model: estimate.model,
      durationSeconds: estimate.durationSeconds,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

export const buildMusicEstimates = async (opts: EstimateMusicCostOptions): Promise<MusicStepEstimate[]> => {
  if (!hasAnySelection(opts, MUSIC_PRICING_PROVIDERS)) return []

  const estimates = estimateMusicCosts({
    ...pick(opts, MUSIC_PRICING_MODEL_KEYS),
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  const results: MusicStepEstimate[] = []
  for (const estimate of estimates) {
    const estimation = getMusicEstimation(estimate.provider, estimate.model)
    results.push({
      step: 'music',
      provider: estimate.provider,
      model: estimate.model,
      durationSeconds: estimate.durationSeconds,
      lyricsSource: estimate.lyricsSource,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      ...(estimate.note !== undefined ? { note: estimate.note } : {})
    })
  }
  return results
}
