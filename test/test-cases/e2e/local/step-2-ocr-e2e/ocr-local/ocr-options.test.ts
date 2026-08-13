import { test, expect, beforeAll, afterAll } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { cleanupTestOutput, runCommand, fileExists, findLatestDirectory, ensurePageImageFixture } from '../../../../../test-utils/test-helpers'
import { readCanonicalManifest, readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import type { OcrE2eExtractMetadata } from '~/types'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'

const pdfInput = 'input/examples/document/1-document.pdf'
const multiPagePdfInput = 'input/examples/document/3-document.pdf'
const epubInput = 'input/examples/document/1-epub.epub'
const imageInput = 'input/examples/document/1-document.png'
const articleUrl = 'https://ajcwebdev.com'

const requireOutputDir = (outputDir: string | null, title: string): string => {
  if (!outputDir) {
    throw new Error(`Expected output directory for ${title}`)
  }
  return outputDir
}

beforeAll(async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('3-document')
  await cleanupTestOutput('1-epub')
})

afterAll(async () => {
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('3-document')
  await cleanupTestOutput('1-epub')
})

test('extract PDF with default options', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput], { testName: 'extract PDF with default options' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-document', result.outputRoot), '1-document')

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/${PIPELINE_MANIFEST_FILE}`)).toBe(true)

  const manifest = await readCanonicalManifest(outputDir)
  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(manifest.command).toBe('extract')
  expect(manifest.items[0]?.extractRoute).toBe('document')
  expect(metadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'pdf',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'default' }]
  })
  expect(metadata.requestedProviders).toEqual([{ service: 'tesseract', model: 'tesseract' }])
  expect(metadata.providerStates).toMatchObject([
    {
      service: 'tesseract',
      model: 'tesseract',
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }
  ])
  expect(metadata.missingProviders).toEqual([])
})

test('extract PDF with --out json', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--format', 'json'], { testName: 'extract PDF with --out json' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-document', result.outputRoot), '1-document')

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
})

test('extract EPUB with default options writes cleaned text and chapter metadata without synthetic page labels', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput], { testName: 'extract EPUB with default options writes cleaned text and chapter metadata without synthetic page labels' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  const extractionText = await Bun.file(`${outputDir}/extraction.txt`).text()
  expect(extractionText.startsWith('Page 1\n')).toBe(false)
  expect(extractionText).toContain('Chapter 1: Introduction to AutoShow')

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-text')
  expect(metadata.step2?.outputFidelity).toBe('cleaned-epub-text')
  expect(metadata.step2?.chapterExport).toMatchObject({
    sourceFormat: 'epub',
    mode: 'chapters',
    directories: ['chapters']
  })
  expect(metadata.resolvedStep2).toMatchObject({
    route: 'native-document',
    sourceKind: 'epub'
  })
  expect(metadata.requestedProviders).toEqual([])
  expect(metadata.providerStates).toEqual([])
  expect(metadata.missingProviders).toEqual([])
})

test('extract image with explicit --tesseract matches the default local OCR path', async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')

  const defaultResult = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput], {
    testName: 'extract image with default local OCR path'
  })
  expect(defaultResult.exitCode).toBe(0)

  const defaultOutputDir = requireOutputDir(defaultResult.outputDir ?? await findLatestDirectory('1-document', defaultResult.outputRoot), '1-document')

  const defaultMetadata = await readCanonicalRecord(defaultOutputDir) as OcrE2eExtractMetadata

  await cleanupTestOutput('1-document')

  const explicitResult = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, '--provider', 'tesseract'], {
    testName: 'extract image with explicit --tesseract'
  })
  expect(explicitResult.exitCode).toBe(0)

  const explicitOutputDir = requireOutputDir(explicitResult.outputDir ?? await findLatestDirectory('1-document', explicitResult.outputRoot), '1-document')

  const explicitMetadata = await readCanonicalRecord(explicitOutputDir) as OcrE2eExtractMetadata
  expect(defaultMetadata.step2?.extractionMethod).toBe('image+tesseract')
  expect(defaultMetadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'image',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'default' }]
  })
  expect(explicitMetadata.step2?.extractionMethod).toBe(defaultMetadata.step2?.extractionMethod)
  expect(explicitMetadata.step2?.totalPages).toBe(defaultMetadata.step2?.totalPages)
  expect(explicitMetadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'image',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'explicit' }]
  })
  expect(explicitMetadata.requestedProviders).toEqual([{ service: 'tesseract', model: 'tesseract' }])
  expect(explicitMetadata.providerStates).toMatchObject([
    {
      service: 'tesseract',
      model: 'tesseract',
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }
  ])
  expect(explicitMetadata.missingProviders).toEqual([])
})

test('bun autoshow extract https://ajcwebdev.com --url-provider defuddle', async () => {
  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'defuddle'],
      { testName: 'bun autoshow extract https://ajcwebdev.com --url-provider defuddle' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = requireOutputDir(result.outputDir, 'defuddle URL extraction')

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+defuddle')
    expect(metadata.resolvedStep2).toMatchObject({
      route: 'article',
      sourceKind: 'article',
      providers: [{ service: 'defuddle', model: 'defuddle' }]
    })
    expect(metadata.requestedProviders).toEqual([{ service: 'defuddle', model: 'defuddle' }])
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

test('extract EPUB with --epub-bun writes structured data into the canonical manifest only', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun'], { testName: 'extract EPUB with --epub-bun writes structured data into the canonical manifest only' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  expect(await fileExists(join(outputDir, PIPELINE_MANIFEST_FILE))).toBe(true)
  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-bun')
  expect(typeof metadata.step2?.epub).toBe('object')
})

test('extract EPUB with --epub-bun uses Bun EPUB reader', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun'], { testName: 'extract EPUB with --epub-bun uses Bun EPUB reader' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-bun')
  expect(typeof metadata.step2?.epub).toBe('object')
})

test('extract EPUB writes chapter files by default and metadata summary', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--length', '5'], { testName: 'extract EPUB writes chapter files by default and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  const chapterFiles = (await readdir(`${outputDir}/chapters`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chapterFiles.length).toBeGreaterThan(0)
  expect(await fileExists(`${outputDir}/chunks`)).toBe(false)

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('epub')
  expect(metadata.step2?.chapterExport?.mode).toBe('chapters')
  expect(metadata.step2?.chapterExport?.chunkLimitChars).toBe(5000)
  expect(metadata.step2?.chapterExport?.directories).toEqual(['chapters'])
  expect(metadata.step2?.chapterExport?.logicalChapterCount).toBeGreaterThan(0)
  expect(metadata.step2?.chapterExport?.logicalChapterSource).toMatch(/^(toc|spine|heading)$/)

  const firstChapter = await Bun.file(`${outputDir}/chapters/${chapterFiles[0]}`).text()
  expect(firstChapter.startsWith('Chapter 1:')).toBe(true)
})

test('extract EPUB with --no-chapters and --length writes chunk files and metadata summary', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--no-chapters', '--length', '1'], { testName: 'extract EPUB with --no-chapters and --length writes chunk files and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  const chunkFiles = (await readdir(`${outputDir}/chunks`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chunkFiles.length).toBeGreaterThan(1)
  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('epub')
  expect(metadata.step2?.chapterExport?.mode).toBe('chunks')
  expect(metadata.step2?.chapterExport?.chunkLimitChars).toBe(1000)
  expect(metadata.step2?.chapterExport?.directories).toEqual(['chunks'])
})

test('extract PDF with --chapters writes chapter files and diagnostics', async () => {
  await cleanupTestOutput('3-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', multiPagePdfInput, '--chapters', '--format', 'json'], { testName: 'extract PDF with --chapters writes chapter files and diagnostics' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('3-document', result.outputRoot), '3-document')

  const chapterFiles = (await readdir(`${outputDir}/chapters`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chapterFiles.length).toBeGreaterThan(0)

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('pdf')
  expect(metadata.step2?.chapterExport?.mode).toBe('chapters')
  expect(metadata.step2?.chapterExport?.directories).toEqual(['chapters'])
  expect(Array.isArray(metadata.step2?.pdfChapterDetection?.chapters)).toBe(true)
  expect((metadata.step2?.pdfChapterDetection?.chapters ?? []).length).toBeGreaterThan(0)
})

test('extract EPUB inspect mode ignores chapter export flags', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun', '--chapters'], { testName: 'extract EPUB inspect mode ignores chapter export flags' })
  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('EPUB export flags (--chapters, --no-chapters, --length) are ignored when using EPUB inspect mode.')

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-epub', result.outputRoot), '1-epub')

  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)

  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-bun')
  expect(metadata.step2?.chapterExport).toBeUndefined()
})

test('extract non-EPUB-non-PDF ignores chapter export flags', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, '--chapters', '--format', 'json'], { testName: 'extract non-EPUB-non-PDF ignores chapter export flags' })
  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Chapter export flags (--chapters, --no-chapters, --length) are ignored for inputs other than EPUB and PDF.')

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-document', result.outputRoot), '1-document')

  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)
  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.chapterExport).toBeUndefined()
})

test('extract rejects non-json --format with EPUB inspect mode', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun', '--format', 'text'])
  expect(result.exitCode).not.toBe(0)
})

test('extract non-EPUB with --epub-bun falls back to normal extraction flow', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--epub-bun'], { testName: 'extract non-EPUB with --epub-bun falls back to normal extraction flow' })
  expect(result.exitCode).toBe(0)

  const outputDir = requireOutputDir(result.outputDir ?? await findLatestDirectory('1-document', result.outputRoot), '1-document')

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
  expect(metadata.step2?.extractionMethod).not.toBe('epub-bun')
})
