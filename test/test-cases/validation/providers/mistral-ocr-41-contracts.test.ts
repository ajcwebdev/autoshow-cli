import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runMistralOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/run-mistral-ocr'
import { writeProviderArtifacts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-artifacts'
import { remapOcrPagesToRange } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-page-remap'
import { estimateMistralOcrCost } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { ExtractionResultSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({ envKeys: ['MISTRAL_API_KEY'], tempPrefix: 'autoshow-mistral-ocr-41-' })
const model = 'mistral-ocr-4-1'
const block = {
  type: 'text', top_left_x: 10, top_left_y: 20, bottom_right_x: 80, bottom_right_y: 50,
  content: 'Synthetic block',
  confidence_scores: { average_content_confidence_score: 0.98, minimum_content_confidence_score: 0.8, block_type_confidence_score: 1 }
}

describe('Mistral OCR 4.1 contracts', () => {
  test('selectors preserve current models and default', () => {
    for (const selector of ['mistral-ocr-2512', 'mistral-ocr-4-0', model]) {
      expect(buildOptsFromFlags({ 'mistral-ocr': selector }).mistralOcrModels).toEqual([selector])
    }
    expect(buildOptsFromFlags({ 'mistral-ocr': true }).mistralOcrModels).toEqual(['mistral-ocr-2512'])
  })

  for (const format of ['pdf', 'png'] as const) {
    test(`${format} preserves confidence, block order and prose through JSON artifacts`, async () => {
      const dir = await tempDirs.make()
      const input = join(dir, `synthetic.${format}`)
      await Bun.write(input, 'synthetic fixture bytes; fetch is mocked')
      process.env['MISTRAL_API_KEY'] = 'mock-key'
      const pageMetadata = {
        blocks: [block, { ...block, type: 'image', content: '', image_id: 'image-0', confidence_scores: { average_content_confidence_score: null, minimum_content_confidence_score: null, block_type_confidence_score: 0.9 } }],
        confidence_scores: { average_page_confidence_score: 0.97, minimum_page_confidence_score: 0.7 }
      }
      const calls = installMockFetch(() => Response.json({ pages: [
        { index: 0, markdown: 'First synthetic page.', ...pageMetadata },
        { index: 1, markdown: 'Second synthetic page.' }
      ] }))
      const run = await runMistralOcr(input, { slug: 'synthetic', format, pageCount: 2, fileSize: 40 }, model, { baseURL: 'https://mock.mistral.local' })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson).toMatchObject({ model, include_blocks: true, confidence_scores_granularity: 'block', include_image_base64: false })
      expect(calls[0]?.bodyJson?.['document']).toMatchObject({ type: format === 'pdf' ? 'document_url' : 'image_url' })
      for (const key of ['document_annotation_format', 'bbox_annotation_format', 'document_annotation_prompt']) {
        expect(calls[0]?.bodyJson).not.toHaveProperty(key)
      }
      expect(run.pages.map(page => page.text)).toEqual(['First synthetic page.', 'Second synthetic page.'])
      expect(run.pages.map(page => page.pageNumber)).toEqual([0, 1])
      expect(run.pages[0]?.mistralOcr).toEqual(pageMetadata)
      expect(run.pages[0]?.confidence).toBeUndefined()
      expect(run.pages[1]?.mistralOcr).toBeUndefined()
      const pages = remapOcrPagesToRange(run.pages, { startPage: 5, endPage: 6 })
      expect(pages.map(page => page.pageNumber)).toEqual([5, 6])
      const result = validateData(ExtractionResultSchema, { pages, text: pages.map(page => page.text).join('\n\n'), totalPages: 2, ocrPages: 2, textPages: 0 }, 'fixture')
      await writeProviderArtifacts(dir, result, 'text')
      expect((await Bun.file(join(dir, 'result.json')).json()).pages[0].mistralOcr).toEqual(pageMetadata)
      expect(await Bun.file(join(dir, 'extraction.txt')).text()).toBe('First synthetic page.\n\nSecond synthetic page.')
    })
  }

  test('missing and null optional confidence fields remain valid', async () => {
    const dir = await tempDirs.make()
    const input = join(dir, 'synthetic.png')
    await Bun.write(input, 'fixture')
    process.env['MISTRAL_API_KEY'] = 'mock-key'
    const { confidence_scores: _, ...withoutConfidence } = block
    installMockFetch(() => Response.json({ pages: [
      { index: 0, markdown: 'A', blocks: [withoutConfidence, { ...block, confidence_scores: null }], confidence_scores: null },
      { index: 1, markdown: 'B', blocks: null },
      { index: 2, markdown: 'C', blocks: [] }
    ] }))
    const run = await runMistralOcr(input, { slug: 'synthetic', format: 'png', pageCount: 3, fileSize: 7 }, model)
    expect(run.pages[0]?.mistralOcr?.blocks?.[0]?.confidence_scores).toBeUndefined()
    expect(run.pages[0]?.mistralOcr?.blocks?.[1]?.confidence_scores).toBeNull()
    expect(run.pages[0]?.mistralOcr?.confidence_scores).toBeNull()
    expect(run.pages[1]?.mistralOcr?.blocks).toBeNull()
    expect(run.pages[2]?.mistralOcr?.blocks).toEqual([])
  })

  test('ordinary and annotated pricing remain separate; unknown annotation tariffs reject', async () => {
    const dir = await tempDirs.make()
    const input = join(dir, 'synthetic.png')
    await Bun.write(input, 'fixture')
    const calls = installMockFetch(() => { throw new Error('Pricing must not call a provider') })
    expect(await estimateMistralOcrCost(model, input)).toMatchObject({ pageCount: 1, costPer1kPagesCents: 400, totalCost: 0.4 })
    expect(await estimateMistralOcrCost(model, input, { annotated: true })).toMatchObject({ costPer1kPagesCents: 500, totalCost: 0.5 })
    expect(await estimateMistralOcrCost('mistral-ocr-2512', input)).toMatchObject({ totalCost: 0.2 })
    expect(await estimateMistralOcrCost('mistral-ocr-4-0', input)).toMatchObject({ totalCost: 0.4 })
    await expect(estimateMistralOcrCost('mistral-ocr-2512', input, { annotated: true })).rejects.toThrow('Annotated OCR pricing is not configured')
    expect(calls).toHaveLength(0)
  })
})
