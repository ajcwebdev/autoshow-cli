import { validateGeminiImageDimensions } from '../image-generation-services/image-gemini/gemini-image-options'
import { resolveGrokImageOptions } from '../image-generation-services/image-grok/grok-image-options'
import { getImageInputCostPer1M, getImageModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateGeminiImageModel, validateGrokImageModel, validateOpenAIImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { deriveGenerationPricingProviders, IMAGE_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import type { EstimateImageCostOptions, ImageCostEstimate, ImageProvider, OpenAIImageInputEstimate, OpenAIImageQuality, ProviderModelSelectionSpec } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'
import { requireRegistryRate } from '~/utils/pricing/registry-rate'
import { isOpenAIImage25Model } from '~/cli/commands/setup-and-utilities/models/image-models'
import { estimateOpenAIImage25Output } from './openai-image-pricing'
import { OPENAI_IMAGE_COUNT_RANGE, validateOpenAIImageOptions } from '../image-generation-services/image-openai/openai-image-options'
import { validateImageCount } from './image-target-validation'

export const IMAGE_PRICING_PROVIDERS = deriveGenerationPricingProviders(IMAGE_GENERATION_SELECTION) satisfies readonly ProviderModelSelectionSpec<EstimateImageCostOptions, ImageProvider>[]

export const IMAGE_PRICING_MODEL_KEYS = passThroughKeys(IMAGE_PRICING_PROVIDERS)

const OPENAI_IMAGE_LATENCY_NOTE = 'Low quality is fastest; square images are typically fastest; JPEG is faster than PNG; complex prompts can take up to about 2 minutes.'
export const OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE = 1000
export const OPENAI_IMAGE_INPUT_COST_NOTE = 'Estimate covers image output; input images are modeled at 1,000 units per high-detail reference and priced at the registry image-input rate when one exists, else reported unpriced. OpenAI also bills text input units, which are not modeled.'

export const estimateOpenAIImageInputUnits = (model: string, referenceInputs: number): OpenAIImageInputEstimate => {
  const normalizedReferenceInputs = Math.max(0, Math.floor(referenceInputs))
  const totalUnits = normalizedReferenceInputs * OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE
  const ratePer1MCents = getImageInputCostPer1M('openai', model)
  return {
    unitsPerReference: OPENAI_IMAGE_INPUT_UNITS_PER_REFERENCE,
    referenceInputs: normalizedReferenceInputs,
    totalUnits,
    ratePer1MCents,
    costCents: ratePer1MCents === null ? null : (totalUnits / 1_000_000) * ratePer1MCents,
    priced: ratePer1MCents !== null
  }
}

const requireImageCost = (service: ImageProvider, model: string, value: number | undefined, field: string): number =>
  requireRegistryRate(value, { category: 'image', service, model, field })

const normalizeOpenAIQualityForEstimate = (quality: string | undefined): OpenAIImageQuality => {
  const normalized = quality?.toLowerCase()
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized
  }
  return 'medium'
}

const normalizeOpenAIImageSizeForEstimate = (size: string | undefined): string => {
  const normalized = size?.toLowerCase()
  if (!normalized || normalized === 'auto') {
    return '1024x1024'
  }
  return normalized
}

const estimateOpenAIImageCost = (
  model: string,
  options: Pick<EstimateImageCostOptions, 'imageSize' | 'imageQuality'>
): { costPerImageCents: number, note: string } => {
  if (isOpenAIImage25Model(model)) return estimateOpenAIImage25Output(model, options)
  const meta = getImageModelMeta('openai', model)
  const sizeQualityCosts = meta?.costPerImageBySizeQualityCents
  const defaultCostCents = requireImageCost('openai', model, meta?.costPerImageCents, 'costPerImageCents')
  if (!sizeQualityCosts) {
    return {
      costPerImageCents: defaultCostCents,
      note: `Approximate cost; see OpenAI pricing for exact rates. ${OPENAI_IMAGE_INPUT_COST_NOTE}`
    }
  }

  const label = meta?.displayName ?? model
  const quality = normalizeOpenAIQualityForEstimate(options.imageQuality)
  const size = normalizeOpenAIImageSizeForEstimate(options.imageSize)
  const documentedCost = sizeQualityCosts[size]?.[quality]

  if (typeof documentedCost === 'number') {
    return {
      costPerImageCents: documentedCost,
      note: `Approximate ${label} output estimate for ${size} ${quality} quality. ${OPENAI_IMAGE_INPUT_COST_NOTE} ${OPENAI_IMAGE_LATENCY_NOTE}`
    }
  }

  const sizeDescription = meta?.supportsFlexibleSizes === true
    ? 'a flexible size'
    : 'an unsupported size'
  return {
    costPerImageCents: defaultCostCents,
    note: `Approximate ${label} output estimate for ${sizeDescription}; using the 1024x1024 medium default. ${OPENAI_IMAGE_INPUT_COST_NOTE} Check OpenAI's calculator for this exact resolution. ${OPENAI_IMAGE_LATENCY_NOTE}`
  }
}

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  for (const selection of collectSelections(options, IMAGE_PRICING_PROVIDERS)) {
    switch (selection.service) {
      case 'gemini': {
        const model = validateGeminiImageModel(selection.model)
        validateGeminiImageDimensions(model, options)
        const imageSize = options.imageSize ?? '1K'
        const meta = getImageModelMeta('gemini', model)
        const costPerImageCents = meta?.costPerImageBySizeCents?.[imageSize]
          ?? requireImageCost('gemini', model, meta?.costPerImageCents, 'costPerImageCents')
        estimates.push({
          provider: 'gemini',
          model,
          imageCount: 1,
          costPerImageCents,
          totalCost: costPerImageCents,
          note: `Published Gemini standard-tier ${imageSize} output-image estimate; input tokens, text/thinking output tokens, and search grounding are excluded; no grounding tools enabled`
        })
        break
      }
      case 'openai': {
        const model = validateOpenAIImageModel(selection.model)
        validateOpenAIImageOptions(model, options)
        const imageCount = validateImageCount('OpenAI', model, options.imageCount, ...OPENAI_IMAGE_COUNT_RANGE)
        const { costPerImageCents, note } = estimateOpenAIImageCost(model, options)
        const referencesPerCall = options.imageInputs?.length ?? 0
        const imageInputEstimate = referencesPerCall > 0 ? estimateOpenAIImageInputUnits(model, referencesPerCall * imageCount) : undefined
        estimates.push({
          provider: 'openai',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount + (imageInputEstimate?.costCents ?? 0),
          note,
          ...(imageInputEstimate ? { imageInputEstimate } : {})
        })
        break
      }
      case 'grok': {
        const model = validateGrokImageModel(selection.model)
        const { quality, resolution, imageCount } = resolveGrokImageOptions(model, options)
        const meta = getImageModelMeta('grok', model)
        const costPerImageCents = requireImageCost(
          'grok', model, meta?.costPerImageBySizeQualityCents?.[resolution]?.[quality],
          `costPerImageBySizeQualityCents.${resolution}.${quality}`
        )
        const inputImageCount = options.imageInputs?.length ?? 0
        const inputImageRateCents = requireImageCost('grok', model, meta?.inputImageCostCents, 'inputImageCostCents')
        const inputImageCostCents = inputImageCount * inputImageRateCents
        estimates.push({
          provider: 'grok', model, imageCount, costPerImageCents,
          totalCost: costPerImageCents * imageCount + inputImageCostCents,
          inputImageCount, inputImageCostCents,
          note: `Published xAI ${resolution} ${quality} output price plus ${inputImageCount} input images at ${inputImageRateCents} cent${inputImageRateCents === 1 ? '' : 's'} each per request. Account discounts and taxes excluded.`
        })
        break
      }
    }
  }

  return estimates
}

export const logImageEstimate = (estimate: ImageCostEstimate): void => {
  l.write('info', `Estimated ${estimate.imageCount} images with ${estimate.provider}/${estimate.model}: ${estimate.totalCost.toFixed(3)}¢`, {
    category: 'pricing',
    metadata: estimate
  })
}
