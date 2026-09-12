import { expect, test } from 'bun:test'
import { buildVideoEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { getImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { SUPPORTED_FAL_VIDEO_MODELS } from '~/cli/commands/setup-and-utilities/models/video-models'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { buildReplicateImageInput, runReplicateImageGen } from '~/cli/commands/visuals/image/image-generation-services/replicate/run-replicate-image-gen'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { collectFalVideoTargets } from '~/cli/commands/visuals/video/video-services/fal-video-service/fal-video-targets'
import { buildFalVideoRequest, runFalVideoGen } from '~/cli/commands/visuals/video/video-services/fal-video-service/run-fal-video-gen'
import { buildReplicateVideoInput, runReplicateVideoGen } from '~/cli/commands/visuals/video/video-services/replicate-video/run-replicate-video-gen'
import { estimateVideoCosts } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import type { VideoMode } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['FAL_API_KEY', 'REPLICATE_API_TOKEN'], tempPrefix: 'autoshow-priority-media-', beforeEachExtra: () => { process.env['FAL_API_KEY'] = 'synthetic'; process.env['REPLICATE_API_TOKEN'] = 'synthetic' } })
const ref = 'https://fixtures.example/reference.png'
const bytes = new Uint8Array([1, 2, 3])
for (const model of ['alibaba/qwen-image-3', 'alibaba/qwen-image-3-pro'] as const) test(`${model} selection, editing, download, price, and resume retain host/model identity`, async () => {
  const options = { replicateImageModels: [model], imageInputs: [ref] }
  expect(collectImageTargets(options).map(t => t.model)).toEqual([model])
  expect(imageResumeConfig.collectTargets(options).map(t => `${t.service}/${t.model}`)).toEqual([`replicate/${model}`])
  expect(estimateImageCosts(options)[0]?.totalCost).toBe(model.endsWith('pro') ? 4 : 3)
  expect(() => collectImageTargets({ ...options, imageInputs: [ref, ref] })).toThrow(/(?:allows|at most) 1/)
  expect((await buildReplicateImageInput('Synthetic', { model, inputs: [] })).input).toEqual({ prompt: 'Synthetic', match_input_image: false })
  const calls = installMockFetch(call => call.method === 'POST' ? jsonResponse({ id: 'qwen-1', status: 'succeeded', output: 'https://fixtures.example/image.png' }) : new Response(bytes, { headers: { 'content-type': 'image/png' } }))
  await dirs.withDir(async dir => {
    const result = await runReplicateImageGen('Synthetic', dir, { model, inputs: [ref], aspectRatio: '2:1' })
    expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(bytes)
    expect(result.metadata).toMatchObject({ imageModel: model, imageService: 'replicate', requestMode: 'edit', providerCostCents: model.endsWith('pro') ? 4 : 3 })
  })
  expect(calls[0]?.url).toContain(`/models/${model}/predictions`)
  expect(calls[0]?.bodyJson?.['input']).toEqual({ prompt: 'Synthetic', match_input_image: true, image: ref, aspect_ratio: '2:1' })
})

test('same Qwen ID has independent fal and Replicate reference capabilities', () => {
  expect(getImageReferenceCapabilities('alibaba/qwen-image-3', 'replicate').maxInputs).toBe(1)
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

test('Seedance tariffs include every input video, automatic duration, and host-specific units', async () => {
  for (const [resolution, plain, video] of [['480p', 10.28, 43.04], ['720p', 23.12, 96.76]] as const) {
    expect(estimateVideoCosts({ replicateVideoModels: ['bytedance/seedance-2.5'], videoResolution: resolution, videoDuration: 4 })[0]?.totalCost).toBeCloseTo(4 * plain)
    expect(estimateVideoCosts({ replicateVideoModels: ['bytedance/seedance-2.5'], videoResolution: resolution, videoDuration: -1, replicateVideoReferenceVideoCount: 2 })[0]?.totalCost).toBeCloseTo(30 * video)
  }
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
    await expect(buildFalVideoRequest('Synthetic', { model, mode: 'edit' })).rejects.toThrow()
    await expect(buildFalVideoRequest('Synthetic', { model, mode: 'text', duration: 3 })).rejects.toThrow()
  }
  await expect(buildFalVideoRequest('Synthetic', { model: 'bytedance/seedance-2.5/reference-to-video', mode: 'reference-to-video', referenceImages: Array(31).fill(ref) })).rejects.toThrow()
  await expect(buildReplicateVideoInput('Synthetic', { model: 'bytedance/seedance-2.5', resolution: '1080p' })).rejects.toThrow()
  await expect(buildReplicateVideoInput('Synthetic', { model: 'bytedance/seedance-2.5', durationSeconds: 0 })).rejects.toThrow()
  expect(calls).toHaveLength(0)
})

test('Replicate Seedance 2.5 uses its own prediction identity and adaptive frame contract', async () => {
  const request = await buildReplicateVideoInput('Synthetic', { model: 'bytedance/seedance-2.5', mode: 'interpolate', inputImage: ref, lastFrameImage: ref, durationSeconds: 30 })
  expect(request.input).toMatchObject({ image: ref, last_frame_image: ref, aspect_ratio: 'adaptive', duration: 30, resolution: '720p' })
  const calls = installMockFetch(call => call.method === 'POST' ? jsonResponse({ id: 'seedance25-1', status: 'succeeded', output: 'https://fixtures.example/output.mp4' }) : new Response(bytes, { headers: { 'content-type': 'video/mp4' } }))
  await dirs.withDir(async dir => {
    const result = await runReplicateVideoGen('Synthetic', dir, { model: 'bytedance/seedance-2.5', mode: 'text', durationSeconds: 5 })
    expect(result.metadata.videoGenModel).toBe('bytedance/seedance-2.5')
    expect(result.metadata.providerCostCents).toBeCloseTo(115.6)
  })
  expect(calls[0]?.url).toContain('/bytedance/seedance-2.5/predictions')
})
