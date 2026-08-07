import { expect, test } from 'bun:test'
import {
  buildExtractionOptions,
  configureBinDir,
  getConfiguredBinDir,
  join,
  mkdtemp,
  prepareDocumentMetadata,
  resolveEbookConvertCommand,
  resolveOcrStep2ExecutionFromFormat,
  rm,
  runOcr,
  tmpdir,
  withFakeEbookConvert,
  writeFile
} from './shared'

test('normalizable ebook metadata records source format and EPUB normalization chain', async () => {
  await withFakeEbookConvert(async (root) => {
    const cases = [
      ['book.mobi', 'mobi'],
      ['book.prc', 'mobi'],
      ['book.azw3', 'azw3'],
      ['book.azw', 'azw3'],
      ['book.fb2', 'fb2'],
      ['book.lit', 'lit']
    ] as const

    for (const [fileName, sourceFormat] of cases) {
      const sourcePath = join(root, fileName)
      await writeFile(sourcePath, 'fake ebook input')
      const prepared = await prepareDocumentMetadata(sourcePath)
      try {
        expect(prepared.step1Metadata.format).toBe('epub')
        expect(prepared.step1Metadata.sourceFormat).toBe(sourceFormat)
        expect(prepared.step1Metadata.normalizedFormat).toBe('epub')
        expect(prepared.step1Metadata.conversionChain).toEqual(['calibre'])
        expect(prepared.step1Metadata.fileSize).toBe('fake ebook input'.length)
        expect(prepared.effectiveFilePath).toEndWith('converted.epub')
        expect(await Bun.file(prepared.effectiveFilePath ?? '').exists()).toBe(true)
      } finally {
        await prepared.tempCleanup?.()
      }
    }
  })
})

test('normalizable ebook extraction follows EPUB chapter, length, and inspect behavior', async () => {
  await withFakeEbookConvert(async (root) => {
    const sourcePath = join(root, 'normalized-source.azw3')
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-normalized-ebook-output-'))
    await writeFile(sourcePath, 'fake azw3 input')
    const prepared = await prepareDocumentMetadata(sourcePath)
    const epubPath = prepared.effectiveFilePath ?? sourcePath

    try {
      const defaultRun = await runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir)
      )
      expect(defaultRun.step2Metadata.extractionMethod).toBe('epub-text')
      expect(defaultRun.step2Metadata.inputFamily).toBe('epub')
      expect(defaultRun.step2Metadata.normalizedFrom).toBe('azw3')
      expect(defaultRun.step2Metadata.conversionChain).toEqual(['calibre'])
      expect(defaultRun.step2Metadata.chapterExport?.sourceFormat).toBe('epub')
      expect(defaultRun.step2Metadata.chapterExport?.normalizedFrom).toBe('azw3')
      expect(defaultRun.step2Metadata.chapterExport?.mode).toBe('chapters')
      expect(defaultRun.artifactFiles?.some((file) => file.relativePath.startsWith('chapters/'))).toBe(true)

      const noChapterRun = await runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir, { epubChapterFiles: false })
      )
      expect(noChapterRun.step2Metadata.chapterExport).toBeUndefined()
      expect(noChapterRun.artifactFiles).toBeUndefined()

      const lengthRun = await runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir, { epubChunkLimitChars: 30 })
      )
      expect(lengthRun.step2Metadata.chapterExport?.sourceFormat).toBe('epub')
      expect(lengthRun.step2Metadata.chapterExport?.normalizedFrom).toBe('azw3')
      expect(lengthRun.step2Metadata.chapterExport?.chunkLimitChars).toBe(30)
      expect(lengthRun.artifactFiles?.some((file) => file.relativePath.includes('-part-'))).toBe(true)

      const inspectRun = await runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir, {
          outputFormat: 'json',
          useEpubBun: true
        })
      )
      expect(inspectRun.step2Metadata.extractionMethod).toBe('epub-bun')
      expect(inspectRun.step2Metadata.normalizedFrom).toBe('azw3')
      expect(inspectRun.step2Metadata.conversionChain).toEqual(['calibre'])
      expect(inspectRun.step2Metadata.epub).toBeDefined()
    } finally {
      await prepared.tempCleanup?.()
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})

test('missing ebook-convert error names normalizable ebook setup', () => {
  const previousBinDir = getConfiguredBinDir()
  configureBinDir('')
  try {
    expect(() => resolveEbookConvertCommand({
      resolveCalibreBin: () => 'ebook-convert',
      which: () => null
    })).toThrow('Calibre is required to convert normalizable ebook files')
  } finally {
    configureBinDir(previousBinDir ?? '')
  }
})

test('normalizable ebook routing resolves to the EPUB native path', () => {
  const emptyOptions = {} as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[1]
  for (const format of ['mobi', 'azw3', 'fb2', 'lit'] as const) {
    expect(resolveOcrStep2ExecutionFromFormat(format, emptyOptions)).toEqual({
      route: 'native-document',
      sourceKind: 'epub'
    })
  }
})
