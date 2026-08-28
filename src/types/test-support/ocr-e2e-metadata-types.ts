type OcrE2eEpubExportMetadata = {
  sourceFormat?: 'epub' | 'pdf'
  mode?: 'chapters' | 'chunks'
  chunkLimitChars?: number
  directories?: string[]
  chapterFilesWritten?: number
  chunkFilesWritten?: number
  logicalChapterCount?: number
  logicalChapterSource?: 'toc' | 'spine' | 'heading'
  tocStartSections?: number
  prefaceSectionsDropped?: number
}

type OcrE2ePdfChapterDetectionMetadata = {
  strategyUsed?: string
  tocPages?: number[]
  pageMapSpans?: Array<Record<string, unknown>>
  chapters?: Array<Record<string, unknown>>
  warnings?: string[]
}

export type OcrE2eExtractMetadata = {
  step1?: { format?: string }
  primaryProvider?: { service?: string; model?: string }
  resolvedStep2?: {
    route?: string
    sourceKind?: string
    providers?: Array<{ service?: string; model?: string; origin?: string }>
  }
  requestedProviders?: Array<{ service?: string; model?: string }>
  providerStates?: Array<{ service?: string; model?: string; status?: string; artifactDir?: string; attempts?: number }>
  missingProviders?: Array<unknown>
  step2?: {
    extractionMethod?: string
    totalPages?: number
    epub?: Record<string, unknown>
    chapterExport?: OcrE2eEpubExportMetadata
    pdfChapterDetection?: OcrE2ePdfChapterDetectionMetadata
    outputFidelity?: string
  }
}
