import { afterEach, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import {
  buildExtractionOptions,
  chmod,
  configureBinDir,
  EXAMPLE_EPUB_PATH,
  getConfiguredBinDir,
  join,
  mkdir,
  mkdtemp,
  prepareDocumentMetadata,
  resolve,
  rm,
  runOcr,
  tmpdir,
  withStandardEpubContainer,
  writeFile,
  writeStoredZip
} from './shared'
import { classifyInputFamily, classifyUrlInput } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { ACSM_PRICE_NOTE, fulfillAcsmToDocument, resolveAcsmFulfillCommand } from '~/cli/commands/process-steps/step-1-download/document/acsm-fulfillment'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { runCommand } from '../../../../test-utils/test-helpers'
import type { AcsmFakeFulfillMode, CommandPricingOptions } from '~/types'

const EXAMPLE_PDF_PATH = resolve('input/examples/document/1-document.pdf')
const tempDirs: string[] = []

const EPUB_UNREADABLE_ERROR = 'AutoShow does not remove DRM'

const createTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const acsmWithExpiration = (expiration: string | undefined): string => [
  '<adept:fulfillmentToken xmlns:adept="http://ns.adobe.com/adept">',
  ...(expiration === undefined ? [] : [`  <adept:expiration>${expiration}</adept:expiration>`]),
  '</adept:fulfillmentToken>'
].join('\n')

const writeFakeMutool = async (binDir: string): Promise<void> => {
  const fakeMutoolPath = join(binDir, 'mutool')
  await writeFile(fakeMutoolPath, [
    '#!/usr/bin/env bun',
    'const args = process.argv.slice(2)',
    "if (args[0] === 'draw') {",
    '  console.log("page fake 1")',
    '} else {',
    '  console.log("Pages: 1\\nTitle: Fulfilled Title\\nAuthor: Fulfilled Author")',
    '}'
  ].join('\n'))
  await chmod(fakeMutoolPath, 0o755)
}

const encryptedSpineEpubFiles = (): Record<string, string> => withStandardEpubContainer({
  'META-INF/encryption.xml': `
    <encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
      <enc:EncryptedData>
        <enc:CipherData>
          <enc:CipherReference URI="OEBPS/Text/chapter.xhtml"/>
        </enc:CipherData>
      </enc:EncryptedData>
    </encryption>
  `,
  'OEBPS/content.opf': `
    <package>
      <manifest>
        <item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine><itemref idref="chapter"/></spine>
    </package>
  `,
  'OEBPS/Text/chapter.xhtml': `\u0000\u0001\u0002${'\uFFFD'.repeat(20)}encrypted payload`
})

const writeFakeAcsmFulfill = async (
  binDir: string,
  mode: AcsmFakeFulfillMode,
  markerPath?: string,
  encryptedEpubFixturePath?: string
): Promise<void> => {
  const fakeFulfillPath = join(binDir, 'calibre-acsm-fulfill')
  const outputLines = (() => {
    if (mode === 'zero') return ['// no fulfilled output']
    if (mode === 'multiple') {
      return [
        `copyFileSync(${JSON.stringify(EXAMPLE_EPUB_PATH)}, join(outputDir, 'fulfilled.epub'))`,
        `copyFileSync(${JSON.stringify(EXAMPLE_PDF_PATH)}, join(outputDir, 'fulfilled.pdf'))`
      ]
    }
    if (mode === 'pdf') {
      return [`copyFileSync(${JSON.stringify(EXAMPLE_PDF_PATH)}, join(outputDir, 'fulfilled.pdf'))`]
    }
    if (mode === 'encrypted-epub') {
      if (!encryptedEpubFixturePath) {
        throw new Error('encrypted EPUB fixture path is required')
      }
      return [`copyFileSync(${JSON.stringify(encryptedEpubFixturePath)}, join(outputDir, 'fulfilled.epub'))`]
    }
    if (mode === 'fail') {
      return [
        "console.error('activation path /Users/alice/Library/Application Support/calibre/acsm/account.json backup /tmp/private/activation.zip key=SECRETKEY')",
        'process.exit(9)'
      ]
    }
    return [`copyFileSync(${JSON.stringify(EXAMPLE_EPUB_PATH)}, join(outputDir, 'fulfilled.epub'))`]
  })()

  await writeFile(fakeFulfillPath, [
    '#!/usr/bin/env bun',
    "import { copyFileSync, writeFileSync } from 'node:fs'",
    "import { join } from 'node:path'",
    'const inputPath = process.argv[2]',
    'const outputDir = process.argv[3]',
    'if (!inputPath || !outputDir) process.exit(2)',
    ...(markerPath ? [`writeFileSync(${JSON.stringify(markerPath)}, inputPath + '\\n')`] : []),
    ...outputLines
  ].join('\n'))
  await chmod(fakeFulfillPath, 0o755)
}

const withFakeAcsmFulfill = async <T>(
  mode: AcsmFakeFulfillMode,
  fn: (root: string, binDir: string) => Promise<T>,
  options: { markerPath?: string | undefined } = {}
): Promise<T> => {
  const root = await createTempRoot('autoshow-fake-acsm-')
  const binDir = join(root, 'bin')
  await mkdir(binDir, { recursive: true })
  await writeFakeMutool(binDir)
  const encryptedEpubFixturePath = mode === 'encrypted-epub'
    ? join(root, 'encrypted-spine.epub')
    : undefined
  if (encryptedEpubFixturePath) {
    await writeStoredZip(encryptedEpubFixturePath, encryptedSpineEpubFiles())
  }
  await writeFakeAcsmFulfill(binDir, mode, options.markerPath, encryptedEpubFixturePath)

  const previousPath = process.env['PATH']
  const previousBinDir = getConfiguredBinDir()
  process.env['PATH'] = `${binDir}:${previousPath ?? ''}`
  configureBinDir(binDir)
  try {
    return await fn(root, binDir)
  } finally {
    if (previousPath === undefined) {
      delete process.env['PATH']
    } else {
      process.env['PATH'] = previousPath
    }
    configureBinDir(previousBinDir ?? '')
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('ACSM local and URL inputs classify as document inputs', async () => {
  const root = await createTempRoot('autoshow-acsm-classify-')
  const acsmPath = join(root, 'book.acsm')
  await writeFile(acsmPath, '<adept:fulfillmentToken />')

  await expect(classifyInputFamily(acsmPath)).resolves.toBe('document')
  await expect(classifyUrlInput('https://example.com/books/book.acsm')).resolves.toBe('url_direct_document')
  await expect(resolveInputRoutingForCommand('extract', acsmPath)).resolves.toMatchObject({
    family: 'document',
    extractRoute: 'document',
    resolvedStep2: {
      route: 'native-document',
      sourceKind: 'acsm'
    }
  })
})

test('ACSM content-disposition and content-type hints classify URLs as document inputs', async () => {
  const previousFetch = globalThis.fetch
  const responses = [
    new Response('', { headers: { 'content-disposition': 'attachment; filename="book.acsm"' } }),
    new Response('', { headers: { 'content-type': 'application/vnd.adobe.adept+xml' } })
  ]
  let index = 0
  globalThis.fetch = (async () => responses[index++] ?? responses[responses.length - 1]!) as unknown as typeof fetch
  try {
    await expect(classifyUrlInput('https://example.com/download')).resolves.toBe('url_direct_document')
    await expect(classifyUrlInput('https://example.com/license')).resolves.toBe('url_direct_document')
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('missing ACSM fulfillment wrapper reports setup error', async () => {
  const root = await createTempRoot('autoshow-missing-acsm-')

  expect(() => resolveAcsmFulfillCommand({
    overrideBinDir: root,
    exists: () => false,
    which: () => null
  })).toThrow('ACSM fulfillment requires calibre-acsm-fulfill')
})

test('fulfillAcsmToDocument invokes the wrapper with an absolute ACSM path', async () => {
  const markerRoot = await createTempRoot('autoshow-acsm-absolute-marker-')
  const markerPath = join(markerRoot, 'input-arg.txt')

  await withFakeAcsmFulfill('epub', async (root) => {
    const acsmPath = join(root, 'relative-input.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')

    const relativeAcsmPath = relative(process.cwd(), acsmPath)
    const fulfilled = await fulfillAcsmToDocument(relativeAcsmPath)
    try {
      expect(await readFile(markerPath, 'utf8')).toBe(`${resolve(relativeAcsmPath)}\n`)
    } finally {
      await fulfilled.tempCleanup()
    }
  }, { markerPath })
})

test('expired ACSM tokens fail before fulfillment wrapper invocation', async () => {
  const markerRoot = await createTempRoot('autoshow-acsm-expired-marker-')
  const markerPath = join(markerRoot, 'invoked.txt')

  await withFakeAcsmFulfill('epub', async (root) => {
    const acsmPath = join(root, 'expired.acsm')
    await writeFile(acsmPath, acsmWithExpiration('2026-07-15T07:22:18Z'))

    await expect(fulfillAcsmToDocument(acsmPath, {
      now: () => new Date('2026-07-15T08:00:00.000Z')
    })).rejects.toThrow('ACSM fulfillment token expired at 2026-07-15T07:22:18.000Z; current UTC time is 2026-07-15T08:00:00.000Z')

    expect(existsSync(markerPath)).toBe(false)
  }, { markerPath })
})

test('future ACSM expiration continues to fulfillment wrapper invocation', async () => {
  const markerRoot = await createTempRoot('autoshow-acsm-future-marker-')
  const markerPath = join(markerRoot, 'invoked.txt')

  await withFakeAcsmFulfill('epub', async (root) => {
    const acsmPath = join(root, 'future.acsm')
    await writeFile(acsmPath, acsmWithExpiration('2026-07-15T09:00:00Z'))

    const fulfilled = await fulfillAcsmToDocument(acsmPath, {
      now: () => new Date('2026-07-15T08:00:00.000Z')
    })
    try {
      expect(await readFile(markerPath, 'utf8')).toBe(`${acsmPath}\n`)
    } finally {
      await fulfilled.tempCleanup()
    }
  }, { markerPath })
})

test('invalid or missing ACSM expiration does not block fulfillment wrapper invocation', async () => {
  const markerRoot = await createTempRoot('autoshow-acsm-invalid-marker-')
  const markerPath = join(markerRoot, 'invoked.txt')

  await withFakeAcsmFulfill('epub', async (root) => {
    for (const [name, source] of [
      ['invalid', acsmWithExpiration('not-a-date')],
      ['missing', acsmWithExpiration(undefined)]
    ] as const) {
      await rm(markerPath, { force: true })
      const acsmPath = join(root, `${name}.acsm`)
      await writeFile(acsmPath, source)

      const fulfilled = await fulfillAcsmToDocument(acsmPath, {
        now: () => new Date('2026-07-15T08:00:00.000Z')
      })
      try {
        expect(await readFile(markerPath, 'utf8')).toBe(`${acsmPath}\n`)
      } finally {
        await fulfilled.tempCleanup()
      }
    }
  }, { markerPath })
})

test('fake ACSM wrapper fulfillment records EPUB and PDF normalization metadata', async () => {
  await withFakeAcsmFulfill('epub', async (root) => {
    const acsmPath = join(root, 'book-epub.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    const prepared = await prepareDocumentMetadata(acsmPath)
    try {
      expect(prepared.step1Metadata.format).toBe('epub')
      expect(prepared.step1Metadata.sourceFormat).toBe('acsm')
      expect(prepared.step1Metadata.normalizedFormat).toBe('epub')
      expect(prepared.step1Metadata.conversionChain).toEqual(['calibre-acsm-plugin'])
      expect(prepared.effectiveFilePath).toEndWith('fulfilled.epub')
    } finally {
      await prepared.tempCleanup?.()
    }
  })

  await withFakeAcsmFulfill('pdf', async (root) => {
    const acsmPath = join(root, 'book-pdf.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    const prepared = await prepareDocumentMetadata(acsmPath)
    try {
      expect(prepared.step1Metadata.format).toBe('pdf')
      expect(prepared.step1Metadata.sourceFormat).toBe('acsm')
      expect(prepared.step1Metadata.normalizedFormat).toBe('pdf')
      expect(prepared.step1Metadata.conversionChain).toEqual(['calibre-acsm-plugin'])
      expect(prepared.effectiveFilePath).toEndWith('fulfilled.pdf')
    } finally {
      await prepared.tempCleanup?.()
    }
  })
})

test('ACSM fulfillment fails when wrapper writes zero or multiple fulfilled outputs', async () => {
  await withFakeAcsmFulfill('zero', async (root) => {
    const acsmPath = join(root, 'zero.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    await expect(prepareDocumentMetadata(acsmPath))
      .rejects.toThrow('expected exactly one .epub or .pdf output, found 0')
  })

  await withFakeAcsmFulfill('multiple', async (root) => {
    const acsmPath = join(root, 'multiple.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    await expect(prepareDocumentMetadata(acsmPath))
      .rejects.toThrow('expected exactly one .epub or .pdf output, found 2')
  })
})

test('ACSM step 2 metadata preserves normalized source and conversion chain', async () => {
  await withFakeAcsmFulfill('epub', async (root) => {
    const acsmPath = join(root, 'step2.acsm')
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-acsm-step2-'))
    tempDirs.push(outputDir)
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    const prepared = await prepareDocumentMetadata(acsmPath)
    const epubPath = prepared.effectiveFilePath ?? acsmPath

    try {
      const run = await runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir)
      )
      expect(run.step2Metadata.extractionMethod).toBe('epub-text')
      expect(run.step2Metadata.normalizedFrom).toBe('acsm')
      expect(run.step2Metadata.conversionChain).toEqual(['calibre-acsm-plugin'])
      expect(run.step2Metadata.chapterExport?.normalizedFrom).toBe('acsm')
    } finally {
      await prepared.tempCleanup?.()
    }
  })
})

test('ACSM fulfilled EPUB with encrypted spine content fails native EPUB text extraction', async () => {
  await withFakeAcsmFulfill('encrypted-epub', async (root) => {
    const acsmPath = join(root, 'encrypted-step2.acsm')
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-acsm-encrypted-step2-'))
    tempDirs.push(outputDir)
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    const prepared = await prepareDocumentMetadata(acsmPath)
    const epubPath = prepared.effectiveFilePath ?? acsmPath

    try {
      expect(prepared.step1Metadata.format).toBe('epub')
      expect(prepared.step1Metadata.sourceFormat).toBe('acsm')
      expect(prepared.step1Metadata.conversionChain).toEqual(['calibre-acsm-plugin'])

      await expect(runOcr(
        epubPath,
        prepared.step1Metadata,
        buildExtractionOptions(epubPath, outputDir)
      )).rejects.toThrow(EPUB_UNREADABLE_ERROR)

      expect(existsSync(join(outputDir, 'fulfilled', 'fulfilled.epub'))).toBe(true)
      const handoff = await readFile(join(outputDir, 'acsm-handoff.md'), 'utf8')
      expect(handoff).toContain('ACSM fulfillment completed')
      expect(handoff).toContain('AutoShow does not remove DRM')
      expect(handoff).not.toContain('DeDRM')
    } finally {
      await prepared.tempCleanup?.()
    }
  })
})

test('ACSM --price does not invoke fulfillment and reports omitted page-priced OCR estimate', async () => {
  const root = await createTempRoot('autoshow-acsm-price-')
  const binDir = join(root, 'bin')
  const acsmPath = join(root, 'price.acsm')
  const markerPath = join(root, 'fulfillment-invoked.txt')
  await mkdir(binDir, { recursive: true })
  await writeFakeAcsmFulfill(binDir, 'epub', markerPath)
  await writeFile(acsmPath, '<adept:fulfillmentToken />')

  const estimate = await buildAggregatedPriceEstimate('extract', acsmPath, {
    step2SelectionOrigins: { 'kimi-ocr': 'explicit' },
    kimiOcrModels: ['kimi-k2.6']
  } as unknown as CommandPricingOptions)
  expect(estimate.steps).toHaveLength(0)
  expect(estimate.notes).toContain(ACSM_PRICE_NOTE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    acsmPath,
    '--provider',
    'kimi=kimi-k2.6',
    '--price'
  ], {
    env: { AUTOSHOW_BIN_DIR: binDir }
  })

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  expect(existsSync(markerPath)).toBe(false)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Expected files')
  expect(output).toContain('ACSM price estimate omitted page-priced OCR costs')
  expect(output).not.toContain('kimi-k2.6')
})

test('ACSM fulfillment failures do not leak wrapper stdout or stderr details', async () => {
  await withFakeAcsmFulfill('fail', async (root) => {
    const acsmPath = join(root, 'leaky.acsm')
    await writeFile(acsmPath, '<adept:fulfillmentToken />')
    try {
      await prepareDocumentMetadata(acsmPath)
      throw new Error('expected ACSM fulfillment to fail')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).toContain('ACSM fulfillment failed with exit code 9')
      expect(message).not.toContain('/Users/alice')
      expect(message).not.toContain('account.json')
      expect(message).not.toContain('activation.zip')
      expect(message).not.toContain('SECRETKEY')
    }
  })
})
