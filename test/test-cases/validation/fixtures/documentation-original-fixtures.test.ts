import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { PageResult } from '~/types'
import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary, hasRuntimeTool } from '~/utils/runtime-paths'
import { extractPageText, getDocumentInfo, showPdfOutline } from '~/cli/commands/sources/download/document/mutool-utils'
import { parsePdfOutline } from '~/cli/commands/text/ocr/pdf/ocr-chapters/detection'
import { buildPdfChapterArtifacts } from '~/cli/commands/text/ocr/pdf/ocr-chapters/ocr-chapter-artifacts'
import { loadTreatmentSource } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-source-loader'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const FIELD_NOTES = 'input/examples/document/harborlight-field-notes.pdf'
const TREATMENT = 'input/examples/comic/harborlight-camp-treatment'
const MASK = 'input/examples/image/harborlight-mug-mask.png'
const tempDirs = createTempDirTracker('autoshow-documentation-originals-')
afterAll(async () => await tempDirs.cleanup())
beforeAll(() => {
  // Fail clearly rather than invoking any automatic native-tool installer during these offline tests.
  for (const tool of ['ffmpeg', 'ffprobe', 'mutool'] as const) {
    if (!hasRuntimeTool(tool)) throw new Error(`Install ${tool} separately before running original-fixture decoder coverage; this suite does not download tools.`)
  }
})

type Captured = { exitCode: number, stdout: Uint8Array, stderr: string }
const capture = async (args: string[], environment = childEnv()): Promise<Captured> => {
  const child = Bun.spawn(args, { env: environment, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000) })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).bytes(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}
const successful = async (args: string[]): Promise<Uint8Array> => {
  const result = await capture(args)
  if (result.exitCode !== 0) throw new Error(`Local fixture decoder failed: ${result.stderr}`)
  return result.stdout
}
const decodedPixels = async (path: string, format: 'rgba' | 'rgb24'): Promise<Uint8Array> => await successful([
  getFfmpegBinary(), '-v', 'error', '-xerror', '-nostdin', '-threads', '1', '-i', path,
  '-map', '0:v:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', format, '-'
])
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const readPdfPages = async (path: string): Promise<PageResult[]> => {
  const info = await getDocumentInfo(path)
  expect(info.pageCount).toBe(4)
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= info.pageCount; pageNumber++) {
    const result = await extractPageText(path, pageNumber)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim().length).toBeGreaterThan(500)
    pages.push({ pageNumber, method: 'text', text: result.stdout })
  }
  return pages
}

const offlineCli = async () => {
  const directory = await tempDirs.make()
  const preload = join(directory, 'network-forbidden.ts')
  const attempts = join(directory, 'network-attempts.txt')
  const config = join(directory, 'config.json')
  await Bun.write(config, '{}\n')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'\nglobalThis.fetch = () => { appendFileSync(${JSON.stringify(attempts)}, 'attempt\\n'); throw new Error('Network forbidden during original-fixture verification') }\n`)
  return {
    directory,
    run: async (args: string[]) => await capture([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', ...args, '--config-path', config, '--json'], childEnv({ set: { HOME: directory } })),
    expectNoNetwork: () => expect(existsSync(attempts)).toBe(false)
  }
}

test('all eight original raster inputs actually decode in their documented formats and dimensions', async () => {
  const inputs = [
    ['input/examples/image/harborlight-mug.png', 'png', 1024, 1024],
    ['input/examples/image/harborlight-mug.jpg', 'mjpeg', 1024, 1024],
    [MASK, 'png', 1024, 1024],
    ['input/examples/video/harborlight-start.png', 'png', 1080, 1920],
    ['input/examples/video/harborlight-end.png', 'png', 1080, 1920],
    ['input/examples/video/harborlight-jacket.png', 'png', 768, 768],
    ['input/examples/video/harborlight-glasses.png', 'png', 768, 768],
    ['input/examples/comic/harborlight-camp--style-seed.png', 'png', 1536, 1024]
  ] as const
  for (const [path, codec, width, height] of inputs) {
    const probe = JSON.parse(new TextDecoder().decode(await successful([getFfprobeBinary(), '-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', path]))) as { streams: Array<{ codec_name: string, width: number, height: number }> }
    expect(probe.streams).toEqual([{ codec_name: codec, width, height }])
    // Header/probe success alone is insufficient: force a complete frame decode, including compressed data.
    await successful([getFfmpegBinary(), '-v', 'error', '-xerror', '-nostdin', '-threads', '1', '-i', path, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'])
  }
  const [start, end] = await Promise.all(['start', 'end'].map(name => decodedPixels(`input/examples/video/harborlight-${name}.png`, 'rgb24')))
  expect(start!.byteLength).toBe(1080 * 1920 * 3)
  expect(end!.byteLength).toBe(start!.byteLength)
  expect(sha256(start!)).not.toBe(sha256(end!))
}, 30_000)

test('decoded RGBA mask opens only the mug surface while preserving the badge, rim, background and handle hole', async () => {
  const bytes = await decodedPixels(MASK, 'rgba')
  expect(bytes.byteLength).toBe(1024 * 1024 * 4)
  const alpha = (x: number, y: number): number => bytes[(y * 1024 + x) * 4 + 3]!
  // Independently selected spatial expectations; no generator code or ImageMagick expressions are reused.
  for (const [x, y] of [[370, 500], [600, 620], [840, 515]]) expect(alpha(x!, y!)).toBe(0)
  for (const [x, y] of [[20, 20], [480, 535], [480, 345], [735, 515], [507, 779], [900, 500]]) expect(alpha(x!, y!)).toBe(255)
  let transparent = 0, intermediate = 0, escapedSurface = 0, openedBadge = 0
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const value = alpha(x, y)
      if (value > 0 && value < 255) intermediate++
      if (value !== 0) continue
      transparent++
      if (x < 286 || x > 849 || y < 374 || y > 738) escapedSurface++
      if ((x - 480) ** 2 + (y - 535) ** 2 < 78 ** 2) openedBadge++
    }
  }
  expect(transparent).toBeGreaterThan(100_000)
  expect(transparent).toBeLessThan(170_000)
  expect(intermediate).toBeGreaterThan(0)
  expect(escapedSurface).toBe(0)
  expect(openedBadge).toBe(0)
})

test('actual PDF text and outline produce two nonempty native chapters with the expected content boundaries', async () => {
  const pages = await readPdfPages(FIELD_NOTES)
  expect(pages[0]!.text).toContain('Chapter 1: First light')
  expect(pages[2]!.text).toContain('Chapter 2: Night watch')
  expect(pages.map(page => page.text).join('\n')).toContain('three small sketches of the footbridge')
  const outline = await showPdfOutline(FIELD_NOTES)
  expect(outline.exitCode).toBe(0)
  expect(parsePdfOutline(outline.stdout).map(entry => ({ title: entry.title, pdfPage: entry.pdfPage }))).toEqual([
    { title: 'Chapter 1: First light', pdfPage: 1 }, { title: 'Chapter 2: Night watch', pdfPage: 3 }
  ])
  const result = await buildPdfChapterArtifacts({ filePath: FIELD_NOTES, pages, mode: 'local' })
  expect(result.summary).toMatchObject({ sourceFormat: 'pdf', sectionsKept: 2, filesWritten: 2, chapterFilesWritten: 2 })
  const files = result.files
  if (!files) throw new Error('Local chapter builder returned no fixture files')
  expect(files.map(file => file.relativePath)).toEqual(['chapters/01-001-chapter-1-first-light.txt', 'chapters/02-003-chapter-2-night-watch.txt'])
  expect(files[0]!.text).toContain('Along the marked path')
  expect(files[0]!.text).not.toContain('Chapter 2: Night watch')
  expect(files[1]!.text).toContain('A clear record and a clean return')
  expect(files[1]!.text).not.toContain('Chapter 1: First light')
  expect(files.every(file => file.text.length > 2000)).toBe(true)
})

test('actual offline extract CLI distinguishes explicit chapter export from --no-chapters without provider calls', async () => {
  const workspace = await offlineCli()
  const chapters = join(workspace.directory, 'chapters-enabled'), single = join(workspace.directory, 'chapters-disabled')
  for (const [directory, flag] of [[chapters, '--chapters'], [single, '--no-chapters']]) {
    const result = await workspace.run([FIELD_NOTES, '--provider', 'tesseract', flag!, '--pdf-chapter-mode', 'local', '--output-dir', directory!])
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(new TextDecoder().decode(result.stdout))).toMatchObject({ status: 'success' })
    const text = await Bun.file(join(directory!, 'extraction.txt')).text()
    expect(text).toContain('Chapter 1: First light')
    expect(text).toContain('Chapter 2: Night watch')
  }
  expect((await readdir(join(chapters, 'chapters'))).sort()).toEqual(['01-001-chapter-1-first-light.txt', '02-003-chapter-2-night-watch.txt'])
  expect(existsSync(join(single, 'chapters'))).toBe(false)
  workspace.expectNoNetwork()
}, 30_000)

const storyBeats = (text: string): string => {
  const cleaned = text.replace(/<!--\s*pagebreak\s*-->/g, '')
    .replace(/^#{1,3} .+$/gm, '')
    .replace(/^--- Page \d+ ---$/gm, '')
    .replace(/^Harborlight originals \/ AutoShow \/ Page \d+ of \d+$/gm, '')
    .replace(/^(The ridge before dusk|A smaller circle of light|What they bring home)$/gm, '')
    .replace(/\s+/g, ' ').trim()
  return cleaned.slice(cleaned.indexOf('1. Morning light'))
}

test('Markdown and text-bearing PDF loaders retain the same 24 authored treatment beats, without claiming a drafted script', async () => {
  const [markdown, pdf] = await Promise.all([loadTreatmentSource(`${TREATMENT}.md`), loadTreatmentSource(`${TREATMENT}.pdf`)])
  expect(markdown.kind).toBe('markdown')
  expect(pdf.kind).toBe('pdf')
  expect(pdf.pageCount).toBe(4)
  for (const source of [markdown, pdf]) {
    expect(source.defaultSlug).toBe('harborlight-camp')
    expect(source.text).toContain('papa-bear')
    expect(source.text).toContain('two adult human characters')
    expect([...storyBeats(source.text).matchAll(/(?:^| )(\d+)\. /g)].map(match => Number(match[1]))).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
    expect(storyBeats(source.text)).toContain('The ending echoes the opening without implying that the trip never happened.')
  }
  expect(storyBeats(pdf.text)).toBe(storyBeats(markdown.text))
})

test('truncated image data and an invalid text-bearing PDF are rejected by real decoders and the treatment parser', async () => {
  const directory = await tempDirs.make()
  const png = join(directory, 'truncated.png'), jpeg = join(directory, 'invalid.jpg'), pdf = join(directory, 'invalid.pdf')
  await Bun.write(png, (await Bun.file('input/examples/image/harborlight-mug.png').bytes()).slice(0, 33))
  await Bun.write(jpeg, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]))
  await Bun.write(pdf, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 9 0 R >>\nendobj\n%%EOF\n')
  for (const path of [png, jpeg]) {
    const decoded = await capture([getFfmpegBinary(), '-v', 'error', '-xerror', '-nostdin', '-i', path, '-frames:v', '1', '-f', 'null', '-'])
    expect(decoded.exitCode).not.toBe(0)
    expect(decoded.stderr.length).toBeGreaterThan(0)
  }
  const invalidPage = await extractPageText(pdf, 1)
  expect(invalidPage.exitCode).not.toBe(0)
  await expect(loadTreatmentSource(pdf)).rejects.toThrow()
})
