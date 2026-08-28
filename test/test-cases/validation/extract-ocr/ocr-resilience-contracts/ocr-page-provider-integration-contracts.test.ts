import { describe,expect,test } from 'bun:test'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { basePdfMetadata,join,jsonResponse,rm,runKimiOcr } from './shared'

describe('OCR resilience contracts', () => {

  test('Kimi image OCR uses page-level bounded retry attempts for structured page failures', async () => {
    const previousFetch = globalThis.fetch
    const previousSleep = Bun.sleep
    const previousEnv = {
      KIMI_API_KEY: process.env['KIMI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-kimi-page-retry-')
    const inputPath = join(tempDir, 'input.png')
    let attempts = 0

    try {
      await Bun.write(inputPath, new Uint8Array([137, 80, 78, 71]))
      process.env['KIMI_API_KEY'] = 'test-key'
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
      installMockFetch((_call, _input, init) => {
        attempts += 1
        expect(init?.signal).toBeDefined()
        return jsonResponse({
          choices: [{
            finish_reason: 'length',
            message: { content: 'partial page text' }
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 6
          }
        })
      })

      await expect(runKimiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'png',
        fileSize: 4
      }, 'kimi-k2.6', {
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrPreparationCache: undefined,
        ocrConcurrency: undefined
      })).rejects.toThrow('kimi-ocr input image failed after 2/2 attempts')

      expect(attempts).toBe(2)
    } finally {
      globalThis.fetch = previousFetch
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
      if (previousEnv.KIMI_API_KEY === undefined) {
        delete process.env['KIMI_API_KEY']
      } else {
        process.env['KIMI_API_KEY'] = previousEnv.KIMI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
