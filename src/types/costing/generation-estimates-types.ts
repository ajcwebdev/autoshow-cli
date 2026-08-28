import type { EstimateVideoCostOptions, VideoRuntimeOptions } from '~/types'

export type VideoEstimateOptions = EstimateVideoCostOptions & Partial<Pick<
  VideoRuntimeOptions,
  'videoInputImage' | 'videoReferenceImages' | 'videoInputVideo' | 'videoReferenceVideos'
>>
