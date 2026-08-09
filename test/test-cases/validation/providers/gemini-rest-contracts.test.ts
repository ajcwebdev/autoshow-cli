import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata, LogSinkEvent } from '~/types'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGeminiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/run-gemini-stt'
import { runGeminiModel } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/run-gemini'
import { runGeminiTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-gemini/run-gemini-tts'
import { parseSpeakerVoiceMappings } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-gemini/run-gemini-video-gen'
import { runGeminiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { geminiGenerateContent, GeminiRestError } from '~/utils/gemini/gemini-rest'
import { l } from '~/utils/app-logger/app-logger'
import {
  installMockFetch as installFetch,
  jsonResponse,
  setupContractSuiteLifecycle
} from '../../../test-utils/rest-contract-helpers'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'

const envKeys = ['GEMINI_API_KEY']
const tempDirs = setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-gemini-rest-' })
const withTempDir = tempDirs.withDir

const audioBytes = new Uint8Array([1, 2, 3, 4])
const audioBase64 = Buffer.from(audioBytes).toString('base64')
const videoBytes = new Uint8Array([5, 4, 3, 2])

const captureLogEvents = async <T>(
  run: () => Promise<T>
): Promise<{ result: T, events: LogSinkEvent[] }> => {
  const originalSinks = [...l.config.sinks]
  const events: LogSinkEvent[] = []
  l.config.sinks.length = 0
  l.config.sinks.push((event) => {
    events.push(event)
  })

  try {
    return {
      result: await run(),
      events
    }
  } finally {
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
  }
}

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

    try {
      await geminiGenerateContent('gemini-key', {
        model: 'gemini-test',
        contents: 'retry?'
      })
      throw new Error('expected Gemini request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiRestError)
      expect((error as GeminiRestError).status).toBe(429)
      expect((error as GeminiRestError).headers.get('retry-after')).toBe('1')
      expect(classifyGeminiRetry(error)).toMatchObject({ shouldRetry: true, reason: 'retryable status 429' })
    }
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

    const result = await runGeminiModel('Write a title.', 'gemini-3.1-flash-lite', {
      strategy: 'schema-guided',
      schemaName: 'Title',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      }
    })

    expect(result.result).toBe('{"title":"Done"}')
    expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent')
    expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      }
    })
    expect(requestSignal).toBeInstanceOf(AbortSignal)
  })

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
      const result = await runGeminiOcr(imagePath, metadata, 'gemini-3.5-flash')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
      expect(result.promptTokens).toBe(12)
      expect(result.completionTokens).toBe(12)
      expect(result.providerUsage).toEqual([{
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        attempt: 1,
        usageRole: 'success',
        purpose: 'ocr-page',
        promptTokens: 12,
        completionTokens: 12,
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 7 }
      }])
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent')
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
      }, 'gemini-2.5-flash')

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
      const warnings = events.filter((event) => event.level === 'warn').map((event) => event.message)
      expect(warnings).toEqual([
        'Gemini OCR returned malformed output for page-000660.png on attempt 1/3 (7 output tokens) (Gemini OCR returned no pages.); retrying'
      ])
      expect(warnings[0]).not.toContain('{"pages":[]}')
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

  test('Gemini TTS sends single and multispeaker speechConfig and extracts audio', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const wavBase64 = createMockWavBase64()
    const calls = installFetch(() => jsonResponse({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'audio/wav', data: wavBase64 } }]
        }
      }]
    }))

    await withTempDir(async (dir) => {
      const result = await runGeminiTts('Single speaker sample.', dir, {
        model: 'gemini-3.1-flash-tts-preview',
        voiceId: 'Kore'
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
    })
    await withTempDir(async (dir) => {
      const result = await runGeminiTts('Host: Hello.\nGuest: Hi.', dir, {
        model: 'gemini-3.1-flash-tts-preview',
        speakerVoiceRegistry: parseSpeakerVoiceMappings(['Host=Kore', 'Guest=Puck'])
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
    })

    expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Kore'
          }
        }
      }
    })
    expect(calls[1]?.bodyJson?.['generationConfig']).toMatchObject({
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            { speaker: 'Guest', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
          ]
        }
      }
    })
  }, 20_000)

  test('Gemini Veo polls long-running operations and downloads generated video files', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch((call) => {
      if (call.url.endsWith('/models/veo-3.1-lite-generate-preview:predictLongRunning')) {
        expect(call.bodyJson).toEqual({
          instances: [{ prompt: 'rain over city' }],
          parameters: {
            sampleCount: 1,
            durationSeconds: 4,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        })
        return jsonResponse({ name: 'operations/veo-123', done: false })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/operations/veo-123') {
        return jsonResponse({
          name: 'operations/veo-123',
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [{
                video: {
                  uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-file'
                }
              }]
            }
          }
        })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/video-file:download?alt=media') {
        return new Response(videoBytes, { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      throw new Error(`Unexpected Gemini video fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runGeminiVideoGen('rain over city', dir, {
        model: 'veo-3.1-lite-generate-preview',
        durationSeconds: 4,
        resolution: '720p',
        aspectRatio: '16:9'
      })
      expect(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer())).toEqual(videoBytes)
    })

    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'GET'])
  })

  test('Gemini Lyria writes inline audio and preserves generated text metadata', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch(() => jsonResponse({
      candidates: [{
        content: {
          parts: [
            { text: '[Verse]\nSilver static in the sky' },
            { inlineData: { mimeType: 'audio/mpeg', data: audioBase64 } }
          ]
        }
      }]
    }))

    await withTempDir(async (dir) => {
      const lyricsPath = join(dir, 'lyrics.txt')
      await writeFile(lyricsPath, 'Bright lights tonight')
      const result = await runGeminiMusicGen('90s pop rock', dir, {
        model: 'lyria-3-pro-preview',
        durationSeconds: 120,
        lyricsFile: lyricsPath
      })

      expect(new Uint8Array(await Bun.file(result.musicPath).arrayBuffer())).toEqual(audioBytes)
      expect(result.metadata).toMatchObject({
        lyricsSource: 'provided',
        musicDurationMs: 120_000,
        audioMimeType: 'audio/mpeg',
        outputFormat: 'mp3',
        generatedText: '[Verse]\nSilver static in the sky'
      })
    })

    const prompt = ((((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)[0]?.['text'])
    expect(prompt).toContain('90s pop rock')
    expect(prompt).toContain('Create a song that is about 120 seconds long.')
    expect(prompt).toContain('Lyrics:\nBright lights tonight')
  })
})
