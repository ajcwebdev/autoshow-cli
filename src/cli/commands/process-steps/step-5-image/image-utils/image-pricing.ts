import { getImageCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateBflImageModel, validateFalImageModel, validateGeminiImageModel, validateGrokImageModel, validateLumalabsImageModel, validateOpenAIImageModel, validateRecraftImageModel, validateReplicateImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { EstimateImageCostOptions, ImageCostEstimate, ImageProvider, OpenAIImageOutputPricing, OpenAIImageQuality } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'
import type { ProviderModelSelectionSpec } from '~/utils/pricing/model-selection'

export const IMAGE_PRICING_PROVIDERS = [
  { service: 'gemini', modelsKey: 'geminiImageModels', modelKey: 'geminiImageModel' },
  { service: 'openai', modelsKey: 'openaiImageModels', modelKey: 'openaiImageModel' },
  { service: 'grok', modelsKey: 'grokImageModels', modelKey: 'grokImageModel' },
  { service: 'bfl', modelsKey: 'bflImageModels', modelKey: 'bflImageModel' },
  { service: 'recraft', modelsKey: 'recraftImageModels', modelKey: 'recraftImageModel' },
  { service: 'replicate', modelsKey: 'replicateImageModels', modelKey: 'replicateImageModel' },
  { service: 'lumalabs', modelsKey: 'lumalabsImageModels', modelKey: 'lumalabsImageModel' },
  { service: 'fal', modelsKey: 'falImageModels', modelKey: 'falImageModel' }
] as const satisfies readonly ProviderModelSelectionSpec<EstimateImageCostOptions, ImageProvider>[]

export const IMAGE_PRICING_MODEL_KEYS = passThroughKeys(IMAGE_PRICING_PROVIDERS)

const OPENAI_IMAGE_OUTPUT_PRICE_CENTS: Partial<Record<string, OpenAIImageOutputPricing>> = {
  'gpt-image-2': {
    label: 'GPT Image 2',
    defaultCostCents: 5.3,
    supportsFlexibleSizes: true,
    commonSizeCosts: {
      '1024x1024': {
        low: 0.6,
        medium: 5.3,
        high: 21.1
      },
      '1024x1536': {
        low: 0.5,
        medium: 4.1,
        high: 16.5
      },
      '1536x1024': {
        low: 0.5,
        medium: 4.1,
        high: 16.5
      }
    }
  }
}

const OPENAI_IMAGE_LATENCY_NOTE = 'Low quality is fastest; square images are typically fastest; JPEG is faster than PNG; complex prompts can take up to about 2 minutes.'
const OPENAI_IMAGE_INPUT_COST_NOTE = 'Estimate covers image output only; OpenAI also bills text and image input tokens when present.'

const GEMINI_IMAGE_OUTPUT_PRICE_CENTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'gemini-3.1-flash-lite-image': { '1K': 3.36 },
  'gemini-3.1-flash-image': { '1K': 6.7, '2K': 10.1, '4K': 15.1 },
  'gemini-3-pro-image': { '1K': 13.4, '2K': 13.4, '4K': 24 }
}

const REPLICATE_SEEDREAM_5_PRO_PRICE_CENTS: Readonly<Record<string, number>> = {
  '1K': 4.5,
  '2K': 9
}

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
  const pricing = OPENAI_IMAGE_OUTPUT_PRICE_CENTS[model]
  if (!pricing) {
    return {
      costPerImageCents: getImageCost('openai', model) || 4,
      note: `Approximate cost; see OpenAI pricing for exact rates. ${OPENAI_IMAGE_INPUT_COST_NOTE}`
    }
  }

  const quality = normalizeOpenAIQualityForEstimate(options.imageQuality)
  const size = normalizeOpenAIImageSizeForEstimate(options.imageSize)
  const documentedCost = pricing.commonSizeCosts[size]?.[quality]

  if (typeof documentedCost === 'number') {
    return {
      costPerImageCents: documentedCost,
      note: `Approximate ${pricing.label} output estimate for ${size} ${quality} quality. ${OPENAI_IMAGE_INPUT_COST_NOTE} ${OPENAI_IMAGE_LATENCY_NOTE}`
    }
  }

  const sizeDescription = pricing.supportsFlexibleSizes
    ? 'a flexible size'
    : 'an unsupported size'
  return {
    costPerImageCents: pricing.defaultCostCents,
    note: `Approximate ${pricing.label} output estimate for ${sizeDescription}; using the 1024x1024 medium default. ${OPENAI_IMAGE_INPUT_COST_NOTE} Check OpenAI's calculator for this exact resolution. ${OPENAI_IMAGE_LATENCY_NOTE}`
  }
}

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  for (const selection of collectSelections(options, IMAGE_PRICING_PROVIDERS)) {
    switch (selection.service) {
      case 'gemini': {
        const model = validateGeminiImageModel(selection.model)
        const imageSize = options.imageSize ?? '1K'
        const costPerImageCents = GEMINI_IMAGE_OUTPUT_PRICE_CENTS[model]?.[imageSize] ?? (getImageCost('gemini', model) || 4)
        estimates.push({
          provider: 'gemini',
          model,
          imageCount: 1,
          costPerImageCents,
          totalCost: costPerImageCents,
          note: `Published Gemini standard-tier ${imageSize} output-image estimate; text/image input tokens and optional Search grounding are not included`
        })
        break
      }
      case 'openai': {
        const model = validateOpenAIImageModel(selection.model)
        const { costPerImageCents, note } = estimateOpenAIImageCost(model, options)
        const imageCount = Math.max(1, options.imageCount ?? 1)
        estimates.push({
          provider: 'openai',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount,
          note
        })
        break
      }
      case 'grok': {
        const model = validateGrokImageModel(selection.model)
        const costPerImageCents = getImageCost('grok', model)
        const imageCount = Math.max(1, options.imageCount ?? 1)
        estimates.push({
          provider: 'grok',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount,
          note: 'Approximate cost; xAI publishes flat per-image billing and exact account pricing may vary'
        })
        break
      }
      case 'bfl': {
        const model = validateBflImageModel(selection.model)
        const costPerImageCents = getImageCost('bfl', model)
        estimates.push({
          provider: 'bfl',
          model,
          imageCount: 1,
          costPerImageCents,
          totalCost: costPerImageCents,
          note: 'Approximate from BFL published FLUX.2 starting prices; exact cost varies by output resolution and provider quote is used when returned'
        })
        break
      }
      case 'recraft': {
        const model = validateRecraftImageModel(selection.model)
        const costPerImageCents = getImageCost('recraft', model)
        const imageCount = Math.max(1, options.imageCount ?? 1)
        estimates.push({
          provider: 'recraft',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount,
          note: 'Approximate Recraft published per-image API unit price; local estimates cover generation output only'
        })
        break
      }
      case 'replicate': {
        const model = validateReplicateImageModel(selection.model)
        const normalizedSize = options.imageSize?.toUpperCase() ?? '1K'
        const costPerImageCents = model === 'bytedance/seedream-5-pro'
          ? (REPLICATE_SEEDREAM_5_PRO_PRICE_CENTS[normalizedSize] ?? REPLICATE_SEEDREAM_5_PRO_PRICE_CENTS['1K']!)
          : getImageCost('replicate', model)
        const supportsCount = model.startsWith('wan-video/') || model.startsWith('prunaai/ernie-image')
        const imageCount = supportsCount ? Math.max(1, options.imageCount ?? 1) : 1
        const note = model === 'bytedance/seedream-5-pro'
          ? `Published Replicate Seedream 5 Pro ${normalizedSize} per-output-image price; provider-reported billing is used when returned`
          : model.startsWith('prunaai/ernie-image')
            ? 'Approximate Replicate H100 runtime estimate at the default 1024x1024 settings; actual cost varies with runtime, resolution, prompt enhancement, and output count'
            : 'Approximate Replicate published per-output-image price; provider-reported billing is used when returned'
        estimates.push({
          provider: 'replicate',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount,
          note
        })
        break
      }
      case 'lumalabs': {
        const model = validateLumalabsImageModel(selection.model)
        const costPerImageCents = getImageCost('lumalabs', model)
        estimates.push({
          provider: 'lumalabs',
          model,
          imageCount: 1,
          costPerImageCents,
          totalCost: costPerImageCents,
          note: 'Approximate Luma Labs published per-image pricing; image edits and reference images cost slightly more per the Luma pricing table'
        })
        break
      }
      case 'fal': {
        const model = validateFalImageModel(selection.model)
        const costPerImageCents = getImageCost('fal', model)
        const imageCount = Math.max(1, options.imageCount ?? 1)
        estimates.push({
          provider: 'fal',
          model,
          imageCount,
          costPerImageCents,
          totalCost: costPerImageCents * imageCount,
          note: model === 'fal-ai/hidream-o1-image'
            ? 'fal.ai bills HiDream per output megapixel; the local estimate uses the default one-megapixel output'
            : model === 'reve/2.1'
              ? 'fal.ai published per-image price for Reve 2.1'
              : 'Provisional fal.ai estimate derived from the endpoint billing unit and default runtime; actual compute-based billing may vary'
        })
        break
      }
    }
  }

  return estimates
}

export const logImageEstimate = (estimate: ImageCostEstimate): void => {
  const entries: Array<readonly [string, string]> = [
    ['Provider', estimate.provider],
    ['Model', estimate.model],
    ['Image Count', String(estimate.imageCount)],
    ['Cost Per Image', `${estimate.costPerImageCents.toFixed(3)}¢`],
    ['Total Cost', `${estimate.totalCost.toFixed(3)}¢`],
    ...(estimate.note ? [['Note', estimate.note] as const] : [])
  ]
  l.write('info', `Estimated image cost for ${estimate.provider}/${estimate.model}`, {
    category: 'pricing',
    humanTable: createKeyValueTable(entries),
    metadata: estimate
  })
}
