import { isRecord } from '~/utils/rest-client'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CollectPartialStep2Options, ExtractionMetadata, HostedExtractOcrEngine, OcrProviderFailureSummary, OcrTarget, PartialExtractionFailureMetadata, PartialExtractionMetadata, PartialPageUsage } from '~/types'
import { ExtractionMetadataSchema } from '~/types'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { estimateTokens } from '~/utils/text-utils'
import { validateData } from '~/utils/validate/validation'
import { getOcrTargetDirectoryName } from './ocr-targets'
import { getUsageNumber } from './ocr-utils/hosted-ocr-utils'
import { parseStoredHostedOcrPageCache } from './ocr-utils/pdf-chunk-fallback-state'

const PAGE_RESULTS_DIR = 'page-results'

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

const parsePageCache = (
  value: unknown,
  target: OcrTarget
): PartialPageUsage | undefined => {
  if (target.service === 'tesseract') {
    return undefined
  }
  const parsed = parseStoredHostedOcrPageCache(value, {
    identity: {
      extractionMethod: `${target.service}-ocr` as HostedExtractOcrEngine,
      ocrService: target.service,
      ocrModel: target.model
    }
  })
  if (parsed === undefined) {
    return undefined
  }

  const run = parsed.run
  const page = run.pages.find((candidate) => candidate.pageNumber === parsed.pageNumber)
  if (!page) {
    return undefined
  }

  const usageTokens = collectUsageTokens(run.providerUsage)
  return {
    pageNumber: page.pageNumber,
    text: page.text,
    extractionMethod: run.extractionMethod,
    totalPages: Math.max(1, Math.floor(parsed.totalPages)),
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
    const parsed = parsePageCache(raw, target)
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
