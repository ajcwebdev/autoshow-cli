import { describe,expect,test } from 'bun:test'
import { runHostedOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/hosted-ocr'
import type { ExtractionOptions } from '~/types'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { basePdfMetadata,createOcrPreparationCache,join,jsonResponse,prefillRenderedPageCache,rm } from './shared'

describe('OCR resilience contracts', () => {

  test('Kimi rendered page OCR uses the shared fallback default concurrency without adaptive throttling', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      KIMI_API_KEY: process.env['KIMI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-kimi-default-page-concurrency-')
    const inputPath = join(tempDir, 'input.pdf')
    const renderDir = join(tempDir, 'renders')
    const cache = createOcrPreparationCache()
    const pages = Array.from({ length: 12 }, (_value, index) => index + 1)
    const starts: number[] = []
    let activeRequests = 0
    let maxActiveRequests = 0
    let releaseFirstWindow!: () => void
    const firstWindowRelease = new Promise<void>(resolve => {
      releaseFirstWindow = resolve
    })

    const readPageNumber = (body: Record<string, unknown>): number => {
      const messages = body['messages'] as Array<Record<string, unknown>>
      const content = messages[0]?.['content'] as Array<Record<string, unknown>>
      const imagePart = content.find(part => part['type'] === 'image_url')
      const imageUrl = (imagePart?.['image_url'] as Record<string, unknown> | undefined)?.['url']
      if (typeof imageUrl !== 'string') {
        throw new Error('Kimi test request did not include an image URL')
      }
      const encoded = imageUrl.split(',')[1] ?? ''
      const decoded = Buffer.from(encoded, 'base64').toString('utf8')
      const match = /rendered page (\d+)/.exec(decoded)
      if (!match?.[1]) {
        throw new Error(`Kimi test request used unexpected image data: ${decoded}`)
      }
      return Number(match[1])
    }

    try {
      await Bun.write(inputPath, '%PDF-1.7 test placeholder')
      await prefillRenderedPageCache(cache, renderDir, inputPath, pages, 300)
      process.env['KIMI_API_KEY'] = 'test-key'
      installMockFetch(async (call) => {
        const pageNumber = readPageNumber(call.bodyJson ?? {})
        starts.push(pageNumber)
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        try {
          if (pageNumber <= 10) {
            await firstWindowRelease
          }
          return jsonResponse({
            choices: [{
              finish_reason: 'stop',
              message: { content: `page ${pageNumber}` }
            }],
            usage: {
              prompt_tokens: pageNumber,
              completion_tokens: pageNumber * 10
            }
          })
        } finally {
          activeRequests -= 1
        }
      })

      const run = runHostedOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: pages.length,
        format: 'pdf',
        fileSize: 128
      }, {
        filePath: inputPath,
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrPreparationCache: cache,
        ocrConcurrency: undefined,
        kimiOcrModel: 'kimi-k2.6'
      } as ExtractionOptions)

      for (let attempt = 0; attempt < 500 && starts.length < 10; attempt++) {
        await Bun.sleep(1)
      }
      const initialStarts = [...starts]
      releaseFirstWindow()

      const result = await run
      expect(initialStarts).toHaveLength(10)
      expect(initialStarts.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(maxActiveRequests).toBe(10)
      expect(starts.slice().sort((a, b) => a - b)).toEqual(pages)
      expect(result.pages.map(page => page.text)).toEqual(pages.map(page => `page ${page}`))
      expect(result.providerUsage?.map(entry => entry['unit'])).toEqual(pages.map(() => 'chunk'))
    } finally {
      releaseFirstWindow?.()
      globalThis.fetch = previousFetch
      if (previousEnv.KIMI_API_KEY === undefined) {
        delete process.env['KIMI_API_KEY']
      } else {
        process.env['KIMI_API_KEY'] = previousEnv.KIMI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
