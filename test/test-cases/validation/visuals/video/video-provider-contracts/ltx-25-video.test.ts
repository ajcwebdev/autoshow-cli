import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { estimateVideoCost } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { normalizeLtxVideoDuration, normalizeLtxVideoSize } from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { computeActualCosts, installMockFetch, jsonResponse, runLtxVideoGen, videoBytes, videoResponse, writeMediaFixtures } from './shared'

import { setupContractSuiteLifecycle } from '../../../../../test-utils/rest-contract-helpers'

// Register lifecycle in this file too: Bun caches shared.ts after the first importing test file.
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['LTXV_API_KEY'], tempPrefix: 'autoshow-ltx-25-', restoreBunSleep: true, beforeEachExtra: () => { Bun.sleep = (async () => {}) as typeof Bun.sleep } })
const withTempDir = tempDirs.withDir

const models = ['ltx-2-5-fast', 'ltx-2-5-pro'] as const
const resolutions = ['720p', '1080p', '1440p', '4k'] as const
const ratios = ['16:9', '9:16'] as const
const sizes = [['1280x720', '720x1280'], ['1920x1080', '1080x1920'], ['2560x1440', '1440x2560'], ['3840x2160', '2160x3840']] as const
const rates = [[9, 13, 19, 30], [12, 17, 25, 39]] as const
const image = 'https://fixtures.example/first.png'
const last = 'https://fixtures.example/last.png'

describe('LTX 2.5 contracts', () => {
  test('selectors add both models and preserve the bare provider default and old targets', () => {
    expect(buildOptsFromFlags({ 'ltx-video': true }).ltxVideoModels).toEqual(['ltx-2-3-fast'])
    for (const model of models) {
      expect(collectVideoTargets(buildOptsFromFlags({ 'ltx-video': model })).map(target => target.model)).toEqual([model])
    }
    expect(collectVideoTargets(buildOptsFromFlags({ 'all-video': true })).filter(target => target.service === 'ltx').map(target => target.model))
      .toEqual(['ltx-2-3-fast', 'ltx-2-3-pro', ...models])
  })

  test('24 fps capability matrix and exact prices agree for all resolutions, orientations and input modes', () => {
    for (const [modelIndex, model] of models.entries()) {
      for (const [resolutionIndex, resolution] of resolutions.entries()) {
        for (const [ratioIndex, aspectRatio] of ratios.entries()) {
          const size = sizes[resolutionIndex]![ratioIndex]!
          expect(normalizeLtxVideoSize(model, resolution, aspectRatio)).toBe(size)
          const durations = modelIndex === 0 && resolutionIndex < 2 ? [6, 8, 10, 12, 14, 16, 18, 20] : [6, 8, 10]
          for (const mode of ['text', 'image-to-video', 'interpolate'] as const) {
            for (const duration of durations) {
              const options = { ltxVideoModels: [model], videoResolution: resolution, videoAspectRatio: aspectRatio, videoDuration: duration, videoMode: mode,
                ...(mode !== 'text' ? { videoInputImage: image } : {}), ...(mode === 'interpolate' ? { videoLastFrame: last } : {}) }
              expect(collectVideoTargets(options).map(target => target.model)).toEqual([model])
              expect(estimateVideoCost(options)).toMatchObject({ durationSeconds: duration, billedDurationSeconds: duration, costPerSecond: rates[modelIndex]![resolutionIndex], totalCost: duration * rates[modelIndex]![resolutionIndex]! })
            }
          }
          expect(normalizeLtxVideoDuration(model, size, undefined)).toBe(8)
          for (const duration of [0, 5, 7, 8.5, 21, NaN, Infinity, ...(durations.includes(12) ? [] : [12, 20])]) {
            const options = { ltxVideoModels: [model], videoResolution: resolution, videoAspectRatio: aspectRatio, videoDuration: duration }
            expect(() => collectVideoTargets(options)).toThrow('Invalid --duration')
            expect(() => estimateVideoCost(options)).toThrow('Invalid --duration')
          }
        }
      }
    }
    expect(normalizeLtxVideoSize('ltx-2-5-fast', undefined, undefined)).toBe('1920x1080')
    // Legacy normalization and the narrower CLI resolution surface stay unchanged.
    expect(normalizeLtxVideoDuration('ltx-2-3-fast', '1080x1920', 20)).toBe(10)
    expect(() => normalizeLtxVideoSize('ltx-2-3-fast', '720p', undefined)).toThrow('Expected 1080p or 4k')
  })

  test('unsupported modes and malformed inputs fail before HTTP, including direct runner calls', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected HTTP') })
    for (const model of models) {
      for (const mode of ['extend', 'edit', 'reference-to-video'] as const) {
        expect(() => collectVideoTargets({ ltxVideoModels: [model], videoMode: mode, ...(mode === 'reference-to-video' ? { videoReferenceImages: [image] } : { videoInputVideo: 'https://fixtures.example/input.mp4' }) })).toThrow('is not supported')
        expect(() => estimateVideoCost({ ltxVideoModels: [model], videoMode: mode })).toThrow('is not supported')
        await expect(runLtxVideoGen('Synthetic prompt', '/unused', { model, mode })).rejects.toThrow('is not supported')
      }
      expect(collectVideoTargets({ ltxVideoModels: [model], allVideo: true, videoMode: 'extend', videoInputVideo: 'https://fixtures.example/input.mp4' })).toEqual([])
      for (const options of [{ resolution: '480p' }, { aspectRatio: '1:1' }, { durationSeconds: 7 }, { mode: 'image-to-video' as const }, { mode: 'interpolate' as const, inputImage: image }, { inputImage: image }]) {
        await expect(runLtxVideoGen('Synthetic prompt', '/unused', { model, ...options })).rejects.toThrow()
      }
    }
    expect(calls).toHaveLength(0)
  })

  test('target runners serialize exact model, dimensions and fixed 24 fps and normalize polled output', async () => {
    process.env['LTXV_API_KEY'] = 'synthetic-key'
    let serial = 0
    const polls = new Map<string, number>()
    const calls = installMockFetch(call => {
      if (call.url.startsWith('https://api.ltx.io/v2/') && call.method === 'POST') return jsonResponse({ id: `job/${++serial}` }, { status: 202 })
      if (call.url.startsWith('https://api.ltx.io/v2/') && call.method === 'GET') {
        const count = (polls.get(call.url) ?? 0) + 1
        polls.set(call.url, count)
        if (count === 1) return jsonResponse({ status: 'pending' })
        if (count === 2) return jsonResponse({ status: 'processing' })
        return jsonResponse({ status: 'completed', created_at: '2026-09-08T12:00:00Z', completed_at: '2026-09-08T12:00:08Z', result: { video_url: 'https://fixtures.example/output.mp4' } })
      }
      if (call.url === 'https://fixtures.example/output.mp4') return videoResponse()
      throw new Error(`Unexpected HTTP ${call.method} ${call.url}`)
    })
    await withTempDir(async dir => {
      const fixtures = await writeMediaFixtures(dir)
      for (const [modelIndex, model] of models.entries()) {
        for (const [resolutionIndex, resolution] of resolutions.entries()) {
          for (const [ratioIndex, aspectRatio] of ratios.entries()) {
            for (const mode of ['text', 'image-to-video', 'interpolate'] as const) {
              const inputImage = mode === 'image-to-video' ? fixtures.imagePath : image
              const options = { ltxVideoModels: [model], videoResolution: resolution, videoAspectRatio: aspectRatio, videoMode: mode,
                ...(mode !== 'text' ? { videoInputImage: inputImage } : {}), ...(mode === 'interpolate' ? { videoLastFrame: fixtures.lastFramePath } : {}) }
              const result = await collectVideoTargets(options)[0]!.run(mode === 'image-to-video' ? undefined : 'Synthetic motion', dir)
              const expectedCost = 8 * rates[modelIndex]![resolutionIndex]!
              expect(result.metadata).toMatchObject({ videoGenModel: model, videoDuration: 8, videoResolution: resolution, videoAspectRatio: aspectRatio, videoSize: sizes[resolutionIndex]![ratioIndex], providerCostCents: expectedCost, providerCostSource: 'registry_fallback', videoFileSize: videoBytes.byteLength, providerRequestId: `job/${serial}`, providerFileOutput: { created_at: '2026-09-08T12:00:00Z', completed_at: '2026-09-08T12:00:08Z' } })
              expect(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer())).toEqual(videoBytes)
              expect(computeActualCosts({ step6: [result.metadata] }).totalCost).toBe(expectedCost)
              const submitted = calls.filter(call => call.method === 'POST').at(-1)!
              expect(submitted.url).toBe(`https://api.ltx.io/v2/${mode === 'text' ? 'text-to-video' : 'image-to-video'}`)
              expect(submitted.headers.get('authorization')).toBe('Bearer synthetic-key')
              expect(submitted.bodyJson).toEqual({ model, duration: 8, resolution: sizes[resolutionIndex]![ratioIndex], fps: 24,
                prompt: mode === 'image-to-video' ? 'Animate the provided image with natural, subtle motion while preserving its subject and composition.' : 'Synthetic motion',
                ...(mode !== 'text' ? { image_uri: mode === 'image-to-video' ? 'data:image/png;base64,AQID' : image } : {}),
                ...(mode === 'interpolate' ? { last_frame_uri: 'data:image/webp;base64,BAUG' } : {}) })
            }
          }
        }
      }
    })
    expect(serial).toBe(48)
    expect([...polls.keys()].every(url => url.includes('job%2F'))).toBe(true)
    expect([...polls.values()].every(count => count === 3)).toBe(true)
  })

  test('failed, malformed and missing-output jobs fail without resubmitting', async () => {
    process.env['LTXV_API_KEY'] = 'synthetic-key'
    for (const response of [{ status: 'failed', error: { message: 'Synthetic provider failure' } }, { status: 'completed', result: {} }, { unexpected: true }]) {
      const calls = installMockFetch(call => call.method === 'POST' ? jsonResponse({ id: 'failed' }) : jsonResponse(response))
      await withTempDir(async dir => {
        await expect(runLtxVideoGen('Synthetic motion', dir, { model: 'ltx-2-5-pro' })).rejects.toThrow()
        expect(await Bun.file(`${dir}/generated-video.mp4`).exists()).toBe(false)
      })
      expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
    }
  })
})
