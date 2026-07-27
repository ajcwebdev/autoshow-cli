import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OcrPreparationCache } from '~/types'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getCachedRenderedPageImage } from './preparation-cache'
import { runOrderedOcrPageTasks } from './page-concurrency'
import { InfraError } from '~/utils/error-handler'

export const runWithRenderedOcrPdfPages = async <T>(options: {
  filePath: string
  totalPages: number
  dpi: number
  password?: string | undefined
  ocrPreparationCache?: OcrPreparationCache | undefined
  tempDirPrefix: string
  providerLabel: string
  pageConcurrency?: number | undefined
  readCachedPage?: (page: number) => Promise<T | undefined>
  onPageStart?: (page: number) => Promise<void> | void
  onPage: (input: { imagePath: string, page: number }) => Promise<T>
  onResult?: (
    result: T,
    page: number,
    index: number,
    results: ReadonlyArray<T | undefined>
  ) => Promise<void> | void
}): Promise<T[]> => {
  const tempDir = await mkdtemp(join(tmpdir(), options.tempDirPrefix))
  const pages = Array.from({ length: options.totalPages }, (_value, index) => index + 1)

  try {
    return await runOrderedOcrPageTasks(pages, options.pageConcurrency, async (page) => {
      const cached = await options.readCachedPage?.(page)
      if (cached !== undefined) {
        return cached
      }

      await options.onPageStart?.(page)

      const imagePath = join(tempDir, `page-${String(page).padStart(3, '0')}.png`)
      let renderedImagePath = imagePath
      let removeRenderedImage = true

      if (options.ocrPreparationCache) {
        const rendered = await getCachedRenderedPageImage(
          options.ocrPreparationCache,
          {
            filePath: options.filePath,
            page,
            dpi: options.dpi,
            password: options.password
          },
          async (outputPath) => {
            const renderResult = await renderPageToImage(
              options.filePath,
              page,
              options.dpi,
              outputPath,
              options.password
            )
            if (renderResult.exitCode !== 0) {
              throw InfraError(renderResult.stderr || `Failed rendering page ${page} for ${options.providerLabel}`, { stage: 'ocr:render' })
            }
          }
        )
        renderedImagePath = rendered.imagePath
        removeRenderedImage = false
      } else {
        const renderResult = await renderPageToImage(
          options.filePath,
          page,
          options.dpi,
          imagePath,
          options.password
        )
        if (renderResult.exitCode !== 0) {
          throw InfraError(renderResult.stderr || `Failed rendering page ${page} for ${options.providerLabel}`, { stage: 'ocr:render' })
        }
      }

      try {
        return await options.onPage({ imagePath: renderedImagePath, page })
      } finally {
        if (removeRenderedImage) {
          await rm(imagePath, { force: true })
        }
      }
    }, options.onResult)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
