import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatUniqueValueList, formatValueList, formatValuesByProvider, pickFlags, renameFlags, withHelpGroup } from './flag-utils'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { GEMINI_IMAGE_RESPONSE_MODES, GEMINI_IMAGE_SIZE_VALUES, GEMINI_NATIVE_ASPECT_RATIO_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/gemini-image-targets'
import { GROK_IMAGE_ASPECT_RATIO_VALUES, GROK_IMAGE_COUNT_RANGE, GROK_IMAGE_SIZE_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-grok/grok-image-targets'
import { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES, OPENAI_IMAGE_COMPRESSION_RANGE, OPENAI_IMAGE_COUNT_RANGE, OPENAI_IMAGE_FORMAT_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/openai-image-targets'
import { BFL_OUTPUT_FORMATS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/bfl/run-bfl-image-gen'
import { LUMALABS_ASPECT_RATIOS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/run-lumalabs-image-gen'
import { LUMALABS_MAX_IMAGE_INPUTS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/lumalabs-image-targets'
import { RECRAFT_ASPECT_RATIOS, RECRAFT_IMAGE_COUNT_RANGE } from '~/cli/commands/process-steps/step-5-image/image-generation-services/recraft/run-recraft-image-gen'
import { REPLICATE_QWEN_ASPECT_RATIO_VALUES, REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES, REPLICATE_WAN_IMAGE_COUNT_RANGE } from '~/cli/commands/process-steps/step-5-image/image-generation-services/replicate/run-replicate-image-gen'

// Values Seedream accepts that no other image provider does, so the clause stays right
// if the shared ratios change.
const imageAspectRatioLists = [
  GROK_IMAGE_ASPECT_RATIO_VALUES,
  GEMINI_NATIVE_ASPECT_RATIO_VALUES,
  LUMALABS_ASPECT_RATIOS,
  RECRAFT_ASPECT_RATIOS,
  REPLICATE_QWEN_ASPECT_RATIO_VALUES
] as const
const sharedImageAspectRatios = new Set<string>(imageAspectRatioLists.flat())
const seedreamOnlyAspectRatios = REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES.filter(
  (ratio) => !sharedImageAspectRatios.has(ratio)
)

export const IMAGE_COMMAND_SELECTOR_FLAGS = {
  'gemini-image': 'gemini',
  'openai-image': 'openai',
  'grok-image': 'grok',
  'bfl-image': 'bfl',
  'recraft-image': 'recraft',
  'replicate-image': 'replicate',
  'lumalabs-image': 'lumalabs'
} as const satisfies Record<string, string>

export const imageGenFlags = {
  'image-aspect-ratio': {
    description: `Image aspect ratio: ${formatUniqueValueList(...imageAspectRatioLists)} (provider-specific support; Replicate Seedream also supports ${formatValueList(seedreamOnlyAspectRatios)})`,
    type: String
  },
  'image-size': {
    description: `Image size/resolution: ${formatValueList(GEMINI_IMAGE_SIZE_VALUES)} (Gemini/Replicate Wan), ${formatValueList(OPENAI_FIXED_IMAGE_SIZE_VALUES)} or flexible WIDTHxHEIGHT for OpenAI gpt-image-2, ${formatValueList(GROK_IMAGE_SIZE_VALUES)} (Grok), WIDTHxHEIGHT for BFL/Replicate custom sizing, or Recraft model-specific WIDTHxHEIGHT/aspect ratio values`,
    type: String
  },
  'image-quality': {
    description: `Image quality: ${formatValueList(IMAGE_GENERATION_QUALITIES)} (OpenAI, default: auto)`,
    type: String
  },
  'image-format': {
    description: `Image output format: ${formatUniqueValueList(OPENAI_IMAGE_FORMAT_VALUES, BFL_OUTPUT_FORMATS)} (OpenAI default: png; BFL default: jpeg; Replicate seedream-5-lite supports png|jpeg)`,
    type: String
  },
  'image-background': {
    description: `Image background: ${formatValueList(OPENAI_IMAGE_BACKGROUND_VALUES)} (OpenAI, default: auto)`,
    type: String
  },
  'image-count': {
    description: `Number of images to generate in one provider request where supported: ${formatValuesByProvider([
      { provider: 'OpenAI', values: [formatRange(OPENAI_IMAGE_COUNT_RANGE)] },
      { provider: 'Grok', values: [formatRange(GROK_IMAGE_COUNT_RANGE)] },
      { provider: 'Recraft', values: [formatRange(RECRAFT_IMAGE_COUNT_RANGE)] },
      { provider: 'Replicate Wan', values: [formatRange(REPLICATE_WAN_IMAGE_COUNT_RANGE)] }
    ])}; default: 1`,
    type: String
  },
  'image-input': {
    description: `Reference/source image path or URL for edit/reference workflows (repeatable; OpenAI, Grok, Gemini native, BFL, Replicate, Luma Labs; Luma Labs supports up to ${LUMALABS_MAX_IMAGE_INPUTS})`,
    type: [String] as [StringConstructor]
  },
  'image-mask': {
    description: 'Mask image path for inpainting/edit workflows (OpenAI only)',
    type: String
  },
  'image-response-mode': {
    description: `Gemini native response mode: ${formatValueList(GEMINI_IMAGE_RESPONSE_MODES)} (default: image)`,
    type: String
  },
  'image-search-grounding': {
    description: 'Enable Gemini native image generation with Google Search grounding metadata',
    type: Boolean,
    default: false,
    negatable: false
  },
  'image-compression': {
    description: `OpenAI output compression for jpeg/webp images, ${formatRange(OPENAI_IMAGE_COMPRESSION_RANGE)}`,
    type: String
  },
  'gemini-search-grounding': {
    description: 'Enable Gemini native image generation with Google Search grounding metadata',
    type: Boolean,
    default: false,
    negatable: false,
    help: { hidden: true }
  },
} as const satisfies CliFlagsDefinition

const imageCommandOptionNames = {
  'image-aspect-ratio': 'aspect-ratio',
  'image-size': 'size',
  'image-quality': 'quality',
  'image-format': 'format',
  'image-background': 'background',
  'image-count': 'count',
  'image-input': 'input',
  'image-mask': 'mask',
  'image-response-mode': 'response-mode',
  'image-search-grounding': 'search-grounding',
  'image-compression': 'compression'
} as const satisfies Record<string, string>

const imageProviderSelectionFlags = {
  provider: {
    description: `Image provider[=model]: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}; repeatable`,
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const imageGenerationOptionNames = [
  'image-aspect-ratio',
  'image-size',
  'image-quality',
  'image-format',
  'image-background',
  'image-count'
] as const

export const imageInputOptionNames = [
  'image-input',
  'image-mask'
] as const

export const imageProviderSpecificOptionNames = [
  'image-response-mode',
  'image-search-grounding',
  'image-compression'
] as const

export const imageCommandFlags = {
  ...withHelpGroup(imageProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageGenerationOptionNames), imageCommandOptionNames), 'image-options'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageInputOptionNames), imageCommandOptionNames), 'image-inputs'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageProviderSpecificOptionNames), imageCommandOptionNames), 'image-provider-options'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
