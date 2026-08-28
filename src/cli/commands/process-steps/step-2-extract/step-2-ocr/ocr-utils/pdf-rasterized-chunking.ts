import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import type { OcrPreparationCache, OcrPdfChunkRange, PdfChunkLocalTools, PdfChunkPreparationState, PdfChunkPreparationSummary, PdfChunkSplitLogMode, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { getCachedRenderedPageImage } from './preparation-cache'
import { defaultPdfChunkLocalTools, tryCreateDirectPdfChunk, writeDirectSplitFallbackLog } from './pdf-direct-chunking'
import { createOcrPdfChunkRenderError, DEFAULT_RASTERIZED_PDF_CHUNK_DPI, formatRange, hasNonEmptyFile } from './pdf-chunk-fallback-shared'
import {
  createPdfChunkPreparationState, getDisabledSplitTools, recordAdaptiveDirectFailure,
  recordAdaptiveDirectSuccess, recordSplitAttempts, recordToolFallbackSuccess, summarizePdfChunkPreparation
} from './pdf-chunk-preparation-state'

export const createRenderedPngPageChunk = (
  dpi: number,
  ocrPreparationCache?: OcrPreparationCache | undefined
): NonNullable<RunHostedOcrPdfChunkFallbackOptions['createChunk']> => async (
  inputPath,
  outputPath,
  range,
  password
) => {
  if (range.startPage !== range.endPage) {
    throw createOcrPdfChunkRenderError(range, {
      exitCode: 1,
      stderr: 'Rendered PNG fallback only supports single-page chunks.',
      stdout: '',
      command: `mutool draw PNG (${formatRange(range)})`
    })
  }

  const render = async (renderPath: string): Promise<void> => {
    const result = await renderPageToImage(inputPath, range.startPage, dpi, renderPath, password)
    if (result.exitCode !== 0 || !await hasNonEmptyFile(renderPath)) {
      throw createOcrPdfChunkRenderError(range, {
        exitCode: result.exitCode === 0 ? 1 : result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout,
        command: `mutool draw PNG (${formatRange(range)})`
      })
    }
  }

  if (ocrPreparationCache === undefined) {
    await render(outputPath)
    return
  }

  const rendered = await getCachedRenderedPageImage(
    ocrPreparationCache,
    {
      filePath: inputPath,
      page: range.startPage,
      dpi,
      password
    },
    render
  )
  await copyFile(rendered.imagePath, outputPath)
  if (!await hasNonEmptyFile(outputPath)) {
    throw createOcrPdfChunkRenderError(range, {
      exitCode: 1,
      stderr: 'Cached rendered PNG page was empty.',
      stdout: '',
      command: `copy cached PNG (${formatRange(range)})`
    })
  }
}

export const createRasterizedSinglePagePdfChunk = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  dpi?: number | undefined
  tools: PdfChunkLocalTools
}): Promise<void> => {
  if (options.range.startPage !== options.range.endPage) {
    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: 1,
      stderr: 'Rasterized PDF fallback only supports single-page chunks.',
      stdout: '',
      command: `mutool draw (${formatRange(options.range)})`
    })
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-raster-'))
  const imagePath = join(tempDir, `page-${String(options.range.startPage).padStart(6, '0')}.png`)
  const dpi = Math.max(1, Math.floor(options.dpi ?? DEFAULT_RASTERIZED_PDF_CHUNK_DPI))

  try {
    await rm(options.outputPath, { force: true }).catch(() => {})

    const renderResult = await options.tools.renderPageToImage(
      options.inputPath,
      options.range.startPage,
      dpi,
      imagePath,
      options.password
    )
    if (renderResult.exitCode !== 0 || !await hasNonEmptyFile(imagePath)) {
      throw createOcrPdfChunkRenderError(options.range, {
        exitCode: renderResult.exitCode,
        stderr: renderResult.stderr,
        stdout: renderResult.stdout,
        command: `mutool draw (${formatRange(options.range)})`
      })
    }

    const convertResult = await options.tools.convertDocumentToPdf(imagePath, options.outputPath)
    if (await hasNonEmptyFile(options.outputPath)) {
      if (convertResult.exitCode !== 0) {
        l.warn(
          `mutool convert exited ${convertResult.exitCode} while rasterizing ${formatRange(options.range)} but produced output; using partial result`,
          {
            category: 'pipeline',
            metadata: { exitCode: convertResult.exitCode, startPage: options.range.startPage, endPage: options.range.endPage }
          }
        )
      }
      return
    }

    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: convertResult.exitCode,
      stderr: convertResult.stderr,
      stdout: convertResult.stdout,
      command: `mutool convert rasterized page (${formatRange(options.range)})`
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const rasterizeAdaptivePdfPageChunk = async (
  state: PdfChunkPreparationState,
  options: {
    inputPath: string
    outputPath: string
    range: OcrPdfChunkRange
    password?: string | undefined
    dpi?: number | undefined
    tools: PdfChunkLocalTools
  }
): Promise<void> => {
  await createRasterizedSinglePagePdfChunk(options)
  state.rasterizedPages += 1
}

export const createAdaptivePdfPageChunk = async (
  state: PdfChunkPreparationState,
  options: {
    inputPath: string
    outputPath: string
    range: OcrPdfChunkRange
    password?: string | undefined
    dpi?: number | undefined
    tools: PdfChunkLocalTools
    logLabel?: string | undefined
    onDirectSplittingDisabled?: ((summary: PdfChunkPreparationSummary) => void) | undefined
  }
): Promise<void> => {
  if (state.mode === 'raster-only') {
    await rasterizeAdaptivePdfPageChunk(state, options)
    return
  }

  state.directPageAttempts += 1
  const direct = await tryCreateDirectPdfChunk({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    range: options.range,
    password: options.password,
    tools: options.tools,
    splitLogMode: 'debug',
    logLabel: options.logLabel,
    disabledTools: getDisabledSplitTools(state)
  })
  recordSplitAttempts(state, direct.result.attempts)

  if (direct.created) {
    recordToolFallbackSuccess(state, options.range, direct.result)
    recordAdaptiveDirectSuccess(state)
    return
  }

  if (options.range.startPage !== options.range.endPage) {
    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: direct.result.exitCode,
      stderr: direct.result.stderr,
      stdout: direct.result.stdout,
      command: `${direct.result.tool} (${formatRange(options.range)})`
    })
  }

  await rasterizeAdaptivePdfPageChunk(state, options)
  writeDirectSplitFallbackLog('debug', options.range, direct.result, options.logLabel)
  recordAdaptiveDirectFailure(state, options.range, direct.result, options.onDirectSplittingDisabled)
}

export const createAdaptiveOcrPdfPageChunkCreator = (options: {
  dpi?: number | undefined
  tools?: PdfChunkLocalTools | undefined
  logLabel?: string | undefined
  onDirectSplittingDisabled?: (summary: PdfChunkPreparationSummary) => void
} = {}): {
  createChunk: (inputPath: string, outputPath: string, range: OcrPdfChunkRange, password?: string | undefined) => Promise<void>
  getSummary: () => PdfChunkPreparationSummary
} => {
  const state = createPdfChunkPreparationState()
  const tools = options.tools ?? defaultPdfChunkLocalTools

  const createChunk = async (
    inputPath: string,
    outputPath: string,
    range: OcrPdfChunkRange,
    password?: string | undefined
  ): Promise<void> => {
    const task = async (): Promise<void> => {
      await createAdaptivePdfPageChunk(state, {
        inputPath,
        outputPath,
        range,
        password,
        dpi: options.dpi,
        tools,
        logLabel: options.logLabel,
        onDirectSplittingDisabled: options.onDirectSplittingDisabled
      })
    }

    if (state.mode === 'adaptive') {
      await state.runExclusiveDirectProbe(task)
      return
    }

    await task()
  }

  return {
    createChunk,
    getSummary: () => summarizePdfChunkPreparation(state) ?? {
      strategy: 'adaptive',
      directPageAttempts: 0,
      directSuccesses: 0,
      directFailures: 0,
      rasterizedPages: 0,
      directSplittingDisabled: false,
      tools: []
    }
  }
}

export const createOcrPdfChunkWithLocalFallback = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  dpi?: number | undefined
  tools?: PdfChunkLocalTools | undefined
  splitLogMode?: PdfChunkSplitLogMode | undefined
  logLabel?: string | undefined
}): Promise<void> => {
  const tools = options.tools ?? defaultPdfChunkLocalTools
  const direct = await tryCreateDirectPdfChunk({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    range: options.range,
    password: options.password,
    tools,
    splitLogMode: options.splitLogMode,
    logLabel: options.logLabel
  })

  if (direct.created) {
    return
  }

  if (options.range.startPage === options.range.endPage) {
    writeDirectSplitFallbackLog(
      'warn',
      options.range,
      direct.result,
      options.logLabel
    )
    await createRasterizedSinglePagePdfChunk({
      inputPath: options.inputPath,
      outputPath: options.outputPath,
      range: options.range,
      password: options.password,
      dpi: options.dpi,
      tools
    })
    return
  }

  throw createOcrPdfChunkRenderError(options.range, {
    exitCode: direct.result.exitCode,
    stderr: direct.result.stderr,
    stdout: direct.result.stdout,
    command: `${direct.result.tool} (${formatRange(options.range)})`
  })
}
