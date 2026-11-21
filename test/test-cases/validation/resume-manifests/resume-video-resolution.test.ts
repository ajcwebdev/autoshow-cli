import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { requestedGenerationProvider, writeGenerationMetadata } from '~/cli/commands/command-shared/generation-command-utils'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { ResumeTarget, VideoTarget } from '~/types'
import { validVideoBytes } from '../visuals/video/video-provider-contracts/valid-video-fixture'
import { bytesResponse, installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const omni = 'gemini-omni-1.2-flash'
const grok = 'grok-imagine-video-1.5-lite'
const handler = getResumeHandler('video')
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['GEMINI_API_KEY', 'XAI_API_KEY'], tempPrefix: 'resume-video-resolution-' })

const writeMissingTargets = async (targets: VideoTarget[]): Promise<ResumeTarget> => {
  const dir = await tempDirs.make()
  await writeGenerationMetadata(dir, 'video', [], {}, {}, {
    input: 'A red kite',
    requestedProviders: targets.map(target => requestedGenerationProvider('video', target)),
    completedProviders: []
  })
  return { dir, kind: 'video', scope: 'single', manifestPath: join(dir, 'manifest.json') }
}

const mockVideoProviders = () => {
  process.env['GEMINI_API_KEY'] = 'mock-key'
  process.env['XAI_API_KEY'] = 'mock-key'
  return installMockFetch(call => {
    if (call.method === 'POST' && call.url.endsWith('/interactions')) return jsonResponse({
      id: 'omni-test', status: 'completed', output_video: { mime_type: 'video/mp4', data: Buffer.from(validVideoBytes).toString('base64') }
    })
    if (call.method === 'POST' && call.url.endsWith('/videos/generations')) return jsonResponse({ request_id: 'grok-test' })
    if (call.url.endsWith('/videos/grok-test')) return jsonResponse({ status: 'done', video: { url: 'https://cdn.example/video.mp4' } })
    if (call.url === 'https://cdn.example/video.mp4') return bytesResponse(validVideoBytes)
    throw new Error(`Unexpected request: ${call.method} ${call.url}`)
  })
}

describe('video resume resolution', () => {
  for (const { name, flags, resolution, cents } of [
    { name: 'stored request', flags: new Set<string>(), resolution: '360p', cents: 23.172 },
    { name: 'explicit override', flags: new Set(['resolution', 'gemini-video']), resolution: '1080p', cents: 104.256 }
  ]) {
    test(`prices and dispatches the ${name} resolution`, async () => {
      const stored = collectVideoTargets({ geminiVideoModels: [omni], videoDuration: 10, videoResolution: '360p' })
      const target = await writeMissingTargets(stored)
      const opts = buildOptsFromFlags({ 'gemini-video': omni, resolution: '1080p' })
      const calls = mockVideoProviders()
      const estimate = await handler.price(target, opts, flags)
      expect(estimate.totalEstimatedCost).toBeCloseTo(cents, 6)
      expect(calls).toHaveLength(0)
      expect(await handler.resume(target, opts, flags)).toMatchObject({ full: 1 })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson).toMatchObject({ model: omni, response_format: { resolution } })
    })
  }

  test('prices and dispatches each missing target at its own resolution', async () => {
    const target = await writeMissingTargets([
      ...collectVideoTargets({ geminiVideoModels: [omni], videoResolution: '4k' }),
      ...collectVideoTargets({ grokVideoModels: [grok], videoResolution: '1080p' })
    ])
    const opts = buildOptsFromFlags({})
    const flags = new Set<string>()
    const calls = mockVideoProviders()
    const estimate = await handler.price(target, opts, flags)
    expect(estimate.steps).toHaveLength(2)
    expect(estimate.steps.find(step => step.model === omni)?.totalCost).toBeCloseTo(208.512, 6)
    expect(estimate.steps.find(step => step.model === grok)?.totalCost).toBe(112)
    expect(calls).toHaveLength(0)
    expect(await handler.resume(target, opts, flags)).toMatchObject({ full: 1 })
    const bodies = calls.filter(call => call.method === 'POST').map(call => call.bodyJson)
    expect(bodies).toHaveLength(2)
    expect(bodies).toContainEqual(expect.objectContaining({ model: omni, response_format: expect.objectContaining({ resolution: '4k' }) }))
    expect(bodies).toContainEqual(expect.objectContaining({ model: grok, resolution: '1080p' }))
  })

  test('legacy and newly added targets retain their normal resolution defaults', async () => {
    const dir = await tempDirs.make()
    await writeGenerationMetadata(dir, 'video', [], {}, {}, {
      input: 'A red kite',
      requestedProviders: [{ service: 'gemini', model: omni }],
      completedProviders: []
    })
    const target: ResumeTarget = { dir, kind: 'video', scope: 'single', manifestPath: join(dir, 'manifest.json') }
    const calls = mockVideoProviders()
    const legacy = await handler.price(target, buildOptsFromFlags({}), new Set())
    expect(legacy.totalEstimatedCost).toBeCloseTo(69.504, 6)
    const additive = await handler.price(target, buildOptsFromFlags({ 'grok-video': grok }), new Set(['grok-video']))
    expect(additive.steps).toHaveLength(1)
    expect(additive.totalEstimatedCost).toBe(16)
    expect(calls).toHaveLength(0)
  })
})
