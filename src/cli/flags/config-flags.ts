import { omitFlags, withHelpGroup } from './flag-utils'
import {
  transcriptionFlags,
  llmProviderFlags,
  ocrInputFlags,
  ocrTuningFlags,
  batchFlags,
  promptFlag,
  priceFlag,
  sharedConcurrencyFlags,
  stepProviderSelectorFlags
} from './shared-flags'
import { ttsCommandFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'
import type { CliFlagsDefinition } from '~/types'

const configFlags = {
  show: {
    description: 'Print the effective config and resolved path',
    type: Boolean,
    default: false,
    negatable: false
  },
  reset: {
    description: 'Clear the config file back to empty defaults',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const pricingFlags = {
  'max-cents': {
    description: 'Budget limit in cents — commands exceeding this fail unless --allow-over-budget is set',
    type: String
  }
} as const satisfies CliFlagsDefinition

const configTtsFlags = omitFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'all-local',
  'provider-concurrency',
  'local-concurrency',
  'batch-concurrency',
  'price'
])
const configOcrInputFlags = omitFlags(ocrInputFlags, ['password'])

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

export const configCommandFlags = {
  ...withHelpGroup(configFlags, 'config'),
  ...withHelpGroup(pricingFlags, 'pricing'),
  ...withHelpGroup(batchFlags, 'batch-download'),
  ...withHelpGroup(sharedConcurrencyFlags, 'concurrency'),
  ...withHelpGroup({ stt: stepProviderSelectorFlags.stt }, 'step-2-stt'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup({ ocr: stepProviderSelectorFlags.ocr }, 'step-2-ocr'),
  ...withHelpGroup(configOcrInputFlags, 'step-2-ocr'),
  ...withHelpGroup(ocrTuningFlags, 'step-2-ocr'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup({ tts: stepProviderSelectorFlags.tts }, 'step-4-tts'),
  ...withHelpGroup(configTtsFlags, 'step-4-tts'),
  ...withHelpGroup({ image: stepProviderSelectorFlags.image }, 'step-5-image'),
  ...withHelpGroup(configImageGenFlags, 'step-5-image'),
  ...withHelpGroup({ video: stepProviderSelectorFlags.video }, 'step-6-video'),
  ...withHelpGroup(configVideoGenFlags, 'step-6-video'),
  ...withHelpGroup({ music: stepProviderSelectorFlags.music }, 'step-7-music'),
  ...withHelpGroup(musicGenFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
