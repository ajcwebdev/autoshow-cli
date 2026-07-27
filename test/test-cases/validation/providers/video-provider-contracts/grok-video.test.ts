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
  test('Grok sends generation media, storage options, and extracts poll metadata cost', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-123' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-123`) {
        return jsonResponse({
          status: 'done',
          model: 'grok-imagine-video',
          progress: 100,
          usage: { cost_in_usd_ticks: 250_000_000 },
          video: {
            url: 'https://cdn.example.com/grok.mp4',
            duration: 6,
            respect_moderation: true,
            file_output: { file_id: 'file-123', filename: 'clip.mp4' }
          }
        })
      }
      if (call.url === 'https://cdn.example.com/grok.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      const result = await runGrokVideoGen('animate subject', dir, {
        model: 'grok-imagine-video',
        mode: 'image-to-video',
        inputImage: imagePath,
        durationSeconds: 6,
        aspectRatio: '9:16',
        resolution: '720p',
        storageFilename: 'clip.mp4',
        storageExpiresAfter: 3600
      })

      expect(result.metadata).toMatchObject({
        requestMode: 'image-to-video',
        providerRequestId: 'grok-123',
        providerReturnedModel: 'grok-imagine-video',
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
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'grok-imagine-video',
      prompt: 'animate subject',
      duration: 6,
      aspect_ratio: '9:16',
      resolution: '720p',
      storage_options: {
        filename: 'clip.mp4',
        expires_after: 3600
      },
      image: {
        url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
      }
    })
  })

  test('Grok sends reference, edit, and extension endpoint shapes', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    let requestIndex = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ request_id: `grok-${requestIndex}` })
      }
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
      const { imagePath, lastFramePath, videoPath } = await writeMediaFixtures(dir)
      await runGrokVideoGen('reference scene', dir, {
        model: 'grok-imagine-video',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath]
      })
      await runGrokVideoGen('make it dusk', dir, {
        model: 'grok-imagine-video',
        mode: 'edit',
        inputVideo: videoPath
      })
      await runGrokVideoGen('continue forward', dir, {
        model: 'grok-imagine-video',
        mode: 'extend',
        inputVideo: videoPath,
        durationSeconds: 12
      })
    })

    const postCalls = calls.filter((call) => call.method === 'POST')
    expect(postCalls.map((call) => call.url)).toEqual([
      `${XAI_DEFAULT_BASE_URL}/videos/generations`,
      `${XAI_DEFAULT_BASE_URL}/videos/edits`,
      `${XAI_DEFAULT_BASE_URL}/videos/extensions`
    ])
    expect(postCalls[0]?.bodyJson).toMatchObject({
      reference_images: [
        { url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}` },
        { url: `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}` }
      ]
    })
    expect(postCalls[1]?.bodyJson).toEqual({
      model: 'grok-imagine-video',
      prompt: 'make it dusk',
      video: { url: `data:video/mp4;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}` }
    })
    expect(postCalls[2]?.bodyJson).toEqual({
      model: 'grok-imagine-video',
      prompt: 'continue forward',
      duration: 10,
      video: { url: `data:video/mp4;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}` }
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
        model: 'grok-imagine-video'
      })).rejects.toThrow('blocked by moderation')
    })
  })
})
