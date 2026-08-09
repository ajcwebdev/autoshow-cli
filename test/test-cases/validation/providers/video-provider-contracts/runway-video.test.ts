import { describe, expect, test } from 'bun:test'
import {
  installMockFetch,
  jsonResponse,
  runRunwayVideoGen,
  videoBytes,
  videoResponse,
  withTempDir
} from './shared'

describe('video provider REST contracts', () => {
  test('Runway Gen-4.5 uses text_to_video request shape and downloads output', async () => {
    process.env['RUNWAYML_API_SECRET'] = 'runway-key'
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.url === 'https://api.dev.runwayml.com/v1/text_to_video' && call.method === 'POST') {
        return jsonResponse({ id: 'runway-task-123' })
      }
      if (call.url === 'https://api.dev.runwayml.com/v1/tasks/runway-task-123' && call.method === 'GET') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        }
        return jsonResponse({
          id: 'runway-task-123',
          status: 'SUCCEEDED',
          output: ['https://cdn.example.com/runway.mp4'],
          createdAt: '2026-05-20T12:00:00.000Z'
        })
      }
      if (call.url === 'https://cdn.example.com/runway.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Runway fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runRunwayVideoGen(
        'A serene mountain landscape at sunrise with mist rolling through the valleys',
        dir,
        { model: 'gen4.5', durationSeconds: 5, aspectRatio: '16:9' }
      )

      expect(result.videoPath).toBe(`${dir}/generated-video.mp4`)
      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
      expect(result.metadata).toMatchObject({
        videoGenService: 'runway',
        videoGenModel: 'gen4.5',
        videoFileName: 'generated-video.mp4',
        videoFileSize: videoBytes.byteLength,
        videoDuration: 5
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.dev.runwayml.com/v1/text_to_video',
      'GET https://api.dev.runwayml.com/v1/tasks/runway-task-123',
      'GET https://api.dev.runwayml.com/v1/tasks/runway-task-123',
      'GET https://cdn.example.com/runway.mp4'
    ])

    const createCall = calls[0]!
    expect(createCall.headers.get('Authorization')).toBe('Bearer runway-key')
    expect(createCall.headers.get('X-Runway-Version')).toBe('2024-11-06')
    expect(createCall.headers.get('Content-Type')).toBe('application/json')
    expect(createCall.bodyJson).toEqual({
      model: 'gen4.5',
      promptText: 'A serene mountain landscape at sunrise with mist rolling through the valleys',
      ratio: '1280:720',
      duration: 5
    })
    expect(createCall.bodyJson).not.toHaveProperty('promptImage')
  })
})
