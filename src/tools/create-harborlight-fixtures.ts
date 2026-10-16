/** Reproduce original Harborlight raster/PDF fixtures locally, without API calls or downloads. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

type PdfPage = { content: string, chapter?: string | undefined }

const sourcePath = (relative: string): string => join(PROJECT_ROOT, 'input/examples', relative)
const escapePdf = (text: string): string => text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')

const wrapParagraph = (text: string, limit: number): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line)
      line = word
    } else line += `${line ? ' ' : ''}${word}`
  }
  if (line) lines.push(line)
  return lines
}

const pageStream = (page: PdfPage, index: number, count: number): string => {
  const commands = ['0.10 0.20 0.24 rg']
  let y = 742
  for (const paragraph of page.content.trim().split(/\n\s*\n/)) {
    const heading = /^(#{1,3})\s+/.exec(paragraph)
    const size = heading?.[1]?.length === 1 ? 22 : heading?.[1]?.length === 2 ? 17 : heading ? 13 : 11
    const text = paragraph.replace(/^#{1,3}\s+/, '').replaceAll('**', '').replace(/\s*\n\s*/g, ' ')
    if (/[^\x20-\x7e]/.test(text)) throw new Error('Fixture PDF source must use printable ASCII for its embedded standard-font text layer.')
    for (const line of wrapParagraph(text, heading ? Math.floor(500 / (size * 0.57)) : 88)) {
      if (y < 58) throw new Error(`PDF page ${index + 1} overflows; add a pagebreak to its source Markdown.`)
      commands.push(`BT /${heading ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 54 ${y} Tm (${escapePdf(line)}) Tj ET`)
      y -= size + 4
    }
    y -= heading ? 12 : 9
  }
  commands.push(`0.35 0.40 0.42 rg BT /F1 8 Tf 1 0 0 1 54 30 Tm (Harborlight originals / AutoShow / Page ${index + 1} of ${count}) Tj ET`)
  return `${commands.join('\n')}\n`
}

/** Small deterministic PDF 1.4 writer: searchable standard-font text, chapter bookmarks, fixed dates. */
const createPdf = (markdown: string): Uint8Array => {
  const pages: PdfPage[] = markdown.split(/<!--\s*pagebreak\s*-->/).map(content => ({
    content,
    ...(/^## (Chapter [^\n]+)/m.exec(content)?.[1] ? { chapter: /^## (Chapter [^\n]+)/m.exec(content)![1]! } : {})
  }))
  const objects: string[] = []
  const add = (body: string): number => { objects.push(body); return objects.length }
  const catalogId = add('')
  const pagesId = add('')
  const regularId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const boldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const pageIds = pages.map((page, index) => {
    const stream = pageStream(page, index, pages.length)
    const streamId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`)
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${streamId} 0 R >>`)
  })
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`
  const chapters = pages.flatMap((page, index) => page.chapter ? [{ title: page.chapter, pageId: pageIds[index]! }] : [])
  let outlineId: number | undefined
  if (chapters.length > 0) {
    outlineId = add('')
    const chapterIds = chapters.map(() => add(''))
    chapters.forEach((chapter, index) => {
      objects[chapterIds[index]! - 1] = `<< /Title (${escapePdf(chapter.title)}) /Parent ${outlineId} 0 R /Dest [${chapter.pageId} 0 R /Fit]${index ? ` /Prev ${chapterIds[index - 1]} 0 R` : ''}${index + 1 < chapterIds.length ? ` /Next ${chapterIds[index + 1]} 0 R` : ''} >>`
    })
    objects[outlineId - 1] = `<< /Type /Outlines /First ${chapterIds[0]} 0 R /Last ${chapterIds.at(-1)} 0 R /Count ${chapters.length} >>`
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${outlineId ? ` /Outlines ${outlineId} 0 R /PageMode /UseOutlines` : ''} >>`
  const title = /^# (.+)$/m.exec(markdown)?.[1] ?? 'Harborlight original fixture'
  const infoId = add(`<< /Title (${escapePdf(title)}) /Author (AutoShow project contributors) /Creator (AutoShow original fixture generator) /CreationDate (D:20261015000000Z) /ModDate (D:20261015000000Z) >>`)
  let output = '%PDF-1.4\n% AutoShow original text fixture\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output))
    output += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(output)
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output)
}

const findBrowser = (): string => {
  const browser = [
    process.env['AUTOSHOW_FIXTURE_BROWSER'],
    Bun.which('chromium'), Bun.which('chromium-browser'), Bun.which('google-chrome'), Bun.which('microsoft-edge'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].find((candidate): candidate is string => typeof candidate === 'string' && existsSync(candidate))
  if (!browser) throw new Error('A local Chromium/Chrome/Edge browser is required for SVG rasterization. Set AUTOSHOW_FIXTURE_BROWSER to its executable; no browser is downloaded.')
  return browser
}

const renderSvg = (browser: string, temporary: string, source: string, target: string, mask = false): void => {
  const svg = readFileSync(sourcePath(source), 'utf8')
  const width = /\bwidth="(\d+)"/.exec(svg)?.[1]
  const height = /\bheight="(\d+)"/.exec(svg)?.[1]
  if (!width || !height) throw new Error(`Missing fixed SVG dimensions: ${source}`)
  const screenshot = join(temporary, 'render.png')
  // Browser rendering preserves SVG gradients/strokes; minimal ImageMagick SVG builds may drop them.
  execFileSync(browser, [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${join(temporary, 'browser-profile')}`,
    `--screenshot=${screenshot}`, `--window-size=${width},${height}`, Bun.pathToFileURL(sourcePath(source)).href
  ], { stdio: 'pipe', timeout: 20_000 })
  execFileSync('magick', [screenshot, ...(mask ? ['-colorspace', 'Gray', '-alpha', 'off', '-alpha', 'copy', '-colorspace', 'sRGB', '-define', 'png:color-type=6'] : []), '-strip', sourcePath(target)], { stdio: 'pipe' })
}

export const createHarborlightFixtures = (): void => {
  try { execFileSync('magick', ['-version'], { stdio: 'pipe' }) } catch { throw new Error('ImageMagick 7 (magick) is required to reproduce the raster fixtures; install it separately. No model or asset downloads are performed.') }
  const browser = findBrowser()
  const temporary = mkdtempSync(join(tmpdir(), 'autoshow-harborlight-raster-'))
  try {
    renderSvg(browser, temporary, 'image/harborlight-mug.svg', 'image/harborlight-mug.png')
    execFileSync('magick', [sourcePath('image/harborlight-mug.png'), '-background', '#f3ece0', '-alpha', 'remove', '-alpha', 'off', '-quality', '92', '-strip', sourcePath('image/harborlight-mug.jpg')], { stdio: 'pipe' })
    // White source pixels become protected alpha=255; black pixels become editable alpha=0.
    renderSvg(browser, temporary, 'image/harborlight-mug-mask.svg', 'image/harborlight-mug-mask.png', true)
    const maskAlpha = execFileSync('magick', [sourcePath('image/harborlight-mug-mask.png'), '-format', '%[fx:p{370,500}.a] %[fx:p{480,535}.a] %[fx:p{20,20}.a] %[fx:p{840,515}.a] %[fx:p{735,515}.a]', 'info:'], { encoding: 'utf8' }).trim()
    if (maskAlpha !== '0 1 1 0 1') throw new Error(`Invalid edit-mask alpha: ${maskAlpha}; expected editable body/handle and protected badge/background/hole.`)

    for (const name of ['start', 'end', 'jacket', 'glasses']) renderSvg(browser, temporary, `video/harborlight-${name}.svg`, `video/harborlight-${name}.png`)
    renderSvg(browser, temporary, 'comic/harborlight-camp--style-seed.svg', 'comic/harborlight-camp--style-seed.png')
    for (const relative of ['document/harborlight-field-notes', 'comic/harborlight-camp-treatment']) {
      writeFileSync(sourcePath(`${relative}.pdf`), createPdf(readFileSync(sourcePath(`${relative}.md`), 'utf8')))
    }
  } finally {
    // Only this tool's disposable browser profile/raster staging is removed; input/output assets are retained.
    rmSync(temporary, { recursive: true, force: true })
  }
  console.log('Reproduced 8 raster images and 2 text-bearing PDFs from the original Harborlight SVG/Markdown sources under input/examples/.')
}

if (import.meta.main) createHarborlightFixtures()
