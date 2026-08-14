import type { ComputeEstimatedProcessingTimesInput } from '~/types'


export type TimedExtractProvider = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]['provider']


export type AggregateTimingOptions = {
  concurrencyMode?: ComputeEstimatedProcessingTimesInput['concurrencyMode'] | undefined
  ttsInputText?: string | undefined
  ttsChunkConcurrency?: number | undefined
  ocrConcurrency?: number | undefined
  ocrConcurrencyMode?: ComputeEstimatedProcessingTimesInput['ocrConcurrencyMode'] | undefined
  ocrProviderConcurrency?: number | undefined
  ocrLocalConcurrency?: number | undefined
}

export type TimedImageService = NonNullable<ComputeEstimatedProcessingTimesInput['imageTargets']>[number]['service']

export type TimedMusicService = NonNullable<ComputeEstimatedProcessingTimesInput['musicTargets']>[number]['service']

export type TimedSttService = NonNullable<ComputeEstimatedProcessingTimesInput['sttTargets']>[number]['service']

export type TimedVideoService = NonNullable<ComputeEstimatedProcessingTimesInput['videoTargets']>[number]['service']
