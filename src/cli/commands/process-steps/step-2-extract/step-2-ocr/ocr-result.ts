import type { EpubArtifactFile, ExtractionMetadata, ExtractionResult, OcrResultBuilderInput } from '~/types'
import { ExtractionMetadataSchema } from '~/types'
import { estimateTokens } from '~/utils/text-utils'
import { validateData } from '~/utils/validate/validation'
import { buildOcrConversionMetadata, buildOcrProviderMetadata } from './ocr-result-provider-metadata'
import { buildOcrResultSummary } from './ocr-result-summary'

export const buildOcrOutput = (
  input: OcrResultBuilderInput
): { result: ExtractionResult, step2Metadata: ExtractionMetadata, artifactFiles?: EpubArtifactFile[] } => {
  const summary = buildOcrResultSummary(input)
  const step2Metadata = validateData(ExtractionMetadataSchema, {
    extractionMethod: input.extractionMethod,
    totalPages: summary.totalPages,
    ocrPages: summary.ocrPages,
    textPages: summary.textPages,
    processingTime: summary.processingTime,
    dpi: input.opts.dpi,
    languages: input.opts.languages,
    tokenEstimate: estimateTokens(summary.result.text),
    ...buildOcrProviderMetadata(input),
    ...buildOcrConversionMetadata(input)
  }, 'extraction metadata')

  return {
    result: summary.result,
    step2Metadata,
    ...(input.artifactFiles ? { artifactFiles: input.artifactFiles } : {})
  }
}
