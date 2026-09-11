import { basename, extname } from 'node:path'
import type { TreatmentSource, TreatmentSourceKind } from '~/types'
import { extractPageText, getDocumentInfo } from '~/cli/commands/sources/download/document/mutool-utils'
import { sanitizeTitleSlug } from '~/cli/commands/sources/download/download-audio/metadata-utils'
import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { TREATMENT_STAGE } from './treatment-defaults'

const PAGE_MARKER_PATTERN = /^--- Page \d+ ---$/gm
const TITLE_PATTERN = /^#\s+(.+?)\s*$/m

const humanizeStem = (stem: string): string => stem.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

const trimDashes = (value: string): string => value.replace(/^-+|-+$/g, '')

export const deriveTreatmentSlug = (title: string, fallback: string): string => {
  const cleaned = trimDashes(sanitizeTitleSlug(title.replace(/\btreatment\b/gi, ' ')))
  return cleaned || trimDashes(sanitizeTitleSlug(fallback)) || 'treatment'
}

const resolveTreatmentKind = (path: string): TreatmentSourceKind => {
  const extension = extname(path).toLowerCase()
  if (extension === '.md' || extension === '.markdown') return 'markdown'
  if (extension === '.txt') return 'text'
  if (extension === '.pdf') return 'pdf'
  throw UsageError(`Unsupported treatment file "${path}". Expected a .md, .txt, or .pdf file.`)
}

const readPdfTreatment = async (path: string): Promise<{ text: string; pageCount: number; title: string | undefined }> => {
  const info = await getDocumentInfo(path)
  if (!Number.isInteger(info.pageCount) || info.pageCount < 1) {
    throw ValidationError(`Treatment PDF has no readable pages: ${path}`, { stage: TREATMENT_STAGE })
  }
  const pages: string[] = []
  for (let page = 1; page <= info.pageCount; page++) {
    const result = await extractPageText(path, page)
    if (result.exitCode !== 0) {
      throw InfraError(`mutool could not extract page ${page} of ${path}: ${result.stderr.trim() || 'unknown error'}`, { stage: TREATMENT_STAGE })
    }
    pages.push(`--- Page ${page} ---\n\n${result.stdout.replace(/\r\n/g, '\n').trim()}`)
  }
  return { text: pages.join('\n\n'), pageCount: info.pageCount, title: info.title }
}

export const loadTreatmentSource = async (path: string): Promise<TreatmentSource> => {
  const kind = resolveTreatmentKind(path)
  const file = Bun.file(path)
  if (!(await file.exists())) throw UsageError(`Treatment file not found: ${path}`)
  const stem = basename(path, extname(path))
  let text: string
  let pageCount: number
  let documentTitle: string | undefined
  if (kind === 'pdf') {
    const pdf = await readPdfTreatment(path)
    text = pdf.text
    pageCount = pdf.pageCount
    documentTitle = pdf.title
  } else {
    text = (await file.text()).replace(/\r\n/g, '\n')
    const markers = text.match(PAGE_MARKER_PATTERN)
    pageCount = markers ? markers.length : 1
  }
  if (!text.trim()) throw ValidationError(`Treatment file is empty: ${path}`, { stage: TREATMENT_STAGE })
  const headingTitle = text.match(TITLE_PATTERN)?.[1]?.trim()
  const title = headingTitle || documentTitle?.trim() || humanizeStem(stem)
  return { path, kind, text, title, defaultSlug: deriveTreatmentSlug(title, stem), pageCount }
}
