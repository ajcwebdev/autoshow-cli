import type { OcrSelectionState } from '~/types'

export const HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING = 'OCR flags are ignored for HTML/article inputs.'
export const CSV_OCR_FLAGS_IGNORED_WARNING = 'OCR flags are ignored for CSV inputs (CSV content is read as raw text).'
export const CHAPTER_EXPORT_FLAGS_IGNORED_WARNING = 'Chapter export flags (--chapters, --no-chapters, --length) are ignored for inputs other than EPUB and PDF.'
export const PDF_LENGTH_WITHOUT_CHAPTERS_WARNING = 'For PDF inputs, --length is ignored when --no-chapters is set.'
export const EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING = 'EPUB export flags (--chapters, --no-chapters, --length) are ignored when an OCR engine is selected for EPUB input.'

const hasSelectedModel = (
  values: string[] | undefined
): boolean => (values?.length ?? 0) > 0

export const hasConfiguredOcrProviderSelection = (
  opts: OcrSelectionState
): boolean =>
  opts.useTesseract === true
  || hasSelectedModel(opts.mistralOcrModels)
  || hasSelectedModel(opts.glmOcrModels)
  || hasSelectedModel(opts.kimiOcrModels)
  || hasSelectedModel(opts.openaiOcrModels)
  || hasSelectedModel(opts.grokOcrModels)
  || hasSelectedModel(opts.anthropicOcrModels)
  || hasSelectedModel(opts.geminiOcrModels)
  || hasSelectedModel(opts.deepinfraOcrModels)
  || hasSelectedModel(opts.replicateOcrModels)
  || hasSelectedModel(opts.falOcrModels)

export const formatHtmlArticleOcrFlagsIgnoredWarning = (
  target?: string
): string =>
  target && target.length > 0
    ? `${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)}: ${target}`
    : HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING

export const buildSpeakerCountHintWarning = <T,>(
  targets: T[],
  requestedSpeakerCount: number | undefined,
  supportsSpeakerCountHint: (target: T) => boolean,
  formatTargetLabel: (target: T) => string
): string | undefined => {
  if (requestedSpeakerCount === undefined || targets.length === 0) {
    return undefined
  }

  const honored = targets
    .filter((target) => supportsSpeakerCountHint(target))
    .map(formatTargetLabel)
  const ignored = targets
    .filter((target) => !supportsSpeakerCountHint(target))
    .map(formatTargetLabel)

  if (ignored.length === 0) {
    return undefined
  }

  return [
    `Using --speaker-count=${requestedSpeakerCount} for STT diarization`,
    `honored=${honored.length > 0 ? honored.join(', ') : 'none'}`,
    `ignored=${ignored.join(', ')}`
  ].join('; ')
}
