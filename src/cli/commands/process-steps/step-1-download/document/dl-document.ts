import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { CONVERTIBLE_EBOOK_FORMAT_LABEL, isConvertibleEbookFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks'
import { detectDocumentFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-detect-format'
import { buildDocumentStep1Slug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { calibreBin } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import type { BatchChildRunContext, DocFormat, EbookConvertCommandOptions, PreparedDocument, PreparedDocumentMetadata, Step1SourceRef } from '~/types'
import { DocumentMetadataSchema } from '~/types'
import { ensureDirectory, exec } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { validateData } from '~/utils/validate/validation'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getDocumentInfo } from './mutool-utils'
import { resolveRuntimeToolInfo } from '~/utils/runtime-paths'

export const resolveEbookConvertCommand = (
  options: EbookConvertCommandOptions = {}
): string => {
  const resolveCalibreBin = options.resolveCalibreBin ?? calibreBin
  const which = options.which ?? ((command: string) => Bun.which(command))
  if (!options.resolveCalibreBin) {
    const resolved = resolveRuntimeToolInfo('ebook-convert')
    if (resolved) return resolved.path
    throw InfraError(
      `Calibre is required to convert normalizable ebook files (${CONVERTIBLE_EBOOK_FORMAT_LABEL}) to EPUB. ` +
      'Install it with: bun autoshow setup --step calibre',
      { stage: 'download:document', hints: ["Run 'bun autoshow setup --step calibre' to install Calibre"] }
    )
  }
  const ebookConvert = resolveCalibreBin('ebook-convert')
  if (ebookConvert === 'ebook-convert' && !which('ebook-convert')) {
    throw InfraError(
      `Calibre is required to convert normalizable ebook files (${CONVERTIBLE_EBOOK_FORMAT_LABEL}) to EPUB. ` +
      'Install it with: bun autoshow setup',
      { stage: 'download:document', hints: ["Run 'bun autoshow setup' to install yt-dlp and other dependencies"] }
    )
  }

  return ebookConvert
}

const normalizeEbookToEpub = async (
  filePath: string,
  tempDir: string
): Promise<{ epubPath: string }> => {
  const ebookConvert = resolveEbookConvertCommand()

  const epubPath = join(tempDir, 'converted.epub')
  const result = await exec(ebookConvert, [filePath, epubPath], {
    retry: { operationName: 'Calibre ebook-convert' }
  })
  if (result.exitCode !== 0) {
    throw InfraError(
      `Calibre ebook-convert failed for ${filePath}: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`,
      { stage: 'download:document' }
    )
  }

  return { epubPath }
}

const mapFormat = (detected: NonNullable<import('~/types').DetectResult>): DocFormat => {
  if (detected === 'pdf') return 'pdf'
  if (detected === 'epub') return 'epub'
  if (detected === 'docx') return 'docx'
  if (detected === 'pptx') return 'pptx'
  if (detected === 'xlsx') return 'xlsx'
  if (detected === 'odf') return 'odf'
  if (detected === 'mobi') return 'mobi'
  if (detected === 'azw3') return 'azw3'
  if (detected === 'fb2') return 'fb2'
  if (detected === 'lit') return 'lit'
  if (detected === 'cbz') return 'cbz'
  if (detected === 'rtf') return 'rtf'
  if (detected === 'csv') return 'csv'
  if (detected === 'png') return 'png'
  if (detected === 'jpg') return 'jpg'
  if (detected === 'tif') return 'tif'
  if (detected === 'webp') return 'webp'
  if (detected === 'bmp') return 'bmp'
  if (detected === 'gif') return 'gif'
  return 'tif'
}

const defaultOutputDir = (baseDir: string, filePath: string): string => {
  const title = basename(filePath).replace(/\.[^.]+$/, '')
  return resolveRunDirectory(baseDir, title, 'document')
}

export const prepareDocumentMetadata = async (
  filePath: string,
  password?: string,
  sourceRef?: Step1SourceRef
): Promise<PreparedDocumentMetadata> => {
  const source = Bun.file(filePath)
  if (!(await source.exists())) {
    throw InfraError(`File does not exist: ${filePath}`, { stage: 'download:document' })
  }

  const sourceStats = await stat(filePath)
  if (sourceStats.size <= 0) {
    throw InfraError(`Document is empty: ${filePath}`, { stage: 'download:document' })
  }

  const detectedFormat = await detectDocumentFormat(filePath)
  if (!detectedFormat) {
    throw ValidationError(`Unsupported document format: ${filePath}`, { stage: 'download:document' })
  }

  const sourceFormat = mapFormat(detectedFormat)
  const baseTitle = basename(filePath).replace(/\.[^.]+$/, '')
  let pageCount = 1
  let title = baseTitle
  let author: string | undefined

  // Normalizable ebook inputs are converted once, then routed through EPUB extraction.
  let effectiveFilePath: string | undefined
  let tempDir: string | undefined
  let tempCleanup: (() => Promise<void>) | undefined
  let effectiveFormat: DocFormat = sourceFormat
  let conversionChain: string[] | undefined

  if (isConvertibleEbookFormat(detectedFormat)) {
    l.write('info', `Normalizing ${detectedFormat.toUpperCase()} ebook to EPUB via Calibre`, {
      category: 'pipeline',
      metadata: { sourceFormat: detectedFormat, targetFormat: 'epub', tool: 'calibre' }
    })
    tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ebook-norm-'))
    tempCleanup = async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
      }
    }

    const convResult = await normalizeEbookToEpub(filePath, tempDir).catch(async (err) => {
      // cleanup on failure
      if (tempDir) await rm(tempDir, { recursive: true, force: true })
      throw err
    })

    effectiveFilePath = convResult.epubPath
    effectiveFormat = 'epub'
    conversionChain = ['calibre']
  }

  const resolvedFilePath = effectiveFilePath ?? filePath

  if (effectiveFormat === 'pdf' || effectiveFormat === 'epub') {
    const info = await getDocumentInfo(resolvedFilePath, password)
    pageCount = Math.max(1, info.pageCount)
    if (info.title && info.title.length > 0) title = info.title
    if (info.author && info.author.length > 0) author = info.author
  }

  const step1MetadataPayload: {
    title?: string
    slug: string
    author?: string
    pageCount: number
    format: DocFormat
    fileSize: number
    sourceFormat?: string
    normalizedFormat?: string
    conversionChain?: string[]
  } = {
    slug: buildDocumentStep1Slug(sourceRef ?? { filePath }, title),
    pageCount,
    format: effectiveFormat,
    fileSize: sourceStats.size
  }

  if (title) step1MetadataPayload.title = title
  if (author) step1MetadataPayload.author = author
  if (conversionChain) {
    step1MetadataPayload.sourceFormat = sourceFormat
    step1MetadataPayload.normalizedFormat = effectiveFormat
    step1MetadataPayload.conversionChain = conversionChain
  }

  const step1Metadata = validateData(DocumentMetadataSchema, step1MetadataPayload, 'document metadata')

  return {
    step1Metadata,
    ...(effectiveFilePath ? { effectiveFilePath } : {}),
    ...(tempCleanup ? { tempCleanup } : {})
  }
}

export const downloadDocument = async (
  filePath: string,
  baseOutputDir: string,
  password?: string,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<PreparedDocument> => {
  const prepared = await prepareDocumentMetadata(filePath, password, sourceRef)
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    slug: prepared.step1Metadata.slug,
    fallbackLabel: basename(filePath).replace(/\.[^.]+$/, '')
  }) ?? defaultOutputDir(baseOutputDir, filePath)
  await ensureDirectory(outputDir)

  return {
    outputDir,
    ...prepared
  }
}
