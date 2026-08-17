import { boolFlag, omitFlags, strFlag, withHelpGroup } from './flag-utils'
import {
  transcriptionFlags,
  llmProviderFlags,
  ocrInputFlags,
  ocrProviderModeFlag,
  ocrTuningFlags,
  batchFlags,
  promptFlag,
  sharedConcurrencyFlags,
  stepProviderSelectorFlags
} from './shared-flags'
import { ttsCommandFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'
import type { CliFlagsDefinition } from '~/types'

const configFlags = {
  show: boolFlag('Print the effective config and resolved path'),
  reset: boolFlag('Clear the config file back to empty defaults')
} as const satisfies CliFlagsDefinition

const pricingFlags = {
  'max-cents': strFlag('Budget limit in cents — commands exceeding this fail unless --allow-over-budget is set')
} as const satisfies CliFlagsDefinition

const authFlags = {
  cookies: strFlag('Path to cookies.txt file for authenticated downloads'),
  'cookies-from-browser': strFlag('Import cookies from browser for authenticated downloads: chrome|firefox|opera|edge|chromium|brave|vivaldi|safari (passed to yt-dlp --cookies-from-browser)')
} as const satisfies CliFlagsDefinition

const configTtsFlags = omitFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'all-local',
  'concurrency-mode',
  'provider-concurrency',
  'local-concurrency',
  'batch-concurrency',
  'price',
  'tts-ref-audio',
  'allow-ambiguous-redispatch',
  'tts-allow-ambiguous-redispatch'
])
const configOcrInputFlags = omitFlags(ocrInputFlags, ['password'])
const configPromptFlags = omitFlags(promptFlag, ['prompt-md'])

// Per-run inputs, not defaults: each names a specific file, mask, or one-shot
// switch for a single generation. They used to be accepted here and silently
// dropped, because `FLAG_TO_CONFIG_PATH` never had a destination for them.
const configImageGenFlags = omitFlags(imageGenFlags, [
  'image-input',
  'image-mask',
  'image-response-mode',
  'image-search-grounding',
  'image-compression'
])
const configVideoGenFlags = omitFlags(videoGenFlags, [
  'replicate-video-multi-prompt',
  'replicate-video-multi-clip'
])
const configMusicGenFlags = omitFlags(musicGenFlags, [
  'music-lyrics-file'
])

export const configCommandFlags = {
  ...withHelpGroup(configFlags, 'config'),
  ...withHelpGroup(pricingFlags, 'pricing'),
  ...withHelpGroup(authFlags, 'auth'),
  ...withHelpGroup(batchFlags, 'batch-download'),
  ...withHelpGroup(sharedConcurrencyFlags, 'concurrency'),
  ...withHelpGroup({ stt: stepProviderSelectorFlags.stt }, 'transcription'),
  ...withHelpGroup(transcriptionFlags, 'transcription'),
  ...withHelpGroup({ ocr: stepProviderSelectorFlags.ocr }, 'ocr-document'),
  ...withHelpGroup(configOcrInputFlags, 'ocr-document'),
  ...withHelpGroup(ocrTuningFlags, 'ocr-document'),
  ...withHelpGroup(ocrProviderModeFlag, 'ocr-document'),
  ...withHelpGroup(llmProviderFlags, 'writing'),
  ...withHelpGroup(configPromptFlags, 'writing'),
  ...withHelpGroup({ tts: stepProviderSelectorFlags.tts }, 'tts-options'),
  ...withHelpGroup(configTtsFlags, 'tts-options'),
  ...withHelpGroup({ image: stepProviderSelectorFlags.image }, 'image-options'),
  ...withHelpGroup(configImageGenFlags, 'image-options'),
  ...withHelpGroup({ video: stepProviderSelectorFlags.video }, 'video-options'),
  ...withHelpGroup(configVideoGenFlags, 'video-options'),
  ...withHelpGroup({ music: stepProviderSelectorFlags.music }, 'hosted-music'),
  ...withHelpGroup(configMusicGenFlags, 'hosted-music')
} as const satisfies CliFlagsDefinition
