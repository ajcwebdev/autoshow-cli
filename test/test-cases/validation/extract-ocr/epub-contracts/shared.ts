import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  prepareDocumentMetadata,
  resolveEbookConvertCommand
} from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { cleanEpubHtmlToText } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/cleanup'
import { inspectEpubWithReader } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/inspect-core'
import { buildEpubTextOutput } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export'
import { runOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr'
import { resolveOcrStep2ExecutionFromFormat } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import type { EpubChapter, EpubContentReader, ExtractionOptions } from '~/types'
import { withEnv } from '../../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

export const createReader = (files: Record<string, string>): EpubContentReader => ({
  adapterLabel: 'test',
  entries: Object.entries(files).map(([path, text]) => ({ path, size: text.length })),
  hasEntry: (entryPath: string) => Object.hasOwn(files, entryPath),
  readText: async (entryPath: string) => {
    const text = files[entryPath]
    if (typeof text !== 'string') {
      throw new Error(`Missing test EPUB entry: ${entryPath}`)
    }
    return text
  }
})

export const withStandardEpubContainer = (
  files: Record<string, string>,
  packagePath = 'OEBPS/content.opf'
): Record<string, string> => ({
  'META-INF/container.xml': `
    <container>
      <rootfiles>
        <rootfile full-path="${packagePath}" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>
  `,
  ...files
})

export const createStandardEpubReader = (
  files: Record<string, string>,
  packagePath = 'OEBPS/content.opf'
): EpubContentReader => createReader(withStandardEpubContainer(files, packagePath))

const EXAMPLE_EPUB_PATH = resolve('input/examples/document/1-epub.epub')

export const withFakeEbookConvert = async <T>(
  fn: (root: string) => Promise<T>
): Promise<T> => {
  const root = await makeTempDir('autoshow-fake-ebook-convert-')
  const binDir = join(root, 'bin')
  await mkdir(binDir, { recursive: true })
  const fakeConvertPath = join(binDir, 'ebook-convert')
  const fakeMutoolPath = join(binDir, 'mutool')
  await writeFile(fakeConvertPath, [
    '#!/usr/bin/env bun',
    "import { copyFileSync } from 'node:fs'",
    `const source = ${JSON.stringify(EXAMPLE_EPUB_PATH)}`,
    'const output = process.argv.at(-1)',
    'if (!output) process.exit(2)',
    'copyFileSync(source, output)'
  ].join('\n'))
  await writeFile(fakeMutoolPath, [
    '#!/usr/bin/env bun',
    'console.log("page fake 1")'
  ].join('\n'))
  await chmod(fakeConvertPath, 0o755)
  await chmod(fakeMutoolPath, 0o755)

  const previousBinDir = getConfiguredBinDir()
  configureBinDir(binDir)
  try {
    return await withEnv({ PATH: `${binDir}:${process.env['PATH'] ?? ''}` }, () => fn(root))
  } finally {
    configureBinDir(previousBinDir ?? '')
    await rm(root, { recursive: true, force: true })
  }
}

export const buildExtractionOptions = (
  filePath: string,
  outputDir: string,
  overrides: Partial<ExtractionOptions> = {}
): ExtractionOptions => ({
  filePath,
  outputDir,
  dpi: 300,
  languages: 'eng',
  outputFormat: 'text',
  ocrProviderConcurrency: 2,
  ocrLocalConcurrency: 1,
  pdfChapterMode: 'local',
  ...overrides
})

export const buildTestEpubChapter = (
  index: number,
  title = `Chapter ${index}`,
  text = `${title}\n\nBody ${index}.`
): EpubChapter => ({
  index,
  idref: `chapter${index}`,
  href: `Text/chapter-${index}.xhtml`,
  path: `OEBPS/Text/chapter-${index}.xhtml`,
  title,
  text,
  wordCount: text.split(/\s+/).filter((word) => word.length > 0).length,
  characterCount: text.length
})

export const buildSplitChapterText = (partCount: number): string =>
  Array.from({ length: partCount }, (_, index) => `Part ${index + 1}.`).join('\n\n')

export const writeStoredZip = async (
  filePath: string,
  files: Record<string, string>
): Promise<void> => {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const [entryPath, content] of Object.entries(files)) {
    const pathBuffer = Buffer.from(entryPath, 'utf8')
    const dataBuffer = Buffer.from(content, 'utf8')

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(0, 14)
    localHeader.writeUInt32LE(dataBuffer.length, 18)
    localHeader.writeUInt32LE(dataBuffer.length, 22)
    localHeader.writeUInt16LE(pathBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, pathBuffer, dataBuffer)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(0, 16)
    centralHeader.writeUInt32LE(dataBuffer.length, 20)
    centralHeader.writeUInt32LE(dataBuffer.length, 24)
    centralHeader.writeUInt16LE(pathBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, pathBuffer)

    offset += localHeader.length + pathBuffer.length + dataBuffer.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 8)
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)

  await writeFile(filePath, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]))
}

const WINDOWS_1252_TEST_BYTES: Record<string, number> = {
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
  '…': 0x85
}

export const encodeLegacyPuaText = (text: string): string =>
  Array.from(text).map((char) => {
    const byte = WINDOWS_1252_TEST_BYTES[char] ?? char.codePointAt(0)
    if (byte === undefined || byte > 0xff) {
      throw new Error(`Test helper cannot encode character: ${char}`)
    }
    return String.fromCodePoint(0xf000 + byte)
  }).join('')

export const encodeReversedLegacyPuaText = (text: string): string =>
  Array.from(text).map((char) => {
    const byte = WINDOWS_1252_TEST_BYTES[char] ?? char.codePointAt(0)
    if (byte === undefined || byte > 0xff) {
      throw new Error(`Test helper cannot encode character: ${char}`)
    }
    return String.fromCodePoint(0xf000 + (byte === 0x20 ? 0x20 : 0x120 - byte))
  }).join('')
export {
  buildEpubTextOutput,
  chmod,
  cleanEpubHtmlToText,
  configureBinDir,
  getConfiguredBinDir,
  inspectEpubWithReader,
  join,
  mkdir,
  prepareDocumentMetadata,
  resolve,
  resolveEbookConvertCommand,
  resolveOcrStep2ExecutionFromFormat,
  rm,
  runOcr,
  writeFile
}
