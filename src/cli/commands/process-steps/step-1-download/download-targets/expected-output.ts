import type { ProcessCommand, ResolvedInputRouting, RuntimeOptions } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { collectSttTargets, collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { shouldExportEpubChapters } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults'
import { resolveLLMDefaults } from './options/model-option-llm-defaults'
import { isDocumentLikeTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
const getEffectiveLlmOutputCount = (opts: RuntimeOptions): number => {
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
    ...(llmConfig.cerebrasModels ?? (llmConfig.cerebrasModel ? [llmConfig.cerebrasModel] : [])),
    ...(llmConfig.llamaModels ?? (llmConfig.llamaModel ? [llmConfig.llamaModel] : []))
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).length
}

const getExpectedLlmJsonArtifact = (llmOutputCount: number): string =>
  llmOutputCount <= 1 ? 'text.json' : 'text-<model>.json'

const getExpectedShowNoteArtifact = (llmOutputCount: number): string =>
  llmOutputCount <= 1 ? 'show-note.md' : 'show-note-<model>.md'

const getExpectedOcrArtifact = (opts: RuntimeOptions): string => {
  if (opts.out === 'tsv') {
    return 'extraction.tsv'
  }
  if (opts.out === 'hocr') {
    return 'extraction.hocr'
  }
  if (opts.out === 'json') {
    return 'result.json'
  }
  return 'extraction.txt'
}

const getExpectedOcrExportArtifacts = (
  opts: RuntimeOptions,
  routing?: ResolvedInputRouting
): string[] => {
  const artifacts: string[] = []
  const sourceKind = routing?.resolvedStep2.sourceKind
  const epubChaptersAutomatic = sourceKind === 'epub' && shouldExportEpubChapters(opts.epubChapterFiles)
  if (opts.epubChapterFiles === true || epubChaptersAutomatic) {
    artifacts.push('chapters/*.txt (EPUB native text runs, or PDF chapter autodetection)')
  }
  if (typeof opts.epubChunkLimitChars === 'number' && !epubChaptersAutomatic && opts.epubChapterFiles !== true) {
    artifacts.push('chunks/*.txt (EPUB native text runs only)')
  }
  return artifacts
}

const collectExpectedSttTargets = (
  opts: RuntimeOptions,
  resolvedTarget?: string
) => typeof resolvedTarget === 'string'
  ? collectSttTargetsForSource(opts, sttSourceFromInput(resolvedTarget))
  : collectSttTargets(opts)

export const buildExpectedFilesList = async (
  command: ProcessCommand,
  opts: RuntimeOptions,
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
    return opts.markdown ? ['run.json', 'metadata.md'] : ['run.json']
  }
  if (command === 'download') {
    const documentDownload = typeof resolvedTarget === 'string' && await isDocumentLikeTarget(resolvedTarget, opts)
    return documentDownload ? ['run.json'] : [opts.bestQuality ? 'Media file' : 'Audio file', 'run.json']
  }
  if (isExtractCommand(command) && extractRoute === 'document') {
    const ocrArtifact = getExpectedOcrArtifact(opts)
    const ocrExportArtifacts = getExpectedOcrExportArtifacts(opts, routing)
    const htmlArticleInput = routing?.family === 'html_article'
    if (opts.useEpubBun || opts.useEpubCalibre) {
      return ['run.json (includes EPUB inspection payload)', 'Extracted text (non-EPUB fallback inputs only)', ...ocrExportArtifacts]
    }
    if (htmlArticleInput && opts.urlBackends) {
      return ['providers/<backend>/result.json', 'providers/<backend>/extraction.txt', 'run.json']
    }
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      return [ocrArtifact, ...ocrExportArtifacts, 'providers/<service>-<model>/result.json', 'run.json']
    }
    return [ocrArtifact, ...ocrExportArtifacts, 'run.json']
  }
  if (isExtractCommand(command) && extractRoute === 'media') {
    const files = collectExpectedSttTargets(opts, resolvedTarget).length > 1
      ? ['Shared audio artifact(s)', 'providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json', 'prompt.md', 'run.json']
      : ['Audio file', 'transcription.txt', 'result.json', 'prompt.md', 'run.json']
    if (opts.youtubeCaptions) {
      files.splice(files.length - 2, 0, 'youtube-captions.vtt (when available)', 'youtube-captions.json (when available)')
    }
    return files
  }
  if (command === 'write' && opts.textInput) {
    const llmOutputCount = getEffectiveLlmOutputCount(opts)
    const canRunPostGeneration = llmOutputCount === 1
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
    const ttsTargets = collectTtsTargets(opts)
    const imageTargets = collectImageTargets(opts)
    const videoTargets = collectVideoTargets(opts)
    const musicTargets = collectMusicTargets(opts)
    if (ttsTargets.length > 0 && canRunPostGeneration) {
      for (const target of ttsTargets) {
        files.push(getTtsArtifactFileName(target, ttsTargets.length === 1))
      }
    }
    if (canRunPostGeneration && imageTargets.length > 0) {
      files.push('generated-image.png')
    }
    if (canRunPostGeneration && videoTargets.length > 0) {
      files.push('Video file')
    }
    if (canRunPostGeneration && musicTargets.length > 0) {
      files.push('Music file')
    }
    files.push('prompt.md')
    files.push('run.json')
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
    files.push('run.json')
    return files
  }
  const documentWrite = command === 'write'
    && (routing?.family === 'document' || routing?.family === 'html_article')
  if (documentWrite) {
    const htmlArticleInput = routing?.family === 'html_article'
    const files = opts.useEpubBun || opts.useEpubCalibre
      ? [summaryFile, 'run.json (includes EPUB inspection payload)']
      : htmlArticleInput && opts.urlBackends
        ? ['providers/<backend>/result.json', 'providers/<backend>/extraction.txt', summaryFile]
        : [getExpectedOcrArtifact(opts), summaryFile]
    files.push(showNoteFile)
    files.push(...getExpectedOcrExportArtifacts(opts))
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      files.push('providers/<service>-<model>/result.json')
    }
    files.push('prompt.md')
    if (!files.some((entry) => entry.startsWith('run.json'))) {
      files.push('run.json')
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
  const ttsTargets = collectTtsTargets(opts)
  const imageTargets = collectImageTargets(opts)
  const videoTargets = collectVideoTargets(opts)
  const musicTargets = collectMusicTargets(opts)
  const canRunPostGeneration = !opts.skipLLM && llmOutputCount === 1
  if (ttsTargets.length > 0 && canRunPostGeneration) {
    for (const target of ttsTargets) {
      files.push(getTtsArtifactFileName(target, ttsTargets.length === 1))
    }
  }
  if (canRunPostGeneration && imageTargets.length > 0) {
    files.push('generated-image.png')
  }
  if (canRunPostGeneration && videoTargets.length > 0) {
    files.push('Video file')
  }
  if (canRunPostGeneration && musicTargets.length > 0) {
    files.push('Music file')
  }
  if (opts.youtubeCaptions) {
    files.push('youtube-captions.vtt (when available)')
    files.push('youtube-captions.json (when available)')
  }
  files.push('prompt.md')
  files.push('run.json')
  return files
}

export const buildBatchExpectedFilesList = async (
  command: ProcessCommand,
  opts: RuntimeOptions,
  sampleTarget: string
): Promise<string[]> => {
  const expectedFiles = await buildExpectedFilesList(command, opts, sampleTarget)
  const childFiles = expectedFiles
    .filter((file) => !file.includes('/*.md'))
    .map((file) => `<child-run>/${file}`)
  const externalFiles = expectedFiles.filter((file) => file.includes('/*.md'))
  return ['batch.json', ...childFiles, ...externalFiles]
}
