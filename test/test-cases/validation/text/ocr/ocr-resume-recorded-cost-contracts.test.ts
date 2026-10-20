import { expect, spyOn, test } from 'bun:test'
import { join } from 'node:path'
import type { OcrExtractionOptions, OcrTarget, StepCostEntry } from '~/types'
import { resumeOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { preserveRecordedOcrActualCosts } from '~/cli/commands/text/ocr/ocr-costs'
import * as tokenProfiles from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-token-profiles'
import * as throughputProfiles from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-throughput-profiles'
import { readCanonicalRecord, writeSingleManifestFixture } from '../../../../test-utils/manifest-helpers'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { ocrResumeTarget } from './ocr-resume-fixture'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY'], tempPrefix: 'autoshow-ocr-recorded-cost-' })

test('actual additive OCR resume preserves the complete recorded old cost row and prices only the new slot', async () => {
  // Mocked responses must not train the user's persistent paid-run calibration.
  const tokenSpy = spyOn(tokenProfiles, 'persistHostedOcrTokenUsageProfiles').mockResolvedValue(undefined)
  const throughputSpy = spyOn(throughputProfiles, 'persistHostedOcrThroughputProfiles').mockResolvedValue(undefined)
  try {
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'source.png')
      await Bun.write(path, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64'))
      const oldTarget: OcrTarget = { service: 'openai', model: 'gpt-6.1-sol' }
      const newTarget: OcrTarget = { service: 'openai', model: 'gpt-6-luna' }
      const oldMetadata = {
        extractionMethod: 'image+openai-ocr' as const, totalPages: 1, ocrPages: 1, textPages: 0,
        processingTime: 12345, dpi: 300, languages: 'eng', tokenEstimate: 12,
        ocrService: oldTarget.service, ocrModel: oldTarget.model,
        promptTokens: 790, completionTokens: 246, inputFamily: 'image', effectiveReasoningEffort: 'default' as const
      }
      const oldResult = { text: 'Previously extracted text.', pages: [{ pageNumber: 1, method: 'ocr', text: 'Previously extracted text.' }], totalPages: 1, ocrPages: 1, textPages: 0 }
      const oldCost: StepCostEntry = {
        step: 'extract', provider: oldTarget.service, model: oldTarget.model,
        cost: 1.133, costSource: 'provider_usage', inputMetric: 'tokens', inputValue: 1036,
        promptTokens: 790, completionTokens: 246, pricingBand: 'standard-short-context',
        pricingNote: 'Historical recorded rate retained from the original completed run.'
      }
      expect(computeActualCosts({ step2: oldMetadata }).steps[0]?.cost).not.toBe(oldCost.cost)
      const outputDir = join(dir, 'run')
      await writeSingleManifestFixture(outputDir, 'extract', {
        step1: { slug: 'source', format: 'png', pageCount: 1, fileSize: Bun.file(path).size },
        step2: oldMetadata,
        source: { filePath: path }, completionStatus: 'full', ocrProviderMode: 'fanout',
        requestedProviders: [oldTarget], missingProviders: [], blockedProviders: [],
        providerStates: [{ ...oldTarget, status: 'succeeded', attempts: 1, artifactDir: '.', metadata: oldMetadata, result: oldResult }],
        cost: { actual: { totalCost: oldCost.cost, steps: [oldCost] } }
      }, { extractRoute: 'document' })
      const original = await readCanonicalRecord(outputDir)
      const originalState = (original['providerStates'] as Array<Record<string, unknown>>)[0]
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const calls = installMockFetch(call => {
        expect(call.bodyJson?.['model']).toBe(newTarget.model)
        return Response.json({ model: newTarget.model, status: 'completed', output_text: 'Newly extracted text.', usage: { input_tokens: 1000, output_tokens: 200 } })
    })
    await resumeOcrTarget(ocrResumeTarget(outputDir), buildOptsFromFlags({}) as OcrExtractionOptions, [newTarget])
    const updated = await readCanonicalRecord(outputDir)
    const actual = (updated['cost'] as { actual: { totalCost: number, steps: StepCostEntry[] } }).actual
    expect(actual.steps.find(row => row.model === oldTarget.model)).toEqual(oldCost)
    expect(actual.steps.find(row => row.model === newTarget.model)).toMatchObject({
      step: 'extract', provider: 'openai', cost: 0.02, costSource: 'registry_fallback',
      promptTokens: 1000, completionTokens: 200
    })
    expect(actual.totalCost).toBeCloseTo(1.153, 12)
    const states = updated['providerStates'] as Array<Record<string, unknown>>
    const preserved = states.find(state => state['model'] === oldTarget.model)
    expect(preserved?.['metadata']).toEqual(originalState?.['metadata'])
    expect(preserved?.['result']).toEqual(originalState?.['result'])
    expect(preserved?.['attempts']).toBe(1)
    expect(updated['completionStatus']).toBe('full')
    expect(calls).toHaveLength(1)
    await resumeOcrTarget(ocrResumeTarget(outputDir), buildOptsFromFlags({}) as OcrExtractionOptions, [newTarget])
    const noop = await readCanonicalRecord(outputDir)
    expect((noop['cost'] as { actual: unknown }).actual).toEqual(actual)
    expect(calls).toHaveLength(1)
    expect(noop).toEqual(updated)
    })
  } finally {
    tokenSpy.mockRestore()
    throughputSpy.mockRestore()
  }
})

test('recorded completed cost rows remain authoritative when a current registry row is absent', () => {
  const recorded: StepCostEntry = { step: 'extract', provider: 'openai', model: 'retained-model', cost: 2.75, costSource: 'provider_usage' }
  const fresh: StepCostEntry = { step: 'extract', provider: 'anthropic', model: 'claude-haiku-5-5', cost: 0.5, costSource: 'registry_fallback' }
  expect(preserveRecordedOcrActualCosts({ totalCost: 0.5, steps: [fresh] }, [recorded])).toEqual({ totalCost: 3.25, steps: [fresh, recorded] })
})
