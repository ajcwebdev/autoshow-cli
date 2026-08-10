import type { BatchRuntimeOptions } from './batch-options-types'
import type { OcrExtractionOptions, OcrRuntimeOptions } from './ocr-options-types'
import type { SttExtractionOptions } from './stt-options-types'
import type { DownloadRuntimeOptions, MetadataOutputOptions, SharedPipelineOptions, UrlRuntimeOptions, WriteRuntimeOptions } from '../cli-surface/cli-types'
import type { UrlExtractionOptions } from '../url-workflow/url-targets-types'

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
