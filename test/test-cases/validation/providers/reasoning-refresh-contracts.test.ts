import { describe, expect, test } from 'bun:test'
import { runAnthropicModel } from '~/cli/commands/text/write/write-services/write-anthropic/run-anthropic'
import { runGrokModel } from '~/cli/commands/text/write/write-services/write-grok/run-grok'
import { runGeminiModel } from '~/cli/commands/text/write/write-services/write-gemini/run-gemini'
import { runWithLLMInstrumentation } from '~/cli/commands/text/write/write-utils/llm-instrumentation'
import { parseReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import type { StructuredRequestOptions } from '~/types'

setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY'], tempPrefix: 'autoshow-reasoning-refresh-' })
const options: StructuredRequestOptions = { schemaName: 'summary', schema: { type: 'object', properties: { summary: { type: 'string' } } }, strict: true, strategy: 'native' }

describe('Retained native reasoning documentation contracts', () => {
  // Native payloads follow the official effort/reasoning pages, refreshed 2026-10-17:
  // https://platform.claude.com/docs/en/build-with-claude/effort
  // https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
  for (const model of ['claude-fable-5-1', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
    test(`${model} dispatch accepts xhigh and explicit default resets the override`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'test'
      const calls = installMockFetch(() => Response.json({ model, content: [{ type: 'text', text: '{"summary":"ok"}' }], usage: { input_tokens: 12, output_tokens: 6 } }))
      for (const requestedReasoningEffort of [undefined, 'xhigh', 'default'] as const) {
        await runAnthropicModel('Summarize.', model, { ...options, requestedReasoningEffort })
      }
      expect(calls.map(call => (call.bodyJson?.['output_config'] as Record<string, unknown>)['effort'])).toEqual([undefined, 'xhigh', undefined])
      expect(calls.every(call => call.url.endsWith('/v1/messages'))).toBe(true)
    })
  }
  test('Grok 4.7 sends xhigh via Chat Completions and resets with default', async () => {
    process.env['XAI_API_KEY'] = 'test'
    const calls = installMockFetch(() => Response.json({ model: 'grok-4.7', choices: [{ message: { content: '{"summary":"ok"}' } }], usage: { prompt_tokens: 12, completion_tokens: 6 } }))
    for (const requestedReasoningEffort of [undefined, 'xhigh', 'default'] as const) await runGrokModel('Summarize.', 'grok-4.7', { ...options, requestedReasoningEffort })
    expect(calls.map(call => call.bodyJson?.['reasoning_effort'])).toEqual([undefined, 'xhigh', undefined])
    expect(calls.every(call => call.url.endsWith('/chat/completions'))).toBe(true)
  })
  test('public vocabulary rejects unsupported provider terms rather than coercing them', () => {
    for (const value of ['ultra', 'none', 'auto', 'adaptive', 'unlimited']) expect(() => parseReasoningEffort(value)).toThrow('Invalid --reasoning-effort')
  })
  test('Gemini write dispatch accounts for candidates plus billed thought tokens', async () => {
    process.env['GEMINI_API_KEY'] = 'test'
    installMockFetch(() => Response.json({ candidates: [{ content: { parts: [{ text: '{"summary":"ok"}' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 7, totalTokenCount: 24 } }))
    const result = await runGeminiModel('Summarize.', 'gemini-3.8-flash', { ...options, requestedReasoningEffort: 'high' })
    expect(result.metadata.outputTokenCount).toBe(12)
    expect(result.metadata.providerUsage).toMatchObject({ inputTokenCount: 12, outputTokenCount: 12, totalTokenCount: 24 })
  })
  test('unmapped provider completion totals include reasoning; Grok maps its documented split in its adapter', async () => {
    const result = await runWithLLMInstrumentation('Prompt', async () => ({ text: 'ok', usage: { prompt_tokens: 12, completion_tokens: 10, completion_tokens_details: { reasoning_tokens: 7 } } }))
    expect(result.outputTokenCount).toBe(10)
  })
})
