import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runOpenAIImageGen, parseOpenAIImageUsage } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/run-openai-image-gen'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { computeOpenAIImageUsageCostCents, estimateOpenAIImage25Output } from '~/cli/commands/process-steps/step-5-image/image-utils/openai-image-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { createImage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets'
import { estimateImageOutputCost } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/image-costs'
import { validateImageSizeForModels } from '~/cli/commands/process-steps/step-8-comic/comic-utils/image-size'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const models = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'] as const
const reference = 'https://fixtures.example/reference.png'
const bytes = new Uint8Array([1, 2, 3])
const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY', 'AUTOSHOW_REQUIRED_IMAGE_MODEL'], tempPrefix: 'autoshow-openai-image-25-',
  beforeEachExtra: () => { process.env['OPENAI_API_KEY'] = 'synthetic-key' }
})
const imageData = () => ({ b64_json: Buffer.from(bytes).toString('base64') })

describe('GPT Image 2.5 contracts', () => {
  test('selection, registry, expansion, and resume share both models; bare OpenAI selects Flare', () => {
    expect(buildOptsFromFlags({ 'openai-image': true }).openaiImageModels).toEqual([models[0]])
    const all = collectImageTargets(buildOptsFromFlags({ 'all-image': true })).filter(target => target.service === 'openai')
    expect(all.map(target => target.model)).toEqual(['gpt-image-2', ...models])
    for (const model of models) {
      const options = buildOptsFromFlags({ 'openai-image': [model] })
      expect(collectImageTargets(options).map(target => target.model)).toEqual([model])
      expect(imageResumeConfig.collectTargets(options).map(target => target.model)).toEqual([model])
      expect(imageResumeConfig.buildEstimates(options)[0]?.model).toBe(model)
      expect(getModelRegistry().image['openai']?.models[model]).toMatchObject({
        costPerImageCents: 1.317, textInputCostPer1MCents: 500, cachedTextInputCostPer1MCents: 125,
        imageInputCostPer1MCents: 800, cachedImageInputCostPer1MCents: 200, imageOutputCostPer1MCents: 3000,
      })
    }
  })

  test('extended quality, transparency, size, and reference restrictions fail before dispatch', () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    for (const model of models) {
      for (const quality of ['low', 'medium', 'high', 'xhigh', 'max', 'auto']) {
        for (const format of ['png', 'webp']) {
          expect(collectImageTargets({ openaiImageModels: [model], imageQuality: quality, imageSize: '2048x1152', imageBackground: 'transparent', imageFormat: format })).toHaveLength(1)
        }
      }
      for (const imageSize of ['800x800', '1025x1024', '4096x1024', '3840x1024', '3840x3840', '0x1024', '1K']) {
        expect(() => collectImageTargets({ openaiImageModels: [model], imageSize })).toThrow('Invalid --size')
        expect(() => estimateImageCosts({ openaiImageModels: [model], imageSize })).toThrow('Invalid --size')
      }
      expect(() => collectImageTargets({ openaiImageModels: [model], imageBackground: 'transparent', imageFormat: 'jpeg' })).toThrow('requires --format png or webp')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageQuality: 'ultra' })).toThrow('Invalid --quality')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageCount: 11 })).toThrow('Invalid --count')
      expect(collectImageTargets({ openaiImageModels: [model], imageInputs: Array(16).fill(reference) })).toHaveLength(1)
      expect(() => collectImageTargets({ openaiImageModels: [model], imageInputs: Array(17).fill(reference) })).toThrow('central image registry allows 16')
    }
    for (const imageQuality of ['xhigh', 'max']) {
      expect(() => collectImageTargets({ openaiImageModels: ['gpt-image-2'], imageQuality })).toThrow('Invalid --quality')
      expect(() => estimateImageCosts({ openaiImageModels: ['gpt-image-2'], imageQuality })).toThrow('Invalid --quality')
    }
    expect(() => collectImageTargets({ openaiImageModels: ['gpt-image-2'], imageBackground: 'transparent' })).toThrow('not supported')
    expect(calls).toHaveLength(0)
  })

  test('direct transport validates incompatible controls before credentials or network access', async () => {
    delete process.env['OPENAI_API_KEY']
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    await tempDirs.withDir(async dir => {
      await expect(runOpenAIImageGen('Synthetic scene', dir, { model: models[0], background: 'transparent', outputFormat: 'jpeg' })).rejects.toThrow('requires --format png or webp')
      await expect(runOpenAIImageGen('Synthetic scene', dir, { model: 'gpt-image-2', quality: 'max' })).rejects.toThrow('Invalid --quality')
    })
    expect(calls).toHaveLength(0)
  })

  test('calculator fixtures distinguish all five qualities, custom dimensions, and ties-to-even rounding', () => {
    // Expected output tokens from the official GPT Image 2.5 calculator (2026-09-10).
    for (const model of models) {
      for (const [quality, tokens] of [['low', 196], ['medium', 439], ['high', 1756], ['xhigh', 3122], ['max', 7024]] as const) {
        const result = estimateOpenAIImage25Output(model, { imageSize: '1024x1024', imageQuality: quality })
        expect(result.outputTokens).toBe(tokens)
        expect(result.costPerImageCents).toBeCloseTo(tokens * 0.003, 9)
      }
      expect(estimateOpenAIImage25Output(model, { imageSize: '1536x1024', imageQuality: 'high' }).outputTokens).toBe(1372)
      expect(estimateOpenAIImage25Output(model, { imageSize: '1536x1056', imageQuality: 'medium' }).outputTokens).toBe(348)
      expect(estimateOpenAIImage25Output(model, { imageSize: '1056x1536', imageQuality: 'medium' }).outputTokens).toBe(348)
      const auto = estimateImageCosts({ openaiImageModels: [model], imageQuality: 'auto', imageSize: 'auto' })[0]!
      expect(auto.costPerImageCents).toBeCloseTo(1.317, 9)
      expect(auto.note).toContain('actual auto consumption varies')
      expect(auto.note).toContain('Prompt tokens and cached-input discounts are excluded')
    }
  })

  test('image, aggregate, resume, and comic estimates retain new prices and modeled reference charges', () => {
    for (const model of models) {
      const options = { openaiImageModels: [model], imageSize: '1024x1024', imageQuality: 'medium', imageCount: 2, imageInputs: [reference] }
      const estimate = estimateImageCosts(options)[0]!
      expect(estimate.imageInputEstimate).toMatchObject({ totalUnits: 2000, ratePer1MCents: 800, costCents: 1.6, priced: true })
      expect(estimate.totalCost).toBeCloseTo(4.234, 9)
      expect(imageResumeConfig.buildEstimates(options)[0]?.totalCost).toBeCloseTo(4.234, 9)
      for (const selection of [options, { ...options, imageTargets: [{ service: 'openai' as const, model, count: 2 }] }]) {
        expect(computeEstimatedCosts({ ...selection, applyCostMultipliers: false }).steps[0]?.cost).toBeCloseTo(4.234, 9)
      }
      expect(() => validateImageSizeForModels('2048x1152', [model])).not.toThrow()
      expect(estimateImageOutputCost(model, 'max', '1024x1024')).toBeCloseTo(0.21072, 9)
    }
    expect(() => validateImageSizeForModels('2048x1152', [...models, 'gemini-3-pro-image'])).toThrow('requires every selected image model')
  })

  test('generation preserves extended controls, snapshot identity, multiple outputs, and usage billing', async () => {
    const calls = installMockFetch(call => jsonResponse({
      model: `${call.bodyJson?.['model']}-2026-09-08`,
      data: [imageData(), imageData()],
      usage: { input_tokens: 1100, input_tokens_details: { text_tokens: 100, image_tokens: 1000 }, output_tokens: 2000, total_tokens: 3100 }
    }))
    for (const model of models) {
      await tempDirs.withDir(async dir => {
        const options = { openaiImageModels: [model], imageSize: '2048x1152', imageQuality: 'xhigh', imageBackground: 'transparent', imageFormat: 'webp', imageCompression: 80, imageCount: 2 }
        const result = await collectImageTargets(options)[0]!.run('Synthetic product sketch', dir, options)
        expect(result.imagePaths).toHaveLength(2)
        expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(bytes)
        expect(result.metadata).toMatchObject({
          imageModel: model, providerReturnedModel: `${model}-2026-09-08`, imageQuality: 'xhigh', imageSize: '2048x1152', imageFormat: 'webp',
          imageCount: 2, requestMode: 'generation', textInputUnits: 100, imageInputUnits: 1000, outputUnits: 2000,
          providerCostCents: 6.85, providerCostSource: 'provider_usage'
        })
        expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBe(6.85)
      })
      expect(calls.at(-1)?.url).toBe('https://api.openai.com/v1/images/generations')
      expect(calls.at(-1)?.bodyJson).toMatchObject({ model, size: '2048x1152', quality: 'xhigh', n: 2, output_format: 'webp', background: 'transparent', output_compression: 80 })
      expect(calls.at(-1)?.bodyJson?.['input_fidelity']).toBeUndefined()
    }
    expect(calls).toHaveLength(2)
  })

  test('edits preserve ordered references, masks, and max quality through the multipart transport', async () => {
    const calls = installMockFetch(() => jsonResponse({ data: [imageData()] }))
    for (const model of models) {
      await tempDirs.withDir(async dir => {
        const first = join(dir, 'first.png'), second = join(dir, 'second.png'), mask = join(dir, 'mask.png')
        for (const file of [first, second, mask]) await Bun.write(file, bytes)
        const options = { openaiImageModels: [model], imageInputs: [first, second], imageMask: mask, imageQuality: 'max', imageSize: '1536x1024', imageBackground: 'transparent' }
        const result = await collectImageTargets(options)[0]!.run('Change only the mug color; preserve everything else', dir, options)
        expect(result.metadata.requestMode).toBe('edit')
        expect(result.metadata.providerCostCents).toBeUndefined()
        expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBeCloseTo(estimateImageCosts(options)[0]!.costPerImageCents, 9)
      })
      const call = calls.at(-1)!
      expect(call.url).toBe('https://api.openai.com/v1/images/edits')
      expect(call.form?.get('model')).toBe(model)
      expect(call.form?.get('quality')).toBe('max')
      expect(call.form?.get('background')).toBe('transparent')
      expect(call.form?.getAll('image[]').map(value => (value as File).name)).toEqual(['first.png', 'second.png'])
      expect((call.form?.get('mask') as File).name).toBe('mask.png')
      expect(call.form?.has('input_fidelity')).toBe(false)
    }
  })

  test('comic uses the shared adapter for reference-led custom-sized Image 2.5 generation', async () => {
    const calls = installMockFetch(() => jsonResponse({ data: [imageData()] }))
    await tempDirs.withDir(async dir => {
      const referencePath = join(dir, 'reference.png')
      await Bun.write(referencePath, bytes)
      const result = await createImage('Preserve the character and change the lighting', [referencePath], models[1], '2048x1152', 'xhigh')
      expect(result.mode).toBe('edit')
    })
    expect(calls[0]?.form?.get('model')).toBe(models[1])
    expect(calls[0]?.form?.get('size')).toBe('2048x1152')
    expect(calls[0]?.form?.get('quality')).toBe('xhigh')
  })

  test('billing excludes text output and incomplete or invalid usage falls back without inventing counts', async () => {
    const usage = parseOpenAIImageUsage({ input_tokens: 100, input_tokens_details: { text_tokens: 100, image_tokens: 0 }, output_tokens: 300, output_tokens_details: { image_tokens: 200, text_tokens: 100 } })
    expect(computeOpenAIImageUsageCostCents(models[0], usage)).toBe(0.65)
    for (const partial of [{}, { textInputUnits: 10, outputUnits: 200 }, { ...usage, totalInputUnits: 101 }, { ...usage, imageInputUnits: -1 }]) {
      expect(computeOpenAIImageUsageCostCents(models[0], partial)).toBeUndefined()
    }
    expect(parseOpenAIImageUsage({ output_tokens: -1, input_tokens: NaN })).toEqual({})
    installMockFetch(() => jsonResponse({ data: [imageData()], usage: { output_tokens: 200 } }))
    await tempDirs.withDir(async dir => {
      const result = await runOpenAIImageGen('Synthetic scene', dir, { model: models[0], size: '1024x1024', quality: 'low' })
      expect(result.metadata.providerCostCents).toBeUndefined()
      expect(computeActualCosts({ step5: result.metadata }).steps[0]).toMatchObject({ cost: 0.588, costSource: 'registry_fallback' })
    })
  })
})
