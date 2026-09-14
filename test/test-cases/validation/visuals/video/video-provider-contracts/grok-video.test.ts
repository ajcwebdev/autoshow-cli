import { describe, expect, test } from 'bun:test'
import {
  computeActualCosts,
  installMockFetch,
  jsonResponse,
  runGrokVideoGen,
  videoResponse,
  withTempDir,
  writeMediaFixtures,
  XAI_DEFAULT_BASE_URL
} from './shared'

describe('video provider REST contracts', () => {
  test('Grok Imagine Video 1.5 sends native 1080p generation requests', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-15' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-15`) {
        pollAttempts += 1
        if (pollAttempts === 1) return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        return jsonResponse({ status: 'done', model: 'grok-imagine-video-1.5', video: { url: 'https://cdn.example.com/grok-15.mp4', duration: 5, respect_moderation: true } })
      }
      if (call.url === 'https://cdn.example.com/grok-15.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await runGrokVideoGen('A cinematic ocean sunrise', dir, {
        model: 'grok-imagine-video-1.5',
        durationSeconds: 5,
        resolution: '1080p',
        aspectRatio: '16:9'
      })
    })

    expect(calls[0]?.bodyJson).toEqual({ model: 'grok-imagine-video-1.5', prompt: 'A cinematic ocean sunrise', duration: 5, aspect_ratio: '16:9', resolution: '1080p' })
    expect(pollAttempts).toBe(2)
  })

  test('Grok sends generation media and extracts poll metadata cost without server-side storage', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-123' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-123`) {
        return jsonResponse({
          status: 'done',
          model: 'grok-imagine-video-1.5',
          progress: 100,
          usage: { cost_in_usd_ticks: 250_000_000 },
          video: {
            url: 'https://cdn.example.com/grok.mp4',
            duration: 6,
            respect_moderation: true
          }
        })
      }
      if (call.url === 'https://cdn.example.com/grok.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      const result = await runGrokVideoGen('animate subject', dir, {
        model: 'grok-imagine-video-1.5',
        mode: 'image-to-video',
        inputImage: imagePath,
        durationSeconds: 6,
        aspectRatio: '9:16',
        resolution: '720p'
      })

      expect(result.metadata).toMatchObject({
        requestMode: 'image-to-video',
        providerRequestId: 'grok-123',
        providerReturnedModel: 'grok-imagine-video-1.5',
        providerVideoUrl: 'https://cdn.example.com/grok.mp4',
        providerProgress: 100,
        providerModeration: true,
        providerCostCents: 2.5,
        providerCostSource: 'provider_usage',
        videoDuration: 6
      })
      expect(computeActualCosts({ step6: result.metadata }).totalCost).toBe(2.5)
    })

    expect(calls[0]).toMatchObject({
      url: `${XAI_DEFAULT_BASE_URL}/videos/generations`,
      method: 'POST'
    })
    expect(calls[0]?.bodyJson).toEqual({
      model: 'grok-imagine-video-1.5',
      prompt: 'animate subject',
      duration: 6,
      aspect_ratio: '9:16',
      resolution: '720p',
      image: {
        url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
      }
    })
  })

  test('Grok Imagine Video 1.5 sends reference-to-video generation requests', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-1' })
      if (call.url.startsWith(`${XAI_DEFAULT_BASE_URL}/videos/grok-`)) {
        return jsonResponse({
          status: 'done',
          video: {
            url: 'https://cdn.example.com/grok.mp4',
            duration: 5,
            respect_moderation: true
          }
        })
      }
      if (call.url === 'https://cdn.example.com/grok.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)
      await runGrokVideoGen('reference scene', dir, {
        model: 'grok-imagine-video-1.5',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath]
      })
    })

    const postCalls = calls.filter((call) => call.method === 'POST')
    expect(postCalls.map((call) => call.url)).toEqual([
      `${XAI_DEFAULT_BASE_URL}/videos/generations`
    ])
    expect(postCalls[0]?.bodyJson).toMatchObject({
      model: 'grok-imagine-video-1.5',
      reference_images: [
        { url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}` },
        { url: `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}` }
      ]
    })
  })

  test('Grok fails clearly when moderation blocks video output', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    installMockFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-blocked' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-blocked`) {
        return jsonResponse({
          status: 'done',
          video: {
            url: null,
            respect_moderation: false
          }
        })
      }
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await expect(runGrokVideoGen('blocked prompt', dir, {
        model: 'grok-imagine-video-1.5'
      })).rejects.toThrow('blocked by moderation')
    })
  })
})
