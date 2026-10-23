import { expect, test } from 'bun:test'
import { buildVideoEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { getImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { SUPPORTED_FAL_VIDEO_MODELS } from '~/cli/commands/setup-and-utilities/models/video-models'
import { collectFalVideoTargets } from '~/cli/commands/visuals/video/video-services/fal-video-service/fal-video-targets'
import { buildFalVideoRequest, runFalVideoGen } from '~/cli/commands/visuals/video/video-services/fal-video-service/run-fal-video-gen'
import { estimateVideoCosts } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import type { VideoMode } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['FAL_API_KEY'], tempPrefix: 'autoshow-priority-media-', beforeEachExtra: () => { process.env['FAL_API_KEY'] = 'synthetic' } })
const ref = 'https://fixtures.example/reference.png'
const bytes = new Uint8Array([1, 2, 3])
test('fal Qwen supports multiple reference images', () => {
  expect(getImageReferenceCapabilities('alibaba/qwen-image-3', 'fal').maxInputs).toBeGreaterThan(1)
})

const routes = SUPPORTED_FAL_VIDEO_MODELS.filter(model => model.includes('seedance-2.5') || model.includes('h3-max'))
for (const model of routes) test(`${model} has a distinct endpoint, correct fields, and downloadable output`, async () => {
  const mode: VideoMode = model.endsWith('/text-to-video') ? 'text' : model.endsWith('/image-to-video') ? 'image-to-video' : 'reference-to-video'
  const inputs = mode === 'image-to-video' ? { inputImage: ref } : mode === 'reference-to-video' ? { referenceImages: [ref], referenceVideos: ['https://fixtures.example/reference.mp4'] } : {}
  const request = await buildFalVideoRequest('Synthetic', { model, mode, ...inputs })
  expect(request.endpointId).toBe(model)
  expect(request.input).toMatchObject({ duration: model.includes('seedance') ? '5' : 5, resolution: model.includes('seedance') ? '720p' : '768P' })
  if (model.includes('h3-max')) expect(request.input['prompt_expansion_mode']).toBe('balanced')
  if (mode === 'reference-to-video') expect(request.input).toMatchObject({ image_urls: [ref], video_urls: ['https://fixtures.example/reference.mp4'], task: 'reference' })
  expect(collectFalVideoTargets({ falVideoModels: [model], videoInputImage: inputs.inputImage, videoReferenceImages: inputs.referenceImages, videoReferenceVideos: inputs.referenceVideos }, mode).map(t => t.model)).toEqual([model])
  const calls = installMockFetch(call => {
    if (call.method === 'POST') return jsonResponse({ request_id: 'fal-1', status: 'IN_QUEUE', status_url: 'https://queue.fal.run/status-fixture', response_url: 'https://queue.fal.run/result-fixture' })
    if (call.url.endsWith('status-fixture')) return jsonResponse({ request_id: 'fal-1', status: 'COMPLETED' })
    if (call.url.endsWith('result-fixture')) return jsonResponse({ video: { url: 'https://fixtures.example/output.mp4' } })
    return new Response(bytes, { headers: { 'content-type': 'video/mp4' } })
  })
  await dirs.withDir(async dir => {
    const result = await runFalVideoGen('Synthetic', dir, { model, mode, ...inputs, pollIntervalMs: 1 })
    expect(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer())).toEqual(bytes)
    expect(result.metadata).toMatchObject({ videoGenModel: model, providerRequestId: 'fal-1', requestMode: mode })
  })
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(calls[0]?.url).toBe(`https://queue.fal.run/${model}`)
})

test('fal Seedance tariffs include every input video and unknown-duration fallback', async () => {
  const model = 'bytedance/seedance-2.5/reference-to-video'
  const known = estimateVideoCosts({ falVideoModels: [model], videoDuration: 5, falVideoReferenceVideoCount: 2, falInputVideoDurationSeconds: 8 })[0]!
  expect(known.totalCost).toBeCloseTo(13 * 47.3 * 0.6)
  const preflight = await buildVideoEstimates({ falVideoModels: [model], videoDuration: 5, videoReferenceVideos: ['https://fixtures.example/a.mp4', 'https://fixtures.example/b.mp4'] })
  expect(preflight[0]?.totalCost).toBeCloseTo(35.2 * 47.3 * 0.6)
})

test('H3 Max/Turbo estimates retain regular tariffs across the promotional cutoff', () => {
  for (const model of routes.filter(m => m.includes('h3-max'))) {
    for (const [resolution, price] of [['480p', 5], ['768p', 8], ['1080p', 16]] as const) {
      const estimate = () => estimateVideoCosts({ falVideoModels: [model], videoDuration: 5, videoResolution: resolution })[0]!.totalCost
      const oldNow = Date.now
      try {
        Date.now = () => Date.parse('2026-09-14T23:59:59Z'); const before = estimate()
        Date.now = () => Date.parse('2026-09-15T00:00:00Z'); expect(estimate()).toBe(before)
        expect(before).toBe(5 * price / (model.includes('turbo') ? 2 : 1))
      } finally { Date.now = oldNow }
    }
  }
})

test('invalid video modes, duration gaps, extra references, and unsupported resolutions fail before submission', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected network') })
  for (const model of routes) {
    await expect(buildFalVideoRequest('Synthetic', { model, mode: 'edit' as never })).rejects.toThrow()
    await expect(buildFalVideoRequest('Synthetic', { model, mode: 'text', duration: 3 })).rejects.toThrow()
  }
  await expect(buildFalVideoRequest('Synthetic', { model: 'bytedance/seedance-2.5/reference-to-video', mode: 'reference-to-video', referenceImages: Array(31).fill(ref) })).rejects.toThrow()
  await expect(buildFalVideoRequest('Synthetic', { model: 'bytedance/seedance-2.5/text-to-video', mode: 'text', resolution: '4k' })).rejects.toThrow(/resolution/i)
  expect(calls).toHaveLength(0)
})
