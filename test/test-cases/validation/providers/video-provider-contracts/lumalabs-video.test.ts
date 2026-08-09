import { describe, expect, test } from 'bun:test'
import {
  installMockFetch,
  jsonResponse,
  runLumalabsVideoGen,
  videoBytes,
  videoResponse,
  withTempDir
} from './shared'

const BASE = 'https://agents.lumalabs.ai/v1'

describe('video provider REST contracts', () => {
  test('Luma Labs Ray 3.2 submits a video generation and downloads output', async () => {
    process.env['LUMA_AGENTS_API_KEY'] = 'luma-key'
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.url === `${BASE}/generations` && call.method === 'POST') {
        return jsonResponse({ id: 'luma-gen-123', state: 'queued' })
      }
      if (call.url === `${BASE}/generations/luma-gen-123` && call.method === 'GET') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        }
        return jsonResponse({
          id: 'luma-gen-123',
          state: 'completed',
          output: [{ type: 'video', url: 'https://cdn.example.com/luma.mp4' }]
        })
      }
      if (call.url === 'https://cdn.example.com/luma.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Luma fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runLumalabsVideoGen(
        'A slow dolly shot through a misty greenhouse at sunrise',
        dir,
        { model: 'ray-3.2', durationSeconds: 5, aspectRatio: '16:9', resolution: '720p' }
      )

      expect(result.videoPath).toBe(`${dir}/generated-video.mp4`)
      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
      expect(result.metadata).toMatchObject({
        videoGenService: 'lumalabs',
        videoGenModel: 'ray-3.2',
        videoFileName: 'generated-video.mp4',
        videoFileSize: videoBytes.byteLength,
        videoDuration: 5,
        videoResolution: '720p',
        videoAspectRatio: '16:9'
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${BASE}/generations`,
      `GET ${BASE}/generations/luma-gen-123`,
      `GET ${BASE}/generations/luma-gen-123`,
      'GET https://cdn.example.com/luma.mp4'
    ])

    const createCall = calls[0]!
    expect(createCall.headers.get('Authorization')).toBe('Bearer luma-key')
    expect(createCall.headers.get('Content-Type')).toBe('application/json')
    expect(createCall.bodyJson).toEqual({
      model: 'ray-3.2',
      type: 'video',
      prompt: 'A slow dolly shot through a misty greenhouse at sunrise',
      aspect_ratio: '16:9',
      video: {
        resolution: '720p',
        duration: '5s'
      }
    })
  })

  test('Luma Labs Ray 3.2 sends video.start_frame for image-to-video', async () => {
    process.env['LUMA_AGENTS_API_KEY'] = 'luma-key'
    const calls = installMockFetch((call) => {
      if (call.url === `${BASE}/generations` && call.method === 'POST') {
        return jsonResponse({ id: 'luma-gen-456', state: 'queued' })
      }
      if (call.url === `${BASE}/generations/luma-gen-456` && call.method === 'GET') {
        return jsonResponse({
          id: 'luma-gen-456',
          state: 'completed',
          output: [{ type: 'video', url: 'https://cdn.example.com/luma-i2v.mp4' }]
        })
      }
      if (call.url === 'https://cdn.example.com/luma-i2v.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Luma fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runLumalabsVideoGen(
        'gentle camera push-in',
        dir,
        {
          model: 'ray-3.2',
          durationSeconds: 10,
          resolution: '1080p',
          inputImage: 'https://example.com/frame.png'
        }
      )

      expect(result.metadata).toMatchObject({
        videoGenService: 'lumalabs',
        videoDuration: 10,
        inputImage: 'https://example.com/frame.png'
      })
    })

    const createCall = calls[0]!
    expect(createCall.bodyJson).toMatchObject({
      model: 'ray-3.2',
      type: 'video',
      video: {
        resolution: '1080p',
        duration: '10s',
        start_frame: { url: 'https://example.com/frame.png' }
      }
    })
  })
})
