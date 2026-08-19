import type { BatchRuntimeOptions, DownloadRuntimeOptions, MetadataOutputOptions, OcrExtractionOptions, OcrRuntimeOptions, SharedPipelineOptions, SttExtractionOptions, UrlExtractionOptions, UrlRuntimeOptions, WriteRuntimeOptions } from '~/types'

export type MetadataCommandOptions = OcrRuntimeOptions
  & UrlRuntimeOptions
  & MetadataOutputOptions
  & Pick<SharedPipelineOptions, 'outputRootDir'>

export type DownloadCommandOptions = MetadataCommandOptions
  & BatchRuntimeOptions
  & DownloadRuntimeOptions

export type ExtractCommandOptions = SttExtractionOptions
  & OcrExtractionOptions
  & UrlExtractionOptions

export type SingleTargetCommandOptions = MetadataCommandOptions
  | DownloadCommandOptions
  | ExtractCommandOptions
  | WriteRuntimeOptions
