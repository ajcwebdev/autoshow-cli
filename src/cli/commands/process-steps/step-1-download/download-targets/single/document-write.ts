import { join } from 'node:path'
import { statPath as stat } from '~/utils/bun-file-io'
import type { DocumentExtractionOptions, ExtractionMetadata, ExtractionOptions, ResolvedLLMModelOptions } from '~/types'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'

const hasConfiguredLlmProvider = (opts: ResolvedLLMModelOptions): boolean =>
  [
    ...(opts.openaiModels ?? []),
    ...(opts.groqModels ?? []),
    ...(opts.geminiModels ?? []),
    ...(opts.anthropicModels ?? []),
    ...(opts.minimaxModels ?? []),
    ...(opts.grokModels ?? []),
    ...(opts.glmModels ?? []),
    ...(opts.kimiModels ?? []),
    ...(opts.togetherModels ?? []),
    ...(opts.cerebrasModels ?? [])
  ].some((value) => typeof value === 'string' && value.length > 0)

export const buildExtractionCallOpts = (target: string, baseDir: string, opts: DocumentExtractionOptions): Partial<ExtractionOptions> => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || opts.outputRootDir,
    dpi: opts.dpi,
    languages: opts.lang,
    outputFormat: opts.out,
    pdfChapterMode: opts.pdfChapterMode,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderMode: opts.ocrProviderMode,
    ocrProviderModeExplicit: opts.ocrProviderModeExplicit,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    primaryOcr: opts.primaryOcr,
    configPath: opts.configPath
  }

  if (opts.pdfChapterMode !== 'local' && hasConfiguredLlmProvider(opts)) {
    const llmConfig = resolveLLMDefaults(opts)
    if (typeof llmConfig.llmService === 'string' && typeof llmConfig.llmModel === 'string') {
      extractionOpts.pdfChapterLlmService = llmConfig.llmService
      extractionOpts.pdfChapterLlmModel = llmConfig.llmModel
    }
  }

  if (opts.password) {
    extractionOpts.password = opts.password
  }
  if (opts.ocrConcurrency !== undefined) {
    extractionOpts.ocrConcurrency = opts.ocrConcurrency
  }
  if (opts.useTesseract) {
    extractionOpts.useTesseract = true
  }
  if (opts.mistralOcrModels) {
    extractionOpts.mistralOcrModels = opts.mistralOcrModels
  }
  if (opts.glmOcrModels) {
    extractionOpts.glmOcrModels = opts.glmOcrModels
  }
  if (opts.kimiOcrModels) {
    extractionOpts.kimiOcrModels = opts.kimiOcrModels
  }
  if (opts.openaiOcrModels) {
    extractionOpts.openaiOcrModels = opts.openaiOcrModels
  }
  if (opts.grokOcrModels) {
    extractionOpts.grokOcrModels = opts.grokOcrModels
  }
  if (opts.anthropicOcrModels) {
    extractionOpts.anthropicOcrModels = opts.anthropicOcrModels
  }
  if (opts.geminiOcrModels) {
    extractionOpts.geminiOcrModels = opts.geminiOcrModels
  }
  if (opts.deepinfraOcrModels) {
    extractionOpts.deepinfraOcrModels = opts.deepinfraOcrModels
  }
  if (opts.replicateOcrModels) {
    extractionOpts.replicateOcrModels = opts.replicateOcrModels
  }
  if (opts.falOcrModels) {
    extractionOpts.falOcrModels = opts.falOcrModels
  }
  if (typeof opts.chapterFiles === 'boolean') {
    extractionOpts.chapterFiles = opts.chapterFiles
  }
  if (typeof opts.chapterChunkLimitChars === 'number') {
    extractionOpts.chapterChunkLimitChars = opts.chapterChunkLimitChars
  }
  if (step2SelectionOrigins) {
    extractionOpts.step2SelectionOrigins = step2SelectionOrigins
  }

  return extractionOpts
}

const rootArtifactDirectoryExists = async (
  outputDir: string,
  directory: string
): Promise<boolean> =>
  await stat(join(outputDir, directory)).then((entry) => entry.isDirectory(), () => false)

export const appendChapterExportArtifacts = async (
  artifactFiles: Record<string, string>,
  step2Metadata: ExtractionMetadata | ExtractionMetadata[],
  outputDir: string
): Promise<void> => {
  const primary = Array.isArray(step2Metadata) ? step2Metadata[0] : step2Metadata
  const exportSummary = primary?.chapterExport
  if (!exportSummary || !Array.isArray(exportSummary.directories)) {
    return
  }

  if (exportSummary.directories.includes('chapters') && await rootArtifactDirectoryExists(outputDir, 'chapters')) {
    artifactFiles['chapters'] = 'chapters/'
  }
  if (exportSummary.directories.includes('chunks') && await rootArtifactDirectoryExists(outputDir, 'chunks')) {
    artifactFiles['chunks'] = 'chunks/'
  }
}
