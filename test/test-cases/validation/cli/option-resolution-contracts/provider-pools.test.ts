import { describe, expect, test } from 'bun:test'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import type { LLMTarget, OcrTarget, Step3Metadata } from '~/types'

describe('option resolution contracts', () => {
  test('OCR provider pools enforce hosted and local limits independently', async () => {
      const targets: OcrTarget[] = [
        { service: 'tesseract', model: 'tesseract' },
        { service: 'mistral', model: 'mistral-ocr-2512' },
        { service: 'openai', model: 'gpt-5.4-nano' },
        { service: 'anthropic', model: 'claude-haiku-4-5' },
        { service: 'gemini', model: 'gemini-3.5-flash-lite' }
      ]
      const active = { local: 0, hosted: 0, total: 0 }
      const max = { local: 0, hosted: 0, total: 0 }
      const completedIndices: number[] = []

      await runOcrProviderTargetPools(targets, targets, { provider: 2, local: 1 }, async (index, target) => {
        const group = isLocalOcrTarget(target) ? 'local' : 'hosted'
        active[group] += 1
        active.total += 1
        max[group] = Math.max(max[group], active[group])
        max.total = Math.max(max.total, active.total)

        await Bun.sleep(5)

        completedIndices.push(index)
        active[group] -= 1
        active.total -= 1
      })

      expect(max.local).toBe(1)
      expect(max.hosted).toBe(2)
      expect(max.total).toBe(3)
      expect([...completedIndices].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4])
    })

  test('LLM provider pools enforce hosted limits and preserve target indexes', async () => {
      const metadata = (service: Step3Metadata['llmService'], model: string): Step3Metadata => ({
        llmService: service,
        llmModel: model,
        processingTime: 0,
        inputTokenCount: 0,
        outputTokenCount: 0,
        outputFileName: 'text.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: []
      })
      const target = (service: Step3Metadata['llmService'], model: string): LLMTarget => ({
        service,
        model,
        label: service,
        run: async () => ({ result: '{}', metadata: metadata(service, model) })
      })
      const targets: LLMTarget[] = [
        target('openai', 'hosted-a'),
        target('groq', 'hosted-b'),
        target('glm', 'hosted-glm'),
        target('together', 'hosted-together'),
        target('cerebras', 'hosted-cerebras'),
        target('gemini', 'hosted-c')
      ]
      const active = { hosted: 0, total: 0 }
      const max = { hosted: 0, total: 0 }
      const orderedModels: string[] = []

      await runLlmProviderTargetPools(targets, { provider: 2, local: 1 }, async (index, llmTarget) => {
        active.hosted += 1
        active.total += 1
        max.hosted = Math.max(max.hosted, active.hosted)
        max.total = Math.max(max.total, active.total)

        await Bun.sleep(5)

        orderedModels[index] = llmTarget.model
        active.hosted -= 1
        active.total -= 1
      })

      expect(max.hosted).toBe(2)
      expect(max.total).toBe(2)
      expect(orderedModels).toEqual(targets.map((entry) => entry.model))
    })
})
