import { stat } from 'node:fs/promises'
import { exec } from '~/utils/cli-utils'
import { setupDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document'
import * as l from '~/utils/app-logger/app-logger'
import type { MutoolDocInfo, PdfChunkSplitAttempt, PdfChunkSplitOptions, PdfChunkSplitResult, PdfChunkSplitTool, ResolvedRuntimeTool } from '~/types'
import { getMutoolBinary, hasRuntimeTool, resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { resolveHealthyQpdfToolInfo } from './qpdf-health'

const parsePageCount = (stdout: string): number => {
  const direct = stdout.match(/Pages:\s*(\d+)/i)
  if (direct) {
    const num = Number.parseInt(direct[1] || '0', 10)
    return Number.isFinite(num) && num > 0 ? num : 0
  }
  const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean)
  const pageNums = lines
    .map(line => {
      const m = line.match(/(?:^|\s)(\d+)(?:\s|$)/)
      return m ? Number.parseInt(m[1] || '0', 10) : 0
    })
    .filter(n => Number.isFinite(n) && n > 0)
  if (pageNums.length === 0) return 0
  return Math.max(...pageNums)
}

const withPassword = (args: string[], password?: string): string[] => {
  if (!password) return args
  return [...args, '-p', password]
}

const ensureMutoolSetup = async (): Promise<void> => {
  if (hasRuntimeTool('mutool')) return
  await setupDocumentTools()
}

const countEpubPages = async (filePath: string): Promise<number> => {

  const result = await exec(getMutoolBinary(), ['draw', '-F', 'txt', '-o', '-', filePath])
  const combined = result.stdout + result.stderr
  const matches = combined.match(/^page\s+\S+\s+\d+/gm)
  return matches ? matches.length : 1
}

export const getDocumentInfo = async (filePath: string, password?: string): Promise<MutoolDocInfo> => {
  await ensureMutoolSetup()

  if (filePath.toLowerCase().endsWith('.epub')) {
    const pageCount = await countEpubPages(filePath)
    return { pageCount }
  }

  const infoArgs = withPassword(['info', filePath], password)
  const infoResult = await exec(getMutoolBinary(), infoArgs)
  if (infoResult.exitCode === 0) {
    const pageCount = parsePageCount(infoResult.stdout)
    const title = infoResult.stdout.match(/Title:\s*(.*)/i)?.[1]?.trim()
    const author = infoResult.stdout.match(/Author:\s*(.*)/i)?.[1]?.trim()
    const docInfo: MutoolDocInfo = { pageCount }
    if (title) docInfo.title = title
    if (author) docInfo.author = author
    return docInfo
  }
  const pagesArgs = withPassword(['pages', filePath], password)
  const pagesResult = await exec(getMutoolBinary(), pagesArgs)
  if (pagesResult.exitCode !== 0) {
    throw InfraError(pagesResult.stderr || `Failed to read document info for ${filePath}`, { stage: 'download:document' })
  }
  return { pageCount: parsePageCount(pagesResult.stdout) }
}

export const extractPageText = async (filePath: string, page: number, password?: string): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const args = withPassword(['draw', '-F', 'txt', '-o', '-', filePath, String(page)], password)
  return await exec(getMutoolBinary(), args)
}

export const renderPageToImage = async (
  filePath: string,
  page: number,
  dpi: number,
  outPath: string,
  password?: string,
  rotate: number = 0
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const base = ['draw', '-F', 'png', '-r', String(dpi), '-R', String(rotate), '-o', outPath, filePath, String(page)]
  const args = withPassword(base, password)
  return await exec(getMutoolBinary(), args)
}

export const convertDocumentToPdf = async (
  filePath: string,
  outPath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const base = ['convert', '-F', 'pdf', '-o', outPath, filePath]
  const args = withPassword(base, password)
  return await exec(getMutoolBinary(), args)
}

export const showPdfObject = async (
  filePath: string,
  objectPath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const args = withPassword(['show', filePath, objectPath], password)
  return await exec(getMutoolBinary(), args)
}

export const showPdfOutline = async (
  filePath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> =>
  await showPdfObject(filePath, 'outline', password)

export const formatSplitPdfDiagnostic = (message: string, options?: PdfChunkSplitOptions): string =>
  options?.logLabel ? `${options.logLabel}: ${message}` : message

const writeSplitPdfDiagnostic = (message: string, options?: PdfChunkSplitOptions): void => {
  const logMode = options?.logMode ?? 'warn'
  if (logMode === 'silent') {
    return
  }
  const text = formatSplitPdfDiagnostic(message, options)
  if (logMode === 'debug') {
    l.debug(text, { category: 'pipeline' })
    return
  }
  l.warn(text, { category: 'pipeline' })
}

const splitFailureFirstLine = (stderr: string, stdout: string): string => {
  const raw = `${stderr || stdout || ''}`.trim()
  const firstLine = raw.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0)
  if (!firstLine) {
    return ''
  }
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}...` : firstLine
}

const classifySplitFailureKind = (
  tool: PdfChunkSplitTool,
  stderr: string,
  stdout: string
): NonNullable<PdfChunkSplitAttempt['failureKind']> | undefined => {
  const output = `${stderr}\n${stdout}`
  if (tool === 'qpdf' && /(?:dyld|@rpath|library not loaded|image not found|mach-o|bad cpu|exec format|permission denied|not executable|no such file|enoent)/i.test(output)) {
    return 'qpdf_launch_failure'
  }
  if (tool === 'mutool' && /(?:jbig2|image masks?|does not support|unsupported|cannot decode|cannot convert)/i.test(output)) {
    return 'mutool_unsupported_document'
  }
  return 'split_failed'
}

const buildSplitAttempt = (
  tool: PdfChunkSplitTool,
  result: { exitCode: number, stderr: string, stdout: string },
  info?: Pick<ResolvedRuntimeTool, 'path' | 'source'> | undefined
): PdfChunkSplitAttempt => {
  const message = result.exitCode === 0 ? undefined : splitFailureFirstLine(result.stderr, result.stdout)
  return {
    tool,
    exitCode: result.exitCode,
    ...(info?.path ? { path: info.path } : {}),
    ...(info?.source ? { source: info.source } : {}),
    ...(result.exitCode !== 0 ? { failureKind: classifySplitFailureKind(tool, result.stderr, result.stdout) } : {}),
    ...(message ? { message } : {})
  }
}

const resolveHealthyQpdfForSplit = async (
  attempts: PdfChunkSplitAttempt[],
  options?: PdfChunkSplitOptions | undefined
): Promise<ResolvedRuntimeTool | undefined> => {
  const health = await resolveHealthyQpdfToolInfo()
  if (health.healthy) {
    return health.info
  }
  attempts.push({
    tool: 'qpdf',
    exitCode: health.exitCode,
    ...(health.info?.path ? { path: health.info.path } : {}),
    ...(health.info?.source ? { source: health.info.source } : {}),
    failureKind: health.failureKind,
    message: health.message
  })
  writeSplitPdfDiagnostic(`qpdf unavailable for PDF page splitting: ${health.message}; falling back to mutool`, options)
  return undefined
}

export const splitPdfPages = async (
  inputPath: string,
  outputPath: string,
  pageRange: string,
  password?: string | undefined,
  options?: PdfChunkSplitOptions | undefined
): Promise<PdfChunkSplitResult> => {
  const attempts: NonNullable<PdfChunkSplitResult['attempts']> = []
  const disabledTools = new Set(options?.disabledTools ?? [])

  const qpdfInfo = disabledTools.has('qpdf')
    ? undefined
    : await resolveHealthyQpdfForSplit(attempts, options)
  if (qpdfInfo && !disabledTools.has('qpdf')) {
    const qpdfArgs = [
      ...(password ? [`--password=${password}`] : []),
      inputPath,
      '--pages', '.', pageRange, '--',
      outputPath
    ]
    const result = await exec(qpdfInfo.path, qpdfArgs)
    attempts.push(buildSplitAttempt('qpdf', result, qpdfInfo))
    if (result.exitCode === 0 || result.exitCode === 3) {
      return { tool: 'qpdf', ...result, attempts }
    }
    writeSplitPdfDiagnostic(
      `qpdf failed for ${pageRange} (exit ${result.exitCode}${splitFailureFirstLine(result.stderr, result.stdout) ? `: ${splitFailureFirstLine(result.stderr, result.stdout)}` : ''}); falling back to mutool`,
      options
    )
  }

  await ensureMutoolSetup()
  const mutoolInfo = resolveRuntimeToolInfo('mutool')
  const mutoolPath = mutoolInfo?.path ?? getMutoolBinary()
  const baseArgs = ['convert', '-F', 'pdf', '-o', outputPath, inputPath, pageRange]
  const args = password ? [...baseArgs, '-p', password] : baseArgs
  const result = await exec(mutoolPath, args)
  attempts.push(buildSplitAttempt('mutool', result, {
    path: mutoolPath,
    source: mutoolInfo?.source ?? 'path'
  }))

  if (result.exitCode === 0) {
    return { tool: 'mutool', ...result, attempts }
  }

  try {
    const outputStat = await stat(outputPath)
    if (outputStat.size > 0) {
      writeSplitPdfDiagnostic(
        `mutool convert exited ${result.exitCode} for ${pageRange} but produced output (${outputStat.size} bytes); using partial result`,
        options
      )
      return { tool: 'mutool', ...result, attempts }
    }
  } catch {
    // output file doesn't exist
  }

  return { tool: 'mutool', ...result, attempts }
}

export const isPdfEncryptedViaQpdf = async (
  filePath: string
): Promise<boolean | undefined> => {
  const health = await resolveHealthyQpdfToolInfo()
  if (!health.healthy) {
    return undefined
  }
  const result = await exec(health.info.path, ['--is-encrypted', filePath])
  if (result.exitCode === 0) return true
  if (result.exitCode === 2) return false
  return undefined
}
