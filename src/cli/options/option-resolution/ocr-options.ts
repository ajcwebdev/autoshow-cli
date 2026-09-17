import { DEFAULT_OCR_PROVIDER_MODE, OCR_PROVIDER_MODES, type OcrProviderMode } from '~/cli/flags/ocr-provider-mode-contract'
import { isStep2BooleanProviderSelected } from '~/cli/commands/command-shared/extract-routing/provider-registry'
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
import { ALL_STEP_CONCURRENCY_SCOPES, resolveStepConcurrency } from '~/cli/flags/service-selector-normalization/step-concurrency-scopes'

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
  const pageConcurrency = resolveStepConcurrency('ocr-page', ALL_STEP_CONCURRENCY_SCOPES, ctx.flagOccurrences ?? [], mergedFlags, configuredFlags)
  const rawOcrConcurrency = pageConcurrency.assigned ? String(pageConcurrency.value) : readOptionalStringFlag(mergedFlags, 'ocr-concurrency')
  const hasUserOcrConcurrency = pageConcurrency.assigned
    || hasExplicitOrConfiguredFlag('ocr-concurrency', explicitFlags, configuredFlags)
    || rawOcrConcurrency !== undefined
  const parsedOcrConcurrency = rawOcrConcurrency === undefined
    ? undefined
    : parseIntWithDefault(rawOcrConcurrency, Number.NaN)
  const resolvedOcrConcurrency = hasUserOcrConcurrency
    ? Number.isFinite(parsedOcrConcurrency)
      ? Math.max(1, parsedOcrConcurrency as number)
      : DEFAULT_OCR_CONCURRENCY
    : undefined
  const rawOcrProviderMode = readStringFlag(mergedFlags, 'ocr-provider-mode', DEFAULT_OCR_PROVIDER_MODE)
  if (!OCR_PROVIDER_MODES.includes(rawOcrProviderMode as OcrProviderMode)) {
    throw UsageError(`Invalid --ocr-provider-mode "${rawOcrProviderMode}". Expected ${OCR_PROVIDER_MODES.join(' or ')}.`)
  }
  const ocrProviderModeExplicit = hasExplicitOrConfiguredFlag(
    'ocr-provider-mode',
    explicitFlags,
    configuredFlags
  )

  if (mergedFlags['docx-markdown'] === true && (useTesseract || OCR_MODEL_KEYS.some(key => { const value = modelOptions[key]; return Array.isArray(value) ? value.length > 0 : Boolean(value) }))) throw UsageError('--docx-markdown requires native extraction; remove configured OCR provider selections.')
  return {
    ...pick(modelOptions, OCR_MODEL_KEYS),
    ocrConcurrency: resolvedOcrConcurrency,
    ocrConcurrencyMode: hasUserOcrConcurrency ? 'fixed' : 'auto',
    ocrProviderMode: rawOcrProviderMode as OcrProviderMode,
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
    docxMarkdown: readOptionalBooleanFlag(mergedFlags, 'docx-markdown'),
    chapterFiles: readOptionalBooleanFlag(mergedFlags, 'chapters'),
    chapterChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
    pdfChapterMode,
    reasoningEffort: parseReasoningEffort(readOptionalStringFlag(mergedFlags, 'reasoning-effort'))
  }
}
