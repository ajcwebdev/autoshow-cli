import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { estimateOcrTokenUsage } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import {
  persistHostedOcrTokenUsageProfiles,
  readHostedOcrTokenUsageProfiles
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-token-profiles'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import type { ExtractionMetadata } from '~/types'
import { missingHostedOcrProfilePath } from './shared'

describe('price mode contracts', () => {
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
          expectedOnePageCost: 1.2166
        },
        {
          provider: 'openai' as const,
          model: 'gpt-5.6-luna',
          promptTokensPerPage: 1625,
          completionTokensPerPage: 858,
          costMultiplier: 1,
          msPerPage: 3919,
          expectedOnePageCost: 0.13546
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
        { provider: 'gemini' as const, model: 'gemini-3.5-flash-lite', pageCount: 1, estimateType: 'heuristic' as const },
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
          'effectiveReasoningEffort',
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
})
