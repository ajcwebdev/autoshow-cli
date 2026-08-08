import { DEFAULT_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import { OUTPUT_FORMATS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatProviderList, formatValueList, strFlag, strListFlag } from './flag-utils'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { PDF_CHAPTER_MODES } from '~/cli/commands/process-steps/step-1-download/download-targets/options/flag-readers'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'

export const priceFlag = {
  price: boolFlag('Show aggregated cost estimate for all active pipeline steps and exit')
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
  llm: strListFlag(`Write pipeline LLM provider[=model]: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: llama)`),
  tts: strListFlag(`Write pipeline TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}`),
  image: strListFlag(`Write pipeline image provider[=model]: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}`),
  video: strListFlag(`Write pipeline video provider[=model]: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}`),
  music: strListFlag(`Write pipeline music provider[=model]: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}`)
} as const satisfies CliFlagsDefinition

export const writeAllProvidersFlag = {
  'all-providers': strListFlag('Write pipeline hosted/API-backed all-provider selector, repeatable for stt|ocr|url|llm|tts|image|video|music')
} as const satisfies CliFlagsDefinition

export const writeAllLocalFlag = {
  'all-local': strListFlag('Write pipeline local engine/backend selector, repeatable for stt|ocr|url|llm|tts')
} as const satisfies CliFlagsDefinition

export const sharedConcurrencyFlags = {
  'provider-concurrency': strFlag('Max hosted providers/models running in parallel for one item (default 10)', DEFAULT_CONCURRENCY_FLAG_VALUE),
  'local-concurrency': strFlag('Max local providers/models running in parallel for one item (default 10)', DEFAULT_CONCURRENCY_FLAG_VALUE)
} as const satisfies CliFlagsDefinition

export const batchFlags = {
  'batch-limit': strFlag('Batch: number of items to process (default 5)', '5'),
  'batch-all': boolFlag('Batch: process all items'),
  'batch-order': strFlag('Batch: item order newest|oldest (default newest)', 'newest'),
  'batch-concurrency': strFlag('Batch: number of items to process concurrently (default 10)', DEFAULT_CONCURRENCY_FLAG_VALUE)
} as const satisfies CliFlagsDefinition

export const transcriptionFlags = {
  'youtube-captions': boolFlag('Prefer English YouTube captions before STT when available; falls back to the normal STT provider path'),
  'stt-reverb-verbatimicity': strFlag('Reverb output style 0-1', '0.5'),
  'stt-happyscribe-organization-id': strFlag('Happy Scribe organization/workspace ID; required when the API key can access multiple organizations'),
  'stt-supadata-lang': strFlag('Supadata preferred transcript language (ISO 639-1); used with auto mode when a native transcript is available'),
  'stt-scrapecreators-lang': strFlag('ScrapeCreators YouTube transcript language code (default en)', 'en'),
  'speaker-count': strFlag('Optional diarization speaker-count hint (positive integer); unsupported providers report one aggregated warning at runtime'),
  split: boolFlag('Split audio into 30-minute segments for transcription'),
  'stt-segment-concurrency': strFlag('STT: max split segments in flight per provider (default 10; local clamps to 1)', DEFAULT_CONCURRENCY_FLAG_VALUE),
  'stt-preflight-concurrency': strFlag('STT: max duration probes running in parallel during preflight (default 10)', DEFAULT_CONCURRENCY_FLAG_VALUE),
} as const satisfies CliFlagsDefinition

export const llmProviderFlags = {
  llm: stepProviderSelectorFlags.llm
} as const satisfies CliFlagsDefinition

export const promptFlag = {
  prompt: {
    description: 'Named prompt(s) discovered under src/prompts/entries/ (default: "default")',
    type: [String] as [StringConstructor],
    default: [] as string[]
  },
  'prompt-md': boolFlag('Save a second prompt file (prompt-md.md) with markdown examples alongside the JSON prompt')
} as const satisfies CliFlagsDefinition

export const ocrInputFlags = {
  'ocr-language': strFlag('Tesseract language(s) like eng+fra (default: eng)', 'eng'),
  format: strFlag(`Output format: ${formatValueList(OUTPUT_FORMATS)} (default: text)`, 'text'),
  password: strFlag('Password for encrypted PDFs'),
  chapters: {
    description: 'EPUB native text runs and long PDF chapter autodetection: write chapter files under chapters/ (automatic for EPUB; use --no-chapters for a single extracted file)',
    type: Boolean,
    negatable: true
  },
  length: strFlag('Hard export limit in thousands of characters (e.g. 50 = 50,000 chars); splits oversized EPUB or PDF chapter files'),
  'pdf-chapter-mode': strFlag(`PDF chapter detection mode: ${formatValueList(PDF_CHAPTER_MODES)} (default: local)`, 'local')
} as const satisfies CliFlagsDefinition

export const articleFlags = {
  'url-provider': strFlag(`Article/HTML extraction backend: ${formatValueList(URL_ARTICLE_BACKENDS)} (default: defuddle; local .html/.htm always use defuddle)`, 'defuddle')
} as const satisfies CliFlagsDefinition

export const allArticleFlags = {
  ...articleFlags,
  'url-provider-concurrency': {
    description: 'URL article extraction: max hosted URL providers running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE,
    help: { hidden: true }
  },
  'url-request-timeout-ms': strFlag('URL article extraction: per-provider request timeout in milliseconds (default 60000)', '60000'),
  'url-request-attempts': strFlag('URL article extraction: total provider request attempts including retries (default 3)', '3')
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  'ocr-dpi': strFlag('Render DPI for OCR pages (default: 300)', '300'),
  'ocr-concurrency': strFlag('Page-level OCR concurrency cap. Local OCR defaults to 10; hosted OCR defaults to auto. Explicit values are hosted hard caps.'),
  'keep-ocr-page-inputs': boolFlag('Keep intermediate single-page PDF inputs from hosted OCR fallback after success')
} as const satisfies CliFlagsDefinition
