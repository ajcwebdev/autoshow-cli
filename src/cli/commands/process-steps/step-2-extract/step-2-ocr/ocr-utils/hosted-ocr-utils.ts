import { isRecord } from '~/utils/rest-client'
import { mkdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { DocumentMetadata, ExtractionOptions, HostedOcrImageResult, HostedOcrRun, HostedOcrSchedulerRetryPressureHandler, HostedOcrService, PageResult, StoredRenderedHostedOcrPage } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { ValidationError } from '~/utils/error-handler'
import { runHostedOcrSchedulerAdmission } from './hosted-ocr-scheduler'
import { runWithRenderedOcrPdfPages } from './pdf-page-rendering'

const RENDERED_HOSTED_OCR_PAGE_CACHE_VERSION = 1
export const RENDERED_HOSTED_OCR_PAGE_MODE = 'rendered-page'
const RENDERED_HOSTED_OCR_PAGE_RESULTS_DIR = 'page-results'
const RENDERED_HOSTED_OCR_PARTIAL_TEXT_FILE = 'partial-extraction.txt'

const resolveHostedOcrServiceFromMethod = (
  extractionMethod: string
): HostedOcrService => {
  if (extractionMethod.includes('kimi-ocr')) return 'kimi'
  if (extractionMethod.includes('grok-ocr')) return 'grok'
  if (extractionMethod.includes('deepinfra-ocr')) return 'deepinfra'
  if (extractionMethod.includes('glm-ocr')) return 'glm'
  if (extractionMethod.includes('openai-ocr')) return 'openai'
  if (extractionMethod.includes('anthropic-ocr')) return 'anthropic'
  if (extractionMethod.includes('gemini-ocr')) return 'gemini'
  return 'mistral'
}

export const buildHostedOcrImageResult = (
  pageNumber: number,
  rawText: string,
  usage: {
    promptTokens?: number | undefined
    completionTokens?: number | undefined
  } = {}
): HostedOcrImageResult => ({
  page: {
    pageNumber,
    method: 'ocr',
    text: rawText.trim()
  },
  ...(typeof usage.promptTokens === 'number' ? { promptTokens: usage.promptTokens } : {}),
  ...(typeof usage.completionTokens === 'number' ? { completionTokens: usage.completionTokens } : {})
})

const getHostedOcrImageMimeType = (
  format: DocumentMetadata['format'],
  providerLabel: string,
  supported: Partial<Record<DocumentMetadata['format'], string>>
): string => {
  const mimeType = supported[format]
  if (!mimeType) {
    throw ValidationError(`Unsupported ${providerLabel} image format: ${format}`, { stage: 'ocr:hosted' })
  }
  return mimeType
}

export const assertHostedOcrImageWithinLimits = async (
  filePath: string,
  pageLabel: string,
  options: {
    providerLabel: string
    maxBytes: number
    limitLabel: string
  }
): Promise<void> => {
  const fileStats = await stat(filePath)
  if (fileStats.size > options.maxBytes) {
    throw ValidationError(`${options.providerLabel} image input exceeds the ${options.limitLabel} image limit for ${basename(filePath)} (${pageLabel}).`, { stage: 'ocr:hosted' })
  }
}

export const readHostedOcrImageDataUrl = async (
  filePath: string,
  format: DocumentMetadata['format'],
  options: {
    providerLabel: string
    supportedMimeTypes: Partial<Record<DocumentMetadata['format'], string>>
  }
): Promise<string> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return `data:${getHostedOcrImageMimeType(format, options.providerLabel, options.supportedMimeTypes)};base64,${base64}`
}

const createHostedOcrUsageAccumulator = (): {
  add: (result: Pick<HostedOcrImageResult, 'promptTokens' | 'completionTokens'>) => void
  values: () => { promptTokens?: number, completionTokens?: number }
} => {
  let promptTokens = 0
  let completionTokens = 0
  let hasPromptTokens = false
  let hasCompletionTokens = false

  return {
    add: (result) => {
      if (typeof result.promptTokens === 'number') {
        promptTokens += result.promptTokens
        hasPromptTokens = true
      }
      if (typeof result.completionTokens === 'number') {
        completionTokens += result.completionTokens
        hasCompletionTokens = true
      }
    },
    values: () => ({
      ...(hasPromptTokens ? { promptTokens } : {}),
      ...(hasCompletionTokens ? { completionTokens } : {})
    })
  }
}


export const isPageResult = (value: unknown): value is PageResult =>
  isRecord(value)
  && typeof value['pageNumber'] === 'number'
  && (value['method'] === 'text' || value['method'] === 'ocr' || value['method'] === 'skipped')
  && typeof value['text'] === 'string'
  && (value['confidence'] === undefined || typeof value['confidence'] === 'number')

export const isHostedOcrRun = (value: unknown): value is HostedOcrRun =>
  isRecord(value)
  && Array.isArray(value['pages'])
  && value['pages'].every(isPageResult)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['ocrService'] === 'string'
  && typeof value['ocrModel'] === 'string'

export const getUsageNumber = (
  entry: Record<string, unknown>,
  keys: readonly string[]
): number | undefined => {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

const isHostedOcrImageResult = (value: unknown): value is HostedOcrImageResult =>
  isRecord(value)
  && isPageResult(value['page'])
  && (value['promptTokens'] === undefined || typeof value['promptTokens'] === 'number')
  && (value['completionTokens'] === undefined || typeof value['completionTokens'] === 'number')

const getRenderedHostedOcrPageResultsDir = (outputDir: string): string =>
  join(outputDir, RENDERED_HOSTED_OCR_PAGE_RESULTS_DIR)

const getRenderedHostedOcrPageResultPath = (outputDir: string, pageNumber: number): string =>
  join(getRenderedHostedOcrPageResultsDir(outputDir), `page-${String(pageNumber).padStart(6, '0')}.json`)

const getRenderedHostedOcrPageTextPath = (outputDir: string, pageNumber: number): string =>
  join(getRenderedHostedOcrPageResultsDir(outputDir), `page-${String(pageNumber).padStart(6, '0')}.txt`)

const getRenderedHostedOcrPartialTextPath = (outputDir: string): string =>
  join(outputDir, RENDERED_HOSTED_OCR_PARTIAL_TEXT_FILE)

const parseStoredRenderedHostedOcrPage = (
  value: unknown,
  pageNumber: number,
  totalPages: number,
  extractionMethod: string,
  model: string,
  sourceFile: string
): HostedOcrImageResult | undefined => {
  if (
    !isRecord(value)
    || value['version'] !== RENDERED_HOSTED_OCR_PAGE_CACHE_VERSION
    || value['mode'] !== RENDERED_HOSTED_OCR_PAGE_MODE
    || value['extractionMethod'] !== extractionMethod
    || value['model'] !== model
    || value['sourceFile'] !== sourceFile
    || value['pageNumber'] !== pageNumber
    || value['totalPages'] !== totalPages
    || !isHostedOcrImageResult(value['result'])
  ) {
    return undefined
  }

  const result = value['result']
  if (result.page.pageNumber !== pageNumber) {
    return undefined
  }

  return result
}

const readCachedRenderedHostedOcrPage = async (
  outputDir: string,
  pageNumber: number,
  totalPages: number,
  extractionMethod: string,
  model: string,
  sourceFile: string
): Promise<HostedOcrImageResult | undefined> => {
  try {
    const raw = await Bun.file(getRenderedHostedOcrPageResultPath(outputDir, pageNumber)).json()
    return parseStoredRenderedHostedOcrPage(raw, pageNumber, totalPages, extractionMethod, model, sourceFile)
  } catch {
    return undefined
  }
}

const writeRenderedHostedOcrPageText = async (
  outputDir: string,
  pageNumber: number,
  result: HostedOcrImageResult
): Promise<void> => {
  await mkdir(getRenderedHostedOcrPageResultsDir(outputDir), { recursive: true })
  const pageText = result.page.text
  await Bun.write(
    getRenderedHostedOcrPageTextPath(outputDir, pageNumber),
    pageText.endsWith('\n') ? pageText : `${pageText}\n`
  )
}

const writeCachedRenderedHostedOcrPage = async (
  outputDir: string,
  pageNumber: number,
  totalPages: number,
  extractionMethod: string,
  model: string,
  sourceFile: string,
  result: HostedOcrImageResult
): Promise<void> => {
  await mkdir(getRenderedHostedOcrPageResultsDir(outputDir), { recursive: true })
  await writeRenderedHostedOcrPageText(outputDir, pageNumber, result)
  const payload: StoredRenderedHostedOcrPage = {
    version: RENDERED_HOSTED_OCR_PAGE_CACHE_VERSION,
    mode: RENDERED_HOSTED_OCR_PAGE_MODE,
    extractionMethod,
    model,
    sourceFile,
    totalPages,
    pageNumber,
    result
  }
  await Bun.write(
    getRenderedHostedOcrPageResultPath(outputDir, pageNumber),
    JSON.stringify(payload, null, 2) + '\n'
  )
}

const writeRenderedHostedOcrPartialText = async (
  outputDir: string,
  results: HostedOcrImageResult[]
): Promise<void> => {
  const text = results
    .map((result) => result.page)
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `Page ${page.pageNumber}\n${page.text.trim()}`)
    .join('\n\n')
    .trim()

  await Bun.write(
    getRenderedHostedOcrPartialTextPath(outputDir),
    text.length > 0 ? `${text}\n` : ''
  )
}

export const runHostedOcrDocument = async <TExtractionMethod extends string>(
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'outputDir' | 'ocrPreparationCache' | 'ocrConcurrency' | 'hostedOcrScheduler'>,
  options: {
    service?: HostedOcrService | undefined
    extractionMethod: TExtractionMethod
    tempDirPrefix: string
    providerLabel: string
    model: string
    runImage: (
      imagePath: string,
      format: DocumentMetadata['format'],
      pageNumber: number,
      pageLabel: string,
      onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    ) => Promise<HostedOcrImageResult>
  }
): Promise<{
  pages: PageResult[]
  extractionMethod: TExtractionMethod
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const usage = createHostedOcrUsageAccumulator()
  const service = options.service ?? resolveHostedOcrServiceFromMethod(options.extractionMethod)
  const runScheduledImage = async (
    imagePath: string,
    format: DocumentMetadata['format'],
    pageNumber: number,
    pageLabel: string
  ): Promise<HostedOcrImageResult> =>
    await runHostedOcrSchedulerAdmission(
      opts.hostedOcrScheduler,
      {
        service,
        model: options.model,
        targetKey: `${service}:${options.model}`,
        pageNumber,
        pageCount: 1
      },
      async (onRetryable) => await options.runImage(imagePath, format, pageNumber, pageLabel, onRetryable)
    )

  if (step1Metadata.format !== 'pdf') {
    const result = await runScheduledImage(filePath, step1Metadata.format, 1, 'input image')
    usage.add(result)
    return {
      pages: [result.page],
      extractionMethod: options.extractionMethod,
      totalPages: 1,
      ...usage.values()
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const sourceFile = basename(filePath)
  let partialWrite = Promise.resolve()
  const results = await runWithRenderedOcrPdfPages<HostedOcrImageResult>({
    filePath,
    totalPages,
    dpi: opts.dpi,
    password: opts.password,
    ocrPreparationCache: opts.ocrPreparationCache,
    tempDirPrefix: options.tempDirPrefix,
    providerLabel: options.providerLabel,
    pageConcurrency: opts.hostedOcrScheduler?.getMaxConcurrency({
      service,
      model: options.model,
      pageCount: totalPages
    }) ?? opts.ocrConcurrency,
    readCachedPage: async (page) => {
      const cached = await readCachedRenderedHostedOcrPage(
        opts.outputDir,
        page,
        totalPages,
        options.extractionMethod,
        options.model,
        sourceFile
      )
      if (cached === undefined) {
        return undefined
      }

      usage.add(cached)
      await writeRenderedHostedOcrPageText(opts.outputDir, page, cached)
      l.write('info', `${options.providerLabel}: OCR page ${page} already cached`)
      return cached
    },
    onPageStart: (page) => {
      l.write('info', `${options.providerLabel}: OCR page ${page}`)
    },
    onPage: async ({ imagePath, page }) => {
      const result = await runScheduledImage(imagePath, 'png', page, `page ${page}`)
      usage.add(result)
      await writeCachedRenderedHostedOcrPage(
        opts.outputDir,
        page,
        totalPages,
        options.extractionMethod,
        options.model,
        sourceFile,
        result
      )
      return result
    },
    onResult: async (_result, _pageNumber, _index, results) => {
      const completedResults = results.filter((result): result is HostedOcrImageResult => result !== undefined)
      partialWrite = partialWrite.then(async () => {
        await writeRenderedHostedOcrPartialText(opts.outputDir, completedResults)
      })
      await partialWrite
    }
  })
  await partialWrite
  await writeRenderedHostedOcrPartialText(opts.outputDir, results)
  const pages = results.map((result) => result.page)

  return {
    pages,
    extractionMethod: options.extractionMethod,
    totalPages,
    ...usage.values()
  }
}
