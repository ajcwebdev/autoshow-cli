import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGrokModel } from '~/cli/commands/text/write/write-services/write-grok/run-grok'
import { extractErrorMetadata } from '~/utils/error-handler'
import { installWriteBenchmarkFetchGuard, prepareWriteBenchmarkCase, runWriteBenchmarkSlot, WRITE_BENCHMARK_CASES } from '~/tools/write-benchmark'
import type { WriteBenchmarkCase, WriteBenchmarkPlan } from '~/tools/write-benchmark'
import type { LLMTarget } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { withTempDir } from '../../../../test-utils/temp-dirs'

setupContractSuiteLifecycle({
  envKeys: ['XAI_API_KEY'],
  tempPrefix: 'autoshow-write-empty-usage-',
  beforeEachExtra: () => {
    process.env['XAI_API_KEY'] = 'synthetic-key'
  }
})

const routes = [
  { service: 'grok', model: 'grok-4.7', hostModel: 'grok-4.7', cap: 16000, inputRate: 200, outputRate: 600, run: runGrokModel }
] as const

describe('empty write transport responses retain failure billing evidence', () => {
  for (const route of routes) for (const content of ['', ' \n\t']) {
    test(`${route.service}/${route.model} retains ${content ? 'whitespace' : 'empty'} response usage with one dispatch`, async () => {
      await withTempDir('write-empty-billing-', async runDir => {
        const prepared = await prepareWriteBenchmarkCase(WRITE_BENCHMARK_CASES[0])
        const usage = { prompt_tokens: 100, completion_tokens: route.cap, total_tokens: 100 + route.cap }
        const payload = {
          model: 'returned-empty-model',
          choices: [{ finish_reason: 'length', message: { content, reasoning_content: 'Synthetic thinking consumed the response allowance.' } }],
          usage
        }
        const calls = installMockFetch(() => Response.json(payload))
        const restore = installWriteBenchmarkFetchGuard()
        try {
          const target: LLMTarget = { service: route.service, label: route.service, model: route.model, run: route.run }
          const entry: WriteBenchmarkCase = {
            ...WRITE_BENCHMARK_CASES[0], runDir, estimatedCostCents: 0,
            sourceSha256: sha256Bytes(prepared.source), promptSha256: sha256Bytes(prepared.prompt),
            schemaSha256: sha256Bytes(JSON.stringify(prepared.schema.jsonSchema))
          }
          const slot = await runWriteBenchmarkSlot({ fingerprint: 'empty-response-test' } as WriteBenchmarkPlan, entry, prepared, target)
          expect(calls).toHaveLength(1)
          expect(calls[0]?.bodyJson).toMatchObject({ model: route.hostModel })
          expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
          expect(slot.status).toBe('failed')
          expect(slot.networkAttempts).toBe(1)
          expect(slot.metadata).toMatchObject({ inputTokenCount: 100, outputTokenCount: route.cap, tokenCountSource: 'provider_usage', validationFailed: true, providerReturnedModel: 'returned-empty-model' })
          expect(slot.billing?.status).toBe('known')
          expect(slot.billing?.costCents).toBeCloseTo((100 * route.inputRate + route.cap * route.outputRate) / 1_000_000, 10)
          const evidence = await Bun.file(join(runDir, `failure-${route.service}-${route.model}.json`)).json()
          expect(evidence.rawResponse).toMatchObject({ choices: [{ finish_reason: 'length' }], usage })
          expect(evidence.rawProviderUsage).toEqual(usage)
          expect(evidence.error.metadata.requestSettings).toMatchObject({ model: route.hostModel })
          expect(slot.metadata?.requestSettings).toMatchObject({ model: route.hostModel })
          await runWriteBenchmarkSlot({ fingerprint: 'empty-response-test' } as WriteBenchmarkPlan, entry, prepared, target)
          expect(calls).toHaveLength(1)
        } finally { restore() }
      })
    })
  }

  test('empty response rejection retains error metadata before the shared scaffold can discard usage', async () => {
    const payload = { model: 'returned-grok', choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: { prompt_tokens: 12, completion_tokens: 16000 } }
    const calls = installMockFetch(() => Response.json(payload))
    try {
      await runGrokModel('Return a concise summary.', 'grok-4.7')
      expect.unreachable('Empty provider content must fail')
    } catch (error) {
      expect(extractErrorMetadata(error)).toMatchObject({ retryable: false, rawResponse: payload, rawProviderUsage: payload.usage, returnedModel: 'returned-grok', requestSettings: { model: 'grok-4.7' } })
    }
    expect(calls).toHaveLength(1)
  })
})
