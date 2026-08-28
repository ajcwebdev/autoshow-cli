import type { OcrExtractionOptions, SttExtractionOptions, UrlExtractionOptions } from '~/types'

export type ExtractResumeOptions = SttExtractionOptions & OcrExtractionOptions & UrlExtractionOptions
