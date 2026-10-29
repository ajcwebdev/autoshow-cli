import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { estimateVideoCost } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { resolveCheapestModelForFlag, selectCheapestVideoSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { bytesResponse, computeActualCosts, installMockFetch, join, jsonResponse, runGrokVideoGen, videoResponse, withTempDir, XAI_DEFAULT_BASE_URL } from './shared'

// Independent contract: docs.x.ai/developers/models/grok-imagine-video-1.5-lite and
// /model-capabilities/video/{overview,generation}, refreshed 2026-10-29 via links.
// Local dispatch and decoding do not establish visual quality, speech, or live availability.
const model = 'grok-imagine-video-1.5-lite' as const
const inputImage = 'https://fixtures.example/input.png'

describe('Grok Video 1.5 Lite documented local contracts', () => {
  for (const [duration, resolution, aspect, image, cost] of [
    [1, '480p', '16:9', undefined, 2],
    [8, '720p', '9:16', inputImage, 25],
    [15, '1080p', '21:9', undefined, 210]
  ] as const) {
    test(`mocked transport and decoded video integrity: ${duration}s ${resolution} ${image ? 'image' : 'text'}`, async () => {
      process.env['XAI_API_KEY'] = 'test-key'
      const calls = installMockFetch(call => {
        if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/generations`) return jsonResponse({ request_id: 'lite-123' })
        if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/lite-123`) return jsonResponse({ status: 'done', model, video: { url: 'https://cdn.example/lite.mp4', duration } })
        if (call.url === 'https://cdn.example/lite.mp4') return videoResponse()
        throw Error(`Unexpected request: ${call.url}`)
      })
      await withTempDir(async dir => {
        const target = collectVideoTargets(buildOptsFromFlags({ 'grok-video': model, duration: String(duration), resolution, 'aspect-ratio': aspect, ...(image ? { mode: 'image-to-video', 'input-image': image } : {}) }))[0]!
        const result = await target.run('A red kite above a field', dir)
        expect(result.metadata.videoGenModel).toBe(model)
        expect(result.metadata.providerReturnedModel).toBe(model)
        expect(result.metadata.requestMode).toBe(image ? 'image-to-video' : 'text')
        expect(computeActualCosts({ step6: result.metadata }).totalCost).toBe(cost)
        expect(await Bun.file(result.videoPath).exists()).toBe(true)
      })
      expect(calls[0]).toMatchObject({ method: 'POST', url: `${XAI_DEFAULT_BASE_URL}/videos/generations`, bodyJson: { model, duration, resolution, aspect_ratio: aspect, ...(image ? { image: { url: image } } : {}) } })
    })
  }

  test('defaults and overrides retain exact model and documented 8s/480p request defaults', async () => {
    expect(resolveCheapestModelForFlag('grok-video')).toBe(model)
    expect(selectCheapestVideoSelection('grok')).toMatchObject({ model, duration: 1, resolution: '480p', totalCost: 2 })
    expect(estimateVideoCost({ grokVideoModels: [model] }).totalCost).toBe(16)
    expect(estimateVideoCost({ grokVideoModels: [model], videoDuration: 5, videoResolution: '720p', grokInputImageCount: 1 }).totalCost).toBe(16)
    const defaultTarget = collectVideoTargets(buildOptsFromFlags({ 'grok-video': model }))[0]!
    const override = collectVideoTargets(buildOptsFromFlags({ 'grok-video': model, duration: '15', resolution: '1080p' }))[0]!
    const reset = collectVideoTargets(buildOptsFromFlags({ 'grok-video': model }))[0]!
    expect(defaultTarget.requestSettings).toMatchObject({ model, effective: { durationSeconds: 8, resolution: '480p', aspectRatio: '16:9' } })
    expect(override.requestSettings).toMatchObject({ model, effective: { durationSeconds: 15, resolution: '1080p' } })
    expect(reset.requestSettings).toEqual(defaultTarget.requestSettings)
    process.env['XAI_API_KEY'] = 'test-key'
    const calls = installMockFetch(call => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'defaults-lite' })
      if (call.url.endsWith('/videos/defaults-lite')) return jsonResponse({ status: 'done', video: { url: 'https://cdn.example/defaults.mp4' } })
      return videoResponse()
    })
    await withTempDir(async dir => {
      for (const target of [defaultTarget, override, reset]) await target.run('A red kite', dir)
    })
    expect(calls.filter(call => call.method === 'POST').map(call => call.bodyJson)).toEqual([
      { model, prompt: 'A red kite', duration: 8, aspect_ratio: '16:9', resolution: '480p' },
      { model, prompt: 'A red kite', duration: 15, aspect_ratio: '16:9', resolution: '1080p' },
      { model, prompt: 'A red kite', duration: 8, aspect_ratio: '16:9', resolution: '480p' }
    ])
  })

  test('unsupported modes reject before credentials, pricing, or dispatch; all-video skips Lite references', async () => {
    delete process.env['XAI_API_KEY']
    const calls = installMockFetch(() => { throw Error('Dispatch must not occur') })
    for (const [mode, media] of [
      ['reference-to-video', { 'reference-image': inputImage }],
      ['interpolate', { 'input-image': inputImage, 'last-frame': inputImage }],
      ['edit', { 'input-video': 'https://fixtures.example/in.mp4' }],
      ['extend', { 'input-video': 'https://fixtures.example/in.mp4' }]
    ] as const) {
      expect(() => collectVideoTargets(buildOptsFromFlags({ 'grok-video': model, mode, ...media }))).toThrow(`--mode ${mode} is not supported`)
      expect(() => estimateVideoCost({ grokVideoModels: [model], videoMode: mode })).toThrow(`--mode ${mode} is not supported`)
      await withTempDir(async dir => {
        await expect(runGrokVideoGen('scene', dir, { model, mode })).rejects.toThrow(`--mode ${mode} is not supported`)
      })
    }
    expect(() => collectVideoTargets(buildOptsFromFlags({ 'grok-video': model, resolution: '4k' }))).toThrow('Invalid --resolution')
    await withTempDir(async dir => {
      await expect(runGrokVideoGen('scene', dir, { model, referenceImages: [inputImage] })).rejects.toThrow('--reference-image is not supported')
    })
    expect(collectVideoTargets(buildOptsFromFlags({ 'all-video': true, mode: 'reference-to-video', 'reference-image': inputImage })).map(t => t.model)).not.toContain(model)
    expect(calls).toHaveLength(0)
  })

  for (const failure of ['failed', 'missing-url', 'malformed-json', 'invalid-video', 'empty-video'] as const) {
    test(`rejects ${failure} without reporting a valid artifact`, async () => {
      process.env['XAI_API_KEY'] = 'test-key'
      installMockFetch(call => {
        if (call.method === 'POST') return failure === 'malformed-json'
          ? new Response('{broken', { headers: { 'content-type': 'application/json' } })
          : jsonResponse({ request_id: 'bad-lite' })
        if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/bad-lite`) {
          if (failure === 'malformed-json') return new Response('{broken', { headers: { 'content-type': 'application/json' } })
          if (failure === 'failed') return jsonResponse({ status: 'failed', error: 'generation rejected' })
          return jsonResponse({ status: 'done', ...(failure === 'missing-url' ? {} : { video: { url: 'https://cdn.example/bad.mp4' } }) })
        }
        return bytesResponse(failure === 'empty-video' ? new Uint8Array() : new TextEncoder().encode('<html>not a video</html>'))
      })
      await withTempDir(async dir => {
        await expect(runGrokVideoGen('scene', dir, { model })).rejects.toThrow()
        if (failure === 'invalid-video' || failure === 'empty-video') {
          expect(await Bun.file(join(dir, 'generated-video.mp4')).exists()).toBe(true)
        }
      })
    })
  }
})
