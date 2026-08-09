import { describe, expect, test } from 'bun:test'
import { runMistralOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/run-mistral-ocr'
import { runMistralStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/run-mistral-stt'
import type { DocumentMetadata } from '~/types'
import { mistralJsonRequest, normalizeMistralBaseUrl } from '~/utils/mistral/mistral-client'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const envKeys = ['MISTRAL_API_KEY']
const tempDirs = setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-mistral-rest-' })

describe('Mistral REST contracts', () => {
  test('base URL normalization accepts hosts with or without /v1', () => {
    expect(normalizeMistralBaseUrl('https://api.mistral.ai')).toBe('https://api.mistral.ai/v1')
    expect(normalizeMistralBaseUrl('https://api.mistral.ai/v1')).toBe('https://api.mistral.ai/v1')
    expect(normalizeMistralBaseUrl('https://mock.mistral.local/proxy/')).toBe('https://mock.mistral.local/proxy/v1')
  })

  test('STT sends documented multipart fields and parses segment responses', async () => {
    const dir = await tempDirs.make('autoshow-mistral-stt-rest-')
    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    const calls = installMockFetch(() => Response.json({
        model: 'voxtral-mini-latest',
        text: 'Hello from Mistral.',
        language: 'en',
        segments: [
          { start: 1.2, end: 2.8, text: 'Hello from Mistral.', speaker_id: 'speaker-a' }
        ]
    }))

    const { result, metadata } = await runMistralStt('input/examples/audio/0-audio-short.mp3', dir, {
      model: 'voxtral-mini-latest',
      segmentOffsetMinutes: 1,
      baseUrl: 'https://mock.mistral.local'
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.mistral.local/v1/audio/transcriptions',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer mistral-key')
    expect(calls[0]?.form?.get('model')).toBe('voxtral-mini-latest')
    expect(calls[0]?.form?.get('diarize')).toBe('true')
    expect(calls[0]?.form?.getAll('timestamp_granularities')).toEqual(['segment'])
    const file = calls[0]?.form?.get('file')
    expect(file).toBeInstanceOf(File)
    expect(file).toMatchObject({ name: '0-audio-short.mp3' })
    expect((file as File).size).toBeGreaterThan(0)
    expect(result.text).toBe('Hello from Mistral.')
    expect(result.segments[0]).toMatchObject({
      start: '00:01:01.200',
      end: '00:01:02.800',
      speaker: 'speaker-a',
      text: 'Hello from Mistral.'
    })
    expect(metadata).toMatchObject({
      transcriptionService: 'mistral',
      transcriptionModel: 'voxtral-mini-latest',
      timings: { requestCount: 1 }
    })
  }, 10_000)

  test('STT reports retry and rate-limit counts through the shared hosted finalizer', async () => {
    const dir = await tempDirs.make('autoshow-mistral-stt-retry-')
    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    const calls = installMockFetch(() => calls.length === 1
      ? Response.json({ message: 'rate limited' }, {
          status: 429,
          headers: { 'retry-after': '0.001' }
        })
      : Response.json({
          model: 'voxtral-mini-latest',
          text: 'Recovered transcription.',
          segments: [{ start: 0, end: 1, text: 'Recovered transcription.' }]
        }))

    const { metadata } = await runMistralStt('input/examples/audio/0-audio-short.mp3', dir, {
      model: 'voxtral-mini-latest',
      segmentOffsetMinutes: 0,
      baseUrl: 'https://mock.mistral.local'
    })

    expect(calls).toHaveLength(2)
    expect(metadata.timings).toMatchObject({
      requestCount: 2,
      retryCount: 1,
      rateLimitCount: 1
    })
  }, 10_000)

  test('OCR sends snake_case JSON document bodies for PDFs and images', async () => {
    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    const calls = installMockFetch((call) => Response.json({
        model: call.bodyJson?.['model'],
        pages: [{ index: calls.length, markdown: `page ${calls.length}` }],
        usage_info: { pages_processed: 1, doc_size_bytes: 10 }
    }))

    const pdfMetadata: DocumentMetadata = {
      slug: 'sample-pdf',
      pageCount: 1,
      format: 'pdf',
      fileSize: 10
    }
    const imageMetadata: DocumentMetadata = {
      slug: 'sample-image',
      pageCount: 1,
      format: 'png',
      fileSize: 10
    }

    const pdfResult = await runMistralOcr('input/examples/document/1-document.pdf', pdfMetadata, 'mistral-ocr-4-0', { baseURL: 'https://mock.mistral.local/v1/' })
    const imageResult = await runMistralOcr('input/examples/document/1-document.png', imageMetadata, 'mistral-ocr-4-0', { baseURL: 'https://mock.mistral.local/v1/' })

    expect(pdfResult.pages[0]).toMatchObject({ pageNumber: 1, method: 'ocr', text: 'page 1' })
    expect(imageResult.pages[0]).toMatchObject({ pageNumber: 2, method: 'ocr', text: 'page 2' })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.mistral.local/v1/ocr',
      method: 'POST',
      bodyJson: {
        model: 'mistral-ocr-4-0',
        include_image_base64: false
      }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer mistral-key')
    expect(calls[0]?.bodyJson?.['document']).toMatchObject({
      type: 'document_url'
    })
    expect(String((calls[0]?.bodyJson?.['document'] as Record<string, unknown>)['document_url']))
      .toStartWith('data:application/pdf;base64,')
    expect(calls[1]?.bodyJson?.['document']).toMatchObject({
      type: 'image_url'
    })
    expect(String((calls[1]?.bodyJson?.['document'] as Record<string, unknown>)['image_url']))
      .toStartWith('data:image/png;base64,')
  }, 10_000)

  test('HTTP errors preserve status and headers for retry classification', async () => {
    process.env['MISTRAL_API_KEY'] = 'mistral-key'
    const calls = installMockFetch(() => Response.json({ message: 'rate limited' }, {
        status: 429,
        headers: { 'retry-after': '7' }
    }))

    try {
      await mistralJsonRequest({
        apiKey: 'mistral-key',
        baseURL: 'https://mock.mistral.local',
        path: '/audio/speech',
        errorMessagePrefix: 'Mistral TTS failed',
        body: { input: 'hello' }
      })
      throw new Error('Expected Mistral request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { status?: number }).status).toBe(429)
      expect((error as { headers?: Headers }).headers?.get('retry-after')).toBe('7')
      expect((error as Error).message).toContain('rate limited')
    }

    expect(calls.map((call) => call.url)).toEqual(['https://mock.mistral.local/v1/audio/speech'])
  })
})
