import type { ExpectedOutputOptions, LlmRuntimeOptions, OcrRuntimeOptions, ProcessCommand, ResolvedInputRouting, SttRuntimeOptions } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { collectSttTargets, collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { shouldExportEpubChapters } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { isDocumentLikeTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
const getEffectiveLlmOutputCount = (opts: LlmRuntimeOptions): number => {
  const llmConfig = resolveLLMDefaults(opts)
  return [
    ...(llmConfig.openaiModels ?? (llmConfig.openaiModel ? [llmConfig.openaiModel] : [])),
    ...(llmConfig.groqModels ?? (llmConfig.groqModel ? [llmConfig.groqModel] : [])),
    ...(llmConfig.geminiModels ?? (llmConfig.geminiModel ? [llmConfig.geminiModel] : [])),
    ...(llmConfig.anthropicModels ?? (llmConfig.anthropicModel ? [llmConfig.anthropicModel] : [])),
    ...(llmConfig.minimaxModels ?? (llmConfig.minimaxModel ? [llmConfig.minimaxModel] : [])),
    ...(llmConfig.grokModels ?? (llmConfig.grokModel ? [llmConfig.grokModel] : [])),
    ...(llmConfig.glmModels ?? (llmConfig.glmModel ? [llmConfig.glmModel] : [])),
    ...(llmConfig.kimiModels ?? (llmConfig.kimiModel ? [llmConfig.kimiModel] : [])),
    ...(llmConfig.togetherModels ?? (llmConfig.togetherModel ? [llmConfig.togetherModel] : [])),
    ...(llmConfig.cerebrasModels ?? (llmConfig.cerebrasModel ? [llmConfig.cerebrasModel] : []))
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).length
}

const getExpectedLlmJsonArtifact = (llmOutputCount: number): string =>
  llmOutputCount <= 1 ? 'text.json' : 'text-<model>.json'

const getExpectedShowNoteArtifact = (llmOutputCount: number): string =>
  llmOutputCount <= 1 ? 'show-note.md' : 'show-note-<model>.md'

const getExpectedOcrArtifact = (opts: Pick<OcrRuntimeOptions, 'out'>): string =>
  opts.out === 'json' ? 'result.json' : 'extraction.txt'

const POOLED_OCR_ATTEMPT_ARTIFACTS = [
  'providers/<service>-<model>/attempts/page-<number>/attempt-<number>/result.json',
  'providers/<service>-<model>/attempts/page-<number>/attempt-<number>/usage.json'
] as const

const getExpectedOcrExportArtifacts = (
  opts: Pick<OcrRuntimeOptions, 'chapterFiles' | 'chapterChunkLimitChars'>,
  routing?: ResolvedInputRouting
): string[] => {
  const artifacts: string[] = []
  const sourceKind = routing?.resolvedStep2.sourceKind
  const epubChaptersAutomatic = sourceKind === 'epub' && shouldExportEpubChapters(opts.chapterFiles)
  if (opts.chapterFiles === true || epubChaptersAutomatic) {
    artifacts.push('chapters/*.txt (EPUB native text runs, or PDF chapter autodetection)')
  }
  if (typeof opts.chapterChunkLimitChars === 'number' && !epubChaptersAutomatic && opts.chapterFiles !== true) {
    artifacts.push('chunks/*.txt (EPUB native text runs only)')
  }
  return artifacts
}

const collectExpectedSttTargets = (
  opts: SttRuntimeOptions,
  resolvedTarget?: string
) => typeof resolvedTarget === 'string'
  ? collectSttTargetsForSource(opts, sttSourceFromInput(resolvedTarget))
  : collectSttTargets(opts)

export const buildExpectedFilesList = async (
  command: ProcessCommand,
  opts: ExpectedOutputOptions,
  resolvedTarget?: string
): Promise<string[]> => {
  const routing = typeof resolvedTarget === 'string'
    ? await resolveInputRoutingForCommand(command === 'download' || command === 'metadata' ? 'write' : command, resolvedTarget, opts)
    : undefined
  const extractRoute = routing?.extractRoute

  if (command === 'metadata') {
    if (!opts.save) {
      return [opts.markdown ? 'metadata (logged to terminal as Markdown frontmatter YAML)' : 'metadata (logged to terminal)']
    }
    return opts.markdown ? ['manifest.json', 'metadata.md'] : ['manifest.json']
  }
  if (command === 'download') {
    const documentDownload = typeof resolvedTarget === 'string' && await isDocumentLikeTarget(resolvedTarget, opts)
    return documentDownload ? ['manifest.json'] : [opts.bestQuality ? 'Media file' : 'Audio file', 'manifest.json']
  }
  if (isExtractCommand(command) && (extractRoute === 'document' || extractRoute === 'article')) {
    const ocrArtifact = getExpectedOcrArtifact(opts)
    const ocrExportArtifacts = getExpectedOcrExportArtifacts(opts, routing)
    const htmlArticleInput = routing?.family === 'html_article'
    if (htmlArticleInput && opts.urlBackends) {
      return ['providers/<backend>/result.json', 'providers/<backend>/extraction.txt', 'manifest.json']
    }
    if (!htmlArticleInput && opts.ocrProviderMode === 'pool') {
      return [ocrArtifact, ...ocrExportArtifacts, ...POOLED_OCR_ATTEMPT_ARTIFACTS, 'manifest.json']
    }
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      return [ocrArtifact, ...ocrExportArtifacts, 'providers/<service>-<model>/result.json', 'manifest.json']
    }
    return [ocrArtifact, ...ocrExportArtifacts, 'manifest.json']
  }
  if (isExtractCommand(command) && extractRoute === 'media') {
    const files = collectExpectedSttTargets(opts, resolvedTarget).length > 1
      ? ['Shared audio artifact(s)', 'providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json', 'prompt.md', 'manifest.json']
      : ['Audio file', 'transcription.txt', 'result.json', 'prompt.md', 'manifest.json']
    if (opts.youtubeCaptions) {
      files.splice(files.length - 2, 0, 'youtube-captions.vtt (when available)', 'youtube-captions.json (when available)')
    }
    return files
  }
  if (command === 'write' && opts.textInput) {
    const llmOutputCount = getEffectiveLlmOutputCount(opts)
    const files = [
      getExpectedLlmJsonArtifact(llmOutputCount),
      getExpectedShowNoteArtifact(llmOutputCount)
    ]
    if (opts.renderedText) {
      files.push(llmOutputCount <= 1 ? 'text.md' : 'text-<model>.md')
    }
    if (typeof opts.renderedOutDir === 'string' && opts.renderedOutDir.length > 0) {
      files.push(`${opts.renderedOutDir}/*.md`)
    }
    files.push('prompt.md')
    files.push('manifest.json')
    return files
  }
  const llmOutputCount = getEffectiveLlmOutputCount(opts)
  const summaryFile = getExpectedLlmJsonArtifact(llmOutputCount)
  const showNoteFile = getExpectedShowNoteArtifact(llmOutputCount)
  if (command === 'write' && routing?.family === 'x_space') {
    const files = ['result.json', 'extraction.md', summaryFile, showNoteFile]
    if (opts.renderedText) {
      files.push(llmOutputCount <= 1 ? 'text.md' : 'text-<model>.md')
    }
    files.push('prompt.md')
    files.push('manifest.json')
    return files
  }
  const documentWrite = command === 'write'
    && (routing?.family === 'document' || routing?.family === 'html_article')
  if (documentWrite) {
    const htmlArticleInput = routing?.family === 'html_article'
    const files = htmlArticleInput && opts.urlBackends
      ? ['providers/<backend>/result.json', 'providers/<backend>/extraction.txt', summaryFile]
      : [getExpectedOcrArtifact(opts), summaryFile]
    files.push(showNoteFile)
    files.push(...getExpectedOcrExportArtifacts(opts))
    if (!htmlArticleInput && opts.ocrProviderMode === 'pool') {
      files.push(...POOLED_OCR_ATTEMPT_ARTIFACTS)
    } else if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      files.push('providers/<service>-<model>/result.json')
    }
    files.push('prompt.md')
    if (!files.some((entry) => entry.startsWith('manifest.json'))) {
      files.push('manifest.json')
    }
    return files
  }
  const files = ['Audio file', 'transcription.txt', 'result.json']
  if (!opts.skipLLM) {
    files.push(summaryFile)
    files.push(showNoteFile)
  }
  if (collectExpectedSttTargets(opts, resolvedTarget).length > 1) {
    files.push('providers/<service>-<model>/transcription.txt')
    files.push('providers/<service>-<model>/result.json')
  }
  if (opts.youtubeCaptions) {
    files.push('youtube-captions.vtt (when available)')
    files.push('youtube-captions.json (when available)')
  }
  files.push('prompt.md')
  files.push('manifest.json')
  return files
}

export const buildBatchExpectedFilesList = async (
  command: ProcessCommand,
  opts: ExpectedOutputOptions,
  sampleTarget: string
): Promise<string[]> => {
  const expectedFiles = await buildExpectedFilesList(command, opts, sampleTarget)
  const childFiles = expectedFiles
    .filter((file) => !file.includes('/*.md'))
    .map((file) => `<child-run>/${file}`)
  const externalFiles = expectedFiles.filter((file) => file.includes('/*.md'))
  return ['manifest.json', ...childFiles, ...externalFiles]
}
