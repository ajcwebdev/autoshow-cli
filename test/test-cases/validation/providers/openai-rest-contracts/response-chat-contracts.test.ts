import { describe, expect, test } from 'bun:test'
import { runOpenAICompatibleChatModel } from '~/cli/commands/process-steps/step-3-write/write-services/openai-compatible-chat'
import { runCerebrasModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-cerebras/run-cerebras'
import { runTogetherModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-together/run-together'
import { runMinimaxModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-minimax/run-minimax'
import { CEREBRAS_DEFAULT_BASE_URL, MINIMAX_DEFAULT_BASE_URL, TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { OpenAIRestError, createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, structuredOpts } from './shared'

installOpenAIRestContractHooks()

describe('OpenAI REST response and chat contracts', () => {
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
      { model: 'gpt-5.5', input: 'Hello', stream: false }
    )

    expect(extractOpenAIResponseText(response)).toBe('Hello from REST.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.openai.local/v1/responses',
      method: 'POST',
      bodyJson: { model: 'gpt-5.5', input: 'Hello', stream: false }
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
      { model: 'gpt-5.5', input: 'retry?' }
    )).rejects.toThrow('OpenAI Responses request failed (429): try later')

    try {
      await createOpenAIResponse(
        { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
        { model: 'gpt-5.5', input: 'retry?' }
      )
      throw new Error('expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(OpenAIRestError)
      expect((error as OpenAIRestError).status).toBe(429)
      expect((error as OpenAIRestError).headers.get('retry-after')).toBe('2')
      expect((error as OpenAIRestError).body).toContain('rate_limit_exceeded')
      expect((error as OpenAIRestError).code).toBe('rate_limit_exceeded')
      expect((error as OpenAIRestError).param).toBe('model')
      expect((error as OpenAIRestError).type).toBe('rate_limit_error')
    }
  })

  test('OpenAI-compatible chat retries without response_format after structured fallback error', async () => {
    const calls = installFetch((call) => {
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
  })

  test('MiniMax write uses native chat completions with bearer auth and OpenAI-style usage', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'

    const calls = installFetch(() => jsonResponse({
      model: 'MiniMax-M3',
      choices: [{ message: { content: 'MiniMax response.' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      base_resp: { status_code: 0, status_msg: 'success' }
    }))

    const result = await runMinimaxModel('Draft this.', 'MiniMax-M3', structuredOpts)

    expect(result.result).toBe('MiniMax response.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: `${MINIMAX_DEFAULT_BASE_URL}/v1/chat/completions`,
      method: 'POST',
      bodyJson: {
        model: 'MiniMax-M3',
        messages: [{ role: 'user', content: 'Draft this.' }],
        max_completion_tokens: 16000,
        stream: false
      }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer minimax-key')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    expect(calls[0]?.bodyJson?.['max_tokens']).toBeUndefined()
    expect(calls[0]?.bodyJson?.['output_config']).toBeUndefined()
    expect(result.metadata).toMatchObject({
      llmService: 'minimax',
      llmModel: 'MiniMax-M3',
      providerReturnedModel: 'MiniMax-M3',
      tokenCountSource: 'provider_usage',
      providerUsage: {
        inputTokenCount: 4,
        outputTokenCount: 2,
        totalTokenCount: 6
      },
      rawProviderUsage: {
        prompt_tokens: 4,
        completion_tokens: 2,
        total_tokens: 6
      }
    })
  })

  test('MiniMax write rejects non-success base_resp payloads', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    const calls = installFetch(() => jsonResponse({
      choices: [{ message: { content: 'ignored' } }],
      base_resp: { status_code: 1008, status_msg: 'invalid request' }
    }))

    await expect(runMinimaxModel('Draft this.', 'MiniMax-M3')).rejects.toThrow(
      'MiniMax chat completion failed (1008): invalid request'
    )
    expect(calls).toHaveLength(1)
  })

  test('Cerebras write requires API key before issuing REST calls', async () => {
    await expect(runCerebrasModel('Draft this.', 'gpt-oss-120b')).rejects.toThrow('CEREBRAS_API_KEY')
  })

  test('Cerebras write sends public model IDs with native strict schema', async () => {
    process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

    const calls = installFetch(() => jsonResponse({
      model: 'gpt-oss-120b',
      choices: [{ message: { content: '{"summary":"cerebras"}' } }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 }
    }))

    const result = await runCerebrasModel('Draft this.', 'gpt-oss-120b', structuredOpts)

    expect(result.result).toBe('{"summary":"cerebras"}')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: `${CEREBRAS_DEFAULT_BASE_URL}/chat/completions`,
      method: 'POST',
      bodyJson: {
        model: 'gpt-oss-120b',
        messages: [{ role: 'user', content: 'Draft this.' }],
        max_completion_tokens: 40960,
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
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer cerebras-key')
    expect(result.metadata).toMatchObject({
      llmService: 'cerebras',
      llmModel: 'gpt-oss-120b',
      providerReturnedModel: 'gpt-oss-120b'
    })
  })

  test('Cerebras structured schema omits unsupported strict-mode validation keywords', async () => {
    process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

    const schemaWithUnsupportedKeywords = {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'tags'],
      properties: {
        summary: {
          type: 'string',
          minLength: 1,
          maxLength: 180,
          pattern: '^.+$',
          format: 'text'
        },
        tags: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 32
          }
        }
      }
    }

    const calls = installFetch(() => jsonResponse({
      model: 'gpt-oss-120b',
      choices: [{ message: { content: '{"summary":"cerebras","tags":["public"]}' } }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 }
    }))

    await runCerebrasModel('Draft this.', 'gpt-oss-120b', {
      schemaName: 'summary_tags',
      schema: schemaWithUnsupportedKeywords,
      strict: true,
      strategy: 'native'
    })

    const responseFormat = calls[0]?.bodyJson?.['response_format'] as Record<string, unknown> | undefined
    const jsonSchema = responseFormat?.['json_schema'] as Record<string, unknown> | undefined
    const sentSchema = jsonSchema?.['schema']
    expect(sentSchema).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'tags'],
      properties: {
        summary: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    })
    expect(schemaWithUnsupportedKeywords.properties.summary.minLength).toBe(1)
    expect(schemaWithUnsupportedKeywords.properties.tags.minItems).toBe(1)
  })

  test('Cerebras write honors base URL and sends preview public model ID directly', async () => {
    process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

    const calls = installFetch(() => jsonResponse({
      model: 'zai-glm-4.7',
      choices: [{ message: { content: 'Cerebras preview response.' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 }
    }))

    const result = await runCerebrasModel('Draft this.', 'zai-glm-4.7', undefined, 'https://mock.cerebras.local/v1/')

    expect(result.result).toBe('Cerebras preview response.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.cerebras.local/v1/chat/completions',
      method: 'POST',
      bodyJson: {
        model: 'zai-glm-4.7',
        max_completion_tokens: 40960,
        stream: false
      }
    })
  })

  test('Cerebras write preserves public endpoint REST errors', async () => {
    process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

    installFetch(() => jsonResponse({
      error: {
        message: 'Model zai-glm-4.7 does not exist or you do not have access to it.'
      }
    }, { status: 404 }))

    await expect(runCerebrasModel('Draft this.', 'zai-glm-4.7')).rejects.toThrow(
      'OpenAI Chat Completions request failed (404): Model zai-glm-4.7 does not exist or you do not have access to it.'
    )
  })

  test('Together write maps selectors to provider model IDs with bearer auth', async () => {
    process.env['TOGETHER_API_KEY'] = 'together-key'

    const calls = installFetch((call) => jsonResponse({
      model: call.bodyJson?.['model'],
      choices: [{ message: { content: calls.length === 1 ? '{"summary":"kimi"}' : '{"summary":"glm"}' } }],
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 }
    }))

    const kimiResult = await runTogetherModel('Draft Kimi.', 'kimi-k2.6', structuredOpts)
    const glmResult = await runTogetherModel('Draft GLM.', 'glm-5.1')

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
        model: 'moonshotai/Kimi-K2.6',
        messages: [{ role: 'user', content: 'Draft Kimi.' }],
        max_tokens: 32768,
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
        model: 'zai-org/GLM-5.1',
        messages: [{ role: 'user', content: 'Draft GLM.' }],
        max_tokens: 32768,
        stream: false
      }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer together-key')
    expect(calls[1]?.headers.get('authorization')).toBe('Bearer together-key')
    expect(kimiResult.metadata).toMatchObject({
      llmService: 'together',
      llmModel: 'kimi-k2.6',
      providerReturnedModel: 'moonshotai/Kimi-K2.6'
    })
    expect(glmResult.metadata).toMatchObject({
      llmService: 'together',
      llmModel: 'glm-5.1',
      providerReturnedModel: 'zai-org/GLM-5.1'
    })
  })
})
