import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGeminiVideoGen } from '~/cli/commands/visuals/video/video-services/video-gemini/run-gemini-video-gen'
import { runGeminiMusicGen } from '~/cli/commands/audio/music/music-services/music-gemini/run-gemini-music-gen'
import { geminiGetOperation } from '~/utils/gemini/gemini-rest'
import { installMockFetch as installFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'

const { audioBase64, audioBytes, videoBytes, withTempDir } = setupGeminiRestContractFixture()

describe('Gemini REST contracts', () => {
  test('Gemini Omni creates an interaction and downloads URI-delivered video files', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch((call) => {
      if (call.url.endsWith('/interactions') && call.method === 'POST') {
        expect(call.bodyJson).toMatchObject({
          model: 'gemini-omni-1.1-flash',
          input: 'rain over city',
          response_format: {
            type: 'video',
            duration: '4s',
            resolution: '720p',
            aspect_ratio: '16:9',
            delivery: 'uri'
          }
        })
        return jsonResponse({
          id: 'v1_omni-123',
          status: 'completed',
          steps: [{
            type: 'model_output',
            content: [{
              type: 'video',
              mime_type: 'video/mp4',
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-file:download?alt=media'
            }]
          }]
        })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/video-file' && call.method === 'GET') {
        return jsonResponse({ name: 'files/video-file', state: 'ACTIVE' })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/video-file:download?alt=media') {
        return new Response(videoBytes, { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      throw new Error(`Unexpected Gemini video fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runGeminiVideoGen('rain over city', dir, {
        model: 'gemini-omni-1.1-flash',
        durationSeconds: 4,
        resolution: '720p',
        aspectRatio: '16:9'
      })
      expect(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer())).toEqual(videoBytes)
      expect(result.metadata.providerRequestId).toBe('v1_omni-123')
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

  test('Gemini Lyria writes interaction audio and preserves generated text metadata', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch(() => jsonResponse({
      status: 'completed',
      steps: [
        { type: 'model_output', content: [
          { type: 'text', text: '[Verse]\nSilver static in the sky' },
          { type: 'audio', mime_type: 'audio/mpeg', data: audioBase64 }
        ] }
      ]
    }))

    await withTempDir(async (dir) => {
      const lyricsPath = join(dir, 'lyrics.txt')
      await writeFile(lyricsPath, 'Bright lights tonight')
      const result = await runGeminiMusicGen('90s pop rock', dir, {
        model: 'lyria-3.5',
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

    expect(calls[0]?.url).toEndWith('/interactions')
    const prompt = (calls[0]?.bodyJson as { input?: string } | undefined)?.input
    expect(prompt).toContain('90s pop rock')
    expect(prompt).toContain('Create a song that is about 120 seconds long.')
    expect(prompt).toContain('Lyrics:\nBright lights tonight')
  })
})
