import { isStep2BooleanProviderSelected } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { BuildDomainOptionsContext, OcrRuntimeOptionKey, OutputFormat, RuntimeOptions } from '~/types'
import {
  parseIntWithDefault,
  parseOptionalPositiveIntFlag,
  parsePdfChapterMode,
  readBooleanFlag,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readStringFlag
} from '../options/flag-readers'
import { hasExplicitOrConfiguredFlag } from './build-options-config-flags'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { pick } from '~/utils/cli-utils'

const OCR_MODEL_KEYS = [
  'mistralOcrModels', 'mistralOcrModel', 'glmOcrModels', 'glmOcrModel',
  'kimiOcrModels', 'kimiOcrModel', 'openaiOcrModels', 'openaiOcrModel',
  'grokOcrModels', 'grokOcrModel', 'anthropicOcrModels', 'anthropicOcrModel',
  'geminiOcrModels', 'geminiOcrModel', 'deepinfraOcrModels', 'deepinfraOcrModel',
] as const satisfies readonly OcrRuntimeOptionKey[]

export const buildOcrOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, OcrRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx

  const outputFormat = readStringFlag(mergedFlags, 'format', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'
  const epubLengthThousands = parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'length'), 'length')
  const pdfChapterMode = parsePdfChapterMode(readOptionalStringFlag(mergedFlags, 'pdf-chapter-mode'))
  const useTesseract = isStep2BooleanProviderSelected('tesseract-ocr', mergedFlags, allShortcutFlags)
  const rawOcrConcurrency = readOptionalStringFlag(mergedFlags, 'ocr-concurrency')
  const hasUserOcrConcurrency = hasExplicitOrConfiguredFlag('ocr-concurrency', explicitFlags, configuredFlags)
    || rawOcrConcurrency !== undefined
  const parsedOcrConcurrency = rawOcrConcurrency === undefined
    ? undefined
    : parseIntWithDefault(rawOcrConcurrency, Number.NaN)
  const resolvedOcrConcurrency = hasUserOcrConcurrency
    ? Number.isFinite(parsedOcrConcurrency)
      ? Math.max(1, parsedOcrConcurrency as number)
      : DEFAULT_OCR_CONCURRENCY
    : undefined

  return {
    ...pick(modelOptions, OCR_MODEL_KEYS),
    ocrConcurrency: resolvedOcrConcurrency,
    ocrConcurrencyMode: hasUserOcrConcurrency ? 'fixed' : 'auto',
    ocrProviderConcurrency: resolveProviderConcurrency(
      mergedFlags,
      'ocr-provider-concurrency',
      allShortcutFlags['all-ocr'],
      targetCounts.hostedOcrTargetCount,
      explicitFlags,
      configuredFlags,
      { defaultValue: DEFAULT_OCR_CONCURRENCY, allShortcutDefault: DEFAULT_OCR_CONCURRENCY }
    ),
    ocrLocalConcurrency: resolveLocalConcurrency(
      mergedFlags,
      'ocr-local-concurrency',
      explicitFlags,
      configuredFlags,
      { defaultValue: DEFAULT_OCR_CONCURRENCY }
    ),
    keepOcrPageInputs: readBooleanFlag(mergedFlags, 'keep-ocr-page-inputs'),
    dpi: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'ocr-dpi'), 300),
    lang: readStringFlag(mergedFlags, 'ocr-language', 'eng'),
    out: normalizedOut,
    password: readOptionalStringFlag(mergedFlags, 'password'),
    useTesseract,
    primaryOcr: readOptionalStringFlag(mergedFlags, 'primary-ocr'),
    chapterFiles: readOptionalBooleanFlag(mergedFlags, 'chapters'),
    chapterChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
    pdfChapterMode,
    useEpubBun: readBooleanFlag(mergedFlags, 'epub-bun'),
  }
}
