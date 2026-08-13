import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { readInputList } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection'
import { parseStoredHostedOcrPageCache } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-state'
import { HOSTED_OCR_PDF_PAGE_FALLBACK_MODE, HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-shared'
import { fileFingerprintsMatch, getFileFingerprint, readJsonCacheMap, writeJsonCacheEntry } from '~/utils/file-fingerprint-cache'

describe('ADR-021 file cache contracts', () => {
  it('invalidates a batch-list entry when same-size content changes with a restored mtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-batch-cache-contract-'))
    const listPath = join(root, 'inputs.txt')

    try {
      await writeFile(listPath, 'https://example.com/one\n')
      const originalStats = await stat(listPath)
      const originalFingerprint = await getFileFingerprint(listPath)

      expect(await readInputList(listPath)).toEqual(['https://example.com/one'])

      await Bun.sleep(10)
      await writeFile(listPath, 'https://example.com/two\n')
      await utimes(listPath, originalStats.atime, originalStats.mtime)

      const changedFingerprint = await getFileFingerprint(listPath)
      expect(fileFingerprintsMatch(originalFingerprint, changedFingerprint)).toBe(false)
      expect(await readInputList(listPath)).toEqual(['https://example.com/two'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('serializes concurrent cache updates without losing entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-json-cache-contract-'))
    const cachePath = join(root, 'cache.json')
    const lockName = `file-cache-contract-${basename(root)}`

    try {
      await Promise.all(Array.from({ length: 25 }, async (_, index) => {
        await writeJsonCacheEntry({
          cachePath,
          lockName,
          key: `key-${index}`,
          value: { index }
        })
      }))

      const cache = await readJsonCacheMap<{ index: number }>(cachePath)
      expect(Object.keys(cache)).toHaveLength(25)
      expect(cache['key-0']).toEqual({ index: 0 })
      expect(cache['key-24']).toEqual({ index: 24 })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not reuse hosted OCR page results across reasoning policies', () => {
    const storedPage = {
      version: HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
      mode: HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
      totalPages: 1,
      pageNumber: 1,
      sourceFile: 'input.pdf',
      run: {
        pages: [{ pageNumber: 1, method: 'ocr', text: 'cached text' }],
        extractionMethod: 'kimi-ocr',
        ocrService: 'kimi',
        ocrModel: 'kimi-k2.6',
        totalPages: 1,
        requestedReasoningEffort: 'disabled',
        effectiveReasoningEffort: 'disabled'
      }
    }

    expect(parseStoredHostedOcrPageCache(storedPage, {
      sourceFile: 'input.pdf',
      identity: {
        extractionMethod: 'kimi-ocr',
        ocrService: 'kimi',
        ocrModel: 'kimi-k2.6',
        requestedReasoningEffort: 'disabled',
        effectiveReasoningEffort: 'disabled'
      }
    })).toBeDefined()

    expect(parseStoredHostedOcrPageCache(storedPage, {
      sourceFile: 'input.pdf',
      identity: {
        extractionMethod: 'kimi-ocr',
        ocrService: 'kimi',
        ocrModel: 'kimi-k2.6',
        requestedReasoningEffort: 'default',
        effectiveReasoningEffort: 'disabled'
      }
    })).toBeUndefined()
  })
})
