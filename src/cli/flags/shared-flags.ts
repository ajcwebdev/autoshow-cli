import { DEFAULT_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import { OUTPUT_FORMATS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { formatProviderList, formatValueList } from './flag-utils'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { PDF_CHAPTER_MODES } from '~/cli/commands/process-steps/step-1-download/download-targets/options/flag-readers'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'

export const priceFlag = {
  price: {
    description: 'Show aggregated cost estimate for all active pipeline steps and exit',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const booleanAllProvidersFlag = {
  'all-providers': {
    description: 'Run every hosted/API-backed provider supported by this command and input route',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const booleanAllLocalFlag = {
  'all-local': {
    description: 'Run every local engine/backend supported by this command and input route',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const stepProviderSelectorFlags = {
  stt: {
    description: `Write pipeline STT provider[=model]: ${formatProviderList(WRITE_STT_PROVIDER_TARGETS)} (default: whisper=tiny)`,
    type: [String] as [StringConstructor]
  },
  ocr: {
    description: `Write pipeline OCR provider[=model]: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (default: tesseract)`,
    type: [String] as [StringConstructor]
  },
  llm: {
    description: `Write pipeline LLM provider[=model]: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: llama)`,
    type: [String] as [StringConstructor]
  },
  tts: {
    description: `Write pipeline TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}`,
    type: [String] as [StringConstructor]
  },
  image: {
    description: `Write pipeline image provider[=model]: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}`,
    type: [String] as [StringConstructor]
  },
  video: {
    description: `Write pipeline video provider[=model]: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}`,
    type: [String] as [StringConstructor]
  },
  music: {
    description: `Write pipeline music provider[=model]: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}`,
    type: [String] as [StringConstructor]
  }
} as const satisfies CliFlagsDefinition

export const writeAllProvidersFlag = {
  'all-providers': {
    description: 'Write pipeline hosted/API-backed all-provider selector, repeatable for stt|ocr|url|llm|tts|image|video|music',
    type: [String] as [StringConstructor]
  }
} as const satisfies CliFlagsDefinition

export const writeAllLocalFlag = {
  'all-local': {
    description: 'Write pipeline local engine/backend selector, repeatable for stt|ocr|url|llm|tts',
    type: [String] as [StringConstructor]
  }
} as const satisfies CliFlagsDefinition

export const sharedConcurrencyFlags = {
  'provider-concurrency': {
    description: 'Max hosted providers/models running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  },
  'local-concurrency': {
    description: 'Max local providers/models running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  }
} as const satisfies CliFlagsDefinition

export const batchFlags = {
  'batch-limit': {
    description: 'Batch: number of items to process (default 5)',
    type: String,
    default: '5'
  },
  'batch-all': {
    description: 'Batch: process all items',
    type: Boolean,
    default: false,
    negatable: false
  },
  'batch-order': {
    description: 'Batch: item order newest|oldest (default newest)',
    type: String,
    default: 'newest'
  },
  'batch-concurrency': {
    description: 'Batch: number of items to process concurrently (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  }
} as const satisfies CliFlagsDefinition

export const transcriptionFlags = {
  'youtube-captions': {
    description: 'Prefer English YouTube captions before STT when available; falls back to the normal STT provider path',
    type: Boolean,
    default: false,
    negatable: false
  },
  'stt-reverb-verbatimicity': {
    description: 'Reverb output style 0-1',
    type: String,
    default: '0.5'
  },
  'stt-happyscribe-organization-id': {
    description: 'Happy Scribe organization/workspace ID; required when the API key can access multiple organizations',
    type: String
  },
  'stt-supadata-lang': {
    description: 'Supadata preferred transcript language (ISO 639-1); used with auto mode when a native transcript is available',
    type: String
  },
  'stt-scrapecreators-lang': {
    description: 'ScrapeCreators YouTube transcript language code (default en)',
    type: String,
    default: 'en'
  },
  'speaker-count': {
    description: 'Optional diarization speaker-count hint (positive integer); unsupported providers report one aggregated warning at runtime',
    type: String
  },
  split: {
    description: 'Split audio into 30-minute segments for transcription',
    type: Boolean,
    default: false,
    negatable: false
  },
  'stt-segment-concurrency': {
    description: 'STT: max split segments in flight per provider (default 10; local clamps to 1)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  },
  'stt-preflight-concurrency': {
    description: 'STT: max duration probes running in parallel during preflight (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  },
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
  'prompt-md': {
    description: 'Save a second prompt file (prompt-md.md) with markdown examples alongside the JSON prompt',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const ocrInputFlags = {
  'ocr-language': {
    description: 'Tesseract language(s) like eng+fra (default: eng)',
    type: String,
    default: 'eng'
  },
  format: {
    description: `Output format: ${formatValueList(OUTPUT_FORMATS)} (default: text)`,
    type: String,
    default: 'text'
  },
  password: {
    description: 'Password for encrypted PDFs',
    type: String
  },
  chapters: {
    description: 'EPUB native text runs and long PDF chapter autodetection: write chapter files under chapters/ (automatic for EPUB; use --no-chapters for a single extracted file)',
    type: Boolean,
    negatable: true
  },
  length: {
    description: 'Hard export limit in thousands of characters (e.g. 50 = 50,000 chars); splits oversized EPUB or PDF chapter files',
    type: String
  },
  'pdf-chapter-mode': {
    description: `PDF chapter detection mode: ${formatValueList(PDF_CHAPTER_MODES)} (default: local)`,
    type: String,
    default: 'local'
  }
} as const satisfies CliFlagsDefinition

export const articleFlags = {
  'url-provider': {
    description: `Article/HTML extraction backend: ${formatValueList(URL_ARTICLE_BACKENDS)} (default: defuddle; local .html/.htm always use defuddle)`,
    type: String,
    default: 'defuddle'
  }
} as const satisfies CliFlagsDefinition

export const allArticleFlags = {
  ...articleFlags,
  'url-provider-concurrency': {
    description: 'URL article extraction: max hosted URL providers running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE,
    help: { hidden: true }
  },
  'url-request-timeout-ms': {
    description: 'URL article extraction: per-provider request timeout in milliseconds (default 60000)',
    type: String,
    default: '60000'
  },
  'url-request-attempts': {
    description: 'URL article extraction: total provider request attempts including retries (default 3)',
    type: String,
    default: '3'
  }
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  'ocr-dpi': {
    description: 'Render DPI for OCR pages (default: 300)',
    type: String,
    default: '300'
  },
  'ocr-concurrency': {
    description: 'Page-level OCR concurrency cap. Local OCR defaults to 10; hosted OCR defaults to auto. Explicit values are hosted hard caps.',
    type: String
  },
  'keep-ocr-page-inputs': {
    description: 'Keep intermediate single-page PDF inputs from hosted OCR fallback after success',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition
