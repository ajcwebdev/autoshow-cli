import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGeminiStt } from '~/cli/commands/stt/diarization/gemini-stt/run-gemini-stt'
import { requireDefined } from '../../../test-utils/value-assertions'
import { installMockFetch as installFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'
import type { MockFetchCall } from '~/types'

const { withTempDir } = setupGeminiRestContractFixture()
const GEMINI_TRANSCRIBE_MODEL = 'gemini-3.5-transcribe'
const FILE_URI = 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload'

const completedTranscribeInteraction = (overrides: Record<string, unknown> = {}) => ({
  id: 'interactions/abc123xyz',
  status: 'completed',
  output_text: 'Hello world',
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6 },
  steps: [{
    id: 'step_001',
    type: 'model_output',
    content: [{
      type: 'text',
      text: 'Hello world',
      annotations: [
        { type: 'word_info', text: 'Hello', speaker: 'spk_1', start_offset: '0.100s', end_offset: '0.450s' },
        { type: 'word_info', text: 'world', speaker: 'spk_1', start_offset: '0.500s', end_offset: '0.850s' }
      ]
    }]
  }],
  ...overrides
})

const installGeminiTranscribeMocks = (options: {
  interaction?: unknown | ((call: MockFetchCall) => unknown)
  fileMimeType?: string
} = {}) => {
  const fileMimeType = options.fileMimeType ?? 'audio/mp3'
  return installFetch((call) => {
    if (call.url === 'https://generativelanguage.googleapis.com/upload/v1beta/files') {
      return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.gemini.test/session' } })
    }
    if (call.url === 'https://upload.gemini.test/session') {
      const command = call.headers.get('x-goog-upload-command')
      return new Response(command === 'upload' ? '{}' : JSON.stringify({
        file: {
          name: 'files/gemini-upload',
          uri: FILE_URI,
          mimeType: fileMimeType
        }
      }), {
        status: 200,
        headers: { 'x-goog-upload-status': command === 'upload' ? 'active' : 'final' }
      })
    }
    if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'GET') {
      return jsonResponse({ name: 'files/gemini-upload', state: 'ACTIVE' })
    }
    if (call.url === 'https://generativelanguage.googleapis.com/v1beta/interactions' && call.method === 'POST') {
      const interaction = typeof options.interaction === 'function'
        ? options.interaction(call)
        : (options.interaction ?? completedTranscribeInteraction())
      return jsonResponse(interaction)
    }
    if (call.url === 'https://generativelanguage.googleapis.com/v1beta/interactions/abc123xyz' && call.method === 'GET') {
      return jsonResponse(completedTranscribeInteraction())
    }
    if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'DELETE') {
      return jsonResponse({})
    }
    throw new Error(`Unexpected Gemini STT fetch: ${call.method} ${call.url}`)
  })
}

const transcriptionConfigFromCall = (call: MockFetchCall | undefined): Record<string, unknown> => {
  const generationConfig = call?.bodyJson?.['generation_config'] as Record<string, unknown> | undefined
  return (generationConfig?.['transcription_config'] as Record<string, unknown> | undefined) ?? {}
}

describe('Gemini REST contracts', () => {
  test('Gemini STT uploads audio and transcribes through the Interactions API with speaker diarization', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      const calls = installGeminiTranscribeMocks()

      const result = await runGeminiStt(audioPath, dir, {
        model: GEMINI_TRANSCRIBE_MODEL,
        segmentOffsetMinutes: 0,
        audioDurationSeconds: 1
      })

      expect(result.result.text).toBe('Hello world')
      expect(result.result.segments.map((segment) => segment.speaker)).toEqual(['speaker-1'])
      expect(result.result.evidence).toMatchObject({
        source: 'gemini:native-transcribe',
        timingQuality: 'native_word',
        capabilities: { hasNativeWordTiming: true, hasSpeakerLabels: true }
      })
      const start = calls.find((call) => call.url.endsWith('/upload/v1beta/files'))
      expect(start?.bodyJson).toMatchObject({
        file: { mimeType: 'audio/mp3', displayName: 'clip.mp3' }
      })
      const interactionCall = calls.find((call) => call.url.endsWith('/v1beta/interactions') && call.method === 'POST')
      expect(interactionCall?.bodyJson).toMatchObject({
        model: GEMINI_TRANSCRIBE_MODEL,
        input: [{ type: 'audio', uri: FILE_URI, mime_type: 'audio/mp3' }]
      })
      expect(transcriptionConfigFromCall(interactionCall)).toEqual({
        mode: {
          type: 'verbatim',
          timestamp_granularities: ['word'],
          diarization_mode: 'speaker'
        }
      })
      expect(transcriptionConfigFromCall(interactionCall)).not.toHaveProperty('custom_vocabulary')
      expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/files/gemini-upload'))).toBe(true)
      expect(calls.some((call) => call.url.includes(':generateContent'))).toBe(false)
    })
  })

  test('Gemini STT omits diarization_mode when diarization is disabled and still requests word timestamps', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      const calls = installGeminiTranscribeMocks({
        interaction: completedTranscribeInteraction({
          steps: [{
            id: 'step_001',
            type: 'model_output',
            content: [{
              type: 'text',
              text: 'Hello world',
              annotations: [
                { type: 'word_info', text: 'Hello', start_offset: '0.100s', end_offset: '0.450s' },
                { type: 'word_info', text: 'world', start_offset: '0.500s', end_offset: '0.850s' }
              ]
            }]
          }]
        })
      })

      const result = await runGeminiStt(audioPath, dir, {
        model: GEMINI_TRANSCRIBE_MODEL,
        segmentOffsetMinutes: 0,
        diarizationOptions: { enabled: false }
      })

      expect(result.result.segments.every((segment) => segment.speaker === undefined)).toBe(true)
      const interactionCall = calls.find((call) => call.url.endsWith('/v1beta/interactions') && call.method === 'POST')
      expect(transcriptionConfigFromCall(interactionCall)).toEqual({
        mode: {
          type: 'verbatim',
          timestamp_granularities: ['word']
        }
      })
      expect(transcriptionConfigFromCall(interactionCall)['mode']).not.toHaveProperty('diarization_mode')
    })
  })

  test('Gemini STT rejects Flash models, failed interactions, and incompatible transcription modes before a usable transcript', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      await expect(runGeminiStt(audioPath, dir, {
        model: 'gemini-3.8-flash',
        segmentOffsetMinutes: 0
      })).rejects.toThrow('gemini-3.5-transcribe')

      const calls = installGeminiTranscribeMocks({
        interaction: { id: 'interactions/abc123xyz', status: 'failed' }
      })
      await expect(runGeminiStt(audioPath, dir, {
        model: GEMINI_TRANSCRIBE_MODEL,
        segmentOffsetMinutes: 0
      })).rejects.toThrow('failed')
      expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/files/gemini-upload'))).toBe(true)
      const interactionCall = calls.find((call) => call.url.endsWith('/v1beta/interactions') && call.method === 'POST')
      expect(transcriptionConfigFromCall(interactionCall)).not.toHaveProperty('custom_vocabulary')
      expect(transcriptionConfigFromCall(interactionCall)['mode']).not.toBe('smart')
    })
  })

  test('Gemini STT polls in-progress interactions before parsing word annotations', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      const calls = installGeminiTranscribeMocks({
        interaction: { id: 'interactions/abc123xyz', status: 'in_progress' }
      })

      const result = await runGeminiStt(audioPath, dir, {
        model: GEMINI_TRANSCRIBE_MODEL,
        segmentOffsetMinutes: 0
      })

      expect(result.result.text).toBe('Hello world')
      expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/interactions/abc123xyz'))).toBe(true)
    })
  })

  for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
    test(`Gemini OCR sends inline document content parts and structured schema (${model})`, async () => {
      process.env['GEMINI_API_KEY'] = 'gemini-key'
      await withTempDir(async (dir) => {
        const imagePath = join(dir, 'page.png')
        await writeFile(imagePath, new Uint8Array([8, 7, 6]))
        const calls = installFetch(() => jsonResponse({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }) }]
            }
          }],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 7 }
        }))

        const metadata: DocumentMetadata = {
          slug: 'page',
          pageCount: 1,
          format: 'png',
          fileSize: 3
        }
        const result = await runGeminiOcr(imagePath, metadata, model)

        expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
        expect(result.promptTokens).toBe(12)
        expect(result.completionTokens).toBe(12)
        expect(result.providerUsage).toEqual([{
          provider: 'gemini',
          model,
          attempt: 1,
          usageRole: 'success',
          purpose: 'ocr-page',
          promptTokens: 12,
          completionTokens: 12,
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 7 }
        }])
        for (const key of ['temperature', 'topP', 'topK', 'candidateCount']) {
          expect(calls[0]?.bodyJson?.['generationConfig']).not.toHaveProperty(key)
        }
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
        const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
        expect(parts[0]).toMatchObject({ text: expect.stringContaining('Perform OCR') })
        expect(parts[1]).toMatchObject({
          inlineData: {
            mimeType: 'image/png',
            data: Buffer.from(new Uint8Array([8, 7, 6])).toString('base64')
          }
        })
        expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingLevel: 'LOW'
          }
        })
      })
    })
  }

  for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
    test(`Gemini OCR caps multi-page max output tokens (${model})`, async () => {
      process.env['GEMINI_API_KEY'] = 'gemini-key'
      await withTempDir(async (dir) => {
        const pdfPath = join(dir, 'document.pdf')
        await writeFile(pdfPath, new Uint8Array([37, 80, 68, 70]))
        const calls = installFetch(() => jsonResponse({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  pages: [
                    { pageNumber: 1, text: 'one' },
                    { pageNumber: 2, text: 'two' },
                    { pageNumber: 3, text: 'three' }
                  ]
                })
              }]
            }
          }]
        }))

        await runGeminiOcr(pdfPath, {
          slug: 'document',
          pageCount: 3,
          format: 'pdf',
          fileSize: 4
        }, model)

        expect(calls[0]?.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
        const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
        expect(parts[1]).toMatchObject({ inlineData: { mimeType: 'application/pdf' } })
        expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
          responseMimeType: 'application/json',
          maxOutputTokens: 65536
        })
      })
    })
  }

  test('Gemini OCR rolls schema-retry thought tokens into usage totals', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page-000660.png')
      await writeFile(imagePath, new Uint8Array([8, 7, 6]))
      let responses = 0
      const calls = installFetch(() => {
        responses += 1
        return jsonResponse(responses === 1
          ? {
              candidates: [{ content: { parts: [{ text: '{"pages":[]}' }] } }],
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 4 }
            }
          : {
              candidates: [{
                content: {
                  parts: [{ text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }) }]
                }
              }],
              usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, thoughtsTokenCount: 6 }
            })
      })

      const { result, events } = await captureLogEvents(async () => await runGeminiOcr(imagePath, {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }, 'gemini-3.5-flash'))

      expect(result.promptTokens).toBe(30)
      expect(result.completionTokens).toBe(18)
      expect(result.providerUsage?.map((entry) => ({
        usageRole: entry['usageRole'],
        promptTokens: entry['promptTokens'],
        completionTokens: entry['completionTokens'],
        thoughtsTokenCount: (entry['usageMetadata'] as Record<string, unknown>)['thoughtsTokenCount']
      }))).toEqual([
        { usageRole: 'schema-retry', promptTokens: 10, completionTokens: 7, thoughtsTokenCount: 4 },
        { usageRole: 'success', promptTokens: 20, completionTokens: 11, thoughtsTokenCount: 6 }
      ])
      expect(calls.map((call) => (call.bodyJson?.['generationConfig'] as Record<string, unknown> | undefined)?.['maxOutputTokens'])).toEqual([
        8192,
        8192
      ])
      const retryEvents = events.filter((event) => event.level === 'warn' && event.metadata?.['reasonCode'] === 'invalid_response_reask')
      expect(retryEvents).toHaveLength(1)
      const retryMetadata = requireDefined(retryEvents[0], 'schema retry event').metadata as Record<string, unknown>
      expect(retryMetadata).toMatchObject({
        operation: 'gemini-ocr',
        admittedResponse: 1,
        maxAdmittedResponses: 3,
        reasonCode: 'invalid_response_reask',
        provider: 'gemini',
        pageCount: 1,
        pageNumber: 1,
        failureReason: 'Gemini OCR returned no pages.',
        malformedOutput: 'Gemini OCR returned malformed output for page-000660.png on attempt 1/3 (7 output tokens) (Gemini OCR returned no pages.); retrying'
      })
      expect(JSON.stringify(retryMetadata)).not.toContain('{\"pages\":[]}')
      expect(events.filter((event) => event.level === 'warn')).toHaveLength(1)
    })
  })

  test('Gemini STT uploads large files with 8 MiB chunks, uses fileData, and deletes uploads', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'long.mp3')
      const largeAudio = new Uint8Array(16 * 1024 * 1024 + 1)
      largeAudio[largeAudio.length - 1] = 7
      await writeFile(audioPath, largeAudio)

      const calls = installFetch((call) => {
        if (call.url === 'https://generativelanguage.googleapis.com/upload/v1beta/files') {
          expect(call.headers.get('x-goog-upload-protocol')).toBe('resumable')
          expect(call.headers.get('x-goog-upload-header-content-length')).toBe(String(largeAudio.byteLength))
          expect(call.bodyJson).toMatchObject({
            file: {
              mimeType: 'audio/mp3',
              displayName: 'long.mp3',
              sizeBytes: String(largeAudio.byteLength)
            }
          })
          return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.gemini.test/session' } })
        }
        if (call.url === 'https://upload.gemini.test/session') {
          const command = call.headers.get('x-goog-upload-command')
          return new Response(command === 'upload' ? '{}' : JSON.stringify({
            file: {
              name: 'files/gemini-upload',
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload',
              mimeType: 'audio/mp3'
            }
          }), {
            status: 200,
            headers: { 'x-goog-upload-status': command === 'upload' ? 'active' : 'final' }
          })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'GET') {
          return jsonResponse({ name: 'files/gemini-upload', state: 'ACTIVE' })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/interactions' && call.method === 'POST') {
          expect(call.bodyJson).toMatchObject({
            model: GEMINI_TRANSCRIBE_MODEL,
            input: [{
              type: 'audio',
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload',
              mime_type: 'audio/mp3'
            }]
          })
          return jsonResponse(completedTranscribeInteraction({ output_text: 'uploaded audio' }))
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'DELETE') {
          return jsonResponse({})
        }
        throw new Error(`Unexpected Gemini STT fetch: ${call.method} ${call.url}`)
      })

      const result = await runGeminiStt(audioPath, dir, {
        model: GEMINI_TRANSCRIBE_MODEL,
        segmentOffsetMinutes: 0,
        audioDurationSeconds: 1
      })

      expect(result.result.text).toBe('uploaded audio')
      expect(calls.filter((call) => call.url === 'https://upload.gemini.test/session').map((call) => ({
        command: call.headers.get('x-goog-upload-command'),
        offset: call.headers.get('x-goog-upload-offset'),
        bytes: call.bodyBytes
      }))).toEqual([
        { command: 'upload', offset: '0', bytes: 8 * 1024 * 1024 },
        { command: 'upload', offset: String(8 * 1024 * 1024), bytes: 8 * 1024 * 1024 },
        { command: 'upload, finalize', offset: String(16 * 1024 * 1024), bytes: 1 }
      ])
      expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/files/gemini-upload'))).toBe(true)
    })
  }, 20_000)
})
