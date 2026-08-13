import {
  batchFlags,
  allArticleFlags,
  booleanAllLocalFlag,
  booleanAllProvidersFlag,
  ocrInputFlags,
  ocrTuningFlags,
  priceFlag,
  promptFlag,
  reasoningEffortFlag,
  sharedConcurrencyFlags,
  transcriptionFlags
} from './shared-flags'
import { formatProviderList, pickFlags, strListFlag, withHelpGroup } from './flag-utils'
import { epubInspectFlags } from './ocr-flags'
import { dialogueTtsCommandOptionNames, genericTtsOptionFlags, ttsFlags } from './tts-flags'
import { imageGenFlags, imageGenerationOptionNames, imageInputOptionNames, imageProviderSpecificOptionNames } from './image-flags'
import { videoGenFlags, videoGenerationOptionNames, videoInputOptionNames } from './video-flags'
import { musicGenFlags } from './music-flags'
import type { CliFlagsDefinition } from '~/types'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from './service-selector-normalization/extract-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const extractProvidersFor = (kind: 'stt' | 'ocr'): Record<string, unknown> =>
  Object.fromEntries(Object.entries(EXTRACT_PUBLIC_SELECTOR_FLAGS).filter(([, targets]) => targets[kind] !== undefined))

const resumeProviderSelectionFlags = {
  ...booleanAllProvidersFlag,
  ...booleanAllLocalFlag,
  provider: strListFlag([
    `STT: ${formatProviderList(extractProvidersFor('stt'))} (default: whisper=tiny)`,
    `OCR: ${formatProviderList(extractProvidersFor('ocr'))} (default: tesseract)`,
    `URL: ${URL_ARTICLE_BACKENDS.join('|')} (default: defuddle)`,
    `LLM: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: llama)`,
    `TTS: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}`,
    `image: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}`,
    `video: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}`,
    `music: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}`,
    'repeatable as provider[=model]'
  ].join('\n')),
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

// Resume never accepts provider-named option flags. Provider choice belongs to
// --provider provider[=model], and per-provider tuning belongs to the original
// command or autoshow.config, so every group below is an explicit allow-list of
// provider-neutral options rather than a deny-list that leaks new provider flags.
const resumeTranscriptionOptionNames = [
  'youtube-captions',
  'speaker-count',
  'split',
  'stt-segment-concurrency',
  'stt-preflight-concurrency'
] as const

export const resumeFlags = {
  ...withHelpGroup(resumeProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(pickFlags(transcriptionFlags, resumeTranscriptionOptionNames), 'transcription'),
  ...withHelpGroup({ ...ocrInputFlags, ...ocrTuningFlags, ...reasoningEffortFlag }, 'ocr-document'),
  ...withHelpGroup(allArticleFlags, 'article-extraction'),
  ...withHelpGroup(epubInspectFlags, 'epub-inspect'),
  ...withHelpGroup(promptFlag, 'writing'),
  ...withHelpGroup({
    ...genericTtsOptionFlags,
    ...pickFlags(ttsFlags, dialogueTtsCommandOptionNames)
  }, 'step-4-tts'),
  ...withHelpGroup(pickFlags(imageGenFlags, [
    ...imageGenerationOptionNames,
    ...imageInputOptionNames,
    ...imageProviderSpecificOptionNames
  ]), 'step-5-image'),
  ...withHelpGroup(pickFlags(videoGenFlags, [
    ...videoGenerationOptionNames,
    ...videoInputOptionNames
  ]), 'step-6-video'),
  ...withHelpGroup(musicGenFlags, 'step-7-music')
} as const satisfies CliFlagsDefinition
