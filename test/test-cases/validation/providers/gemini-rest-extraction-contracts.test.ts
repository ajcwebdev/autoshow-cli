import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGeminiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/run-gemini-stt'
import { requireDefined } from '../../../test-utils/value-assertions'
import { installMockFetch as installFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'

const { withTempDir } = setupGeminiRestContractFixture()

describe('Gemini REST contracts', () => {
  test('Gemini STT sends inline audio content parts and structured schema', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      const calls = installFetch(() => jsonResponse({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                text: 'hello world',
                segments: [{ start: 0, end: 1, text: 'hello world' }]
              })
            }]
          }
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6 }
      }))

      const result = await runGeminiStt(audioPath, dir, {
        model: 'gemini-3.6-flash',
        segmentOffsetMinutes: 0,
        audioDurationSeconds: 1
      })

      expect(result.result.text).toBe('hello world')
      expect(calls).toHaveLength(1)
      const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
      expect(parts[0]).toMatchObject({ text: expect.stringContaining('Transcribe the provided audio exactly') })
      expect(parts[1]).toMatchObject({
        inlineData: {
          mimeType: 'audio/mpeg',
          data: Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
        }
      })
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
        responseMimeType: 'application/json'
      })
    })
  })

  test('Gemini OCR sends inline document content parts and structured schema', async () => {
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
      const result = await runGeminiOcr(imagePath, metadata, 'gemini-3.5-flash-lite')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
      expect(result.promptTokens).toBe(12)
      expect(result.completionTokens).toBe(12)
      expect(result.providerUsage).toEqual([{
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        attempt: 1,
        usageRole: 'success',
        purpose: 'ocr-page',
        promptTokens: 12,
        completionTokens: 12,
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 7 }
      }])
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
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

  test('Gemini OCR caps multi-page max output tokens', async () => {
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
      }, 'gemini-3.5-flash-lite')

      expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
      const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
      expect(parts[1]).toMatchObject({ inlineData: { mimeType: 'application/pdf' } })
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
        responseMimeType: 'application/json',
        maxOutputTokens: 65536
      })
    })
  })

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
      const retryEvents = events.filter((event) => event.level === 'warn' && event.message === 'Retry Attempt')
      expect(retryEvents).toHaveLength(1)
      const retryMetadata = requireDefined(retryEvents[0], 'schema retry event').metadata as Record<string, unknown>
      expect(retryMetadata).toMatchObject({
        operation: 'gemini-ocr',
        attempt: 1,
        maxAttempts: 3,
        reason: 'structured_response',
        provider: 'gemini',
        pageCount: 1,
        pageNumber: 1,
        retryClass: 'runtime_http_create_retriable',
        failureReason: 'Gemini OCR returned no pages.',
        ocrSchemaAttempts: 3,
        ocrCreateAttempts: 4,
        maxPaidRequests: 12,
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
              mimeType: 'audio/mpeg',
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
              mimeType: 'audio/mpeg'
            }
          }), {
            status: 200,
            headers: { 'x-goog-upload-status': command === 'upload' ? 'active' : 'final' }
          })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'GET') {
          return jsonResponse({ name: 'files/gemini-upload', state: 'ACTIVE' })
        }
        if (call.url.endsWith(':generateContent')) {
          const parts = (((call.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
          expect(parts[1]).toEqual({
            fileData: {
              fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload',
              mimeType: 'audio/mpeg'
            }
          })
          return jsonResponse({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    text: 'uploaded audio',
                    segments: [{ start: 0, end: 1, text: 'uploaded audio' }]
                  })
                }]
              }
            }],
            usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 }
          })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'DELETE') {
          return jsonResponse({})
        }
        throw new Error(`Unexpected Gemini STT fetch: ${call.method} ${call.url}`)
      })

      const result = await runGeminiStt(audioPath, dir, {
        model: 'gemini-3.6-flash',
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
