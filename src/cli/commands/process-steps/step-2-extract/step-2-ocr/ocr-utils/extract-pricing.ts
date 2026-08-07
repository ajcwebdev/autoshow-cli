import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateAnthropicOcrModel, validateDeepinfraOcrModel, validateGeminiOcrModel, validateGlmOcrModel, validateGrokOcrModel, validateKimiOcrModel, validateMistralOcrModel, validateOpenAIOcrModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { EstimateOcrTokenUsageOptions, HostedOcrEstimateOptions, HostedOcrTokenUsageEstimate, TokenEstimateMetadata, TokenOcrCostEstimate, TokenPricedOcrProvider } from '~/types'
import { resolveHostedOcrTokenUsageEstimate } from './hosted-ocr-token-profiles'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { CLIUsageError, InfraError } from '~/utils/error-handler'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif', '.bmp'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1
const FIRECRAWL_MODEL = 'firecrawl'
const OCR_INPUT_TOKENS_PER_PAGE = 4000
const OCR_OUTPUT_TOKENS_PER_PAGE = 1000
const OPENAI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed OpenAI OCR benchmark usage. Actual OpenAI OCR cost is computed from response usage after execution.'
export const ANTHROPIC_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Anthropic OCR benchmark usage. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'
export const GEMINI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Gemini OCR benchmark usage. Actual Gemini OCR cost is computed from response usage after execution.'
export const GLM_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed GLM OCR benchmark usage. Actual GLM OCR cost is computed from response usage after execution.'
export const GROK_OCR_PRICE_NOTE = 'Provisional heuristic token estimate of 4000 input tokens and 1000 output tokens per page until Grok OCR calibration data is available. Actual Grok OCR cost is computed from response usage after execution.'
export const DEEPINFRA_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed DeepInfra OCR benchmark usage. Actual DeepInfra OCR cost is computed from response usage after execution.'
export const KIMI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Kimi OCR benchmark usage. Actual Kimi OCR cost is computed from response usage after execution. AutoShow uses Kimi cache-miss input pricing for conservative estimates.'

export const FIRECRAWL_PRICE_NOTE = 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'

const computeOcrTokenCost = (
  pricing: ReturnType<typeof getExtractPricing>,
  fallbackInputCostPer1MCents: number,
  fallbackOutputCostPer1MCents: number,
  promptTokens: number,
  completionTokens: number
): {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  pricingBand?: string | undefined
  pricingNote?: string | undefined
} => {
  const tokenCost = computeTokenCost({
    inputCostPer1MCents: pricing.inputCostPer1MCents ?? fallbackInputCostPer1MCents,
    outputCostPer1MCents: pricing.outputCostPer1MCents ?? fallbackOutputCostPer1MCents,
    ...(pricing.tokenPricingBands !== undefined ? { tokenPricingBands: pricing.tokenPricingBands } : {}),
    ...(pricing.higherContextPricing !== undefined ? { higherContextPricing: pricing.higherContextPricing } : {})
  }, promptTokens, completionTokens)

  return {
    inputCostPer1MCents: tokenCost.inputCostPer1MCents,
    outputCostPer1MCents: tokenCost.outputCostPer1MCents,
    totalCost: tokenCost.totalCost,
    ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
    ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
  }
}

export const estimateOcrTokenUsage = (
  provider: TokenPricedOcrProvider,
  model: string,
  pageCount: number,
  options: EstimateOcrTokenUsageOptions = {}
): HostedOcrTokenUsageEstimate => {
  const estimation = getExtractEstimation(provider, model)
  const promptTokensPerPage = estimation.promptTokensPerPage ?? OCR_INPUT_TOKENS_PER_PAGE
  const completionTokensPerPage = estimation.completionTokensPerPage ?? OCR_OUTPUT_TOKENS_PER_PAGE

  return resolveHostedOcrTokenUsageEstimate({
    provider,
    model,
    pageCount,
    ocrMode: options.ocrMode,
    profilePath: options.profilePath,
    registryPromptTokensPerPage: promptTokensPerPage,
    registryCompletionTokensPerPage: completionTokensPerPage
  })
}

const getInputExtension = (input: string): string => {
  if (isRemoteUrl(input)) {
    try {
      return extname(new URL(input).pathname).toLowerCase()
    } catch {
    }
  }

  return extname(input).toLowerCase()
}

const hasImageExtension = (input: string): boolean => {
  const ext = getInputExtension(input)
  return IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number])
}

const hasPdfExtension = (input: string): boolean => getInputExtension(input) === '.pdf'

const isRemoteUrl = (input: string): boolean => /^https?:\/\//i.test(input)

const resolveOcrModeForPricingInput = (input: string): string =>
  hasPdfExtension(input)
    ? 'pdf'
    : hasImageExtension(input)
      ? 'image'
      : 'unknown'

const tokenEstimateMetadata = (
  usage: HostedOcrTokenUsageEstimate
): TokenEstimateMetadata => ({
  tokenEstimateSource: usage.tokenEstimateSource,
  tokenEstimateConfidence: usage.tokenEstimateConfidence,
  ...(typeof usage.tokenProfileSampleCount === 'number' ? { tokenProfileSampleCount: usage.tokenProfileSampleCount } : {}),
  ...(typeof usage.tokenProfilePromptTokensPerPage === 'number' ? { tokenProfilePromptTokensPerPage: usage.tokenProfilePromptTokensPerPage } : {}),
  ...(typeof usage.tokenProfileCompletionTokensPerPage === 'number' ? { tokenProfileCompletionTokensPerPage: usage.tokenProfileCompletionTokensPerPage } : {})
})

const downloadToTemp = async (url: string): Promise<string> => {
  const tempPath = join(tmpdir(), `autoshow-price-${randomUUID()}.pdf`)
  const response = await fetch(url)
  if (!response.ok) throw InfraError(`Failed to fetch ${url}: ${response.status}`, { stage: 'ocr:extract-pricing', status: response.status })
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(tempPath, buffer)
  return tempPath
}

const formatPageCountError = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message.trim()
    : String(error)

const pageCountCache = new Map<string, Promise<number>>()

export const resolveExtractInputPageCountForPricing = (input: string): Promise<number> => {
  const cached = pageCountCache.get(input)
  if (cached) return cached

  const promise = resolveExtractInputPageCountUncached(input)
  pageCountCache.set(input, promise)
  void promise.catch(() => {
    if (pageCountCache.get(input) === promise) {
      pageCountCache.delete(input)
    }
  })
  return promise
}

const resolveExtractInputPageCountUncached = async (input: string): Promise<number> => {
  if (hasImageExtension(input)) return DEFAULT_EXTRACT_PAGE_COUNT
  if (!hasPdfExtension(input)) {
    throw CLIUsageError(`Unable to estimate hosted OCR price for "${input}": expected a PDF or image input so page count can be determined.`)
  }

  let localPath = input
  let tempFile: string | undefined
  try {
    if (isRemoteUrl(input)) {
      tempFile = await downloadToTemp(input)
      localPath = tempFile
    }
    const info = await getDocumentInfo(localPath)
    if (Number.isFinite(info.pageCount) && info.pageCount > 0) {
      return Math.floor(info.pageCount)
    }
    throw new Error(`document info returned ${info.pageCount} pages`)
  } catch (error) {
    throw CLIUsageError(`Unable to estimate hosted OCR price for "${input}": could not determine PDF page count (${formatPageCountError(error)}).`)
  } finally {
    if (tempFile) {
      await unlink(tempFile).catch(() => {})
    }
  }
}

export const estimateMistralOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'mistral', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = validateMistralOcrModel(modelRaw)
  const pricing = getExtractPricing('mistral', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 200
  const pageCount = await resolveExtractInputPageCountForPricing(input)

  return {
    provider: 'mistral',
    model,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents
  }
}

export const estimateGlmOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'glm'>> => {
  const model = validateGlmOcrModel(modelRaw)
  const pricing = getExtractPricing('glm', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('glm', model, pageCount, {
    ocrMode,
    profilePath: options.hostedOcrTokenProfilePath
  })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 3, 3, promptTokens, completionTokens)

  return {
    provider: 'glm',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic'
  }
}

export const estimateOpenAIOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'openai'> & {
  note: string
}> => {
  const model = validateOpenAIOcrModel(modelRaw)
  const pricing = getExtractPricing('openai', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('openai', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 20, 125, promptTokens, completionTokens)

  return {
    provider: 'openai',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic',
    note: OPENAI_OCR_PRICE_NOTE
  }
}

export const estimateGrokOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'grok'> & {
  note: string
}> => {
  const model = validateGrokOcrModel(modelRaw)
  const pricing = getExtractPricing('grok', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('grok', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 125, 250, promptTokens, completionTokens)

  return {
    provider: 'grok',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic',
    note: GROK_OCR_PRICE_NOTE
  }
}

export const estimateAnthropicOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'anthropic'> & {
  note: string
}> => {
  const model = validateAnthropicOcrModel(modelRaw)
  const pricing = getExtractPricing('anthropic', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('anthropic', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 100, 500, promptTokens, completionTokens)

  return {
    provider: 'anthropic',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic',
    note: ANTHROPIC_OCR_PRICE_NOTE
  }
}

export const estimateGeminiOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'gemini'>> => {
  const model = validateGeminiOcrModel(modelRaw)
  const pricing = getExtractPricing('gemini', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('gemini', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 25, 150, promptTokens, completionTokens)

  return {
    provider: 'gemini',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic'
  }
}

export const estimateDeepinfraOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'deepinfra'> & {
  note: string
}> => {
  const model = validateDeepinfraOcrModel(modelRaw)
  const pricing = getExtractPricing('deepinfra', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('deepinfra', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 9, 19, promptTokens, completionTokens)

  return {
    provider: 'deepinfra',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic',
    note: DEEPINFRA_OCR_PRICE_NOTE
  }
}

export const estimateKimiOcrCost = async (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'kimi'> & {
  note: string
}> => {
  const model = validateKimiOcrModel(modelRaw)
  const pricing = getExtractPricing('kimi', model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage('kimi', model, pageCount, { ocrMode, profilePath: options.hostedOcrTokenProfilePath })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, 95, 400, promptTokens, completionTokens)

  return {
    provider: 'kimi',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents: cost.inputCostPer1MCents,
    outputCostPer1MCents: cost.outputCostPer1MCents,
    totalCost: cost.totalCost,
    ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
    ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {}),
    ocrMode,
    ...tokenEstimateMetadata(tokenUsage),
    estimateType: 'heuristic',
    note: KIMI_OCR_PRICE_NOTE
  }
}

export const estimateFirecrawlScrapeCost = (): {
  provider: 'firecrawl'
  model: string
  pageCount: number
  costPer1kPagesCents: number
  totalCost: number
  estimateType: 'exact'
  note: string
} => {
  const pricing = getExtractPricing('firecrawl', FIRECRAWL_MODEL)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 83
  const pageCount = DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'firecrawl',
    model: FIRECRAWL_MODEL,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents,
    estimateType: 'exact',
    note: FIRECRAWL_PRICE_NOTE
  }
}

export { OPENAI_OCR_PRICE_NOTE }
