import { describe, expect, test } from 'bun:test'
import { runGeminiModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/run-gemini'
import { runGeminiImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/run-gemini-image-gen'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent, GeminiRestError } from '~/utils/gemini/gemini-rest'
import { expectProviderHttpError, installMockFetch as installFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'

const { withTempDir } = setupGeminiRestContractFixture()

describe('Gemini REST contracts', () => {
  test('generateContent uses v1beta REST headers, generationConfig, and non-thought text extraction', async () => {
    const calls = installFetch((call) => {
      expect(call.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
      expect(call.method).toBe('POST')
      expect(call.headers.get('x-goog-api-key')).toBe('gemini-key')
      expect(call.bodyJson).toMatchObject({
        contents: [{ role: 'user', parts: [{ text: 'Return JSON.' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' }
        },
        systemInstruction: { parts: [{ text: 'Return only JSON.' }] }
      })
      return jsonResponse({
        candidates: [{
          content: {
            parts: [
              { thought: true, text: 'hidden' },
              { text: '{"ok":true}' }
            ]
          }
        }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 }
      })
    })

    const response = await geminiGenerateContent('gemini-key', {
      model: 'gemini-test',
      contents: 'Return JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' }
      },
      systemInstruction: 'Return only JSON.'
    })

    expect(calls).toHaveLength(1)
    expect(response.text).toBe('{"ok":true}')
    expect(response.usageMetadata).toMatchObject({ promptTokenCount: 3, candidatesTokenCount: 4 })
  })

  test('Gemini REST errors preserve status and headers for retry classification', async () => {
    installFetch(() => jsonResponse({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'quota exceeded'
      }
    }, {
      status: 429,
      headers: { 'retry-after': '1' }
    }))

    const error = await expectProviderHttpError(
      () => geminiGenerateContent('gemini-key', {
        model: 'gemini-test',
        contents: 'retry?'
      }),
      { instanceOf: GeminiRestError, status: 429, headers: { 'retry-after': '1' } }
    )
    expect(classifyGeminiRetry(error)).toMatchObject({ shouldRetry: true, reason: 'provider rejected paid create with retryable status 429' })
  })

  test('a Gemini status parsed out of the response body is judged by the caller\'s retry class', () => {
    const bodyStatusError = new Error('Gemini API request failed: {"error":{"code":500,"message":"internal"}}')

    expect(classifyGeminiRetry(bodyStatusError, 'runtime_http_create_conservative')).toMatchObject({
      shouldRetry: false,
      reason: 'paid create status 500 is not safe to redispatch'
    })
    expect(classifyGeminiRetry(bodyStatusError, 'runtime_http_create_retriable')).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 500'
    })
    expect(classifyGeminiRetry(bodyStatusError)).toMatchObject({ shouldRetry: false })

    const rateLimited = new Error('Gemini API request failed: {"error":{"code":429,"message":"quota"}}')
    expect(classifyGeminiRetry(rateLimited, 'runtime_http_create_conservative')).toMatchObject({
      shouldRetry: true,
      reason: 'provider rejected paid create with retryable status 429'
    })

    const deterministic = new Error('Gemini API request failed: {"error":{"code":400,"message":"bad request"}}')
    expect(classifyGeminiRetry(deterministic, 'runtime_http_create_retriable')).toMatchObject({
      shouldRetry: false,
      reason: 'non-retryable status 400'
    })
  })

  test('the paid Gemini image create runs the conservative tier', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls: number[] = []
    installFetch(() => {
      calls.push(1)
      return new Response(JSON.stringify({ error: { code: 500, message: 'internal' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      })
    })

    await withTempDir(async (dir) => {
      await expect(runGeminiImageGen('a lighthouse', dir, { model: 'gemini-3-pro-image' }))
        .rejects.toThrow()
    })

    expect(calls).toHaveLength(1)
  })

  test('Gemini LLM structured output sends response JSON schema', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    let requestSignal: AbortSignal | null | undefined
    const calls = installFetch((_call, _input, init) => {
      requestSignal = init?.signal
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"title":"Done"}' }] } }]
      })
    })

    const result = await runGeminiModel('Write a title.', 'gemini-3.5-flash-lite', {
      strategy: 'schema-guided',
      schemaName: 'Title',
      strict: true,
      requestedReasoningEffort: 'minimal',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      }
    })

    expect(result.result).toBe('{"title":"Done"}')
    expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      },
      thinkingConfig: { thinkingLevel: 'MINIMAL' }
    })
    expect(requestSignal).toBeInstanceOf(AbortSignal)
  })
})
