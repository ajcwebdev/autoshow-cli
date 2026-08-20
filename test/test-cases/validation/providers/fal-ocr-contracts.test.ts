import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runFalOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/fal-ocr/run-fal-ocr'
import { estimateFalOcrCost } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { resolveActualExtractCostEntry } from '~/cli/commands/pricing-orchestration/provider-family-resolvers'
import type { ExtractionMetadata } from '~/types'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['FAL_API_KEY'],
  tempPrefix: 'autoshow-fal-ocr-'
})

const recordedCalls = (calls: ReturnType<typeof installMockFetch>): Array<{ url: string, body?: Record<string, unknown> }> =>
  calls.map((call) => ({ url: call.url, ...(call.bodyJson ? { body: call.bodyJson } : {}) }))

describe('fal.ai GOT-OCR contracts', () => {
  test('submits a formatted single-image queue request and reads outputs', async () => {
    process.env['FAL_API_KEY'] = 'fal-test-key'
    const calls = installMockFetch((call) => {
      if (call.url === 'https://queue.fal.run/fal-ai/got-ocr/v2') return Response.json({ status: 'COMPLETED', request_id: 'request-1' })
      if (call.url === 'https://queue.fal.run/fal-ai/got-ocr/v2/requests/request-1') return Response.json({ outputs: ['# Formatted page'] })
      throw new Error(`Unexpected fal.ai fetch: ${call.url}`)
    })

    await tempDirs.withDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const result = await runFalOcr(imagePath, 'fal-ai/got-ocr/v2')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: '# Formatted page' }])
      expect(recordedCalls(calls)).toEqual([
        {
          url: 'https://queue.fal.run/fal-ai/got-ocr/v2',
          body: {
            input_image_urls: [`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`],
            do_format: true,
            multi_page: false
          }
        },
        { url: 'https://queue.fal.run/fal-ai/got-ocr/v2/requests/request-1' }
      ])
    })
  })

  test('submits Florence OCR with its single image_url input and reads results', async () => {
    process.env['FAL_API_KEY'] = 'fal-test-key'
    const calls = installMockFetch((call) => {
      if (call.url === 'https://queue.fal.run/fal-ai/florence-2-large/ocr') return Response.json({ status: 'COMPLETED', request_id: 'request-2' })
      if (call.url === 'https://queue.fal.run/fal-ai/florence-2-large/ocr/requests/request-2') return Response.json({ results: 'Florence text' })
      throw new Error(`Unexpected fal.ai fetch: ${call.url}`)
    })

    await tempDirs.withDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const result = await runFalOcr(imagePath, 'fal-ai/florence-2-large/ocr')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: 'Florence text' }])
      expect(recordedCalls(calls)).toEqual([
        {
          url: 'https://queue.fal.run/fal-ai/florence-2-large/ocr',
          body: { image_url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}` }
        },
        { url: 'https://queue.fal.run/fal-ai/florence-2-large/ocr/requests/request-2' }
      ])
    })
  })

  test('uses the benchmark-calibrated Florence compute-second estimate', async () => {
    await expect(estimateFalOcrCost('fal-ai/florence-2-large/ocr', 'input/examples/document/1-document.jpg'))
      .resolves.toMatchObject({ pageCount: 1, costPer1kPagesCents: 755, totalCost: 0.755 })
  })

  test('uses the benchmark-calibrated estimate for Florence completed runs', () => {
    const metadata = {
      extractionMethod: 'image+fal-ocr',
      totalPages: 1,
      ocrService: 'fal',
      ocrModel: 'fal-ai/florence-2-large/ocr'
    } as ExtractionMetadata

    expect(resolveActualExtractCostEntry(metadata, 'fal', 'fal-ai/florence-2-large/ocr')).toMatchObject({
      cost: 0.755,
      costSource: 'registry_fallback'
    })
  })
})
