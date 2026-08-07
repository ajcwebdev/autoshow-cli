import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runFalImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/fal-image-service/run-fal-image-gen'
import { runFalVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/fal-video-service/run-fal-video-gen'
import type { EnvSnapshot, FalImageModel, FalVideoModel } from '~/types'
import { bytesResponse, clearEnv, createTempDirTracker, installMockFetch, jsonResponse, restoreEnv, snapshotEnv } from '../../../test-utils/rest-contract-helpers'

const originalFetch = globalThis.fetch
const tempDirs = createTempDirTracker('autoshow-fal-provider-')
let previousEnv: EnvSnapshot = {}

beforeEach(() => {
  previousEnv = snapshotEnv(['FAL_API_KEY'])
  clearEnv(['FAL_API_KEY'])
  process.env['FAL_API_KEY'] = 'fal-test-key'
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreEnv(previousEnv)
  await tempDirs.cleanup()
})

const installFalQueueMock = () => installMockFetch((call) => {
  const endpointPath = call.url.replace('https://mock.fal.local/', '')
  if (call.method === 'POST') {
    return jsonResponse({
      status: 'IN_QUEUE',
      request_id: 'fal-request',
      status_url: 'https://mock.fal.local/status',
      response_url: `https://mock.fal.local/result?endpoint=${encodeURIComponent(endpointPath)}`,
      cancel_url: 'https://mock.fal.local/cancel'
    })
  }
  if (call.url === 'https://mock.fal.local/status') return jsonResponse({ status: 'COMPLETED', request_id: 'fal-request' })
  if (call.url.startsWith('https://mock.fal.local/result')) {
    return endpointPath.includes('video') || endpointPath.includes('pixverse') || endpointPath.includes('minimax')
      ? jsonResponse({ video: { url: 'https://mock.fal.local/output.mp4' } })
      : jsonResponse({ images: [{ url: 'https://mock.fal.local/output.png' }] })
  }
  if (call.url === 'https://mock.fal.local/output.png') return bytesResponse(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
  if (call.url === 'https://mock.fal.local/output.mp4') return bytesResponse(new Uint8Array([4, 5, 6]), { headers: { 'content-type': 'video/mp4' } })
  throw new Error(`Unexpected fal.ai fetch: ${call.method} ${call.url}`)
})

describe('fal.ai provider REST contracts', () => {
  test('all registered fal.ai image models submit through their current queue endpoints', async () => {
    const calls = installFalQueueMock()
    const cases: Array<{ model: FalImageModel, endpoint: string }> = [
      { model: 'fal-ai/hidream-o1-image', endpoint: 'fal-ai/hidream-o1-image' },
      { model: 'microsoft/mai-image-2.5', endpoint: 'microsoft/mai-image-2.5' },
      { model: 'microsoft/mai-image-2.5-pro', endpoint: 'microsoft/mai-image-2.5-pro' },
      { model: 'alibaba/qwen-image-3', endpoint: 'alibaba/qwen-image-3/text-to-image' },
      { model: 'reve/2.1', endpoint: 'reve/2.1/text-to-image' }
    ]

    await tempDirs.withDir(async (dir) => {
      for (const entry of cases) {
        const result = await runFalImageGen('A clean product photograph', dir, {
          model: entry.model,
          baseUrl: 'https://mock.fal.local',
          pollIntervalMs: 1
        })
        expect(result.metadata).toMatchObject({ imageService: 'fal', imageModel: entry.model, requestMode: 'generation' })
      }
    })

    expect(calls.filter(call => call.method === 'POST').map(call => call.url)).toEqual(cases.map(entry => `https://mock.fal.local/${entry.endpoint}`))
    expect(calls.filter(call => call.method === 'POST').every(call => call.headers.get('authorization') === 'Key fal-test-key')).toBe(true)
  })

  test('both fal.ai video models submit through their text-to-video queue endpoints', async () => {
    const calls = installFalQueueMock()
    const cases: Array<{ model: FalVideoModel, endpoint: string }> = [
      { model: 'minimax/h3', endpoint: 'minimax/h3/text-to-video' },
      { model: 'fal-ai/pixverse/c1', endpoint: 'fal-ai/pixverse/c1/text-to-video' }
    ]

    await tempDirs.withDir(async (dir) => {
      for (const entry of cases) {
        const result = await runFalVideoGen('A slow cinematic camera move', dir, {
          model: entry.model,
          mode: 'text',
          baseUrl: 'https://mock.fal.local',
          pollIntervalMs: 1
        })
        expect(result.metadata).toMatchObject({ videoGenService: 'fal', videoGenModel: entry.model, requestMode: 'text' })
      }
    })

    expect(calls.filter(call => call.method === 'POST').map(call => call.url)).toEqual(cases.map(entry => `https://mock.fal.local/${entry.endpoint}`))
  })

  test('fal.ai edit, multimodal reference, and transition routes preserve their media inputs', async () => {
    const calls = installFalQueueMock()
    const image = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
    const video = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
    const audio = `data:audio/mpeg;base64,${Buffer.from([7, 8, 9]).toString('base64')}`

    await tempDirs.withDir(async (dir) => {
      await runFalImageGen('Edit the reference', dir, {
        model: 'alibaba/qwen-image-3',
        inputs: [image],
        baseUrl: 'https://mock.fal.local',
        pollIntervalMs: 1
      })
      await runFalVideoGen('Preserve the references', dir, {
        model: 'minimax/h3',
        mode: 'reference-to-video',
        referenceImages: [image],
        referenceVideos: [video],
        referenceAudios: [audio],
        baseUrl: 'https://mock.fal.local',
        pollIntervalMs: 1
      })
      await runFalVideoGen('Transition between frames', dir, {
        model: 'fal-ai/pixverse/c1',
        mode: 'interpolate',
        inputImage: image,
        lastFrame: image,
        generateAudio: true,
        baseUrl: 'https://mock.fal.local',
        pollIntervalMs: 1
      })
    })

    const posts = calls.filter(call => call.method === 'POST')
    expect(posts.map(call => call.url)).toEqual([
      'https://mock.fal.local/alibaba/qwen-image-3/edit',
      'https://mock.fal.local/minimax/h3/reference-to-video',
      'https://mock.fal.local/fal-ai/pixverse/c1/transition'
    ])
    expect(posts[0]?.bodyJson).toMatchObject({ image_urls: [image] })
    expect(posts[1]?.bodyJson).toMatchObject({ reference_image_urls: [image], reference_video_urls: [video], reference_audio_urls: [audio] })
    expect(posts[2]?.bodyJson).toMatchObject({ first_image_url: image, end_image_url: image, generate_audio_switch: true })
  })
})
