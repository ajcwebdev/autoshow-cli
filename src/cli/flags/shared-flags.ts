import { DEFAULT_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import { OUTPUT_FORMATS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatProviderList, formatValueList, strFlag, strListFlag } from './flag-utils'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { PDF_CHAPTER_MODES } from '~/cli/options/option-resolution/flag-readers'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'

import { NORMALIZED_REASONING_EFFORTS } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export const priceFlag = {
  price: boolFlag('Show aggregated cost estimate for all active pipeline steps and exit')
} as const satisfies CliFlagsDefinition

export const reasoningEffortFlag = {
  'reasoning-effort': strFlag(`Reasoning effort policy: ${formatValueList(NORMALIZED_REASONING_EFFORTS)} (omit to preserve existing adapter behavior; default delegates to the provider)`)
} as const satisfies CliFlagsDefinition

export const ocrProviderModeFlag = {
  'ocr-provider-mode': strFlag('Multi-provider OCR execution mode: fanout|pool', 'fanout')
} as const satisfies CliFlagsDefinition

export const primaryOcrFlag = {
  'primary-ocr': strFlag(`In multi-provider OCR, write top-level extraction artifacts from one requested provider: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (as service or service/model)`)
} as const satisfies CliFlagsDefinition

export const booleanAllProvidersFlag = {
  'all-providers': boolFlag('Run every hosted/API-backed provider supported by this command and input route')
} as const satisfies CliFlagsDefinition

export const booleanAllLocalFlag = {
  'all-local': boolFlag('Run every local engine/backend supported by this command and input route')
} as const satisfies CliFlagsDefinition

export const stepProviderSelectorFlags = {
  stt: strListFlag(`Write pipeline STT provider[=model]: ${formatProviderList(WRITE_STT_PROVIDER_TARGETS)} (default: whisper=tiny)`),
  ocr: strListFlag(`Write pipeline OCR provider[=model]: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (default: tesseract)`),
  llm: strListFlag(`Write pipeline LLM provider[=model]: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: cheapest hosted)`)
} as const satisfies CliFlagsDefinition

export const configPipelineSelectorFlags = {
  stt: strListFlag(`Default STT provider[=model] persisted for the write and extract commands: ${formatProviderList(WRITE_STT_PROVIDER_TARGETS)} (default: whisper=tiny)`),
  ocr: strListFlag(`Default OCR provider[=model] persisted for the write and extract commands: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (default: tesseract)`),
  llm: strListFlag(`Default LLM provider[=model] persisted for the write command: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: cheapest hosted)`)
} as const satisfies CliFlagsDefinition

export const configGenerationSelectorFlags = {
  tts: strListFlag(`Default TTS provider[=model] persisted for the tts command: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}`),
  image: strListFlag(`Default image provider[=model] persisted for the image command: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}`),
  video: strListFlag(`Default video provider[=model] persisted for the video command: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}`),
  music: strListFlag(`Default music provider[=model] persisted for the music command: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}`)
} as const satisfies CliFlagsDefinition

export const writeAllProvidersFlag = {
  'all-providers': strListFlag('Write pipeline hosted/API-backed all-provider selector, repeatable for stt|ocr|url|llm')
} as const satisfies CliFlagsDefinition

export const writeAllLocalFlag = {
  'all-local': strListFlag('Write pipeline local engine/backend selector, repeatable for stt|ocr|url')
} as const satisfies CliFlagsDefinition

export const sharedConcurrencyFlags = {
  'concurrency-mode': strFlag('Hosted concurrency startup policy: ramp|immediate', 'ramp'),
  'provider-concurrency': strFlag('Max hosted provider/model targets running in parallel for one item; internal request or chunk fan-out uses its own limit', DEFAULT_CONCURRENCY_FLAG_VALUE),
  'local-concurrency': strFlag('Max local providers/models running in parallel for one item', DEFAULT_CONCURRENCY_FLAG_VALUE)
} as const satisfies CliFlagsDefinition

export const batchFlags = {
  'batch-limit': strFlag('Batch: number of items to process or "all"', '5'),
  'batch-order': strFlag('Batch: item order newest|oldest', 'newest'),
  'batch-concurrency': strFlag('Batch: number of items to process concurrently', DEFAULT_CONCURRENCY_FLAG_VALUE)
} as const satisfies CliFlagsDefinition

export const transcriptionFlags = {
  'youtube-captions': boolFlag('Prefer English YouTube captions before STT when available; falls back to the normal STT provider path'),
  'stt-happyscribe-organization-id': strFlag('Happy Scribe organization/workspace ID; required when the API key can access multiple organizations'),
  'stt-supadata-lang': strFlag('Supadata preferred transcript language (ISO 639-1); used with auto mode when a native transcript is available'),
  'stt-scrapecreators-lang': strFlag('ScrapeCreators YouTube transcript language code', 'en'),
  'speaker-count': strFlag('Optional diarization speaker-count hint (positive integer); unsupported providers report one aggregated warning at runtime'),
  split: boolFlag('Split audio into 30-minute segments for transcription'),
  'stt-segment-concurrency': strFlag('STT: max split segments in flight per provider (local clamps to 1)', DEFAULT_CONCURRENCY_FLAG_VALUE),
  'stt-preflight-concurrency': {
    ...strFlag('STT: max duration probes running in parallel during preflight', DEFAULT_CONCURRENCY_FLAG_VALUE),
    help: { hidden: true }
  }
} as const satisfies CliFlagsDefinition

export const promptFlag = {
  prompt: {
    description: 'Named prompt(s) discovered under src/prompts/entries/ (default: "default")',
    type: [String] as [StringConstructor],
    consumeAdjacentValues: true
  },
  'prompt-md': boolFlag('Save a second prompt file (prompt-md.md) with markdown examples alongside the JSON prompt')
} as const satisfies CliFlagsDefinition

export const ocrInputFlags = {
  'ocr-language': strFlag('Tesseract language(s) like eng+fra', 'eng'),
  format: strFlag(`Output format: ${formatValueList(OUTPUT_FORMATS)}`, 'text'),
  password: strFlag('Password for encrypted PDFs'),
  chapters: {
    description: 'EPUB native text runs and long PDF chapter autodetection: write chapter files under chapters/ (automatic for EPUB; use --no-chapters for a single extracted file)',
    type: Boolean,
    negatable: true
  },
  length: strFlag('Hard export limit in thousands of characters (e.g. 50 = 50,000 chars); splits oversized EPUB or PDF chapter files'),
  'pdf-chapter-mode': strFlag(`PDF chapter detection mode: ${formatValueList(PDF_CHAPTER_MODES)}`, 'local')
} as const satisfies CliFlagsDefinition

export const articleFlags = {
  'url-provider': strFlag(`Article/HTML extraction backend: ${formatValueList(URL_ARTICLE_BACKENDS)} (local .html/.htm always use defuddle)`, 'defuddle')
} as const satisfies CliFlagsDefinition

export const allArticleFlags = {
  ...articleFlags,
  'url-provider-concurrency': {
    description: 'URL article extraction: max hosted URL providers running in parallel for one item',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE,
    help: { hidden: true }
  },
  'url-request-timeout-ms': {
    ...strFlag('URL article extraction: per-provider request timeout in milliseconds', '60000'),
    help: { hidden: true }
  },
  'url-request-attempts': {
    ...strFlag('URL article extraction: total provider request attempts including retries', '3'),
    help: { hidden: true }
  }
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  'ocr-dpi': strFlag('Render DPI for OCR pages', '300'),
  'ocr-concurrency': strFlag('Page-level OCR concurrency cap. Local OCR defaults to 10; hosted OCR defaults to auto. Explicit values are hosted hard caps.')
} as const satisfies CliFlagsDefinition
