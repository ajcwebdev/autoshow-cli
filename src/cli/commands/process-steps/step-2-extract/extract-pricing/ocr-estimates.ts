import { writeFile } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { validateAnthropicOcrModel, validateDeepinfraOcrModel, validateFalOcrModel, validateGeminiOcrModel, validateGlmOcrModel, validateGrokOcrModel, validateKimiOcrModel, validateMistralOcrModel, validateOpenAIOcrModel, validateReplicateOcrModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { EstimateOcrTokenUsageOptions, HostedOcrEstimateOptions, HostedOcrTokenUsageEstimate, TokenEstimateMetadata, TokenOcrCostEstimate, TokenPricedOcrProvider } from '~/types'
import { resolveHostedOcrTokenUsageEstimate } from '../step-2-ocr/ocr-utils/hosted-ocr-token-profiles'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'

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
    effectiveReasoningEffort: options.effectiveReasoningEffort,
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
  ...(typeof usage.tokenProfileCompletionTokensPerPage === 'number' ? { tokenProfileCompletionTokensPerPage: usage.tokenProfileCompletionTokensPerPage } : {}),
  ...(typeof usage.tokenProfileEffectiveReasoningEffort === 'string' ? { tokenProfileEffectiveReasoningEffort: usage.tokenProfileEffectiveReasoningEffort } : {})
})

const downloadToTemp = async (url: string): Promise<string> => {
  const tempPath = join(tmpdir(), `autoshow-price-${crypto.randomUUID()}.pdf`)
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
    throw ValidationError(`document info returned ${info.pageCount} pages`, { stage: 'ocr:pricing', retryable: false })
  } catch (error) {
    // An unreadable or malformed PDF is not a usage mistake, so it must not exit 2
    // alongside "you passed the wrong flag". Keep the cause so the underlying mutool /
    // download failure survives into `collectErrorChain`.
    throw ValidationError(
      `Unable to estimate hosted OCR price for "${input}": could not determine PDF page count (${formatPageCountError(error)}).`,
      {
        stage: 'ocr:pricing',
        retryable: false,
        hints: ['Confirm the input is a readable PDF, or pass an explicit page count via the pricing options.'],
        ...(error instanceof Error ? { cause: error } : {})
      }
    )
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

export const estimateReplicateOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'replicate', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = validateReplicateOcrModel(modelRaw)
  const pricing = getExtractPricing('replicate', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 200
  const pageCount = await resolveExtractInputPageCountForPricing(input)

  return {
    provider: 'replicate',
    model,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents
  }
}

export const estimateFalOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'fal', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = validateFalOcrModel(modelRaw)
  const pricing = getExtractPricing('fal', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 5000
  const pageCount = await resolveExtractInputPageCountForPricing(input)

  return { provider: 'fal', model, pageCount, costPer1kPagesCents, totalCost: (pageCount / 1000) * costPer1kPagesCents }
}

const estimateTokenPricedOcrCost = async <TProvider extends TokenPricedOcrProvider>(
  provider: TProvider,
  validateModel: (modelRaw: string) => string,
  fallbackInputCostPer1MCents: number,
  fallbackOutputCostPer1MCents: number,
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions,
  note?: string
): Promise<TokenOcrCostEstimate<TProvider> & { note?: string }> => {
  const model = validateModel(modelRaw)
  const pricing = getExtractPricing(provider, model)
  const pageCount = await resolveExtractInputPageCountForPricing(input)
  const ocrMode = options.ocrMode ?? resolveOcrModeForPricingInput(input)
  const tokenUsage = estimateOcrTokenUsage(provider, model, pageCount, {
    ocrMode,
    profilePath: options.hostedOcrTokenProfilePath,
    effectiveReasoningEffort: options.effectiveReasoningEffort
  })
  const { promptTokens, completionTokens } = tokenUsage
  const cost = computeOcrTokenCost(pricing, fallbackInputCostPer1MCents, fallbackOutputCostPer1MCents, promptTokens, completionTokens)

  return {
    provider,
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
    ...(note !== undefined ? { note } : {})
  }
}

export const estimateGlmOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'glm'>> =>
  estimateTokenPricedOcrCost('glm', validateGlmOcrModel, 3, 3, modelRaw, input, options)

export const estimateOpenAIOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'openai'> & { note: string }> =>
  estimateTokenPricedOcrCost('openai', validateOpenAIOcrModel, 20, 125, modelRaw, input, options, OPENAI_OCR_PRICE_NOTE) as Promise<TokenOcrCostEstimate<'openai'> & { note: string }>

export const estimateGrokOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'grok'> & { note: string }> =>
  estimateTokenPricedOcrCost('grok', validateGrokOcrModel, 125, 250, modelRaw, input, options, GROK_OCR_PRICE_NOTE) as Promise<TokenOcrCostEstimate<'grok'> & { note: string }>

export const estimateAnthropicOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'anthropic'> & { note: string }> =>
  estimateTokenPricedOcrCost('anthropic', validateAnthropicOcrModel, 100, 500, modelRaw, input, options, ANTHROPIC_OCR_PRICE_NOTE) as Promise<TokenOcrCostEstimate<'anthropic'> & { note: string }>

export const estimateGeminiOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'gemini'>> =>
  estimateTokenPricedOcrCost('gemini', validateGeminiOcrModel, 25, 150, modelRaw, input, options)

export const estimateDeepinfraOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'deepinfra'> & { note: string }> =>
  estimateTokenPricedOcrCost('deepinfra', validateDeepinfraOcrModel, 9, 19, modelRaw, input, options, DEEPINFRA_OCR_PRICE_NOTE) as Promise<TokenOcrCostEstimate<'deepinfra'> & { note: string }>

export const estimateKimiOcrCost = (
  modelRaw: string,
  input: string,
  options: HostedOcrEstimateOptions = {}
): Promise<TokenOcrCostEstimate<'kimi'> & { note: string }> =>
  estimateTokenPricedOcrCost('kimi', validateKimiOcrModel, 95, 400, modelRaw, input, options, KIMI_OCR_PRICE_NOTE) as Promise<TokenOcrCostEstimate<'kimi'> & { note: string }>

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
