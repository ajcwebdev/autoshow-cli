

import { scanTagBlocks, innerXml, firstTagText } from '~/utils/xml-scan'
import { ValidationError } from '~/utils/error-handler'
import type { ZipEntry, ZipXmlPage, ZipXmlResult } from '~/types'
import { openZipArchive, readZipEntryData as readZipArchiveEntryData } from '~/utils/zip-central-directory'

const ZIP_XML_ARCHIVE = { stage: 'download:zip-xml' } as const

export const readZipEntryData = (buf: Buffer, entry: ZipEntry): Buffer =>
  readZipArchiveEntryData(buf, entry, ZIP_XML_ARCHIVE)

const readEntryText = (buf: Buffer, entry: ZipEntry): string =>
  readZipEntryData(buf, entry).toString('utf8')

export const openZip = async (filePath: string): Promise<{ buf: Buffer, entries: Map<string, ZipEntry> }> => {
  const { buffer, entries } = await openZipArchive(filePath, ZIP_XML_ARCHIVE)
  return { buf: buffer, entries }
}

const stripNsPrefixes = (xml: string): string =>
  xml.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*:/g, m => m[0] === '<' && m[1] === '/' ? '</' : '<')

const collectParagraphTexts = (xml: string): string[] => {
  const stripped = stripNsPrefixes(xml)
  return scanTagBlocks(stripped, 'p')
    .map(block => {

      const runs = scanTagBlocks(block, 't').map(t => innerXml(t, 't')).join('')
      return runs.trim()
    })
    .filter(s => s.length > 0)
}

const buildResult = (pages: ZipXmlPage[]): ZipXmlResult => ({
  pages,
  totalPages: pages.length,
  text: pages.map(p => p.text).filter(Boolean).join('\n\n')
})

export const extractDocx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)
  const entry = entries.get('word/document.xml')
  if (!entry) throw ValidationError('word/document.xml not found in DOCX archive', { stage: 'download:zip-xml' })

  const xml = readEntryText(buf, entry)
  const paragraphs = collectParagraphTexts(xml)
  const text = paragraphs.join(' ').replace(/\s{2,}/g, ' ').trim()

  return buildResult([{ page: 1, text }])
}

export const extractPptx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)

  const slideEntries = [...entries.values()]
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
      const nb = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
      return na - nb
    })

  const pages: ZipXmlPage[] = slideEntries
    .map((entry, idx) => {
      const xml = readEntryText(buf, entry)
      const text = collectParagraphTexts(xml).join(' ').replace(/\s{2,}/g, ' ').trim()
      return { page: idx + 1, text }
    })
    .filter(p => p.text.length > 0)

  return buildResult(pages)
}

export const extractXlsx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)

  const sharedStrings: string[] = []
  const ssEntry = entries.get('xl/sharedStrings.xml')
  if (ssEntry) {
    const ssXml = stripNsPrefixes(readEntryText(buf, ssEntry))
    for (const siBlock of scanTagBlocks(ssXml, 'si')) {

      const text = scanTagBlocks(siBlock, 't').map(t => innerXml(t, 't')).join('')
      sharedStrings.push(text)
    }
  }

  const sheetEntries = [...entries.values()]
    .filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
      const nb = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
      return na - nb
    })

  const pages: ZipXmlPage[] = sheetEntries.map((entry, idx) => {
    const rawXml = readEntryText(buf, entry)
    const xml = stripNsPrefixes(rawXml)

    const lines: string[] = []
    for (const rowBlock of scanTagBlocks(xml, 'row')) {
      const cells: string[] = []
      for (const cBlock of scanTagBlocks(rowBlock, 'c')) {

        const isSharedStr = cBlock.includes('t="s"') || cBlock.includes("t='s'")
        const vText = firstTagText(cBlock, 'v') ?? ''

        if (isSharedStr) {
          const idx = parseInt(vText, 10)
          cells.push(Number.isFinite(idx) ? (sharedStrings[idx] ?? vText) : vText)
        } else {
          cells.push(vText)
        }
      }
      if (cells.some(c => c.length > 0)) {
        lines.push(cells.join('\t'))
      }
    }

    return { page: idx + 1, text: lines.join('\n') }
  }).filter(p => p.text.length > 0)

  return buildResult(pages)
}

export const extractOdf = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)
  const entry = entries.get('content.xml')
  if (!entry) throw ValidationError('content.xml not found in ODF archive', { stage: 'download:zip-xml' })

  const xml = stripNsPrefixes(readEntryText(buf, entry))

  const paragraphs = scanTagBlocks(xml, 'p')
    .map(block => innerXml(block, 'p').trim())
    .filter(s => s.length > 0)

  const text = paragraphs.join(' ').replace(/\s{2,}/g, ' ').trim()

  return buildResult([{ page: 1, text }])
}
