import { extractDocx, extractOdf, extractPptx, extractXlsx } from '~/cli/commands/sources/download/document/zip-xml-utils'
import type { PageResult, RtfState, ZipXmlFormat, ZipXmlPage } from '~/types'
import { applyRtfControl } from './rtf-control-application'
import { decodeRtfControl, skipRtfFallbackChars } from './rtf-control-tokens'

const ZIP_XML_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'] as const)

export const isZipXmlFormat = (format: string): format is ZipXmlFormat =>
  ZIP_XML_FORMATS.has(format as ZipXmlFormat)

export const buildCombinedText = (
  pages: PageResult[],
  includePageLabels = true
): string => {
  return pages
    .map(page => includePageLabels ? `Page ${page.pageNumber}\n${page.text.trim()}` : page.text.trim())
    .join('\n\n')
    .trim()
}

const zipXmlPageToPageResult = (page: ZipXmlPage): PageResult => ({
  pageNumber: page.page,
  method: 'text',
  text: page.text
})

export const runZipXmlExtract = async (
  filePath: string,
  format: ZipXmlFormat
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  switch (format) {
    case 'docx': {
      const docxResult = await extractDocx(filePath)
      return { pages: docxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'docx' }
    }
    case 'pptx': {
      const pptxResult = await extractPptx(filePath)
      return { pages: pptxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'pptx' }
    }
    case 'xlsx': {
      const xlsxResult = await extractXlsx(filePath)
      return { pages: xlsxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'xlsx' }
    }
    case 'odf': {
      const odfResult = await extractOdf(filePath)
      return { pages: odfResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'odf' }
    }
  }
}

const extractRtfText = (rtf: string): string => {
  const stack: RtfState[] = [{ ignored: false, uc: 1 }]
  let output = ''
  let index = 0

  const state = (): RtfState => stack[stack.length - 1]!
  const append = (text: string): void => {
    if (!state().ignored) output += text
  }

  while (index < rtf.length) {
    const char = rtf[index]

    if (char === '{') {
      const current = state()
      stack.push({ ignored: current.ignored, uc: current.uc })
      index++
      continue
    }

    if (char === '}') {
      if (stack.length > 1) stack.pop()
      index++
      continue
    }

    if (char !== '\\') {
      append(char ?? '')
      index++
      continue
    }

    const token = decodeRtfControl(rtf, index)
    const applied = applyRtfControl(token, state())
    stack[stack.length - 1] = applied.state
    output += applied.text
    index = skipRtfFallbackChars(rtf, token.end, applied.fallbackChars)
  }

  return output
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export const extractRtfFile = async (filePath: string): Promise<PageResult[]> => {
  const rtf = await Bun.file(filePath).text()
  return [{ pageNumber: 1, method: 'text', text: extractRtfText(rtf) }]
}
