import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CollectPartialStep2Options, ExtractionMetadata, HostedOcrRun, OcrProviderFailureSummary, OcrTarget, PageResult, PartialExtractionFailureMetadata, PartialExtractionMetadata, PartialPageUsage } from '~/types'
import { ExtractionMetadataSchema } from '~/types'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { estimateTokens } from '~/utils/text-utils'
import { validateData } from '~/utils/validate/validation'
import { getOcrTargetDirectoryName } from './ocr-targets'

const PAGE_RESULTS_DIR = 'page-results'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPageResult = (value: unknown): value is PageResult =>
  isRecord(value)
  && typeof value['pageNumber'] === 'number'
  && (value['method'] === 'text' || value['method'] === 'ocr' || value['method'] === 'skipped')
  && typeof value['text'] === 'string'

const isHostedOcrRun = (value: unknown): value is HostedOcrRun =>
  isRecord(value)
  && Array.isArray(value['pages'])
  && value['pages'].every(isPageResult)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['ocrService'] === 'string'
  && typeof value['ocrModel'] === 'string'

const getUsageNumber = (
  entry: Record<string, unknown>,
  keys: readonly string[]
): number | undefined => {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

const collectUsageTokens = (
  usage: unknown
): { promptTokens?: number | undefined, completionTokens?: number | undefined } => {
  if (!Array.isArray(usage)) {
    return {}
  }

  let promptTokens = 0
  let completionTokens = 0
  let hasPromptTokens = false
  let hasCompletionTokens = false
  for (const entry of usage) {
    if (!isRecord(entry)) {
      continue
    }
    const prompt = getUsageNumber(entry, ['promptTokens', 'prompt_tokens', 'inputTokens', 'input_tokens'])
    const completion = getUsageNumber(entry, ['completionTokens', 'completion_tokens', 'outputTokens', 'output_tokens'])
    if (typeof prompt === 'number') {
      promptTokens += prompt
      hasPromptTokens = true
    }
    if (typeof completion === 'number') {
      completionTokens += completion
      hasCompletionTokens = true
    }
  }

  return {
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {})
  }
}

const parseRenderedPageCache = (
  value: unknown,
  target: OcrTarget
): PartialPageUsage | undefined => {
  if (
    !isRecord(value)
    || value['mode'] !== 'rendered-page'
    || typeof value['extractionMethod'] !== 'string'
    || value['model'] !== target.model
    || typeof value['totalPages'] !== 'number'
    || typeof value['pageNumber'] !== 'number'
    || !isRecord(value['result'])
    || !isPageResult(value['result']['page'])
  ) {
    return undefined
  }

  const result = value['result'] as Record<string, unknown>
  const page = result['page']
  if (!isPageResult(page)) {
    return undefined
  }
  if (page.pageNumber !== value['pageNumber']) {
    return undefined
  }

  return {
    pageNumber: page.pageNumber,
    text: page.text,
    extractionMethod: value['extractionMethod'],
    totalPages: Math.max(1, Math.floor(value['totalPages'])),
    ...(typeof result['promptTokens'] === 'number' ? { promptTokens: result['promptTokens'] } : {}),
    ...(typeof result['completionTokens'] === 'number' ? { completionTokens: result['completionTokens'] } : {})
  }
}

const parseSinglePageFallbackCache = (
  value: unknown,
  target: OcrTarget
): PartialPageUsage | undefined => {
  if (
    !isRecord(value)
    || value['mode'] !== 'single-page'
    || typeof value['totalPages'] !== 'number'
    || typeof value['pageNumber'] !== 'number'
    || !isHostedOcrRun(value['run'])
  ) {
    return undefined
  }

  const run = value['run']
  if (run.ocrService !== target.service || run.ocrModel !== target.model) {
    return undefined
  }

  const page = run.pages.find((candidate) => candidate.pageNumber === value['pageNumber'])
  if (!page) {
    return undefined
  }

  const usageTokens = collectUsageTokens(run.providerUsage)
  return {
    pageNumber: page.pageNumber,
    text: page.text,
    extractionMethod: run.extractionMethod,
    totalPages: Math.max(1, Math.floor(value['totalPages'])),
    ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : usageTokens.promptTokens !== undefined ? { promptTokens: usageTokens.promptTokens } : {}),
    ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : usageTokens.completionTokens !== undefined ? { completionTokens: usageTokens.completionTokens } : {})
  }
}

const readPartialPageCaches = async (
  providerDir: string,
  target: OcrTarget
): Promise<PartialPageUsage[]> => {
  const pageResultsDir = join(providerDir, PAGE_RESULTS_DIR)
  let entries: string[]
  try {
    entries = await readdir(pageResultsDir)
  } catch {
    return []
  }

  const pages = new Map<number, PartialPageUsage>()
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue
    }
    let raw: unknown
    try {
      raw = await Bun.file(join(pageResultsDir, entry)).json()
    } catch {
      continue
    }
    const parsed = parseRenderedPageCache(raw, target) ?? parseSinglePageFallbackCache(raw, target)
    if (parsed !== undefined) {
      pages.set(parsed.pageNumber, parsed)
    }
  }

  return [...pages.values()].sort((left, right) => left.pageNumber - right.pageNumber)
}

const buildFailureMetadata = (
  failure: OcrProviderFailureSummary
): PartialExtractionFailureMetadata => ({
  message: sanitizeLogText(failure.message),
  ...(failure.category ? { category: failure.category } : {}),
  ...(failure.failureKind ? { failureKind: failure.failureKind } : {}),
  retryable: failure.retryable,
  ...(failure.quota ? { quota: true } : {}),
  ...(failure.providerWide ? { providerWide: true } : {}),
  ...(failure.blockedReason ? { blockedReason: sanitizeLogText(failure.blockedReason) } : {}),
  ...(failure.stage ? { stage: failure.stage } : {}),
  ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
  ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
  ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
  ...(failure.rawResponseFile ? { rawResponseFile: failure.rawResponseFile } : {}),
  ...(typeof failure.elapsedMs === 'number' ? { elapsedMs: Math.max(0, Math.round(failure.elapsedMs)) } : {})
})

const buildPartialExtractionMetadata = (
  target: OcrTarget,
  artifactDir: string,
  pages: PartialPageUsage[],
  failure: OcrProviderFailureSummary,
  options: Pick<CollectPartialStep2Options, 'dpi' | 'languages'>
): PartialExtractionMetadata | undefined => {
  if (pages.length === 0) {
    return undefined
  }

  const totalPages = Math.max(...pages.map((page) => page.totalPages))
  const completedPages = pages.length
  const failedPages = Math.max(1, totalPages - completedPages)
  const promptTokens = pages.reduce((sum, page) => sum + (page.promptTokens ?? 0), 0)
  const completionTokens = pages.reduce((sum, page) => sum + (page.completionTokens ?? 0), 0)
  const hasPromptTokens = pages.some((page) => typeof page.promptTokens === 'number')
  const hasCompletionTokens = pages.some((page) => typeof page.completionTokens === 'number')
  const text = pages.map((page) => page.text).join('\n\n')
  const basePayload = {
    extractionMethod: pages[0]?.extractionMethod ?? `${target.service}-ocr`,
    totalPages,
    ocrPages: completedPages,
    textPages: 0,
    processingTime: Math.max(0, Math.round(failure.elapsedMs ?? 0)),
    dpi: options.dpi,
    languages: options.languages,
    tokenEstimate: estimateTokens(text),
    ocrService: target.service,
    ocrModel: target.model,
    providerCostSource: 'partial_provider_usage',
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {})
  }
  const base = validateData(ExtractionMetadataSchema, basePayload, 'partial OCR extraction metadata') as ExtractionMetadata

  return {
    ...base,
    status: 'failed_partial',
    artifactDir,
    completedPages,
    failedPages,
    failure: buildFailureMetadata(failure)
  }
}

export const collectPartialStep2Metadata = async (
  options: CollectPartialStep2Options
): Promise<PartialExtractionMetadata[]> => {
  const partial: PartialExtractionMetadata[] = []

  for (const [index, failure] of options.failuresByIndex) {
    const target = options.requestedTargets[index]
    if (!target || target.service === 'tesseract') {
      continue
    }
    const artifactDir = `providers/${getOcrTargetDirectoryName(target)}`
    const pages = await readPartialPageCaches(join(options.outputDir, artifactDir), target)
    const metadata = buildPartialExtractionMetadata(target, artifactDir, pages, failure, options)
    if (metadata !== undefined) {
      partial.push(metadata)
    }
  }

  return partial
}
