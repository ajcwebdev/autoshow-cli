import { describe, expect, test } from 'bun:test'
import {
  computeActualCosts,
  defaultImageVideoPrompt,
  installMockFetch,
  jsonResponse,
  runLtxVideoGen,
  videoBytes,
  videoResponse,
  withTempDir,
  writeMediaFixtures
} from './shared'

describe('video provider REST contracts', () => {
  test('LTX 2.5 sends text, image, and interpolation request bodies with metadata cost fallback', async () => {
    process.env['LTXV_API_KEY'] = 'ltx-key'
    let requestIndex = 0
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.url.startsWith('https://api.ltx.io/v2/') && call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ id: `ltx-${requestIndex}` })
      }
      if (call.url.startsWith('https://api.ltx.io/v2/') && call.method === 'GET') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        }
        const id = call.url.split('/').at(-1) ?? 'ltx-unknown'
        return jsonResponse({
          id,
          status: 'completed',
          created_at: '2026-06-01T12:00:00.000Z',
          completed_at: '2026-06-01T12:00:08.000Z',
          result: { video_url: `https://cdn.example.com/${id}.mp4` }
        })
      }
      if (call.url.startsWith('https://cdn.example.com/') && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected LTX fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)
      const text = await runLtxVideoGen('plain prompt', dir, {
        model: 'ltx-2-5-fast',
        durationSeconds: 8
      })
      const image = await runLtxVideoGen(undefined, dir, {
        model: 'ltx-2-5-fast',
        mode: 'image-to-video',
        inputImage: imagePath,
        aspectRatio: '9:16',
        resolution: '4k',
        durationSeconds: 10
      })
      const interpolate = await runLtxVideoGen('transition frames', dir, {
        model: 'ltx-2-5-pro',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath,
        resolution: '1080p',
        aspectRatio: '16:9',
        durationSeconds: 8
      })
      await expect(runLtxVideoGen('continue forward', dir, {
        model: 'ltx-2-5-pro',
        mode: 'extend' as never,
        durationSeconds: 10
      })).rejects.toThrow()

      expect(text.metadata).toMatchObject({
        videoGenService: 'ltx',
        videoGenModel: 'ltx-2-5-fast',
        videoFileName: 'generated-video.mp4',
        videoFileSize: videoBytes.byteLength,
        videoDuration: 8,
        videoSize: '1920x1080',
        requestMode: 'text',
        videoResolution: '1080p',
        videoAspectRatio: '16:9',
        providerRequestId: 'ltx-1',
        providerVideoUrl: 'https://cdn.example.com/ltx-1.mp4',
        providerCostCents: 104,
        providerCostSource: 'registry_fallback'
      })
      expect(image.metadata).toMatchObject({
        videoDuration: 10,
        videoSize: '2160x3840',
        requestMode: 'image-to-video',
        videoResolution: '4k',
        videoAspectRatio: '9:16',
        inputImage: imagePath,
        providerCostCents: 300
      })
      expect(interpolate.metadata).toMatchObject({
        videoDuration: 8,
        videoSize: '1920x1080',
        requestMode: 'interpolate',
        videoResolution: '1080p',
        videoAspectRatio: '16:9',
        lastFrameImage: lastFramePath,
        providerCostCents: 136
      })
      expect(computeActualCosts({ step6: [
        text.metadata,
        image.metadata,
        interpolate.metadata
      ] }).totalCost).toBe(540)
    })

    expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toEqual([
      'https://api.ltx.io/v2/text-to-video',
      'https://api.ltx.io/v2/image-to-video',
      'https://api.ltx.io/v2/image-to-video'
    ])

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    const imageDataUrl = `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    const lastFrameDataUrl = `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}`

    expect(postBodies[0]).toEqual({
      model: 'ltx-2-5-fast',
      prompt: 'plain prompt',
      duration: 8,
      fps: 24,
      resolution: '1920x1080'
    })
    expect(postBodies[1]).toEqual({
      model: 'ltx-2-5-fast',
      image_uri: imageDataUrl,
      prompt: defaultImageVideoPrompt,
      duration: 10,
      fps: 24,
      resolution: '2160x3840'
    })
    expect(postBodies[2]).toEqual({
      model: 'ltx-2-5-pro',
      image_uri: imageDataUrl,
      prompt: 'transition frames',
      duration: 8,
      fps: 24,
      resolution: '1920x1080',
      last_frame_uri: lastFrameDataUrl
    })
  })

  test('LTX failed jobs include provider failure message', async () => {
    process.env['LTXV_API_KEY'] = 'ltx-key'
    installMockFetch((call) => {
      if (call.url === 'https://api.ltx.io/v2/text-to-video' && call.method === 'POST') {
        return jsonResponse({ id: 'ltx-failed' })
      }
      if (call.url.includes('ltx-failed') && call.method === 'GET') {
        return jsonResponse({ id: 'ltx-failed', status: 'failed', error: { message: 'bad input' } })
      }
      throw new Error(`Unexpected failed LTX fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await expect(runLtxVideoGen('bad prompt', dir, {
        model: 'ltx-2-5-fast'
      })).rejects.toThrow('bad input')
    })
  })
})
