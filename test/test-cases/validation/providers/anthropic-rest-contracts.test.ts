import { describe, expect, test } from 'bun:test'
import { runAnthropicModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-anthropic/run-anthropic'
import type { StructuredRequestOptions } from '~/types'
import {
  ANTHROPIC_FILES_API_BETA,
  createAnthropicMessage,
  deleteAnthropicFile,
  uploadAnthropicFile
} from '~/utils/anthropic/anthropic-client'
import { expectProviderHttpError, installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const envKeys = ['ANTHROPIC_API_KEY']

setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-anthropic-rest-' })

const structuredOpts: StructuredRequestOptions = {
  schemaName: 'summary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: {
      summary: { type: 'string' }
    }
  },
  strict: true,
  strategy: 'native'
}

describe('Anthropic REST contracts', () => {
  test('Anthropic write sends documented message headers and extracts text blocks', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'anthropic-key'

    const calls = installMockFetch(() => Response.json({
        id: 'msg_1',
        type: 'message',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'thinking', thinking: 'hidden' },
          { type: 'text', text: 'from Claude.' }
        ],
        usage: { input_tokens: 11, output_tokens: 3 }
    }))

    const result = await runAnthropicModel('Summarize this.', 'claude-haiku-4-5', structuredOpts)

    expect(result.result).toBe('Hello from Claude.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      bodyJson: {
        model: 'claude-haiku-4-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: 'Summarize this.' }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: structuredOpts.schema
          }
        }
      }
    })
    expect(calls[0]?.headers.get('x-api-key')).toBe('anthropic-key')
    expect(calls[0]?.headers.get('anthropic-version')).toBe('2023-06-01')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    expect(calls[0]?.headers.get('anthropic-beta')).toBeNull()
  })

  test('Anthropic write merges normalized effort with structured output_config', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'anthropic-key'
    const calls = installMockFetch(() => Response.json({
      content: [{ type: 'text', text: '{"summary":"done"}' }],
      usage: { input_tokens: 11, output_tokens: 3 }
    }))

    const result = await runAnthropicModel('Summarize this.', 'claude-sonnet-4-6', {
      ...structuredOpts,
      requestedReasoningEffort: 'medium'
    })

    expect(calls[0]?.bodyJson?.['output_config']).toEqual({
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: structuredOpts.schema
      }
    })
    expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
    expect(result.metadata).toMatchObject({
      requestedReasoningEffort: 'medium',
      effectiveReasoningEffort: 'medium'
    })
  })

  test('message responses expose Anthropic usage token fields', async () => {
    installMockFetch(() => Response.json({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 123, output_tokens: 45 }
    }))

    const message = await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local/v1' },
      {
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    )

    expect(message.usage?.input_tokens).toBe(123)
    expect(message.usage?.output_tokens).toBe(45)
  })

  test('Files upload uses multipart form data with beta header and no manual content-type', async () => {
    const calls = installMockFetch(() => Response.json({
        id: 'file_123',
        type: 'file',
        filename: 'document.pdf',
        mime_type: 'application/pdf',
        size_bytes: 7,
        created_at: '2025-01-01T00:00:00Z',
        downloadable: false
    }))

    const uploaded = await uploadAnthropicFile(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      new File(['pdf-ish'], 'document.pdf', { type: 'application/pdf' })
    )

    expect(uploaded.id).toBe('file_123')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.anthropic.local/v1/files',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('x-api-key')).toBe('anthropic-key')
    expect(calls[0]?.headers.get('anthropic-version')).toBe('2023-06-01')
    expect(calls[0]?.headers.get('anthropic-beta')).toBe(ANTHROPIC_FILES_API_BETA)
    expect(calls[0]?.headers.get('content-type')).toBeNull()
    const file = calls[0]?.form?.get('file')
    expect(file).toBeInstanceOf(File)
    expect(file).toMatchObject({ name: 'document.pdf', type: 'application/pdf', size: 7 })
  })

  test('file-backed PDF messages use beta headers and document file_id sources', async () => {
    const calls = installMockFetch(() => Response.json({
        content: [{ type: 'text', text: '{"pages":[{"pageNumber":1,"text":"ok"}]}' }],
        usage: { input_tokens: 10, output_tokens: 5 }
    }))

    await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      {
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'OCR this.' },
            {
              type: 'document',
              source: {
                type: 'file',
                file_id: 'file_123'
              }
            }
          ]
        }]
      },
      { beta: ANTHROPIC_FILES_API_BETA }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://mock.anthropic.local/v1/messages')
    expect(calls[0]?.headers.get('anthropic-beta')).toBe(ANTHROPIC_FILES_API_BETA)
    const messages = calls[0]?.bodyJson?.['messages'] as Array<{ content: Array<Record<string, unknown>> }>
    expect(messages[0]?.content[1]).toMatchObject({
      type: 'document',
      source: {
        type: 'file',
        file_id: 'file_123'
      }
    })
    expect(calls[0]?.bodyJson?.['betas']).toBeUndefined()
  })

  test('delete calls DELETE /v1/files/{file_id} with the Files API beta header', async () => {
    const calls = installMockFetch(() => Response.json({ id: 'file_123', type: 'file_deleted' }))

    await deleteAnthropicFile(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      'file_123'
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.anthropic.local/v1/files/file_123',
      method: 'DELETE'
    })
    expect(calls[0]?.headers.get('anthropic-beta')).toBe(ANTHROPIC_FILES_API_BETA)
    expect(calls[0]?.headers.get('content-type')).toBeNull()
  })

  test('HTTP errors preserve status, headers, and response body for retry classification', async () => {
    installMockFetch(() => Response.json({
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'slow down'
        }
      }, {
        status: 429,
        headers: { 'retry-after': '7' }
      }))

    const error = await expectProviderHttpError(async () => await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      {
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    ), {
      status: 429,
      headers: { 'retry-after': '7' },
      messageContains: 'slow down'
    })
    expect((error as { body?: string }).body).toContain('rate_limit_error')
    expect((error as { errorType?: string }).errorType).toBe('rate_limit_error')
  })
})
