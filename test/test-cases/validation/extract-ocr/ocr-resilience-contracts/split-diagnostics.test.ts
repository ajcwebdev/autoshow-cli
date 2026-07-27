import { describe, expect, test } from 'bun:test'
import {
  captureLogEvents,
  createOcrPdfChunkWithLocalFallback,
  formatSplitPdfDiagnostic,
  join,
  mkdtemp,
  readFallbackAuditRollup,
  rm,
  tmpdir
} from './shared'

describe('OCR resilience contracts', () => {
  test('formatSplitPdfDiagnostic prefixes messages with the provider log label', () => {
    expect(formatSplitPdfDiagnostic(
      'qpdf failed for 1-1 (exit 2); falling back to mutool',
      { logLabel: 'Anthropic OCR' }
    )).toBe('Anthropic OCR: qpdf failed for 1-1 (exit 2); falling back to mutool')
    expect(formatSplitPdfDiagnostic('qpdf failed for 1-1 (exit 2); falling back to mutool'))
      .toBe('qpdf failed for 1-1 (exit 2); falling back to mutool')
  })

  test('rasterize fallback warning is prefixed with the provider label', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-split-label-'))
    try {
      const inputPath = join(tempDir, 'input.pdf')
      const outputPath = join(tempDir, 'chunk.pdf')
      await Bun.write(inputPath, '%PDF-1.7\nplaceholder\n')
      const { events } = await captureLogEvents(async () => {
        await createOcrPdfChunkWithLocalFallback({
          inputPath,
          outputPath,
          range: { startPage: 1, endPage: 1 },
          logLabel: 'Anthropic OCR',
          splitLogMode: 'silent',
          tools: {
            splitPdfPages: async () => ({ tool: 'qpdf', exitCode: 2, stderr: 'split failed', stdout: '' }),
            renderPageToImage: async (_filePath, _page, _dpi, outPath) => {
              await Bun.write(outPath, 'png-bytes')
              return { exitCode: 0, stderr: '', stdout: '' }
            },
            convertDocumentToPdf: async (_filePath, outPath) => {
              await Bun.write(outPath, '%PDF-1.7\nraster\n')
              return { exitCode: 0, stderr: '', stdout: '' }
            }
          }
        })
      })

      const warn = events.find((event) => event.message.includes('PDF chunk extraction failed'))
      expect(warn?.message).toBe('Anthropic OCR: PDF chunk extraction failed for page 1; rasterizing page to PDF')
      expect(await Bun.file(outputPath).exists()).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('readFallbackAuditRollup returns audit counts and tolerates corrupt state', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-audit-rollup-'))
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 1,
        pageStatusCounts: { cached: 0, resumed: 0, succeeded: 1, failed: 1, canceled: 3 },
        terminalReason: 'content_policy',
        chunkPreparation: {
          strategy: 'raster-only',
          directPageAttempts: 2,
          directSuccesses: 0,
          directFailures: 2,
          rasterizedPages: 2,
          directSplittingDisabled: true,
          tools: []
        }
      }, null, 2) + '\n')

      expect(await readFallbackAuditRollup(tempDir)).toEqual({
        pageStatusCounts: { cached: 0, resumed: 0, succeeded: 1, failed: 1, canceled: 3 },
        terminalReason: 'content_policy',
        chunkStrategy: 'raster-only',
        rasterizedPages: 2
      })

      await Bun.write(join(tempDir, 'fallback-state.json'), 'not json')
      expect(await readFallbackAuditRollup(tempDir)).toBeUndefined()
      expect(await readFallbackAuditRollup(undefined)).toBeUndefined()
      expect(await readFallbackAuditRollup(join(tempDir, 'missing-dir'))).toBeUndefined()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
