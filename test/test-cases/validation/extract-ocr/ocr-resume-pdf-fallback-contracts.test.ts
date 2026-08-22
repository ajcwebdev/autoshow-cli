import { describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { runHostedOcrWithPdfChunkFallback } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { pagesForOcrRange as pagesForRange } from '../../../test-utils/ocr-page-fixtures'
import { basePdfMetadata, hostedRun, pageCachePath, pageTextPath, writeCachedPage } from './ocr-resume-fixture'

describe('OCR resume contracts', () => {
  test('hosted PDF page fallback resume skips cached pages and starts at the first missing page', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-page-resume-')
    try {
      await writeCachedPage(tempDir, 1, 4)
      await writeCachedPage(tempDir, 2, 4)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: basePdfMetadata,
        serviceLabel: 'Test OCR',
        totalPages: 4,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      // Pages run concurrently, so attemptedPages records completion order; compare as a set.
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([3, 4])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 4\npage 4')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF fallback state bypasses full-document OCR even before page results exist', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-fallback-state-')
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 2,
        mode: 'single-page',
        totalPages: 2,
        serviceLabel: 'Test OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      let fullAttempts = 0
      const attemptedPages: number[] = []
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([1, 2])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('v1 hosted PDF fallback state misses cleanly and runs full-document OCR', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-fallback-state-v1-')
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 1,
        mode: 'single-page',
        totalPages: 2,
        serviceLabel: 'Test OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      let fullAttempts = 0
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          return hostedRun(pagesForRange(1, 2), { totalPages: 2 })
        },
        createChunk: async () => {
          throw new Error('v1 fallback state must not enter page mode')
        },
        runChunk: async () => {
          throw new Error('v1 fallback state must not call the provider page path')
        }
      })

      expect(fullAttempts).toBe(1)
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF page fallback ignores corrupt or mismatched page cache files', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-page-cache-invalid-')
    try {
      await mkdir(join(tempDir, 'page-results'), { recursive: true })
      await Bun.write(pageCachePath(tempDir, 1), '{bad json')
      await writeCachedPage(
        tempDir,
        2,
        3,
        hostedRun([{ pageNumber: 99, method: 'ocr', text: 'wrong page' }], { totalPages: 1 })
      )
      await writeCachedPage(tempDir, 3, 3)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Test OCR',
        totalPages: 3,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([1, 2])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
