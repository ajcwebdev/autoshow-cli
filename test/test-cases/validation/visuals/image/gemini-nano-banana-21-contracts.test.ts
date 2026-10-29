import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { runGeminiImageGen } from '~/cli/commands/visuals/image/image-generation-services/image-gemini/run-gemini-image-gen'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

// Independent oracle, read 2026-10-29:
// https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1 (stable ID, 14 references)
// https://ai.google.dev/gemini-api/docs/generate-content/image-generation (GenerateContent, imageConfig, 14 ratios)
// https://ai.google.dev/gemini-api/docs/pricing (1120/1680/3780 image tokens at $30/M).
// Pricing's 3780-token 4K tariff takes precedence over the generation guide's conflicting 2520-token table.
const model = 'gemini-nano-banana-2.1' as const
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const dirs = setupContractSuiteLifecycle({ envKeys: ['GEMINI_API_KEY'], tempPrefix: 'autoshow-banana-21-', beforeEachExtra: () => { process.env['GEMINI_API_KEY'] = 'synthetic-key' } })
const response = (data = png, text = false) => jsonResponse({ candidates: [{ content: { parts: [
  ...(text ? [{ text: 'Synthetic caption' }] : []),
  { thought: true, inlineData: { mimeType: 'image/png', data: 'ignored' } },
  { inlineData: { mimeType: 'image/png', data } }
] } }] })
const opts = (extra = {}) => buildOptsFromFlags({ 'gemini-image': [model], ...extra })

describe('Nano Banana 2.1 local dispatch and decoded artifact contracts (quality unmeasured)', () => {
  test('bare Gemini keeps Lite; all-provider expansion adds the high-resolution sibling', () => {
    expect(buildOptsFromFlags({ 'gemini-image': true }).geminiImageModels).toEqual(['gemini-3.1-flash-lite-image'])
    expect(collectImageTargets(buildOptsFromFlags({ 'all-image': true })).filter(t => t.service === 'gemini').map(t => t.model)).toEqual(['gemini-3.1-flash-lite-image', model])
  })
  test('every documented resolution and ratio passes through actual mocked generation dispatch', async () => {
    const ratios = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9']
    const calls = installMockFetch(() => response())
    await dirs.withDir(async dir => {
      for (const size of ['1K', '2K', '4K']) for (const ratio of ratios) {
        const options = opts({ size, 'aspect-ratio': ratio })
        const result = await collectImageTargets(options)[0]!.run('Synthetic landscape', dir, options)
        expect(result.metadata).toMatchObject({ imageModel: model, imageCount: 1, imageSize: size, requestMode: 'generation' })
        expect(computeActualCosts({ step5: result.metadata }).steps[0]?.cost).toBe(size === '4K' ? 11.34 : size === '2K' ? 5.04 : 3.36)
        expect(await new Bun.Image(Bun.file(result.imagePaths[0]!)).metadata()).toMatchObject({ width: 1, height: 1 })
        expect(calls.at(-1)?.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
        expect(calls.at(-1)?.bodyJson?.['generationConfig']).toEqual({ responseModalities: ['IMAGE'], imageConfig: { imageSize: size, aspectRatio: ratio } })
      }
    })
    expect(calls).toHaveLength(42)
  })
  test('editing dispatch keeps reference bytes distinct from text and supports text-image output', async () => {
    const calls = installMockFetch(() => response(png, true))
    await dirs.withDir(async dir => {
      const input = `${dir}/reference.png`
      await Bun.write(input, Buffer.from(png, 'base64'))
      expect(() => collectImageTargets(opts({ input: Array(15).fill(input) }))).toThrow('central image registry allows 14')
      const options = opts({ input: [input], size: '2K', 'response-mode': 'text-image' })
      const result = await collectImageTargets(options)[0]!.run('Synthetic edit', dir, options)
      expect(result.metadata.requestMode).toBe('edit')
      expect(calls[0]?.bodyJson?.['contents']).toEqual([{ role: 'user', parts: [{ text: 'Synthetic edit' }, { inlineData: { mimeType: 'image/png', data: png } }] }])
      expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({ responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K' } })
    })
  })
  test('fresh omitted settings restore provider sizing and image-only response after an override', async () => {
    const calls = installMockFetch(() => response())
    await dirs.withDir(async dir => {
      for (const options of [opts(), opts({ size: '4K', 'aspect-ratio': '8:1', 'response-mode': 'text-image' }), opts()]) await collectImageTargets(options)[0]!.run('Synthetic scene', dir, options)
    })
    expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({ responseModalities: ['IMAGE'] })
    expect(calls[2]?.bodyJson?.['generationConfig']).toEqual(calls[0]?.bodyJson?.['generationConfig'])
  })
  test('unsupported controls reject before dispatch, including direct runner dimensions and price-only dimensions', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    for (const extra of [{ size: '0.5K' }, { size: '1024x1024' }, { 'aspect-ratio': '7:3' }, { quality: 'high' }, { count: '2' }]) expect(() => collectImageTargets(opts(extra))).toThrow()
    expect(() => estimateImageCosts({ geminiImageModels: [model], imageSize: '0.5K' })).toThrow()
    await dirs.withDir(async dir => { await expect(runGeminiImageGen('Synthetic', dir, { model, imageSize: '5K' })).rejects.toThrow('Invalid --size') })
    expect(calls).toHaveLength(0)
  })
  test('output-only estimates use native token-derived rates and name omitted costs', () => {
    for (const [size, tokens] of [['1K', 1120], ['2K', 1680], ['4K', 3780]] as const) {
      const estimate = estimateImageCosts({ geminiImageModels: [model], imageSize: size })[0]!
      expect(estimate.costPerImageCents).toBeCloseTo(tokens * 30 / 10000, 10)
      expect(estimate.note).toContain('text/thinking output tokens, and search grounding are excluded')
    }
  })
  test('transport success with MIME/encoding disagreement fails decoded artifact integrity', async () => {
    installMockFetch(() => jsonResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: png } }] } }] }))
    await dirs.withDir(async dir => { await expect(runGeminiImageGen('Synthetic', dir, { model })).rejects.toThrow('invalid image bytes') })
  })
  for (const bad of ['not base64!', Buffer.from('not image bytes').toString('base64'), png.slice(0, 60)]) test('transport success with malformed image data fails decoded artifact integrity: ' + bad.slice(0, 12), async () => {
    installMockFetch(() => response(bad))
    await dirs.withDir(async dir => { await expect(runGeminiImageGen('Synthetic', dir, { model })).rejects.toThrow('invalid image bytes') })
  })
})
