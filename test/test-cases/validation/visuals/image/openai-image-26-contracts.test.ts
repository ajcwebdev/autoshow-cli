import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { parseOpenAIImageUsage, runOpenAIImageGen } from '~/cli/commands/visuals/image/image-generation-services/image-openai/run-openai-image-gen'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { computeOpenAIImageUsageCostCents, estimateOpenAIGptImageOutput } from '~/cli/commands/visuals/image/image-utils/openai-image-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { createImage } from '~/cli/commands/visuals/comic/comic-image-services/comic-image-targets'
import { estimateImageOutputCost } from '~/cli/commands/visuals/comic/comic-image-services/image-costs'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '~/cli/commands/visuals/comic/comic-utils/image-size'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import type { Step5Metadata } from '~/types'
import { commandNamed } from '../../../../test-utils/cli-assertions'
import { ensurePageImageFixture } from '../../../../test-utils/test-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

// Expected values come from OpenAI's GPT Image 2.6 model pages and the image-generation guide's token calculator
// (read 2026-11-19, IMAGE-102): token rates equal 2.5; output tokens are the 2.5 grid count x 4.2 (low), 3.3 (medium),
// or 1 (high and above), rounded to the nearest token, at $30 per 1M image-output tokens.
const models = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const
const retired = [['gpt-image-2.5-flare', 'gpt-image-2.6-flare'], ['gpt-image-2.5-sunburst', 'gpt-image-2.6-sunburst']] as const
const reference = 'https://fixtures.example/reference.png'
const mugPath = 'input/examples/image/harborlight-mug.png'
const maskPath = 'input/examples/image/harborlight-mug-mask.png'
const bytes = await Bun.file(mugPath).bytes()
const webpBytes = new Uint8Array(await new Bun.Image(Bun.file(maskPath)).resize(32, 32).webp().bytes())
const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY', 'AUTOSHOW_REQUIRED_IMAGE_MODEL'], tempPrefix: 'autoshow-openai-image-26-',
  beforeEachExtra: () => { process.env['OPENAI_API_KEY'] = 'synthetic-key' }
})
const imageData = (data = bytes) => ({ b64_json: Buffer.from(data).toString('base64') })
const finishedImage = (imageService: Step5Metadata['imageService'], imageModel: string, extra: Partial<Step5Metadata> = {}): Step5Metadata => ({
  imageService, imageModel, processingTime: 1, imageFileNames: ['generated-image.png'], imageCount: 1, imageFileSize: 1,
  imageWidth: 1024, imageHeight: 1024, requestMode: 'generation', ...extra
})

describe('GPT Image 2.6 contracts', () => {
  test('registry records only the 2.6 pair with published token rates, a 4.347-cent fallback and provisional timing', () => {
    expect(Object.keys(getModelRegistry().image['openai']?.models ?? {})).toEqual([...models])
    for (const [model, timingSource] of [[models[0], 'gpt-image-2.5-flare'], [models[1], 'gpt-image-2.5-sunburst']] as const) {
      const row = getModelRegistry().image['openai']?.models[model]
      expect(row).toMatchObject({
        pricingSourceUrl: `https://developers.openai.com/api/docs/models/${model}`,
        pricingCheckedAt: '2026-11-19', pricingCurrency: 'USD', pricingTier: 'Standard pay-as-you-go',
        costPerImageCents: 4.347, textInputCostPer1MCents: 500, cachedTextInputCostPer1MCents: 125,
        imageInputCostPer1MCents: 800, cachedImageInputCostPer1MCents: 200, imageOutputCostPer1MCents: 3000
      })
      expect(row?.estimation).toMatchObject({ msPerImage: 21594, timingProvenance: { status: 'provisional', sourceModel: timingSource } })
    }
  })

  test('bare OpenAI and comic default to 2.6 Flare; explicit selection, expansion and resume reach both models', () => {
    expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2.6-flare')
    expect(buildOptsFromFlags({ 'openai-image': true }).openaiImageModels).toEqual(['gpt-image-2.6-flare'])
    expect(DEFAULT_IMAGE_MODEL).toBe('gpt-image-2.6-flare')
    const expanded = collectImageTargets(buildOptsFromFlags({ 'all-image': true })).filter(target => target.service === 'openai')
    expect(expanded.map(target => target.model)).toEqual([...models])
    for (const model of models) {
      const options = buildOptsFromFlags({ 'openai-image': [model] })
      expect(options.openaiImageModels).toEqual([model])
      expect(collectImageTargets(options).map(target => target.model)).toEqual([model])
      expect(imageResumeConfig.collectTargets(options).map(target => target.model)).toEqual([model])
      expect(imageResumeConfig.buildEstimates(options)[0]?.model).toBe(model)
    }
  })

  test('retired GPT Image 2.5 IDs reject before pricing and dispatch, name their 2.6 successors, and keep historical rates', () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    for (const [model, replacement] of retired) {
      const message = `Model "${model}" is retired for --provider/--image openai[=model]. Use "${replacement}" instead.`
      expect(() => buildOptsFromFlags({ 'openai-image': [model] })).toThrow(message)
      expect(() => collectImageTargets({ openaiImageModels: [model] })).toThrow(message)
      expect(() => estimateImageCosts({ openaiImageModels: [model] })).toThrow(message)
      // A finished run without provider usage reprices from the retired 2.5 calculator rate, not the 2.6 multipliers.
      expect(estimateOpenAIGptImageOutput(model, { imageSize: '1024x1024', imageQuality: 'medium' }).outputTokens).toBe(439)
      expect(computeActualCosts({ step5: finishedImage('openai', model, { imageSize: '1024x1024', imageQuality: 'medium' }) }).steps[0])
        .toMatchObject({ model, costSource: 'registry_fallback', cost: 1.317 })
    }
    expect(calls).toHaveLength(0)
  })

  test('calculator applies the 2.6 low and medium multipliers and leaves high and above at the 2.5 grid', () => {
    for (const model of models) {
      for (const [quality, tokens] of [['low', 823], ['medium', 1449], ['high', 1756], ['xhigh', 3122], ['max', 7024]] as const) {
        const result = estimateOpenAIGptImageOutput(model, { imageSize: '1024x1024', imageQuality: quality })
        expect(result.outputTokens).toBe(tokens)
        expect(result.costPerImageCents).toBeCloseTo(tokens * 0.003, 9)
        expect(result.note).toContain('GPT Image 2.6 calculator output estimate')
      }
      for (const [quality, tokens] of [['low', 664], ['medium', 1132], ['high', 1372]] as const) {
        expect(estimateOpenAIGptImageOutput(model, { imageSize: '1536x1024', imageQuality: quality }).outputTokens).toBe(tokens)
      }
      // Ties-to-even short-grid rounding is shared with the 2.5 calculator: 348 grid tokens x 3.3.
      expect(estimateOpenAIGptImageOutput(model, { imageSize: '1536x1056', imageQuality: 'medium' }).outputTokens).toBe(1148)
      const auto = estimateImageCosts({ openaiImageModels: [model], imageQuality: 'auto', imageSize: 'auto' })[0]!
      expect(auto.costPerImageCents).toBeCloseTo(4.347, 9)
      expect(auto.note).toContain('actual auto consumption varies')
      expect(auto.note).toContain('Prompt tokens and cached-input discounts are excluded')
    }
  })

  test('image, aggregate, resume and comic estimates add modeled reference charges to 2.6 output', () => {
    for (const model of models) {
      const options = { openaiImageModels: [model], imageSize: '1024x1024', imageQuality: 'medium', imageCount: 2, imageInputs: [reference] }
      const estimate = estimateImageCosts(options)[0]!
      expect(estimate.imageInputEstimate).toMatchObject({ totalUnits: 2000, ratePer1MCents: 800, costCents: 1.6, priced: true })
      expect(estimate.totalCost).toBeCloseTo(2 * 4.347 + 1.6, 9)
      expect(imageResumeConfig.buildEstimates(options)[0]?.totalCost).toBeCloseTo(2 * 4.347 + 1.6, 9)
      expect(computeEstimatedCosts({ ...options, imageTargets: [{ service: 'openai' as const, model, count: 2 }], applyCostMultipliers: false }).steps[0]?.cost).toBeCloseTo(2 * 4.347 + 1.6, 9)
      expect(estimateImageOutputCost(model, 'max', '1024x1024')).toBeCloseTo(0.21072, 9)
      expect(estimateImageOutputCost(model, 'medium', '1024x1024')).toBeCloseTo(0.04347, 9)
    }
  })

  test('extended quality and custom sizes are accepted; invalid controls fail before pricing, credentials and dispatch', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    for (const model of models) {
      for (const quality of ['low', 'medium', 'high', 'xhigh', 'max', 'auto']) {
        expect(collectImageTargets({ openaiImageModels: [model], imageQuality: quality, imageSize: '2048x1152', imageBackground: 'opaque' })).toHaveLength(1)
      }
      expect(() => validateImageSizeForModels('2048x1152', [model])).not.toThrow()
      for (const imageSize of ['800x800', '1025x1024', '4096x1024', '3840x1024', '3840x3840', '0x1024', '1K']) {
        expect(() => collectImageTargets({ openaiImageModels: [model], imageSize })).toThrow('Invalid --size')
        expect(() => estimateImageCosts({ openaiImageModels: [model], imageSize })).toThrow('Invalid --size')
      }
      expect(() => collectImageTargets({ openaiImageModels: [model], imageQuality: 'ultra' })).toThrow('Invalid --quality')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageCount: 11 })).toThrow('Invalid --count')
      expect(collectImageTargets({ openaiImageModels: [model], imageInputs: Array(16).fill(reference) })).toHaveLength(1)
      expect(() => collectImageTargets({ openaiImageModels: [model], imageInputs: Array(17).fill(reference) })).toThrow('central image registry allows 16')
    }
    expect(() => validateImageSizeForModels('2048x1152', [...models, 'gemini-nano-banana-2.1'])).toThrow('requires every selected image model')
    delete process.env['OPENAI_API_KEY']
    await tempDirs.withDir(async dir => {
      await expect(runOpenAIImageGen('Synthetic scene', dir, { model: models[0], quality: 'ultra' })).rejects.toThrow('Invalid --quality')
    })
    expect(calls).toHaveLength(0)
  })

  test('saved transparent background, an explicit override and a cleared setting reach the OpenAI target', () => {
    const target = (background?: string, override?: string) => {
      const flags = override === undefined ? {} : { background: override }
      const image = { openaiImage: [models[0]], format: 'png', ...(background === undefined ? {} : { background }) }
      const merged = mergeConfigIntoRawFlags(flags, { defaults: { image } }, new Set(Object.keys(flags)), 'image')
      return collectImageTargets(buildOptsFromFlags(merged))[0]!.requestSettings
    }
    expect(target('transparent')['background']).toBe('transparent')
    expect(target('transparent', 'opaque')['background']).toBe('opaque')
    expect(target()['background']).toBe('auto')
  })

  test('mask and transparent controls parse, and invalid combinations fail before provider dispatch', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    const parsed = parseCommandInvocation(['image', 'a mug', '--provider', 'openai', '--input', mugPath, '--mask', maskPath], commandNamed('image'), GLOBAL_FLAG_DEFINITIONS)
    expect(parsed.flags['mask']).toBe(maskPath)
    for (const model of models) {
      expect(() => collectImageTargets({ openaiImageModels: [model], imageMask: maskPath })).toThrow('--mask requires at least one --input')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageInputs: [mugPath], imageMask: reference })).toThrow('--mask must be a local image')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageInputs: [mugPath], imageMask: mugPath.replace('.png', '.jpg') })).toThrow('--mask must be a local PNG')
      expect(() => collectImageTargets({ openaiImageModels: [model], imageBackground: 'transparent', imageFormat: 'jpeg' })).toThrow('requires --format png or webp')
    }
    expect(() => collectImageTargets({ geminiImageModels: ['gemini-nano-banana-2.1'], imageInputs: [mugPath], imageMask: maskPath })).toThrow('--mask is not supported by Gemini')
    await tempDirs.withDir(async dir => {
      const small = join(dir, 'small.png')
      await Bun.write(small, await new Bun.Image(bytes).resize(32, 32).png().bytes())
      await expect(runOpenAIImageGen('Recolor the mug', dir, { model: models[0], inputs: [small], mask: maskPath })).rejects.toThrow('must match the first --input')
      const bad = join(dir, 'invalid.png')
      await Bun.write(bad, 'invalid image')
      await expect(runOpenAIImageGen('Recolor the mug', dir, { model: models[0], inputs: [mugPath], mask: bad })).rejects.toThrow('readable first input image and PNG mask')
      await ensurePageImageFixture(bad)
      await expect(runOpenAIImageGen('Recolor the mug', dir, { model: models[0], inputs: [small], mask: bad })).rejects.toThrow('alpha channel')
    })
    expect(calls).toHaveLength(0)
  })

  test('generation sends the 2.6 wire ID with extended controls, multiple outputs and usage billing', async () => {
    const calls = installMockFetch(call => jsonResponse({
      model: call.bodyJson?.['model'],
      data: [imageData(webpBytes), imageData(webpBytes)],
      usage: { input_tokens: 100, input_tokens_details: { text_tokens: 100, image_tokens: 0 }, output_tokens: 1449, total_tokens: 1549 }
    }))
    for (const model of models) {
      await tempDirs.withDir(async dir => {
        const options = { openaiImageModels: [model], imageSize: '2048x1152', imageQuality: 'xhigh', imageBackground: 'transparent', imageFormat: 'webp', imageCompression: 80, imageCount: 2 }
        const result = await collectImageTargets(options)[0]!.run('Synthetic product sketch', dir, options)
        expect(result.imagePaths).toHaveLength(2)
        expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(webpBytes)
        expect(result.metadata).toMatchObject({ imageModel: model, imageQuality: 'xhigh', imageSize: '2048x1152', imageCount: 2, requestMode: 'generation', outputUnits: 1449, providerCostSource: 'provider_usage' })
        expect(result.metadata.providerCostCents).toBeCloseTo(4.397, 9)
        expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBeCloseTo(4.397, 9)
      })
      expect(calls.at(-1)?.url).toBe('https://api.openai.com/v1/images/generations')
      expect(calls.at(-1)?.bodyJson).toMatchObject({ model, size: '2048x1152', quality: 'xhigh', n: 2, background: 'transparent', output_format: 'webp', output_compression: 80 })
      expect(calls.at(-1)?.bodyJson?.['input_fidelity']).toBeUndefined()
    }
  })

  test('edits send transparent PNG output and the original mask with ordered multipart references', async () => {
    const calls = installMockFetch(() => jsonResponse({ data: [imageData()] }))
    for (const model of models) {
      await tempDirs.withDir(async dir => {
        const first = join(dir, 'first.png'), second = join(dir, 'second.png')
        for (const file of [first, second]) await Bun.write(file, bytes)
        const options = { openaiImageModels: [model], imageInputs: [first, second], imageMask: maskPath, imageBackground: 'transparent', imageQuality: 'max', imageSize: '1536x1024' }
        const result = await collectImageTargets(options)[0]!.run('Change only the mug color; preserve everything else', dir, options)
        expect(result.metadata.requestMode).toBe('edit')
        expect(result.metadata.providerCostCents).toBeUndefined()
        expect(computeActualCosts({ step5: result.metadata }).steps[0]).toMatchObject({ costSource: 'registry_fallback' })
        expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBeCloseTo(estimateImageCosts(options)[0]!.costPerImageCents, 9)
      })
      const call = calls.at(-1)!
      expect(call.url).toBe('https://api.openai.com/v1/images/edits')
      expect(call.form?.get('model')).toBe(model)
      expect(call.form?.get('quality')).toBe('max')
      expect(call.form?.getAll('image[]').map(value => (value as File).name)).toEqual(['first.png', 'second.png'])
      expect(call.form?.get('background')).toBe('transparent')
      expect(call.form?.get('output_format')).toBe('png')
      const mask = call.form?.get('mask') as File
      expect(mask.name).toBe('harborlight-mug-mask.png')
      expect(mask.type).toBe('image/png')
      expect(await mask.bytes()).toEqual(await Bun.file(maskPath).bytes())
      expect(call.form?.has('input_fidelity')).toBe(false)
    }
  })

  test('comic uses the shared adapter for reference-led custom-sized 2.6 generation', async () => {
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

  test('billing excludes text output; incomplete, invalid or empty responses fail or fall back without inventing counts', async () => {
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
      expect(computeActualCosts({ step5: result.metadata }).steps[0]).toMatchObject({ cost: 2.469, costSource: 'registry_fallback' })
    })
    installMockFetch(() => jsonResponse({ data: [], usage: { output_tokens: 1449 } }))
    await tempDirs.withDir(async dir => {
      await expect(runOpenAIImageGen('Synthetic scene', dir, { model: models[0], size: '1024x1024', quality: 'low' })).rejects.toThrow('No image data in OpenAI response')
    })
  })
})
