import { DEFAULT_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import {
  STEP_CONCURRENCY_FLAG,
  stepConcurrencyDefaults,
  stepConcurrencyDescription,
  STEP_CONCURRENCY_SCOPES_HELP_KEY,
  type StepConcurrencyScope
} from './service-selector-normalization/step-concurrency-scopes'
import { OUTPUT_FORMATS } from '~/types'
import type { CliFlagDefinition, CliFlagsDefinition } from '~/types'
import { boolFlag, formatProviderList, formatValueList, strFlag, strListFlag } from './flag-utils'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/command-shared/extract-routing/provider-registry'
import { HOSTED_CONCURRENCY_MODES, DEFAULT_HOSTED_CONCURRENCY_MODE, PDF_CHAPTER_MODES } from '~/cli/options/option-resolution/flag-readers'
import { DEFAULT_OCR_PROVIDER_MODE, OCR_PROVIDER_MODES } from './ocr-provider-mode-contract'
import { genericSttOptionDefault, genericSttOptionDescription, type GenericSttOptionFlag } from './service-selector-normalization/generic-stt-controls'

// Provider-general STT option flags follow the scoped-repeatable convention: the rendered default is
// an array of `provider=value` strings derived from the capability table, and resolution reads that
// same table rather than the seeded value.
const genericSttOptionFlag = (name: GenericSttOptionFlag, summary: string): CliFlagDefinition => {
  const seeded = genericSttOptionDefault(name)
  return {
    description: genericSttOptionDescription(name, summary),
    type: [String] as [StringConstructor],
    ...(seeded ? { default: seeded } : {})
  }
}
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'

import { NORMALIZED_REASONING_EFFORTS } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export const priceFlag = {
  price: boolFlag('Show aggregated cost estimate for all active pipeline steps and exit')
} as const satisfies CliFlagsDefinition

export const modelCostFilterFlag = {
  'max-model-cents': strFlag('Run only provider/model targets whose estimated total cost for this invocation is at most this many cents')
} as const satisfies CliFlagsDefinition

export const reasoningEffortFlag = {
  'reasoning-effort': strFlag(`Reasoning effort policy: ${formatValueList(NORMALIZED_REASONING_EFFORTS)} (omit to preserve existing adapter behavior; default delegates to the provider)`)
} as const satisfies CliFlagsDefinition

export const ocrProviderModeFlag = {
  'ocr-provider-mode': strFlag(`Multi-provider OCR execution mode: ${formatValueList(OCR_PROVIDER_MODES)}`, DEFAULT_OCR_PROVIDER_MODE)
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

export const configPipelineSelectorFlags = {
  stt: strListFlag(`Default STT provider[=model] persisted for the extract command: ${formatProviderList(WRITE_STT_PROVIDER_TARGETS)} (default: whisperfile=tiny)`),
  ocr: strListFlag(`Default OCR provider[=model] persisted for the extract command: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (default: tesseract)`),
  llm: strListFlag(`Default LLM provider[=model] persisted for the write command: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: cheapest hosted)`)
} as const satisfies CliFlagsDefinition

export const configGenerationSelectorFlags = {
  tts: strListFlag(`Default TTS provider[=model] persisted for the tts command: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}`),
  image: strListFlag(`Default image provider[=model] persisted for the image command: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}`),
  video: strListFlag(`Default video provider[=model] persisted for the video command: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}`),
  music: strListFlag(`Default music provider[=model] persisted for the music command: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}`)
} as const satisfies CliFlagsDefinition

export const sharedConcurrencyFlags = {
  'concurrency-mode': strFlag(`Hosted concurrency startup policy: ${formatValueList(HOSTED_CONCURRENCY_MODES)}`, DEFAULT_HOSTED_CONCURRENCY_MODE),
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
  'stt-organization-id': genericSttOptionFlag('stt-organization-id', 'Provider organization/workspace ID; required when the API key can access multiple organizations'),
  'stt-language': genericSttOptionFlag('stt-language', 'Preferred transcript language (ISO 639-1); used when a native transcript is available'),
  'stt-verbatim': genericSttOptionFlag('stt-verbatim', 'Retain filler words and disable numeric/currency formatting for verbatim captions'),
  'stt-chunk-size': genericSttOptionFlag('stt-chunk-size', 'Desired transcript chunk size in characters; does not add word alignment'),
  'stt-response-format': genericSttOptionFlag('stt-response-format', 'Transcription response format; verbose_json retains words, and the text formats use one inference and retain cue timing only'),
  'stt-audio-profile': strFlag('Audio preparation: default (provider compression) or lossless (verified float32 WAV, original channels/rate)'),
  'native-subtitles': boolFlag('Also save native subtitles where available, reusing the current inference/job; exports may consume provider quota'),
  diarization: { description: 'Enable or disable diarization on supported STT providers; default uses each provider’s normal mode', type: Boolean, negatable: true },
  'speaker-count': strFlag('Optional diarization speaker-count hint (positive integer); unsupported providers report one aggregated warning at runtime'),
  split: boolFlag('Split audio into 30-minute segments for transcription')
} as const satisfies CliFlagsDefinition

// One repeatable flag replaces the five intra-step concurrency knobs. Each command registers only
// the scopes it runs, and both the description and the rendered default come from the registry.
export const stepConcurrencyFlag = (scopes: readonly StepConcurrencyScope[]): CliFlagsDefinition => ({
  [STEP_CONCURRENCY_FLAG]: {
    description: stepConcurrencyDescription(scopes),
    type: [String] as [StringConstructor],
    default: stepConcurrencyDefaults(scopes),
    help: { [STEP_CONCURRENCY_SCOPES_HELP_KEY]: [...scopes] }
  }
})

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

export const articleTuningFlags = {
  'url-request-timeout-ms': strFlag('URL article extraction: per-provider request timeout in milliseconds', '60000'),
  'url-request-attempts': strFlag('URL article extraction: total provider request attempts including retries', '3')
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  'ocr-dpi': strFlag('Render DPI for OCR pages', '300')
} as const satisfies CliFlagsDefinition
