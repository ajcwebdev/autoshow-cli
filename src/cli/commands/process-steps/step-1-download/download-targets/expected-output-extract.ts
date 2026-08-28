import type { ExpectedOutputOptions, OcrRuntimeOptions, ResolvedInputRouting, SttRuntimeOptions } from '~/types'
import { collectSttTargets, collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { shouldExportEpubChapters } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults'

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

const appendYoutubeCaptionArtifacts = (files: string[], beforeTrailingFiles = 0): void => {
  const captions = ['youtube-captions.vtt (when available)', 'youtube-captions.json (when available)']
  beforeTrailingFiles > 0 ? files.splice(files.length - beforeTrailingFiles, 0, ...captions) : files.push(...captions)
}

const buildDocumentExtractExpectedFiles = (
  opts: ExpectedOutputOptions,
  routing: ResolvedInputRouting | undefined
): string[] => {
  const ocrArtifact = getExpectedOcrArtifact(opts)
  const exportArtifacts = getExpectedOcrExportArtifacts(opts, routing)
  const htmlArticleInput = routing?.family === 'html_article'
  if (htmlArticleInput && opts.urlBackends) {
    return ['providers/<backend>/result.json', 'providers/<backend>/extraction.txt', 'manifest.json']
  }
  if (!htmlArticleInput && opts.ocrProviderMode === 'pool') {
    return [ocrArtifact, ...exportArtifacts, ...POOLED_OCR_ATTEMPT_ARTIFACTS, 'manifest.json']
  }
  if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
    return [ocrArtifact, ...exportArtifacts, 'providers/<service>-<model>/result.json', 'manifest.json']
  }
  return [ocrArtifact, ...exportArtifacts, 'manifest.json']
}

const buildMediaExtractExpectedFiles = (
  opts: ExpectedOutputOptions,
  resolvedTarget: string | undefined
): string[] => {
  const files = collectExpectedSttTargets(opts, resolvedTarget).length > 1
    ? ['Shared audio artifact(s)', 'providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json', 'prompt.md', 'manifest.json']
    : ['Audio file', 'transcription.txt', 'result.json', 'prompt.md', 'manifest.json']
  if (opts.youtubeCaptions) appendYoutubeCaptionArtifacts(files, 2)
  return files
}

const buildGenericExtractExpectedFiles = (
  opts: ExpectedOutputOptions,
  resolvedTarget: string | undefined
): string[] => {
  const files = ['Audio file', 'transcription.txt', 'result.json']
  if (collectExpectedSttTargets(opts, resolvedTarget).length > 1) {
    files.push('providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json')
  }
  if (opts.youtubeCaptions) appendYoutubeCaptionArtifacts(files)
  files.push('prompt.md', 'manifest.json')
  return files
}

export const buildExtractExpectedFiles = (
  opts: ExpectedOutputOptions,
  routing: ResolvedInputRouting | undefined,
  resolvedTarget: string | undefined
): string[] => {
  if (routing?.extractRoute === 'document' || routing?.extractRoute === 'article') {
    return buildDocumentExtractExpectedFiles(opts, routing)
  }
  if (routing?.extractRoute === 'media') return buildMediaExtractExpectedFiles(opts, resolvedTarget)
  return buildGenericExtractExpectedFiles(opts, resolvedTarget)
}
