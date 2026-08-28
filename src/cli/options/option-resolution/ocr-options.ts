import { isStep2BooleanProviderSelected } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { OcrRuntimeOptions, OcrRuntimeOptionKey, OutputFormat, ResolvedFlagContext } from '~/types'
import {
  parseIntWithDefault,
  parseOptionalPositiveIntFlag,
  parsePdfChapterMode,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readStringFlag
} from './flag-readers'
import { hasExplicitOrConfiguredFlag } from './build-options-config-flags'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { pick } from '~/utils/cli-utils'
import { parseReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { UsageError } from '~/utils/error-handler'

const OCR_MODEL_KEYS = [
  'mistralOcrModels', 'glmOcrModels',
  'kimiOcrModels', 'openaiOcrModels',
  'grokOcrModels', 'anthropicOcrModels',
  'geminiOcrModels', 'deepinfraOcrModels',
] as const satisfies readonly OcrRuntimeOptionKey[]

export const buildOcrOptions = (ctx: ResolvedFlagContext): OcrRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  const outputFormat = readStringFlag(mergedFlags, 'format', 'text')
  if (outputFormat === 'tsv' || outputFormat === 'hocr') {
    throw UsageError(
      `--format "${outputFormat}" was removed because no extraction backend emits it natively. Use --format text or --format json.`
    )
  }
  const normalizedOut: OutputFormat = outputFormat === 'json' ? 'json' : 'text'
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
  const rawOcrProviderMode = readStringFlag(mergedFlags, 'ocr-provider-mode', 'fanout')
  if (rawOcrProviderMode !== 'fanout' && rawOcrProviderMode !== 'pool') {
    throw UsageError(`Invalid --ocr-provider-mode "${rawOcrProviderMode}". Expected fanout or pool.`)
  }
  const ocrProviderModeExplicit = hasExplicitOrConfiguredFlag(
    'ocr-provider-mode',
    explicitFlags,
    configuredFlags
  )

  return {
    ...pick(modelOptions, OCR_MODEL_KEYS),
    ocrConcurrency: resolvedOcrConcurrency,
    ocrConcurrencyMode: hasUserOcrConcurrency ? 'fixed' : 'auto',
    ocrProviderMode: rawOcrProviderMode,
    ocrProviderModeExplicit,
    ocrProviderConcurrency: resolveProviderConcurrency(
      mergedFlags,
      'ocr-provider-concurrency',
      allShortcutFlags['all-ocr'],
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
    dpi: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'ocr-dpi'), 300),
    lang: readStringFlag(mergedFlags, 'ocr-language', 'eng'),
    out: normalizedOut,
    password: readOptionalStringFlag(mergedFlags, 'password'),
    useTesseract,
    primaryOcr: readOptionalStringFlag(mergedFlags, 'primary-ocr'),
    chapterFiles: readOptionalBooleanFlag(mergedFlags, 'chapters'),
    chapterChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
    pdfChapterMode,
    reasoningEffort: parseReasoningEffort(readOptionalStringFlag(mergedFlags, 'reasoning-effort'))
  }
}
