import { describe, expect, test } from 'bun:test'
import { AppError } from '~/utils/error-handler'
import { createAnthropicMessage } from '~/utils/anthropic/anthropic-client'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { createOpenAIResponse } from '~/utils/openai/openai-client'
import { runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'
import { setHttpCaptureBytesForTests } from '~/utils/bounded-capture'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-provider-rest-client-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

type ClientCase = {
  name: string
  request: () => Promise<unknown>
  errorName: string
  appError: boolean
  bodyPolicy: 'raw-text' | 'parsed'
}

const clients: ClientCase[] = [
  {
    name: 'Mistral',
    request: async () => await mistralJsonRequest({
      apiKey: 'mistral-key',
      baseURL: 'https://mock.mistral.local',
      path: '/test',
      errorMessagePrefix: 'Mistral matrix request failed',
      body: { input: 'hello' }
    }),
    errorName: 'Error',
    appError: false,
    bodyPolicy: 'raw-text'
  },
  {
    name: 'Anthropic',
    request: async () => await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hello' }] }
    ),
    errorName: 'Error',
    appError: false,
    bodyPolicy: 'raw-text'
  },
  {
    name: 'OpenAI',
    request: async () => await createOpenAIResponse(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
      { model: 'gpt-test', input: 'hello' }
    ),
    errorName: 'OpenAIRestError',
    appError: false,
    bodyPolicy: 'raw-text'
  },
  {
    name: 'Replicate',
    request: async () => await runReplicatePrediction({
      apiToken: 'replicate-key',
      baseUrl: 'https://mock.replicate.local',
      model: 'owner/model',
      input: { prompt: 'hello' },
      operationName: 'replicate-matrix'
    }),
    errorName: 'ReplicateRestError',
    appError: true,
    bodyPolicy: 'parsed'
  },
  {
    name: 'Gemini',
    request: async () => await geminiGenerateContent('gemini-key', {
      model: 'gemini-test',
      contents: 'hello'
    }),
    errorName: 'GeminiRestError',
    appError: false,
    bodyPolicy: 'parsed'
  }
]

const captureError = async (client: ClientCase): Promise<Error & Record<string, unknown>> => {
  try {
    await client.request()
    throw new Error(`Expected ${client.name} request to fail`)
  } catch (error) {
    return error as Error & Record<string, unknown>
  }
}

describe('provider REST client differential contracts', () => {
  for (const client of clients) {
    test(`${client.name} preserves its rich-error identity for JSON and text bodies`, async () => {
      const responses = [
        new Response(JSON.stringify({ error: { code: 400, message: 'matrix JSON failure' } }), {
          status: 400,
          headers: { 'retry-after': '3' }
        }),
        new Response('matrix text failure', {
          status: 418,
          headers: { 'retry-after': '4' }
        })
      ]
      installMockFetch(() => responses.shift() as Response)

      const jsonError = await captureError(client)
      expect(jsonError.name).toBe(client.errorName)
      expect(jsonError instanceof AppError).toBe(client.appError)
      expect(jsonError['status']).toBe(400)
      expect((jsonError['headers'] as Headers).get('retry-after')).toBe('3')
      expect(jsonError.message).toContain('matrix JSON failure')

      const textError = await captureError(client)
      expect(textError.name).toBe(client.errorName)
      expect(textError instanceof AppError).toBe(client.appError)
      expect(textError['status']).toBe(418)
      expect((textError['headers'] as Headers).get('retry-after')).toBe('4')
      expect(textError.message).toContain('matrix text failure')
      if (client.bodyPolicy === 'raw-text') {
        expect(textError['body']).toBe('matrix text failure')
      } else {
        expect(textError['body'] ?? textError['rawResponse']).toBe('matrix text failure')
      }
    })

    test(`${client.name} bounds oversized error diagnostics`, async () => {
      setHttpCaptureBytesForTests(64)
      try {
        const oversizedBody = `${'x'.repeat(65)}tail-marker`
        installMockFetch(() => new Response(oversizedBody, { status: 422 }))

        const error = await captureError(client)
        expect(error.name).toBe(client.errorName)
        expect(error['bodyBytes']).toBe(oversizedBody.length)
        expect(error['bodyTruncated']).toBe(true)
        expect(error['bodyPreview']).toBeString()
        expect(error['bodyPreview']).toEndWith('tail-marker')
      } finally {
        setHttpCaptureBytesForTests()
      }
    })
  }

  test('Gemini and Replicate normalize fetch TimeoutErrors without ambiguous create redispatch', async () => {
    const geminiCalls = installMockFetch(() => {
      throw new DOMException('provider request timed out', 'TimeoutError')
    })
    const geminiError = await captureError(clients[4] as ClientCase)
    expect(geminiError.name).toBe('AbortError')
    expect(geminiCalls).toHaveLength(1)

    const replicateCalls = installMockFetch(() => {
      throw new DOMException('provider request timed out', 'TimeoutError')
    })
    const replicateError = await captureError(clients[3] as ClientCase)
    expect(replicateError.name).toBe('AbortError')
    expect(replicateCalls).toHaveLength(1)
  })

  // Bun's fetch kills any request after 300s of socket silence unless timeout: false is
  // passed — an AbortSignal alone does not suppress it (oven-sh/bun#16682) — so every
  // provider request must carry the opt-out or long non-streaming calls die at 5 minutes.
  test('every provider client disables Bun\'s default fetch idle timeout', async () => {
    for (const client of clients) {
      let capturedInit: Parameters<typeof fetch>[1]
      installMockFetch((_call, _input, init) => {
        capturedInit = init
        return new Response(JSON.stringify({ error: { code: 400, message: 'init capture' } }), { status: 400 })
      })
      await captureError(client)
      expect((capturedInit as { timeout?: unknown } | undefined)?.timeout).toBe(false)
    }
  })

  test('Gemini keeps its established successful-response JSON validation message', async () => {
    installMockFetch(() => new Response('not JSON', { status: 200 }))
    const error = await captureError(clients[4] as ClientCase)
    expect(error.message).toBe('Gemini API returned invalid JSON: not JSON')
    expect(error).toMatchObject({ kind: 'validation', status: 200 })
  })
})
