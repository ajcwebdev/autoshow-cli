import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildImageEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runGrokImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-grok/run-grok-image-gen'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const model = 'grok-imagine-image-2.0' as const
const reference = 'https://fixtures.example/reference.png'
const bytes = new Uint8Array([1, 2, 3, 4])
const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['XAI_API_KEY'], tempPrefix: 'autoshow-grok-image-2-',
  beforeEachExtra: () => { process.env['XAI_API_KEY'] = 'synthetic-key' }
})
const response = () => jsonResponse({
  model,
  data: [{ b64_json: Buffer.from(bytes).toString('base64'), revised_prompt: 'Synthetic revised prompt', respect_moderation: true }],
  usage: { cost_in_usd_ticks: 400_000_000 }
})

const estimate = (quality?: string, size?: string, inputs?: string[], count = 1) => estimateImageCosts({
  grokImageModels: [model], imageQuality: quality, imageSize: size, imageInputs: inputs, imageCount: count
})[0]!

describe('Grok Imagine Image 2.0 contracts', () => {
  test('selectors expose both models and preserve the bare provider default', () => {
    expect(buildOptsFromFlags({ 'grok-image': true }).grokImageModels).toEqual(['grok-imagine-image-quality'])
    const options = buildOptsFromFlags({ 'grok-image': [model] })
    expect(collectImageTargets(options).map(target => target.model)).toEqual([model])
    expect(collectImageTargets(buildOptsFromFlags({ 'all-image': true })).filter(target => target.service === 'grok').map(target => target.model))
      .toEqual(['grok-imagine-image-quality', model])
  })

  test('all quality/resolution prices include input charges once per batched request', () => {
    for (const [quality, size, cents] of [
      ['low', '1K', 4], ['low', '2K', 6], ['medium', '1K', 6], ['medium', '2K', 8]
    ] as const) {
      expect(estimate(quality, size)).toMatchObject({ costPerImageCents: cents, totalCost: cents })
      expect(estimate(quality, size, Array(5).fill(reference), 3)).toMatchObject({
        costPerImageCents: cents, imageCount: 3, inputImageCount: 5, inputImageCostCents: 5, totalCost: cents * 3 + 5
      })
    }
    expect(estimate()).toMatchObject({ costPerImageCents: 4, totalCost: 4 })
    expect(estimate(undefined, undefined, [reference])).toMatchObject({ costPerImageCents: 6, totalCost: 7 })
    expect(estimate('auto', '1k', [reference]).totalCost).toBe(7)
    expect(estimate('LOW', '2k', [reference]).totalCost).toBe(7)
  })

  test('preflight and observed manifest estimates retain editing quality and input charges', () => {
    const imageInputs = [reference, reference]
    expect(buildImageEstimates({ grokImageModels: [model], imageSize: '2K', imageCount: 3, imageInputs })[0]?.totalCost).toBe(26)
    for (const selection of [
      { grokImageModels: [model], imageCount: 3 },
      { imageTargets: [{ service: 'grok' as const, model, count: 3 }] }
    ]) {
      expect(computeEstimatedCosts({ ...selection, imageSize: '2K', imageInputs, applyCostMultipliers: false }).steps[0]?.cost).toBe(26)
    }
  })

  test('missing provider usage falls back to actual output count, resolved options and reference charges', async () => {
    installMockFetch(() => jsonResponse({ data: [
      { b64_json: Buffer.from(bytes).toString('base64') },
      { b64_json: Buffer.from(bytes).toString('base64') }
    ] }))
    await tempDirs.withDir(async dir => {
      const result = await runGrokImageGen('Synthetic edit', dir, { model, imageSize: '2K', inputs: [reference], count: 3 })
      expect(result.metadata).toMatchObject({ imageCount: 2, imageQuality: 'medium', imageSize: '2k', providerCostCents: 17, providerCostSource: 'registry_fallback' })
      expect(result.metadata.imageFileNames).toEqual(['generated-image.jpg', 'generated-image-2.jpg'])
      expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBe(17)
    })
  })

  test('generation serializes explicit defaults and preserves normalized results and model identity', async () => {
    const calls = installMockFetch(response)
    await tempDirs.withDir(async dir => {
      const options = buildOptsFromFlags({ 'grok-image': [model] })
      const result = await collectImageTargets(options)[0]!.run('Synthetic scene', dir, options)
      expect(result.metadata).toMatchObject({
        imageModel: model, providerReturnedModel: model, imageQuality: 'low', imageSize: '1k',
        imageCount: 1, imageFileNames: ['generated-image.jpg'], requestMode: 'generation',
        providerCostCents: 4, providerCostSource: 'provider_usage', providerModeration: true,
        revisedPrompt: 'Synthetic revised prompt'
      })
      expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(bytes)
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.x.ai/v1/images/generations')
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer synthetic-key')
    expect(calls[0]?.bodyJson).toEqual({ model, prompt: 'Synthetic scene', response_format: 'b64_json', n: 1, resolution: '1k', quality: 'low' })
  })

  test('editing sends JSON single or ordered multiple references with explicit quality and resolution', async () => {
    const calls = installMockFetch(response)
    await tempDirs.withDir(async dir => {
      const local = join(dir, 'reference.png')
      await Bun.write(local, bytes)
      await runGrokImageGen('Synthetic edit', dir, { model, inputs: [local] })
      const inputs = [local, reference, reference, reference, reference]
      const options = buildOptsFromFlags({ 'grok-image': [model], input: inputs, quality: 'low', size: '2K', 'aspect-ratio': '21:9', count: '2' })
      await collectImageTargets(options)[0]!.run('Synthetic edit', dir, options)
    })
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.url).toBe('https://api.x.ai/v1/images/edits')
      expect(call.headers.get('content-type')).toContain('application/json')
      expect(call.bodyText.startsWith('{')).toBe(true)
    }
    expect(calls[0]?.bodyJson).toMatchObject({ quality: 'medium', resolution: '1k', image: { type: 'image_url', url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` } })
    expect(calls[0]?.bodyJson?.['images']).toBeUndefined()
    expect(calls[1]?.bodyJson).toMatchObject({ quality: 'low', resolution: '2k', aspect_ratio: '21:9', n: 2, images: [
      { type: 'image_url', url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` },
      ...Array.from({ length: 4 }, () => ({ type: 'image_url', url: reference }))
    ] })
    expect(calls[1]?.bodyJson?.['image']).toBeUndefined()
  })

  test('explicit request combinations match the quoted output price and never transmit auto quality', async () => {
    const calls = installMockFetch(response)
    await tempDirs.withDir(async dir => {
      for (const imageQuality of ['low', 'medium', 'auto']) {
        for (const imageSize of ['1K', '2K']) {
          for (const inputs of [undefined, [reference]]) {
            await runGrokImageGen('Synthetic scene', dir, { model, imageQuality, imageSize, inputs })
            const body = calls.at(-1)!.bodyJson!
            expect(body['quality']).toBe(imageQuality === 'auto' ? (inputs ? 'medium' : 'low') : imageQuality)
            expect(body['resolution']).toBe(imageSize.toLowerCase())
            expect(estimate(imageQuality, imageSize, inputs).costPerImageCents).toBe(
              (body['quality'] === 'medium' ? 6 : 4) + (body['resolution'] === '2k' ? 2 : 0)
            )
          }
        }
      }
    })
    expect(calls).toHaveLength(12)
  })

  test('invalid controls and references fail locally in collection, pricing and direct transport', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected transport') })
    for (const invalid of [
      { imageQuality: 'high' }, { imageSize: '4K' }, { imageCount: 0 }, { imageCount: 11 }, { imageCount: 1.5 },
      { imageInputs: Array(6).fill(reference) }, { imageInputs: ['https://fixtures.example/reference.webp'] }
    ]) {
      expect(() => collectImageTargets({ grokImageModels: [model], ...invalid })).toThrow()
      expect(() => estimateImageCosts({ grokImageModels: [model], ...invalid })).toThrow()
    }
    expect(() => collectImageTargets({ grokImageModels: [model], imageAspectRatio: '99:1' })).toThrow('--aspect-ratio')
    expect(() => collectImageTargets({ grokImageModels: [model], imageMask: 'mask.png' })).toThrow('--mask')
    expect(() => collectImageTargets({ grokImageModels: ['grok-imagine-image-quality'], imageQuality: 'low' })).toThrow('--quality')
    expect(() => collectImageTargets({ grokImageModels: ['grok-imagine-image-quality'], imageAspectRatio: '21:9' })).toThrow('--aspect-ratio')
    expect(() => collectImageTargets({ grokImageModels: ['grok-imagine-image-quality'], imageInputs: Array(4).fill(reference) })).toThrow()
    await tempDirs.withDir(async dir => {
      await expect(runGrokImageGen('Synthetic scene', dir, { model, mode: 'edit' })).rejects.toThrow('requires --input')
      await expect(runGrokImageGen('Synthetic scene', dir, { model, mode: 'generation', inputs: [reference] })).rejects.toThrow('cannot include')
      await expect(runGrokImageGen('Synthetic scene', dir, { model, imageQuality: 'high' })).rejects.toThrow('--quality')
      await expect(runGrokImageGen('Synthetic scene', dir, { model, inputs: Array(6).fill(reference) })).rejects.toThrow()
    })
    expect(calls).toHaveLength(0)
  })

  test('legacy requests retain their model and omitted controls, including alias response identity', async () => {
    const calls = installMockFetch(response)
    await tempDirs.withDir(async dir => {
      const result = await runGrokImageGen('Synthetic scene', dir, { model: 'grok-imagine-image-quality' })
      expect(result.metadata.imageModel).toBe('grok-imagine-image-quality')
      expect(result.metadata.providerReturnedModel).toBe(model)
      await runGrokImageGen('Synthetic edit', dir, { model: 'grok-imagine-image-quality', inputs: [reference] })
    })
    expect(calls[0]?.bodyJson).toEqual({ model: 'grok-imagine-image-quality', prompt: 'Synthetic scene', response_format: 'b64_json', n: 1 })
    expect(calls[1]?.url).toBe('https://api.x.ai/v1/images/edits')
    expect(calls[1]?.bodyJson?.['quality']).toBeUndefined()
  })

  test('missing image data and provider failures propagate without repeat submission', async () => {
    const calls = installMockFetch(() => jsonResponse({ data: [] }))
    await tempDirs.withDir(async dir => {
      await expect(runGrokImageGen('Synthetic scene', dir, { model })).rejects.toThrow('No image data')
    })
    expect(calls).toHaveLength(1)
    const failures = installMockFetch(() => jsonResponse({ error: { message: 'Synthetic access denied' } }, { status: 403 }))
    await tempDirs.withDir(async dir => {
      await expect(runGrokImageGen('Synthetic scene', dir, { model })).rejects.toThrow('Synthetic access denied')
    })
    expect(failures).toHaveLength(1)
  })
})
