import { describe, expect, test } from 'bun:test'
import { buildOcrCostDiagnostics, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { formatRatesSummary } from '~/cli/commands/process-steps/write-manifest-log/manifest-log-formatting'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import type { CommandPricingOptions, ExtractionMetadata } from '~/types'
import {
  KIMI_OCR_PROVIDER_CASE,
  MULTI_PAGE_PDF,
  buildHostedOcrPricingOptions,
  findPricingNoteKeys,
  missingHostedOcrProfilePath
} from './shared'

describe('price mode contracts', () => {
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
})
