import type { ExpectedOutputOptions, OcrRuntimeOptions, ProcessCommand, ResolvedInputRouting, SttRuntimeOptions } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { collectSttTargets, collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { shouldExportEpubChapters } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults'
import { isDocumentLikeTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { expectedWriteArtifactFiles } from '~/cli/commands/process-steps/step-3-write/run-write-command'

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
  if (command === 'write') {
    return expectedWriteArtifactFiles(opts)
  }
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
  const files = ['Audio file', 'transcription.txt', 'result.json']
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
