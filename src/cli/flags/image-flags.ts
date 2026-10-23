import { booleanAllProvidersFlag, modelCostFilterFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatUniqueValueList, formatValueList, formatValuesByProvider, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { GEMINI_IMAGE_RESPONSE_MODES, GEMINI_IMAGE_SIZE_VALUES, GEMINI_NATIVE_ASPECT_RATIO_VALUES } from '~/cli/commands/visuals/image/image-generation-services/image-gemini/gemini-image-targets'
import { GROK_IMAGE_ASPECT_RATIO_VALUES, GROK_IMAGE_COUNT_RANGE, GROK_IMAGE_SIZE_VALUES } from '~/cli/commands/visuals/image/image-generation-services/image-grok/grok-image-targets'
import { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES, OPENAI_IMAGE_COMPRESSION_RANGE, OPENAI_IMAGE_COUNT_RANGE, OPENAI_IMAGE_FORMAT_VALUES } from '~/cli/commands/visuals/image/image-generation-services/image-openai/openai-image-targets'
import { FAL_IMAGE_COUNT_RANGE } from '~/cli/commands/visuals/image/image-generation-services/fal-image-service/run-fal-image-gen'

const imageAspectRatioLists = [
  GROK_IMAGE_ASPECT_RATIO_VALUES,
  GEMINI_NATIVE_ASPECT_RATIO_VALUES
] as const

export const imageGenFlags = {
  'aspect-ratio': strFlag(`Image aspect ratio: ${formatUniqueValueList(...imageAspectRatioLists)} (provider-specific support; omitted by default for provider sizing). OpenAI/fal.ai use --size instead`),
  size: strFlag(`Image size/resolution: ${formatValueList(GEMINI_IMAGE_SIZE_VALUES)} (Gemini), ${formatValueList(OPENAI_FIXED_IMAGE_SIZE_VALUES)} or flexible WIDTHxHEIGHT for OpenAI GPT Image 2/2.5 (default: auto), ${formatValueList(GROK_IMAGE_SIZE_VALUES)} (Grok; default: 1K), or WIDTHxHEIGHT for fal.ai custom sizing. Other defaults use provider sizing`),
  quality: strFlag(`Image quality: ${formatValueList(IMAGE_GENERATION_QUALITIES)} (OpenAI, default: auto; xhigh/max require GPT Image 2.5); Grok Image 2.0: low|medium|auto (auto pins low for generation, medium for editing)`),
  format: strFlag(`Image output format: ${formatValueList(OPENAI_IMAGE_FORMAT_VALUES)} (OpenAI/fal.ai). Default: png for OpenAI; provider default for fal.ai`),
  background: strFlag(`Image background: ${formatValueList(OPENAI_IMAGE_BACKGROUND_VALUES)} (OpenAI, default: auto; transparent requires GPT Image 2.5 and png/webp)`),
  count: strFlag(`Number of images to generate in one provider request where supported: ${formatValuesByProvider([
    { provider: 'OpenAI', values: [formatRange(OPENAI_IMAGE_COUNT_RANGE)] },
    { provider: 'Grok', values: [formatRange(GROK_IMAGE_COUNT_RANGE)] },
    { provider: 'fal.ai', values: [formatRange(FAL_IMAGE_COUNT_RANGE)] }
  ])} (default: 1)`),
  input: strListFlag('Reference/source image path or URL for edit/reference workflows (repeatable; OpenAI, Grok, Gemini native, fal.ai; Grok: 5; fal.ai Qwen: 3, HiDream: 9)'),
  mask: strFlag('Mask image path for inpainting/edit workflows (OpenAI only)'),
  'response-mode': strFlag(`Gemini native response mode: ${formatValueList(GEMINI_IMAGE_RESPONSE_MODES)} (default: image)`),
  compression: strFlag(`OpenAI output compression for jpeg/webp images, ${formatRange(OPENAI_IMAGE_COMPRESSION_RANGE)} (default: provider compression; requires --format jpeg or webp)`),
} as const satisfies CliFlagsDefinition

const imageProviderSelectionFlags = {
  provider: strListFlag(`Image provider[=model]: ${formatProviderList(STANDALONE_IMAGE_PROVIDER_TARGETS)}; repeatable`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const imageGenerationOptionNames = [
  'aspect-ratio',
  'size',
  'quality',
  'format',
  'background',
  'count'
] as const

export const imageInputOptionNames = [
  'input',
  'mask'
] as const

export const imageProviderSpecificOptionNames = [
  'response-mode',
  'compression'
] as const

export const imageCommandFlags = {
  ...withHelpGroup(imageProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(pickFlags(imageGenFlags, imageGenerationOptionNames), 'image-options'),
  ...withHelpGroup(pickFlags(imageGenFlags, imageInputOptionNames), 'image-inputs'),
  ...withHelpGroup(pickFlags(imageGenFlags, imageProviderSpecificOptionNames), 'image-provider-options'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
