import type { BatchRuntimeOptions, DownloadRuntimeOptions, SharedPipelineOptions } from '~/types'

export type DownloadMediaRuntimeOptions = Pick<BatchRuntimeOptions, 'keepOriginalMedia' | 'bestQuality' | 'flatBatch'>
  & DownloadRuntimeOptions
  & Pick<SharedPipelineOptions, 'outputRootDir'>
