import { getImageCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateBflImageModel, validateGeminiImageModel, validateGrokImageModel, validateLumalabsImageModel, validateOpenAIImageModel, validateRecraftImageModel, validateReplicateImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { EstimateImageCostOptions, ImageCostEstimate, OpenAIImageOutputPricing, OpenAIImageQuality } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

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
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const bflModels = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  const recraftModels = options.recraftImageModels ?? (options.recraftImageModel ? [options.recraftImageModel] : [])
  const replicateModels = options.replicateImageModels ?? (options.replicateImageModel ? [options.replicateImageModel] : [])
  const lumalabsModels = options.lumalabsImageModels ?? (options.lumalabsImageModel ? [options.lumalabsImageModel] : [])

  for (const rawModel of geminiModels) {
    const model = validateGeminiImageModel(rawModel)
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
  }

  for (const rawModel of openaiModels) {
    const model = validateOpenAIImageModel(rawModel)
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
  }

  for (const rawModel of grokModels) {
    const model = validateGrokImageModel(rawModel)
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
  }

  for (const rawModel of bflModels) {
    const model = validateBflImageModel(rawModel)
    const costPerImageCents = getImageCost('bfl', model)
    estimates.push({
      provider: 'bfl',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate from BFL published FLUX.2 starting prices; exact cost varies by output resolution and provider quote is used when returned'
    })
  }

  for (const rawModel of recraftModels) {
    const model = validateRecraftImageModel(rawModel)
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
  }

  for (const rawModel of replicateModels) {
    const model = validateReplicateImageModel(rawModel)
    const costPerImageCents = getImageCost('replicate', model)
    const imageCount = model.startsWith('wan-video/') ? Math.max(1, options.imageCount ?? 1) : 1
    estimates.push({
      provider: 'replicate',
      model,
      imageCount,
      costPerImageCents,
      totalCost: costPerImageCents * imageCount,
      note: 'Approximate Replicate published per-output-image price; provider-reported billing is used when returned'
    })
  }

  for (const rawModel of lumalabsModels) {
    const model = validateLumalabsImageModel(rawModel)
    const costPerImageCents = getImageCost('lumalabs', model)
    estimates.push({
      provider: 'lumalabs',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate Luma Labs published per-image pricing; image edits and reference images cost slightly more per the Luma pricing table'
    })
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
