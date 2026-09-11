import { mkdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DocumentMetadata, OcrBatchRunContext, OcrTarget } from '~/types'
import { statPath as stat } from '~/utils/bun-file-io'
import { UsageError } from '~/utils/error-handler'
import { resolveHostedDirectImageInputStrategy } from './hosted-ocr'
import { extractCbzImages } from './ocr-image/image-ocr'
import { isLocalOcrTarget } from './ocr-provider-pool'
import { createRenderedPngPageChunk } from './ocr-utils/pdf-chunk-fallback'

export const toHostedEngine = (target: OcrTarget): Exclude<import('~/types').HostedExtractOcrEngine, never> =>
  `${target.service}-ocr` as import('~/types').HostedExtractOcrEngine

type PreparedPageInput = { path: string, metadata: OcrBatchRunContext['step1Metadata'] }

export type PooledPageInputProvider = {
  totalPages: number
  preparePage: (pageNumber: number) => Promise<PreparedPageInput>
}

const normalizedImageFormat = (path: string): DocumentMetadata['format'] => {
  const extension = extname(path).slice(1).toLowerCase()
  if (extension === 'jpeg') return 'jpg'
  if (extension === 'tiff') return 'tif'
  return extension as DocumentMetadata['format']
}

export const createPooledPageInputProvider = async (
  ctx: OcrBatchRunContext,
  pageWorkspace: string
): Promise<PooledPageInputProvider> => {
  const cbzImages = ctx.step1Metadata.format === 'cbz'
    ? await extractCbzImages(ctx.extractFilePath, join(pageWorkspace, 'cbz-pages'))
    : undefined
  if (cbzImages?.length === 0) throw UsageError('--ocr-provider-mode pool requires the CBZ input to contain at least one supported image page.')
  if (cbzImages) {
    for (const imagePath of cbzImages) {
      const imageFormat = normalizedImageFormat(imagePath)
      for (const target of ctx.requestedTargets) {
        if (!isLocalOcrTarget(target) && resolveHostedDirectImageInputStrategy(imageFormat, toHostedEngine(target)) === 'unsupported') {
          throw UsageError(`${target.service}/${target.model} cannot normalize a ${imageFormat.toUpperCase()} CBZ page into a compatible pooled page work unit.`)
        }
      }
    }
  }
  const promises = new Map<number, Promise<PreparedPageInput>>()
  const renderPdfPage = createRenderedPngPageChunk(ctx.effectiveOpts.dpi ?? 300, ctx.effectiveOpts.ocrPreparationCache)
  const preparePage = (pageNumber: number): Promise<PreparedPageInput> => {
    const existing = promises.get(pageNumber)
    if (existing) return existing
    const promise = (async (): Promise<PreparedPageInput> => {
      if (cbzImages) {
        const imagePath = cbzImages[pageNumber - 1]
        if (!imagePath) throw UsageError(`CBZ pooled OCR page ${pageNumber} does not exist.`)
        const imageStats = await stat(imagePath)
        return { path: imagePath, metadata: { ...ctx.step1Metadata, pageCount: 1, fileSize: imageStats.size, format: normalizedImageFormat(imagePath) } }
      }
      if (ctx.step1Metadata.format !== 'pdf') return { path: ctx.extractFilePath, metadata: { ...ctx.step1Metadata, pageCount: 1 } }
      const pageDir = join(pageWorkspace, 'page-inputs')
      await mkdir(pageDir, { recursive: true })
      const pagePath = join(pageDir, `page-${String(pageNumber).padStart(6, '0')}.png`)
      await renderPdfPage(
        ctx.extractFilePath,
        pagePath,
        { startPage: pageNumber, endPage: pageNumber },
        ctx.effectiveOpts.password
      )
      const pageStats = await stat(pagePath)
      return { path: pagePath, metadata: { ...ctx.step1Metadata, pageCount: 1, fileSize: pageStats.size, format: 'png' } }
    })()
    promises.set(pageNumber, promise)
    promise.catch(() => {
      if (promises.get(pageNumber) === promise) promises.delete(pageNumber)
    })
    return promise
  }
  return { totalPages: cbzImages?.length ?? Math.max(1, ctx.step1Metadata.pageCount), preparePage }
}

export const preflightPooledPageInputs = async (
  provider: PooledPageInputProvider,
  concurrency = 8
): Promise<void> => {
  const requestedConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1
  const workerCount = Math.max(1, Math.min(provider.totalPages, requestedConcurrency))
  let nextPage = 1
  let failure: unknown
  const worker = async (): Promise<void> => {
    while (failure === undefined) {
      const pageNumber = nextPage++
      if (pageNumber > provider.totalPages) return
      try {
        await provider.preparePage(pageNumber)
      } catch (error) {
        const detail = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : String(error)
        failure = UsageError(
          `--ocr-provider-mode pool could not normalize page ${pageNumber} into a compatible work unit: ${detail}`,
          { cause: error }
        )
      }
    }
  }
  await Promise.all(Array.from({ length: workerCount }, worker))
  if (failure !== undefined) throw failure
}
