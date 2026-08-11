import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { estimateOcrTokenUsage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import {
  persistHostedOcrTokenUsageProfiles,
  readHostedOcrTokenUsageProfiles
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-token-profiles'
import { buildOcrCostDiagnostics, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { formatRatesSummary } from '~/cli/commands/process-steps/write-manifest-log/manifest-log-formatting'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { CommandPricingOptions, ExtractionMetadata } from '~/types'
import { findPricingNoteKeys } from './shared'

const MULTI_PAGE_PDF = 'input/examples/document/3-document.pdf'

const missingHostedOcrProfilePath = (): string =>
  join(tmpdir(), `autoshow-missing-ocr-profile-${process.pid}-${Date.now()}-${Math.random()}.json`)

const HOSTED_OCR_PROVIDER_CASES = [
  { provider: 'mistral', flagName: 'mistral-ocr', modelsKey: 'mistralOcrModels', model: 'mistral-ocr-2512' },
  { provider: 'glm', flagName: 'glm-ocr', modelsKey: 'glmOcrModels', model: 'glm-ocr' },
  { provider: 'kimi', flagName: 'kimi-ocr', modelsKey: 'kimiOcrModels', model: 'kimi-k2.6' },
  { provider: 'openai', flagName: 'openai-ocr', modelsKey: 'openaiOcrModels', model: 'gpt-5.4-nano' },
  { provider: 'grok', flagName: 'grok-ocr', modelsKey: 'grokOcrModels', model: 'grok-4.3' },
  { provider: 'anthropic', flagName: 'anthropic-ocr', modelsKey: 'anthropicOcrModels', model: 'claude-haiku-4-5' },
  { provider: 'gemini', flagName: 'gemini-ocr', modelsKey: 'geminiOcrModels', model: 'gemini-3.1-flash-lite' },
  { provider: 'deepinfra', flagName: 'deepinfra-ocr', modelsKey: 'deepinfraOcrModels', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' }
] as const

const KIMI_OCR_PROVIDER_CASE = HOSTED_OCR_PROVIDER_CASES[2]

const expectedOcrProcessingMs = (
  provider: string,
  model: string,
  pageCount: number,
  concurrency = DEFAULT_OCR_CONCURRENCY
): number => {
  const pageBatches = Math.ceil(pageCount / Math.min(pageCount, Math.max(1, concurrency)))
  return Math.round(pageBatches * getExtractEstimation(provider, model).msPerPage)
}

const buildHostedOcrPricingOptions = (
  providerCases: readonly (typeof HOSTED_OCR_PROVIDER_CASES[number])[] = HOSTED_OCR_PROVIDER_CASES
): CommandPricingOptions => {
  const opts: Record<string, unknown> = {
    step2SelectionOrigins: Object.fromEntries(providerCases.map((providerCase) => [providerCase.flagName, 'explicit'])),
    useTesseract: false,
    urlBackend: 'defuddle',
    urlBackendExplicit: false,
    useEpubBun: false,
    textInput: false
  }

  for (const providerCase of providerCases) {
    opts[providerCase.modelsKey] = [providerCase.model]
  }

  return opts as CommandPricingOptions
}

describe('price mode contracts', () => {
  test('hosted OCR aggregate pricing uses detected PDF page count for every provider', async () => {
      const estimate = await buildAggregatedPriceEstimate('extract', MULTI_PAGE_PDF, buildHostedOcrPricingOptions())

      expect(estimate.steps).toHaveLength(HOSTED_OCR_PROVIDER_CASES.length)
      for (const providerCase of HOSTED_OCR_PROVIDER_CASES) {
        const step = estimate.steps.find(entry => entry.step === 'extract' && entry.provider === providerCase.provider && entry.model === providerCase.model)
        expect(step).toBeDefined()
        expect(step && 'pageCount' in step ? step.pageCount : undefined).toBe(3)
      }
    })

  test('hosted OCR aggregate pricing rejects invalid PDFs instead of estimating one page', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-price-invalid-'))
      const invalidPdf = join(tempDir, 'invalid.pdf')

      await writeFile(invalidPdf, 'not a real PDF\n')

      try {
        await expect(buildAggregatedPriceEstimate('extract', invalidPdf, buildHostedOcrPricingOptions([KIMI_OCR_PROVIDER_CASE])))
          .rejects.toThrow(/could not determine PDF page count/i)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('DeepInfra OCR estimates include token cost and page timing', () => {
      const extractTargets = [{
        provider: 'deepinfra' as const,
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        estimateType: 'heuristic' as const
      }]
      const cost = computeEstimatedCosts({ extractTargets })
      const timing = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map(({ provider, model, pageCount }) => ({ provider, model, pageCount })),
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        promptTokens: 8000,
        completionTokens: 2000,
        pageCount: 2
      })
      expect(cost.totalCost).toBeGreaterThan(0)
      expect(timing.steps[0]).toMatchObject({
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        processingTimeMs: expectedOcrProcessingMs('deepinfra', 'Qwen/Qwen3-VL-30B-A3B-Instruct', 2)
      })

      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+deepinfra-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'deepinfra',
        ocrModel: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        promptTokens: 8000,
        completionTokens: 2000
      }
      const actual = computeActualCosts({ step2: actualMetadata })
      const actualTiming = computeActualProcessingTimes({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        promptTokens: 8000,
        completionTokens: 2000
      })
      expect(actual.totalCost).toBeGreaterThan(0)
      expect(actualTiming.steps[0]).toMatchObject({
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        processingTimeMs: 1234
      })
    })

  test('Kimi OCR estimates include token cost and page timing', () => {
      const extractTargets = [{
        provider: 'kimi' as const,
        model: 'kimi-k2.6',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        estimateType: 'heuristic' as const
      }]
      const cost = computeEstimatedCosts({ extractTargets })
      const timing = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map(({ provider, model, pageCount }) => ({ provider, model, pageCount })),
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'kimi',
        model: 'kimi-k2.6',
        promptTokens: 8000,
        completionTokens: 2000,
        pageCount: 2
      })
      expect(cost.totalCost).toBeGreaterThan(0)
      const pageCount = extractTargets[0]?.pageCount ?? 0
      expect(timing.steps[0]).toMatchObject({
        provider: 'kimi',
        model: 'kimi-k2.6',
        processingTimeMs: expectedOcrProcessingMs('kimi', 'kimi-k2.6', pageCount)
      })
    })

  test('Grok OCR estimates and actuals use provisional token pricing', () => {
      const extractTargets = [{
        provider: 'grok' as const,
        model: 'grok-4.3',
        pageCount: 2,
        estimateType: 'heuristic' as const
      }]
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath()
      })
      const timing = computeEstimatedProcessingTimes({
        extractTargets,
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.3',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        inputCostPer1MCents: 125,
        outputCostPer1MCents: 250,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(1.5)
      expect(timing.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.3',
        processingTimeMs: expectedOcrProcessingMs('grok', 'grok-4.3', 2)
      })

      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+grok-ocr',
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 5000,
        ocrService: 'grok',
        ocrModel: 'grok-4.3',
        promptTokens: 4000,
        completionTokens: 1000
      }
      const actual = computeActualCosts({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.3',
        cost: 0.75,
        promptTokens: 4000,
        completionTokens: 1000,
        costSource: 'provider_usage'
      })
      expect(actual.totalCost).toBe(0.75)

      const grok45Targets = [{
        provider: 'grok' as const,
        model: 'grok-4.5',
        pageCount: 1,
        estimateType: 'heuristic' as const
      }]
      const grok45Cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets: grok45Targets,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath()
      })
      const grok45Timing = computeEstimatedProcessingTimes({
        extractTargets: grok45Targets,
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })
      const grok45Actual = computeActualCosts({
        step2: {
          ...actualMetadata,
          ocrModel: 'grok-4.5'
        }
      })

      expect(grok45Cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.5',
        pageCount: 1,
        promptTokens: 4000,
        completionTokens: 1000,
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600,
        estimateType: 'heuristic'
      })
      expect(grok45Cost.totalCost).toBe(1.4)
      expect(grok45Timing.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        processingTimeMs: expectedOcrProcessingMs('grok', 'grok-4.5', 1)
      })
      expect(grok45Actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.5',
        cost: 1.4,
        promptTokens: 4000,
        completionTokens: 1000,
        costSource: 'provider_usage'
      })
      expect(grok45Actual.totalCost).toBe(1.4)
    })

  test('hosted token OCR estimates include output tokens when usage is not exact', () => {
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath(),
        extractTargets: [{
          provider: 'openai',
          model: 'gpt-5.4-nano',
          pageCount: 2,
          estimateType: 'heuristic'
        }]
      })
      const step = cost.steps[0]

      expect(step).toMatchObject({
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pageCount: 2,
        promptTokens: 5972,
        completionTokens: 3688,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(
        ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
        + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
      )
    })

  test('OCR diagnostics compare page-based estimates with actual token usage', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath(),
        extractTargets: [{
          provider: 'openai',
          model: 'gpt-5.4-nano',
          pageCount: 2,
          estimateType: 'heuristic'
        }]
      })
      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+openai-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'openai',
        ocrModel: 'gpt-5.4-nano',
        promptTokens: 6000,
        completionTokens: 1500,
        ocrProviderUsage: [{
          unit: 'document',
          pages: 2,
          promptTokens: 6000,
          completionTokens: 1500
        }]
      }
      const actual = computeActualCosts({ step2: actualMetadata })
      const diagnostics = buildOcrCostDiagnostics(actualMetadata, estimated, actual)
      const diagnostic = diagnostics[0] as Record<string, unknown>
      const predicted = diagnostic['predictedCostInputs'] as Record<string, unknown>
      const actualInputs = diagnostic['actualCostInputs'] as Record<string, unknown>
      const delta = diagnostic['delta'] as Record<string, unknown>

      expect(diagnostics).toHaveLength(1)
      expect(diagnostic).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pages: 2
      })
      expect(predicted).toMatchObject({
        pageCount: 2,
        promptTokens: 5972,
        completionTokens: 3688,
        costMultiplier: 1,
        estimateType: 'heuristic'
      })
      expect(actualInputs).toMatchObject({
        pageCount: 2,
        inputMetric: 'tokens',
        inputValue: 7500,
        promptTokens: 6000,
        completionTokens: 1500
      })
      expect(actualInputs).not.toHaveProperty('schemaRetryUsage')
      expect(actualInputs['usageDetails']).toEqual(actualMetadata.ocrProviderUsage)
      expect(delta['costCents']).toBe((actual.steps[0]?.cost ?? 0) - (estimated.steps[0]?.cost ?? 0))
    })

  test('OCR diagnostics mark Gemini schema retry usage and show estimate multipliers', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets: [{
          provider: 'gemini',
          model: 'gemini-3.1-flash-lite',
          pageCount: 1,
          estimateType: 'heuristic'
        }]
      })
      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'gemini-ocr',
        inputFamily: 'pdf',
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 5000,
        ocrService: 'gemini',
        ocrModel: 'gemini-3.1-flash-lite',
        promptTokens: 700,
        completionTokens: 120,
        ocrProviderUsage: [
          {
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            usageRole: 'schema-retry',
            purpose: 'ocr-schema-retry',
            pageStart: 38,
            pageEnd: 38,
            promptTokens: 300,
            completionTokens: 60
          },
          {
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            usageRole: 'success',
            purpose: 'ocr-page',
            promptTokens: 400,
            completionTokens: 60
          }
        ]
      }
      const actual = computeActualCosts({ step2: actualMetadata })
      const diagnostics = buildOcrCostDiagnostics(actualMetadata, estimated, actual)
      const diagnostic = diagnostics[0] as Record<string, unknown>
      const actualInputs = diagnostic['actualCostInputs'] as Record<string, unknown>
      const ratesUsed = diagnostic['ratesUsed'] as Record<string, unknown>

      expect(diagnostic['source']).toBe('token_usage_with_schema_retries')
      expect(actualInputs).toMatchObject({
        inputMetric: 'tokens',
        inputValue: 820,
        promptTokens: 700,
        completionTokens: 120,
        retryUsageIncluded: true,
        schemaRetryUsage: {
          count: 1,
          pages: [38],
          promptTokens: 300,
          completionTokens: 60
        }
      })
      expect(ratesUsed['costMultiplier']).toBe(1)
      expect(formatRatesSummary(ratesUsed)).toContain('x1 estimate')
    })

  test('OCR providerCostCents wins over page and token fallback for single extraction metadata', () => {
      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+openai-ocr',
        totalPages: 50,
        ocrPages: 50,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'openai',
        ocrModel: 'gpt-5.4-nano',
        promptTokens: 6000,
        completionTokens: 1500,
        providerCostCents: 0.42,
        providerCostSource: 'provider_usage',
        ocrProviderUsage: [{ prompt_tokens: 6000, completion_tokens: 1500 }]
      }
      const actual = computeActualCosts({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        cost: 0.42,
        costSource: 'provider_usage',
        inputMetric: 'tokens',
        inputValue: 7500
      })
      expect(actual.totalCost).toBe(0.42)
    })

  test('OCR providerCostCents wins over fallback for multi-provider extraction metadata', () => {
      const base: Omit<ExtractionMetadata, 'extractionMethod'> = {
        totalPages: 10,
        ocrPages: 10,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000
      }
      const actual = computeActualCosts({
        step2: [
          {
            ...base,
            extractionMethod: 'pdf+openai-ocr',
            ocrService: 'openai',
            ocrModel: 'gpt-5.4-nano',
            promptTokens: 6000,
            completionTokens: 1500,
            providerCostCents: 0.42,
            providerCostSource: 'provider_usage'
          }
        ] as ExtractionMetadata[]
      })

      expect(actual.steps.map((step) => ({
        provider: step.provider,
        cost: step.cost,
        costSource: step.costSource
      }))).toEqual([
        { provider: 'openai', cost: 0.42, costSource: 'provider_usage' }
      ])
      expect(actual.totalCost).toBe(0.42)
    })

  test('OCR manifest estimates preserve preflight values and fallback avoids actual usage tokens', () => {
      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+openai-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'openai',
        ocrModel: 'gpt-5.4-nano',
        promptTokens: 1,
        completionTokens: 1
      }
      const preflightEstimated = resolveExtractEstimatedCosts({
        totalEstimatedCost: 9,
        steps: [{
          step: 'extract',
          provider: 'openai',
          model: 'gpt-5.4-nano',
          pageCount: 2,
          promptTokens: 8000,
          completionTokens: 2000,
          inputCostPer1MCents: 20,
          outputCostPer1MCents: 125,
          totalCost: 9,
          estimateType: 'heuristic',
          note: 'Internal OCR estimate caveat.'
        }],
        notes: ['Internal aggregate estimate caveat.']
      }, actualMetadata)
      const observedEstimate = resolveExtractObservedEstimateCosts(actualMetadata)
      const fallbackEstimated = resolveExtractEstimatedCosts(undefined, actualMetadata, {
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath()
      })

      expect(preflightEstimated.totalCost).toBe(9)
      expect(preflightEstimated.steps[0]).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        promptTokens: 8000,
        completionTokens: 2000,
        cost: 9
      })
      expect(findPricingNoteKeys(preflightEstimated)).toEqual([])
      expect(fallbackEstimated.steps[0]).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        promptTokens: 5972,
        completionTokens: 3688
      })
      expect(observedEstimate.steps[0]).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        promptTokens: 1,
        completionTokens: 1,
        estimateType: 'exact'
      })
      expect(observedEstimate.totalCost).not.toBe(preflightEstimated.totalCost)
      expect(findPricingNoteKeys(fallbackEstimated)).toEqual([])
    })

  test('OCR manifest fallback estimates apply the same calibrated multiplier as price mode', async () => {
      const profilePath = missingHostedOcrProfilePath()
      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+kimi-ocr',
        totalPages: 3,
        ocrPages: 3,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'kimi',
        ocrModel: 'kimi-k2.6',
        promptTokens: 1,
        completionTokens: 1
      }
      const priceEstimate = await buildAggregatedPriceEstimate('extract', MULTI_PAGE_PDF, {
        ...buildHostedOcrPricingOptions([KIMI_OCR_PROVIDER_CASE]),
        hostedOcrTokenProfilePath: profilePath
      } as CommandPricingOptions & { hostedOcrTokenProfilePath: string })
      const fallbackEstimated = resolveExtractEstimatedCosts(undefined, actualMetadata, { hostedOcrTokenProfilePath: profilePath })
      const observedEstimate = resolveExtractObservedEstimateCosts(actualMetadata)
      const multiplier = getExtractEstimation('kimi', 'kimi-k2.6').costMultiplier

      expect(multiplier).toBe(1)
      expect(fallbackEstimated.totalCost).toBeCloseTo(priceEstimate.totalEstimatedCost)
      expect(fallbackEstimated.steps[0]).toMatchObject({
        provider: 'kimi',
        model: 'kimi-k2.6',
        pageCount: 3,
        costMultiplier: multiplier,
        tokenEstimateSource: 'registry',
        tokenEstimateConfidence: 'none'
      })
      expect(observedEstimate.steps[0]).toMatchObject({
        provider: 'kimi',
        model: 'kimi-k2.6',
        promptTokens: 1,
        completionTokens: 1,
        costMultiplier: 1,
        estimateType: 'exact'
      })
      expect(observedEstimate.totalCost).not.toBe(fallbackEstimated.totalCost)
    })

  test('OCR token heuristics feed registry pricing consistently', () => {
      const calibratedCases = [
        {
          provider: 'openai' as const,
          model: 'gpt-5.6-sol',
          promptTokensPerPage: 1625,
          completionTokensPerPage: 940,
          costMultiplier: 1,
          msPerPage: 9497,
          expectedOnePageCost: 3.6325
        },
        {
          provider: 'openai' as const,
          model: 'gpt-5.6-terra',
          promptTokensPerPage: 1625,
          completionTokensPerPage: 743,
          costMultiplier: 1,
          msPerPage: 5349,
          expectedOnePageCost: 1.52075
        },
        {
          provider: 'openai' as const,
          model: 'gpt-5.6-luna',
          promptTokensPerPage: 1625,
          completionTokensPerPage: 858,
          costMultiplier: 1,
          msPerPage: 3919,
          expectedOnePageCost: 0.6773
        },
        {
          provider: 'anthropic' as const,
          model: 'claude-fable-5',
          promptTokensPerPage: 2024,
          completionTokensPerPage: 869,
          costMultiplier: 1,
          msPerPage: 11827,
          expectedOnePageCost: 6.369
        }
      ]

      for (const expected of calibratedCases) {
        const estimation = getExtractEstimation(expected.provider, expected.model)
        expect(estimation).toMatchObject({
          promptTokensPerPage: expected.promptTokensPerPage,
          completionTokensPerPage: expected.completionTokensPerPage,
          costMultiplier: expected.costMultiplier,
          msPerPage: expected.msPerPage
        })

        const profilePath = missingHostedOcrProfilePath()
        const usage = estimateOcrTokenUsage(expected.provider, expected.model, 1, { profilePath })
        expect(usage.promptTokens).toBe(expected.promptTokensPerPage)
        expect(usage.completionTokens).toBe(expected.completionTokensPerPage)

        const cost = computeEstimatedCosts({
          hostedOcrTokenProfilePath: profilePath,
          extractTargets: [{
            provider: expected.provider,
            model: expected.model,
            pageCount: 1,
            estimateType: 'heuristic'
          }]
        })
        expect(cost.steps[0]).toMatchObject({
          provider: expected.provider,
          model: expected.model,
          promptTokens: expected.promptTokensPerPage,
          completionTokens: expected.completionTokensPerPage,
          costMultiplier: 1
        })
        expect(cost.totalCost).toBeCloseTo(expected.expectedOnePageCost, 8)
      }

      const estimateOnePageCost = (
        target: NonNullable<Parameters<typeof computeEstimatedCosts>[0]['extractTargets']>[number]
      ): number => {
        const cost = computeEstimatedCosts({ applyCostMultipliers: false, extractTargets: [target] })
        const step = cost.steps[0]
        expect(step?.promptTokens).toBeGreaterThan(0)
        expect(step?.completionTokens).toBeGreaterThan(0)
        expect(cost.totalCost).toBe(
          ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
          + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
        )
        return cost.totalCost
      }

      for (const target of [
        { provider: 'kimi' as const, model: 'kimi-k2.6', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'grok' as const, model: 'grok-4.3', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'grok' as const, model: 'grok-4.20-0309-non-reasoning', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'grok' as const, model: 'grok-4.5', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'anthropic' as const, model: 'claude-fable-5', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'anthropic' as const, model: 'claude-opus-4-8', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'anthropic' as const, model: 'claude-sonnet-5', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'anthropic' as const, model: 'claude-haiku-4-5', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.6-sol', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.6-terra', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.6-luna', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.5', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.4-mini', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'openai' as const, model: 'gpt-5.4-nano', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'gemini' as const, model: 'gemini-3.1-pro-preview', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'gemini' as const, model: 'gemini-3.5-flash', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'gemini' as const, model: 'gemini-3.1-flash-lite', pageCount: 1, estimateType: 'heuristic' as const },
        { provider: 'deepinfra' as const, model: 'Qwen/Qwen3-VL-235B-A22B-Instruct', pageCount: 1, estimateType: 'heuristic' as const }
      ]) {
        const usage = estimateOcrTokenUsage(target.provider, target.model, target.pageCount)
        expect(usage.promptTokens).toBeGreaterThan(0)
        expect(usage.completionTokens).toBeGreaterThan(0)
        expect(estimateOnePageCost(target)).toBeGreaterThan(0)
      }
    })

  test('OCR token usage profiles persist aggregate-only samples and back estimates', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-token-profiles-'))
      const profilePath = join(tempDir, 'token-profiles.json')
      const metadata: ExtractionMetadata = {
        extractionMethod: 'pdf+gemini-ocr',
        totalPages: 10,
        ocrPages: 10,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'gemini',
        ocrModel: 'gemini-3.5-flash',
        promptTokens: 20_000,
        completionTokens: 3_000,
        ocrProviderUsage: [{
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          requestId: 'req-secret',
          promptTokens: 20_000,
          completionTokens: 3_000,
          rawDiagnostic: 'input.pdf'
        }]
      }

      try {
        await persistHostedOcrTokenUsageProfiles(metadata, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-11T12:00:00.000Z')
        })

        const store = await readHostedOcrTokenUsageProfiles(profilePath)
        const profile = store.profiles[0]
        expect(profile).toMatchObject({
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          ocrMode: 'pdf',
          pageCountBand: '2-10',
          pageCount: 10,
          observedPromptTokens: 20_000,
          observedCompletionTokens: 3_000,
          promptTokensPerPage: 2000,
          completionTokensPerPage: 300,
          sampleCount: 1,
          sourceConfidence: 'healthy'
        })
        expect(Object.keys(profile ?? {}).sort()).toEqual([
          'completionTokenEstimateDelta',
          'completionTokensPerPage',
          'estimatedCompletionTokens',
          'estimatedPromptTokens',
          'firstSeenAt',
          'lastSeenAt',
          'model',
          'observedCompletionTokens',
          'observedPromptTokens',
          'ocrMode',
          'pageCount',
          'pageCountBand',
          'promptTokenEstimateDelta',
          'promptTokensPerPage',
          'provider',
          'sampleCount',
          'sourceConfidence'
        ])
        expect(JSON.stringify(store)).not.toContain('input.pdf')
        expect(JSON.stringify(store)).not.toContain('req-secret')

        const usage = estimateOcrTokenUsage('gemini', 'gemini-3.5-flash', 10, {
          ocrMode: 'pdf',
          profilePath
        })
        expect(usage).toMatchObject({
          promptTokens: 20_000,
          completionTokens: 3_000,
          tokenEstimateSource: 'profile',
          tokenEstimateConfidence: 'healthy',
          tokenProfileSampleCount: 1
        })

        const cost = computeEstimatedCosts({
          hostedOcrTokenProfilePath: profilePath,
          extractTargets: [{
            provider: 'gemini',
            model: 'gemini-3.5-flash',
            pageCount: 10,
            ocrMode: 'pdf',
            estimateType: 'heuristic'
          }]
        })
        expect(cost.steps[0]).toMatchObject({
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          promptTokens: 20_000,
          completionTokens: 3_000,
          tokenEstimateSource: 'profile',
          tokenEstimateConfidence: 'healthy',
          tokenProfileSampleCount: 1
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('OCR token usage profiles calibrate clean 300-499 page PDF samples per token direction', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-token-profiles-312-'))
      const profilePath = join(tempDir, 'token-profiles.json')
      const pageCount = 312
      const metadata = [
        ['kimi', 'kimi-k2.6', 1_332_939, 114_292],
        ['grok', 'grok-4.20-0309-non-reasoning', 828_252, 112_209],
        ['gemini', 'gemini-3.5-flash', 359_877, 134_602],
        ['gemini', 'gemini-3.1-pro-preview', 363_333, 163_959],
        ['deepinfra', 'Qwen/Qwen3-VL-235B-A22B-Instruct', 3_184_289, 113_872]
      ].map(([provider, model, promptTokens, completionTokens]) => ({
        extractionMethod: `pdf+${provider}-ocr`,
        totalPages: pageCount,
        ocrPages: pageCount,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: provider,
        ocrModel: model,
        promptTokens,
        completionTokens
      })) as ExtractionMetadata[]

      try {
        await persistHostedOcrTokenUsageProfiles({
          extractionMethod: 'pdf+deepinfra-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 1234,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 10_000,
          ocrService: 'deepinfra',
          ocrModel: 'Qwen/Qwen3-VL-235B-A22B-Instruct',
          promptTokens: 781_990,
          completionTokens: 95_155
        }, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-12T18:55:00.000Z')
        })
        await persistHostedOcrTokenUsageProfiles(metadata, {
          completionStatus: 'full',
          profilePath,
          now: new Date('2026-07-12T19:21:00.000Z')
        })

        const store = await readHostedOcrTokenUsageProfiles(profilePath)
        expect(store.profiles).toHaveLength(6)
        expect(store.profiles.filter((profile) =>
          profile.ocrMode === 'pdf' && profile.pageCountBand === '300-499'
        )).toHaveLength(5)

        const deepinfra = store.profiles.find((profile) =>
          profile.provider === 'deepinfra' && profile.pageCountBand === '300-499'
        )
        expect(deepinfra).toMatchObject({
          promptTokensPerPage: 10206.054,
          completionTokensPerPage: 364.974
        })

        const usage = estimateOcrTokenUsage('deepinfra', 'Qwen/Qwen3-VL-235B-A22B-Instruct', pageCount, {
          ocrMode: 'pdf',
          profilePath
        })
        expect(usage).toMatchObject({
          promptTokens: 3_184_289,
          completionTokens: 113_872,
          tokenEstimateSource: 'profile',
          tokenEstimateConfidence: 'healthy',
          tokenProfileSampleCount: 1
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('OCR token usage profiles ignore incomplete and failed samples', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-token-profiles-partial-'))
      const profilePath = join(tempDir, 'token-profiles.json')
      const metadata: ExtractionMetadata = {
        extractionMethod: 'pdf+gemini-ocr',
        totalPages: 10,
        ocrPages: 9,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'gemini',
        ocrModel: 'gemini-3.5-flash',
        promptTokens: 20_000,
        completionTokens: 3_000
      }

      try {
        await persistHostedOcrTokenUsageProfiles(metadata, {
          completionStatus: 'incomplete',
          profilePath,
          now: new Date('2026-07-11T12:00:00.000Z')
        })

        expect((await readHostedOcrTokenUsageProfiles(profilePath)).profiles).toHaveLength(0)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('Gemini 3.5 Flash OCR heuristic tokens use observed single-page calibration', () => {
      const profilePath = missingHostedOcrProfilePath()
      const usage = estimateOcrTokenUsage('gemini', 'gemini-3.5-flash', 10, { profilePath })
      const cost = computeEstimatedCosts({
        hostedOcrTokenProfilePath: profilePath,
        extractTargets: [{
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          pageCount: 10,
          estimateType: 'heuristic'
        }]
      })
      const step = cost.steps[0]

      expect(usage).toMatchObject({
        promptTokens: 11710,
        completionTokens: 6170,
        tokenEstimateSource: 'registry',
        tokenEstimateConfidence: 'none'
      })
      expect(step).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        pageCount: 10,
        promptTokens: 11710,
        completionTokens: 6170,
        costMultiplier: 1,
        tokenEstimateSource: 'registry',
        tokenEstimateConfidence: 'none',
        estimateType: 'heuristic'
      })
    })

  test('Mistral OCR additions use page pricing', () => {
      const extractTargets = [
        { provider: 'mistral' as const, model: 'mistral-ocr-4-0', pageCount: 2, estimateType: 'exact' as const }
      ]
      const cost = computeEstimatedCosts({ applyCostMultipliers: false, extractTargets })

      expect(cost.steps).toHaveLength(1)
      for (const step of cost.steps) {
        expect(step).toMatchObject({
          step: 'extract',
          provider: 'mistral',
          pageCount: 2,
          costPer1kPagesCents: 400,
          estimateType: 'exact'
        })
        expect(step.cost).toBe(0.8)
      }
      expect(cost.totalCost).toBe(0.8)
    })
})
