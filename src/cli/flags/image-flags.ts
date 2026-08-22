import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { boolFlag, formatProviderList, formatRange, formatUniqueValueList, formatValueList, formatValuesByProvider, pickFlags, renameFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { GEMINI_IMAGE_RESPONSE_MODES, GEMINI_IMAGE_SIZE_VALUES, GEMINI_NATIVE_ASPECT_RATIO_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/gemini-image-targets'
import { GROK_IMAGE_ASPECT_RATIO_VALUES, GROK_IMAGE_COUNT_RANGE, GROK_IMAGE_SIZE_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-grok/grok-image-targets'
import { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES, OPENAI_IMAGE_COMPRESSION_RANGE, OPENAI_IMAGE_COUNT_RANGE, OPENAI_IMAGE_FORMAT_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/openai-image-targets'
import { BFL_OUTPUT_FORMATS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/bfl/run-bfl-image-gen'
import { LUMALABS_ASPECT_RATIOS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/run-lumalabs-image-gen'
import { LUMALABS_MAX_IMAGE_INPUTS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/lumalabs-image-targets'
import { REPLICATE_QWEN_ASPECT_RATIO_VALUES, REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES, REPLICATE_WAN_IMAGE_COUNT_RANGE } from '~/cli/commands/process-steps/step-5-image/image-generation-services/replicate/run-replicate-image-gen'
import { FAL_IMAGE_COUNT_RANGE, FAL_REVE_ASPECT_RATIOS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/fal-image-service/run-fal-image-gen'

const imageAspectRatioLists = [
  GROK_IMAGE_ASPECT_RATIO_VALUES,
  GEMINI_NATIVE_ASPECT_RATIO_VALUES,
  LUMALABS_ASPECT_RATIOS,
  REPLICATE_QWEN_ASPECT_RATIO_VALUES,
  FAL_REVE_ASPECT_RATIOS
] as const
const sharedImageAspectRatios = new Set<string>(imageAspectRatioLists.flat())
const seedreamOnlyAspectRatios = REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES.filter(
  (ratio) => !sharedImageAspectRatios.has(ratio)
)

export const imageGenFlags = {
  'image-aspect-ratio': strFlag(`Image aspect ratio: ${formatUniqueValueList(...imageAspectRatioLists)} (provider-specific support; Replicate Seedream also supports ${formatValueList(seedreamOnlyAspectRatios)})`),
  'image-size': strFlag(`Image size/resolution: ${formatValueList(GEMINI_IMAGE_SIZE_VALUES)} (Gemini/Replicate Wan), ${formatValueList(OPENAI_FIXED_IMAGE_SIZE_VALUES)} or flexible WIDTHxHEIGHT for OpenAI gpt-image-2, ${formatValueList(GROK_IMAGE_SIZE_VALUES)} (Grok), or WIDTHxHEIGHT for BFL/Replicate/fal.ai custom sizing`),
  'image-quality': strFlag(`Image quality: ${formatValueList(IMAGE_GENERATION_QUALITIES)} (OpenAI, default: auto)`),
  'image-format': strFlag(`Image output format: ${formatUniqueValueList(OPENAI_IMAGE_FORMAT_VALUES, BFL_OUTPUT_FORMATS)} (OpenAI/fal.ai default: png; BFL default: jpeg; Replicate seedream-5-lite supports png|jpeg)`),
  'image-background': strFlag(`Image background: ${formatValueList(OPENAI_IMAGE_BACKGROUND_VALUES)} (OpenAI, default: auto)`),
  'image-count': strFlag(`Number of images to generate in one provider request where supported: ${formatValuesByProvider([
    { provider: 'OpenAI', values: [formatRange(OPENAI_IMAGE_COUNT_RANGE)] },
    { provider: 'Grok', values: [formatRange(GROK_IMAGE_COUNT_RANGE)] },
    { provider: 'Replicate Wan', values: [formatRange(REPLICATE_WAN_IMAGE_COUNT_RANGE)] },
    { provider: 'fal.ai', values: [formatRange(FAL_IMAGE_COUNT_RANGE)] }
  ])} (default: 1)`),
  'image-input': strListFlag(`Reference/source image path or URL for edit/reference workflows (repeatable; OpenAI, Grok, Gemini native, BFL, Replicate, Luma Labs, fal.ai; Luma Labs supports up to ${LUMALABS_MAX_IMAGE_INPUTS})`),
  'image-mask': strFlag('Mask image path for inpainting/edit workflows (OpenAI only)'),
  'image-response-mode': strFlag(`Gemini native response mode: ${formatValueList(GEMINI_IMAGE_RESPONSE_MODES)} (default: image)`),
  'image-search-grounding': boolFlag('Enable Gemini native image generation with Google Search grounding metadata'),
  'image-compression': strFlag(`OpenAI output compression for jpeg/webp images, ${formatRange(OPENAI_IMAGE_COMPRESSION_RANGE)}`),
} as const satisfies CliFlagsDefinition

export const imageCommandOptionNames = {
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
  provider: strListFlag(`Image provider[=model]: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}; repeatable`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
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
