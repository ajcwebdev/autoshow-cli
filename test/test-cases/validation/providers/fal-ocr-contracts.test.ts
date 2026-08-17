import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runFalOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/fal-ocr/run-fal-ocr'
import { estimateFalOcrCost } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { resolveActualExtractCostEntry } from '~/cli/commands/pricing-orchestration/provider-family-resolvers'
import type { ExtractionMetadata } from '~/types'

const originalFetch = globalThis.fetch
const originalKey = process.env['FAL_API_KEY']

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env['FAL_API_KEY']
  else process.env['FAL_API_KEY'] = originalKey
})

describe('fal.ai GOT-OCR contracts', () => {
  test('submits a formatted single-image queue request and reads outputs', async () => {
    process.env['FAL_API_KEY'] = 'fal-test-key'
    const calls: Array<{ url: string, body?: Record<string, unknown> }> = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)
      calls.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) })
      if (url === 'https://queue.fal.run/fal-ai/got-ocr/v2') return Response.json({ status: 'COMPLETED', request_id: 'request-1' })
      if (url === 'https://queue.fal.run/fal-ai/got-ocr/v2/requests/request-1') return Response.json({ outputs: ['# Formatted page'] })
      throw new Error(`Unexpected fal.ai fetch: ${url}`)
    }) as typeof fetch

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-fal-ocr-'))
    try {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const result = await runFalOcr(imagePath, 'fal-ai/got-ocr/v2')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: '# Formatted page' }])
      expect(calls).toEqual([
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
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('submits Florence OCR with its single image_url input and reads results', async () => {
    process.env['FAL_API_KEY'] = 'fal-test-key'
    const calls: Array<{ url: string, body?: Record<string, unknown> }> = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)
      calls.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) })
      if (url === 'https://queue.fal.run/fal-ai/florence-2-large/ocr') return Response.json({ status: 'COMPLETED', request_id: 'request-2' })
      if (url === 'https://queue.fal.run/fal-ai/florence-2-large/ocr/requests/request-2') return Response.json({ results: 'Florence text' })
      throw new Error(`Unexpected fal.ai fetch: ${url}`)
    }) as typeof fetch

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-fal-ocr-'))
    try {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const result = await runFalOcr(imagePath, 'fal-ai/florence-2-large/ocr')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: 'Florence text' }])
      expect(calls).toEqual([
        {
          url: 'https://queue.fal.run/fal-ai/florence-2-large/ocr',
          body: { image_url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}` }
        },
        { url: 'https://queue.fal.run/fal-ai/florence-2-large/ocr/requests/request-2' }
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
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
