import { describe, expect, test } from 'bun:test'
import { runOpenAICompatibleChatModel } from '~/cli/commands/text/write/write-services/openai-compatible-chat'
import { runTogetherModel } from '~/cli/commands/text/write/write-services/write-together/run-together'
import { runOpenAIModel } from '~/cli/commands/text/write/write-services/write-openai/run-openai'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { OpenAIRestError, createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, structuredOpts } from './shared'
import { expectProviderHttpError } from '../../../../test-utils/rest-contract-helpers'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

installOpenAIRestContractHooks()

describe('OpenAI REST response and chat contracts', () => {
  test('Astra selector preserves the exact model ID and supports xhigh', () => {
    const opts = buildOptsFromFlags({ openai: 'gpt-6-astra', 'reasoning-effort': 'xhigh' })
    expect(opts.openaiModels).toEqual(['gpt-6-astra'])
    expect(opts.reasoningEffort).toBe('xhigh')
    expect(buildOptsFromFlags({ openai: 'gpt-5.6-sol' }).openaiModels).toEqual(['gpt-5.6-sol'])
  })

  for (const effort of [undefined, 'default', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
    test(`Astra sends native chapter lyric schema with ${effort ?? 'omitted'} reasoning`, async () => {
      process.env['OPENAI_API_KEY'] = 'openai-key'
      const schema = await resolveStructuredSchema(['rapSongChapter'])
      const calls = installFetch(() => jsonResponse({
        model: 'gpt-6-astra', output_text: '{"title":"A file"}',
        usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 }
      }))
      const result = await runOpenAIModel('Adapt the transcript.', 'gpt-6-astra', {
        ...structuredOpts, schema: schema.jsonSchema, requestedReasoningEffort: effort
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toEndWith('/responses')
      expect(calls[0]?.bodyJson).toMatchObject({
        model: 'gpt-6-astra', text: { format: { type: 'json_schema', strict: true, schema: schema.jsonSchema } }
      })
      if (effort === undefined || effort === 'default') {
        expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning')
      } else {
        expect(calls[0]?.bodyJson?.['reasoning']).toEqual({ effort })
      }
      expect(result.metadata).toMatchObject({ llmModel: 'gpt-6-astra', effectiveReasoningEffort: effort ?? 'default' })
    })
  }

  test('Astra rejects disabled/minimal reasoning and Sol rejects xhigh before HTTP', async () => {
    const calls = installFetch(() => { throw new Error('Unexpected provider call') })
    for (const effort of ['disabled', 'minimal'] as const) {
      await expect(runOpenAIModel('Adapt.', 'gpt-6-astra', {
        ...structuredOpts, requestedReasoningEffort: effort
      })).rejects.toThrow('does not support')
    }
    await expect(runOpenAIModel('Adapt.', 'gpt-5.6-sol', {
      ...structuredOpts, requestedReasoningEffort: 'xhigh'
    })).rejects.toThrow('does not support')
    expect(calls).toHaveLength(0)
  })

  test('Responses requests use bearer JSON REST and extract output_text content parts', async () => {
    const calls = installFetch(() => jsonResponse({
      output: [{
        type: 'message',
        content: [
          { type: 'output_text', text: 'Hello ' },
          { type: 'refusal', text: 'hidden' },
          { type: 'output_text', text: 'from REST.' }
        ]
      }],
      usage: { input_tokens: 5, output_tokens: 3 }
    }))

    const response = await createOpenAIResponse(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1/' },
      { model: 'gpt-5.6-sol', input: 'Hello', stream: false }
    )

    expect(extractOpenAIResponseText(response)).toBe('Hello from REST.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.openai.local/v1/responses',
      method: 'POST',
      bodyJson: { model: 'gpt-5.6-sol', input: 'Hello', stream: false }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer openai-key')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
  })

  test('REST errors preserve status, headers, body, and parsed OpenAI error fields', async () => {
    installFetch(() => jsonResponse({
      error: {
        message: 'try later',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
        param: 'model'
      }
    }, {
      status: 429,
      headers: { 'retry-after': '2' }
    }))

    await expect(createOpenAIResponse(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
      { model: 'gpt-5.6-sol', input: 'retry?' }
    )).rejects.toThrow('OpenAI Responses request failed (429): try later')

    const error = await expectProviderHttpError(
      () => createOpenAIResponse(
        { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
        { model: 'gpt-5.6-sol', input: 'retry?' }
      ),
      { instanceOf: OpenAIRestError, status: 429, headers: { 'retry-after': '2' } }
    ) as OpenAIRestError
    expect(error.body).toContain('rate_limit_exceeded')
    expect(error.code).toBe('rate_limit_exceeded')
    expect(error.param).toBe('model')
    expect(error.type).toBe('rate_limit_error')
  })

  test('OpenAI write routes Responses output and metadata through the shared request scaffold', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      model: 'gpt-5.6-sol',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"summary":"done"}' }] }],
      usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 }
    }))

    const result = await runOpenAIModel('Summarize this.', 'gpt-5.6-sol', structuredOpts)

    expect(result.result).toBe('{"summary":"done"}')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.bodyJson).toEqual({
      model: 'gpt-5.6-sol',
      input: 'Summarize this.',
      stream: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'summary',
          schema: structuredOpts.schema,
          strict: true
        }
      }
    })
    expect(result.metadata).toMatchObject({
      llmService: 'openai',
      llmModel: 'gpt-5.6-sol',
      providerReturnedModel: 'gpt-5.6-sol',
      tokenCountSource: 'provider_usage'
    })
  })

  test('OpenAI write maps normalized effort to the nested Responses reasoning object', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      model: 'gpt-5.6-sol',
      output_text: '{"summary":"done"}',
      usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 }
    }))

    const result = await runOpenAIModel('Summarize this.', 'gpt-5.6-sol', {
      ...structuredOpts,
      requestedReasoningEffort: 'high'
    })

    expect(calls[0]?.bodyJson?.['reasoning']).toEqual({ effort: 'high' })
    expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
    expect(result.metadata).toMatchObject({
      requestedReasoningEffort: 'high',
      effectiveReasoningEffort: 'high'
    })

    const disabled = await runOpenAIModel('Summarize this.', 'gpt-5.6-sol', {
      ...structuredOpts,
      requestedReasoningEffort: 'disabled'
    })
    expect(calls[1]?.bodyJson?.['reasoning']).toEqual({ effort: 'none' })
    expect(disabled.metadata).toMatchObject({
      requestedReasoningEffort: 'disabled',
      effectiveReasoningEffort: 'disabled'
    })
  })

  test('OpenAI-compatible chat retries without response_format after structured fallback error', async () => {
    const requestSignals: Array<AbortSignal | null | undefined> = []
    const calls = installFetch((call, _input, init) => {
      requestSignals.push(init?.signal)
      if (calls.length === 1) {
        expect(call.bodyJson?.['response_format']).toMatchObject({
          type: 'json_schema'
        })
        return jsonResponse({
          error: {
            message: 'response_format is not supported',
            type: 'invalid_request_error',
            param: 'response_format'
          }
        }, { status: 400 })
      }

      expect(call.bodyJson?.['response_format']).toBeUndefined()
      return jsonResponse({
        choices: [{ message: { content: '{"summary":"fallback"}' } }],
        usage: { prompt_tokens: 4, completion_tokens: 2 }
      })
    })

    const result = await runOpenAICompatibleChatModel({
      prompt: 'Summarize this.',
      model: 'grok-test',
      structuredOpts,
      config: { apiKey: 'xai-key', baseURL: 'https://mock.xai.local/v1' },
      service: 'grok',
      providerLabel: 'Grok',
      operationName: 'grok-rest-test'
    })

    expect(result.result).toBe('{"summary":"fallback"}')
    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.url)).toEqual([
      'https://mock.xai.local/v1/chat/completions',
      'https://mock.xai.local/v1/chat/completions'
    ])
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer xai-key')
    expect(requestSignals).toHaveLength(2)
    expect(requestSignals[0]).toBeInstanceOf(AbortSignal)
    expect(requestSignals[1]).toBeInstanceOf(AbortSignal)
    expect(requestSignals[0]).not.toBe(requestSignals[1])
  })

  test('Together write maps selectors to provider model IDs with bearer auth', async () => {
    process.env['TOGETHER_API_KEY'] = 'together-key'

    const calls = installFetch((call) => jsonResponse({
      model: call.bodyJson?.['model'],
      choices: [{ message: { content: calls.length === 1 ? '{"summary":"kimi"}' : '{"summary":"glm"}' } }],
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 }
    }))

    const kimiResult = await runTogetherModel('Draft Kimi.', 'kimi-k3', structuredOpts)
    const glmResult = await runTogetherModel('Draft GLM.', 'glm-5.3-flash')

    expect(kimiResult.result).toBe('{"summary":"kimi"}')
    expect(glmResult.result).toBe('{"summary":"glm"}')
    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.url)).toEqual([
      `${TOGETHER_DEFAULT_BASE_URL}/chat/completions`,
      `${TOGETHER_DEFAULT_BASE_URL}/chat/completions`
    ])
    expect(calls[0]).toMatchObject({
      method: 'POST',
      bodyJson: {
        model: 'moonshotai/Kimi-K3',
        messages: [{ role: 'user', content: 'Draft Kimi.' }],
        max_tokens: 131072,
        stream: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'summary',
            strict: true
          }
        }
      }
    })
    expect(calls[1]).toMatchObject({
      method: 'POST',
      bodyJson: {
        model: 'zai-org/GLM-5.3-Flash',
        messages: [{ role: 'user', content: 'Draft GLM.' }],
        max_tokens: 32768,
        stream: false
      }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer together-key')
    expect(calls[1]?.headers.get('authorization')).toBe('Bearer together-key')
    expect(kimiResult.metadata).toMatchObject({
      llmService: 'together',
      llmModel: 'kimi-k3',
      providerReturnedModel: 'moonshotai/Kimi-K3'
    })
    expect(glmResult.metadata).toMatchObject({
      llmService: 'together',
      llmModel: 'glm-5.3-flash',
      providerReturnedModel: 'zai-org/GLM-5.3-Flash'
    })
  })
})
