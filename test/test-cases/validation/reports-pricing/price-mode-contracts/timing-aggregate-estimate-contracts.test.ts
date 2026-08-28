import { describe, expect, test } from 'bun:test'
import { getMusicEstimation, getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildAggregateTiming } from '~/cli/commands/pricing-orchestration/aggregate-pricing/timing'
import type { StepEstimate } from '~/types'

describe('price mode contracts', () => {
  test('aggregate timing includes non-TTS step estimates when inputs are known', () => {
      const steps: StepEstimate[] = [
        { step: 'stt', provider: 'deepgram', model: 'nova-3', durationSeconds: 12, totalCost: 1 },
        {
          step: 'llm',
          provider: 'openai',
          model: 'gpt-5.4-nano',
          inputCostPer1MCents: 5,
          outputCostPer1MCents: 40,
          estimatedInputTokens: 600,
          estimatedOutputTokens: 400,
          totalCost: 1
        },
        { step: 'image', provider: 'openai', model: 'gpt-image-2', imageCount: 2, totalCost: 1 },
        { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4, totalCost: 1 },
        { step: 'music', provider: 'gemini', model: 'lyria-3-pro-preview', durationSeconds: 120, lyricsSource: 'generated', totalCost: 1 }
      ]

      const timing = buildAggregateTiming(steps, undefined)
      expect(timing?.steps.map((step) => step.step)).toEqual(['stt', 'llm', 'image', 'video', 'music'])
      expect(timing?.steps.every((step) => typeof step.msPerUnit === 'number')).toBe(true)
    })

  test('video timing estimates use normalized provider defaults when duration is omitted', () => {
      const timing = computeEstimatedProcessingTimes({
        videoTargets: [
          { service: 'gemini', model: 'veo-3.1-lite-generate-preview' },
          { service: 'ltx', model: 'ltx-2-3-fast' }
        ]
      })

      expect(timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        inputValue: step.inputValue,
        msPerUnit: step.msPerUnit
      }))).toEqual([
        {
          provider: 'gemini',
          model: 'veo-3.1-lite-generate-preview',
          inputValue: 4,
          msPerUnit: getVideoEstimation('gemini', 'veo-3.1-lite-generate-preview').msPerSecond
        },
        {
          provider: 'ltx',
          model: 'ltx-2-3-fast',
          inputValue: 8,
          msPerUnit: getVideoEstimation('ltx', 'ltx-2-3-fast').msPerSecond
        }
      ])
    })

  test('Gemini music timing estimates use Lyria defaults', () => {
      const timing = computeEstimatedProcessingTimes({
        musicTargets: [
          { service: 'gemini', model: 'lyria-3-pro-preview' }
        ]
      })

      const rows = timing.steps.map((step) => ({
        model: step.model,
        processingTimeMs: step.processingTimeMs,
        inputValue: step.inputValue
      }))
      expect(rows).toEqual([
        {
          model: 'lyria-3-pro-preview',
          processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('gemini', 'lyria-3-pro-preview').msPerSecond),
          inputValue: rows[0]?.inputValue
        }
      ])
    })

  test('MiniMax music timing estimates use the provider default duration', () => {
      const timing = computeEstimatedProcessingTimes({
        musicTargets: [
          { service: 'minimax', model: 'music-3.0' },
          { service: 'minimax', model: 'music-3.0', durationSeconds: 15 }
        ]
      })

      const rows = timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        processingTimeMs: step.processingTimeMs,
        inputValue: step.inputValue
      }))
      expect(rows).toEqual([
        {
          provider: 'minimax',
          model: 'music-3.0',
          processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-3.0').msPerSecond),
          inputValue: rows[0]?.inputValue
        },
        {
          provider: 'minimax',
          model: 'music-3.0',
          processingTimeMs: Math.round((rows[1]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-3.0').msPerSecond),
          inputValue: rows[1]?.inputValue
        }
      ])
    })

  test('TTS timing uses each target remaining character count instead of one shared input', () => {
      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [
          { service: 'speechify', model: 'simba-3.2', characterCount: 6_000 },
          { service: 'speechify', model: 'simba-3.2', characterCount: 24_000 }
        ],
        ttsCharacterCount: 939_201,
        ttsInputText: 'a'.repeat(939_201)
      })
      expect(timing.steps.map((step) => step.inputValue)).toEqual([6_000, 24_000])
      const firstMs = timing.steps[0]?.processingTimeMs ?? 0
      const secondMs = timing.steps[1]?.processingTimeMs ?? 0
      expect(firstMs).toBeGreaterThan(0)
      expect(secondMs).toBeGreaterThan(firstMs)
    })
})
