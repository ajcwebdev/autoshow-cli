import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-gemini/run-gemini-video-gen'
import { runGeminiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { geminiGetOperation } from '~/utils/gemini/gemini-rest'
import { installMockFetch as installFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'

const { audioBase64, audioBytes, videoBytes, withTempDir } = setupGeminiRestContractFixture()

describe('Gemini REST contracts', () => {
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

  test('Gemini Veo normalizes only published raw REST response spellings', async () => {
    const inlineVideo = Buffer.from(videoBytes).toString('base64')
    let requestCount = 0
    installFetch(() => {
      requestCount += 1
      if (requestCount === 1) {
        return jsonResponse({
          name: 'operations/veo-canonical',
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [
                { video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-file' } },
                { video: { encodedVideo: inlineVideo, encoding: 'video/mp4' } },
                { video: { videoBytes: 'sdk-bytes', mimeType: 'video/webm' } },
                { _self: { gcsUri: 'gs://vertex-output/video.mp4', mimeType: 'video/mp4' } }
              ],
              generatedVideos: [{ video: { uri: 'https://example.com/sdk-video' } }]
            }
          }
        })
      }
      return jsonResponse({
        name: 'operations/veo-unwrapped',
        done: true,
        response: {
          generatedSamples: [{ video: { uri: 'https://example.com/unwrapped-video' } }],
          generatedVideos: [{ video: { uri: 'https://example.com/sdk-video' } }]
        }
      })
    })

    const canonical = await geminiGetOperation('gemini-key', 'operations/veo-canonical')
    const unwrapped = await geminiGetOperation('gemini-key', 'operations/veo-unwrapped')

    expect(canonical.response?.generatedVideos).toEqual([
      { video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-file' } },
      { video: { videoBytes: inlineVideo, mimeType: 'video/mp4' } }
    ])
    expect(unwrapped.response).toBeUndefined()
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
