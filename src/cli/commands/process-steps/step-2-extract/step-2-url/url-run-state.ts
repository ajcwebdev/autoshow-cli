import { isRecord } from '~/utils/rest-client'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { ensureDirectory, writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import { estimateTokens } from '~/utils/text-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { buildArticleSlug } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { writeProviderResult } from '../../manifest-utils'
import { runProviderTargetScheduler } from '../../provider-target-scheduler'
import { URL_ARTICLE_BACKENDS } from '../step-2-shared/provider-registry'
import { collectEstimatedExtractTargets, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts } from '../step-2-ocr/ocr-costs'
import { runUrlArticleProviderWithStats } from './url-provider-registry'
import {
  getUrlProviderArtifactDir,
  isHtmlArticleBackend,
  isLocalUrlBackend,
  toRequestedUrlProvider,
  uniqueBackends
} from './url-targets'
import { fallbackTitleFromSource, formatErrorMessage, isRemoteSource } from './url-utils'
import { DocumentMetadataSchema, ExtractionMetadataSchema, ExtractionResultSchema } from '~/types'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { AggregatedPriceEstimate, BatchChildRunContext, DocumentMetadata, ExtractionMetadata, ExtractionOptions, ExtractionResult, HtmlArticleBackend, RuntimeOptions, UrlArticleBackendPlan, UrlArticleRunResult, UrlProviderFailure, UrlProviderRunOutcome, UrlProviderState, UrlProviderSuccess, UrlRequestOptions, WebArticleMetadata } from '~/types'


const readLocalHtmlFileSize = async (source: string): Promise<number | undefined> => {
  if (isRemoteSource(source)) {
    return undefined
  }
  try {
    return (await stat(source)).size
  } catch {
    return undefined
  }
}

const buildUrlRunOptions = (
  opts: Pick<RuntimeOptions, 'urlRequestTimeoutMs' | 'urlRequestAttempts'>
): UrlRequestOptions => ({
  timeoutMs: opts.urlRequestTimeoutMs,
  requestAttempts: opts.urlRequestAttempts
})

const getErrorAttempts = (error: unknown): number => {
  if (error && typeof error === 'object' && 'attemptsMade' in error) {
    const attempts = (error as { attemptsMade?: unknown }).attemptsMade
    if (typeof attempts === 'number' && Number.isFinite(attempts) && attempts > 0) {
      return Math.floor(attempts)
    }
  }
  return 1
}

export const buildFallbackStep1Metadata = async (
  source: string
): Promise<DocumentMetadata> => {
  const fallbackTitle = fallbackTitleFromSource(source)
  const slug = buildArticleSlug(source, fallbackTitle)
  return validateData(DocumentMetadataSchema, {
    title: fallbackTitle,
    slug,
    pageCount: 1,
    format: 'html',
    fileSize: await readLocalHtmlFileSize(source) ?? 0
  }, 'html article metadata')
}

export const buildStep1MetadataFromArticle = (
  source: string,
  article: UrlArticleRunResult | undefined,
  fallback: DocumentMetadata
): DocumentMetadata => {
  if (!article) {
    return fallback
  }

  const title = article.title ?? article.web.title ?? fallback.title ?? fallbackTitleFromSource(source)
  const slug = buildArticleSlug(isRemoteSource(source) ? (article.web.finalUrl ?? source) : source, title)
  return validateData(DocumentMetadataSchema, {
    ...(title ? { title } : {}),
    slug,
    ...(article.author ?? article.web.author ? { author: article.author ?? article.web.author } : {}),
    pageCount: 1,
    format: 'html',
    fileSize: article.fileSize
  }, 'html article metadata')
}

export const reserveUrlOutputDir = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  fallbackStep1: DocumentMetadata,
  article: UrlArticleRunResult | undefined,
  batchChildContext?: BatchChildRunContext
): Promise<string> => {
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const title = article?.title ?? fallbackStep1.title ?? fallbackTitleFromSource(source)
  const slug = article
    ? buildArticleSlug(isRemoteSource(source) ? (article.web.finalUrl ?? source) : source, title)
    : fallbackStep1.slug
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    slug,
    publishedAt: batchChildContext?.batchItem?.publishedAt ?? article?.web.published,
    fallbackLabel: title || slug || 'article'
  }) ?? resolveRunDirectory(outputBaseDir, title || slug || 'article', 'url')
  await ensureDirectory(outputDir)
  return outputDir
}

const buildUrlExtractionResult = (
  article: UrlArticleRunResult
): ExtractionResult =>
  validateData(ExtractionResultSchema, {
    text: article.markdown.trim(),
    pages: [{
      pageNumber: 1,
      method: 'text',
      text: article.markdown.trim()
    }],
    totalPages: 1,
    ocrPages: 0,
    textPages: 1
  }, 'URL extraction result')

const buildUrlExtractionMetadata = (
  backend: HtmlArticleBackend,
  result: ExtractionResult,
  processingTimeMs: number,
  opts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): ExtractionMetadata =>
  validateData(ExtractionMetadataSchema, {
    extractionMethod: `html+${backend}`,
    totalPages: result.totalPages,
    ocrPages: result.ocrPages,
    textPages: result.textPages,
    processingTime: processingTimeMs,
    dpi: opts.dpi,
    languages: opts.languages,
    tokenEstimate: estimateTokens(result.text),
    inputFamily: 'html',
    outputFidelity: 'markdown',
    outputFormat: opts.outputFormat
  }, 'URL extraction metadata')

export const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat']
): Promise<void> => {
  if (outputFormat === 'json') {
    await writeFile(join(outputDir, 'result.json'), `${JSON.stringify(extractionResult, null, 2)}\n`)
    return
  }

  if (outputFormat === 'tsv') {
    const tsv = extractionResult.pages.map(page => `${page.pageNumber}\t${page.text.replace(/\n/g, ' ')}`).join('\n')
    await writeFile(join(outputDir, 'extraction.tsv'), `${tsv}\n`)
    return
  }

  if (outputFormat === 'hocr') {
    const hocr = extractionResult.pages.map(page => `<div class="page" data-page="${page.pageNumber}">${page.text}</div>`).join('\n')
    await writeFile(join(outputDir, 'extraction.hocr'), `${hocr}\n`)
    return
  }

  await writeFile(join(outputDir, 'extraction.txt'), `${extractionResult.text}\n`)
}

export const writeUrlProviderArtifacts = async (
  outputDir: string,
  success: UrlProviderSuccess
): Promise<void> => {
  const providerDir = join(outputDir, getUrlProviderArtifactDir(success.backend))
  await mkdir(providerDir, { recursive: true })
  await writeFile(join(providerDir, 'extraction.txt'), `${success.result.text}\n`)
  await writeProviderResult(
    providerDir,
    success.backend,
    success.backend,
    success.metadata as Record<string, unknown>,
    success.result as Record<string, unknown>
  )
}

const runSingleUrlBackend = async (
  source: string,
  requestedBackend: HtmlArticleBackend,
  sourceUrl: string | undefined,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>,
  urlRunOptions: UrlRequestOptions
): Promise<UrlProviderSuccess> => {
  let backend = requestedBackend
  const startedAt = Date.now()
  let article: UrlArticleRunResult
  let attempts = 0

  if (requestedBackend === 'defuddle' && sourceUrl) {
    try {
      const run = await runUrlArticleProviderWithStats('defuddle', source, sourceUrl, urlRunOptions)
      article = run.article
      attempts = run.attempts
    } catch (defuddleError) {
      l.warn(`Defuddle article extraction failed; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`)
      try {
        const run = await runUrlArticleProviderWithStats('firecrawl', source, sourceUrl, urlRunOptions)
        article = run.article
        attempts = run.attempts
        backend = 'firecrawl'
      } catch (firecrawlError) {
        throw InfraError(
          `Defuddle article extraction failed and Firecrawl fallback failed. ` +
          `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`,
          { stage: 'extract:url' }
        )
      }
    }
  } else {
    const run = await runUrlArticleProviderWithStats(requestedBackend, source, sourceUrl, urlRunOptions)
    article = run.article
    attempts = run.attempts
  }

  const result = buildUrlExtractionResult(article)
  const metadata = buildUrlExtractionMetadata(backend, result, Date.now() - startedAt, extractionOpts)
  return {
    backend,
    article,
    result,
    metadata,
    attempts
  }
}

const runUrlBackendDirect = async (
  source: string,
  backend: HtmlArticleBackend,
  sourceUrl: string | undefined,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>,
  urlRunOptions: UrlRequestOptions
): Promise<UrlProviderSuccess> => {
  const startedAt = Date.now()
  const run = await runUrlArticleProviderWithStats(backend, source, sourceUrl, urlRunOptions)
  const article = run.article
  const result = buildUrlExtractionResult(article)
  const metadata = buildUrlExtractionMetadata(backend, result, Date.now() - startedAt, extractionOpts)
  return {
    backend,
    article,
    result,
    metadata,
    attempts: run.attempts,
    relativeDir: getUrlProviderArtifactDir(backend)
  }
}

export const buildProviderStates = (
  requestedBackends: HtmlArticleBackend[],
  outcomes: UrlProviderRunOutcome[]
): UrlProviderState[] => {
  const byBackend = new Map<HtmlArticleBackend, UrlProviderRunOutcome>(
    outcomes.map((outcome) => [
      outcome.status === 'succeeded' ? outcome.success.backend : outcome.backend,
      outcome
    ])
  )

  return requestedBackends.map((backend) => {
    const outcome = byBackend.get(backend)
    if (!outcome) {
      return {
        service: backend,
        model: backend,
        artifactDir: getUrlProviderArtifactDir(backend),
        status: 'missing',
        attempts: 0
      }
    }

    if (outcome.status === 'succeeded') {
      return {
        service: backend,
        model: backend,
        artifactDir: getUrlProviderArtifactDir(backend),
        status: 'succeeded',
        attempts: outcome.success.attempts
      }
    }

    return {
      service: backend,
      model: backend,
      artifactDir: getUrlProviderArtifactDir(backend),
      status: outcome.status,
      attempts: outcome.status === 'skipped' ? 0 : outcome.attempts,
      lastError: {
        message: outcome.message
      }
    }
  })
}

export const completionStatusFromProviderStates = (
  providerStates: UrlProviderState[]
): 'full' | 'incomplete' | 'failed' => {
  const succeeded = providerStates.filter((state) => state.status === 'succeeded').length
  if (succeeded === 0) return 'failed'
  return succeeded === providerStates.length ? 'full' : 'incomplete'
}

export const buildManifestMetadata = (
  step1Metadata: DocumentMetadata,
  step2Metadata: ExtractionMetadata | ExtractionMetadata[] | undefined,
  options: {
    source: { url?: string, filePath?: string }
    web?: WebArticleMetadata | undefined
    preflightEstimate?: AggregatedPriceEstimate | undefined
    completionStatus: 'full' | 'incomplete' | 'failed'
    requestedBackends: HtmlArticleBackend[]
    providerStates: UrlProviderState[]
    failures: UrlProviderFailure[]
  }
): Record<string, unknown> => {
  const normalizedStep2 = step2Metadata === undefined
    ? []
    : Array.isArray(step2Metadata)
      ? step2Metadata
      : [step2Metadata]
  const extractTargets = collectEstimatedExtractTargets(normalizedStep2)
  const estimated = resolveExtractEstimatedCosts(options.preflightEstimate, normalizedStep2)
  const observedEstimate = resolveExtractObservedEstimateCosts(normalizedStep2)
  const actual = computeActualCosts({ step2: normalizedStep2 })
  const estimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1Metadata.pageCount,
      ...(typeof target.rasterizedPages === 'number' ? { rasterizedPages: target.rasterizedPages } : {}),
      ...(typeof target.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: target.singlePagePdfFallbackPages } : {})
    }))
  })
  const actualTiming = computeActualProcessingTimes({ step2: normalizedStep2 })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined
  const requestedProviders = options.requestedBackends.map(toRequestedUrlProvider)

  return {
    step1: step1Metadata,
    step2: normalizedStep2.length === 1 ? normalizedStep2[0] : normalizedStep2,
    resolvedStep2: {
      route: 'article',
      sourceKind: 'article',
      providers: requestedProviders
    },
    completionStatus: options.completionStatus,
    requestedProviders,
    providerStates: options.providerStates,
    missingProviders: options.providerStates
      .filter((state) => state.status === 'missing' || state.status === 'failed')
      .map((state) => ({ service: state.service, model: state.model })),
    ...(options.web ? { web: options.web } : {}),
    source: options.source,
    cost: { estimated, observedEstimate, actual },
    ...(timing ? { timing } : {}),
    ...(options.failures.length > 0 ? { errors: options.failures.map((failure) => ({
      service: failure.backend,
      model: failure.backend,
      message: failure.message
    })) } : {})
  }
}

export const runAllUrlBackends = async (
  source: string,
  requestedBackends: HtmlArticleBackend[],
  sourceUrl: string | undefined,
  opts: RuntimeOptions,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): Promise<UrlProviderRunOutcome[]> => {
  const urlRunOptions = buildUrlRunOptions(opts)
  const scheduled = await runProviderTargetScheduler<HtmlArticleBackend, UrlProviderRunOutcome>({
    entries: requestedBackends.map((backend, index) => ({
      index,
      target: backend,
      priority: URL_ARTICLE_BACKENDS.length - index
    })),
    concurrency: {
      provider: opts.urlProviderConcurrency,
      local: 1
    },
    getPool: (backend) => isLocalUrlBackend(backend) ? 'local' : 'hosted',
    runTarget: async (_index, backend) => {
      try {
        const success = await runWithLogContext({ step: 'step-2-url', provider: backend }, async () =>
          await runUrlBackendDirect(source, backend, sourceUrl, extractionOpts, urlRunOptions)
        )
        return { status: 'succeeded', success }
      } catch (error) {
        return {
          status: 'failed',
          backend,
          message: formatErrorMessage(error),
          attempts: getErrorAttempts(error)
        }
      }
    }
  })

  return scheduled.results.filter((entry): entry is UrlProviderRunOutcome => entry !== undefined)
}

export const runUrlArticleBackendPlan = async (
  source: string,
  plan: UrlArticleBackendPlan,
  opts: RuntimeOptions,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): Promise<UrlProviderRunOutcome[]> => {
  if (plan.allUrlMode) {
    return [
      ...(plan.runnableBackends.length > 0
        ? await runAllUrlBackends(source, plan.runnableBackends, plan.sourceUrl, opts, extractionOpts)
        : []),
      ...plan.skippedBackends.map((backend) => ({
        status: 'skipped' as const,
        backend,
        message: 'Local HTML inputs are only supported by defuddle'
      }))
    ]
  }

  const requestedBackend = plan.requestedBackends[0] ?? 'defuddle'
  const urlRunOptions = buildUrlRunOptions(opts)
  return [
    await runWithLogContext({ step: 'step-2-url' }, async () => ({
      status: 'succeeded' as const,
      success: await runSingleUrlBackend(source, requestedBackend, plan.sourceUrl, extractionOpts, urlRunOptions)
    })).catch((error) => ({
      status: 'failed' as const,
      backend: requestedBackend,
      message: formatErrorMessage(error),
      attempts: getErrorAttempts(error)
    }))
  ]
}

const parseStoredProviderBackend = (value: unknown): HtmlArticleBackend | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  const service = value['service']
  return isHtmlArticleBackend(service) ? service : undefined
}

export const parseBackendFromExtractionMetadata = (value: unknown): HtmlArticleBackend | undefined => {
  if (!isRecord(value) || typeof value['extractionMethod'] !== 'string') {
    return undefined
  }
  const match = /^html\+(.+)$/.exec(value['extractionMethod'])
  const backend = match?.[1]
  return isHtmlArticleBackend(backend) ? backend : undefined
}

export const parseStoredStep2Metadata = (metadata: Record<string, unknown>): ExtractionMetadata[] => {
  const rawStep2 = metadata['step2']
  const entries = Array.isArray(rawStep2)
    ? rawStep2
    : isRecord(rawStep2)
      ? [rawStep2]
      : []

  return entries
    .filter(isRecord)
    .map((entry) => validateData(ExtractionMetadataSchema, entry, 'stored URL step2 metadata'))
}

export const parseStoredProviderStates = (metadata: Record<string, unknown>): UrlProviderState[] => {
  const rawStates = Array.isArray(metadata['providerStates']) ? metadata['providerStates'] : []
  return rawStates.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }
    const backend = parseStoredProviderBackend(entry)
    if (!backend) {
      return []
    }
    const status = entry['status']
    if (status !== 'succeeded' && status !== 'missing' && status !== 'failed' && status !== 'skipped') {
      return []
    }
    return [{
      service: backend,
      model: backend,
      artifactDir: typeof entry['artifactDir'] === 'string'
        ? entry['artifactDir']
        : getUrlProviderArtifactDir(backend),
      status,
      attempts: typeof entry['attempts'] === 'number' ? entry['attempts'] : 0,
      ...(isRecord(entry['lastError']) && typeof entry['lastError']['message'] === 'string'
        ? { lastError: { message: entry['lastError']['message'] } }
        : {})
    } satisfies UrlProviderState]
  })
}

export const parseStoredUrlBackends = (
  metadata: Record<string, unknown>,
  step2Metadata: ExtractionMetadata[],
  providerStates: UrlProviderState[]
): HtmlArticleBackend[] =>
  uniqueBackends([
    ...((Array.isArray(metadata['requestedProviders']) ? metadata['requestedProviders'] : [])
      .map(parseStoredProviderBackend)
      .filter((backend): backend is HtmlArticleBackend => backend !== undefined)),
    ...providerStates.map((state) => state.service),
    ...step2Metadata
      .map(parseBackendFromExtractionMetadata)
      .filter((backend): backend is HtmlArticleBackend => backend !== undefined)
  ])

export const getUrlArticleSource = (
  metadata: Record<string, unknown>
): { source: string, sourceRef: { url?: string, filePath?: string }, sourceUrl?: string | undefined } => {
  const source = isRecord(metadata['source']) ? metadata['source'] : undefined
  const url = typeof source?.['url'] === 'string' ? source['url'] : undefined
  const filePath = typeof source?.['filePath'] === 'string' ? source['filePath'] : undefined
  if (url) {
    return { source: url, sourceRef: { url }, sourceUrl: url }
  }
  if (filePath) {
    return { source: filePath, sourceRef: { filePath } }
  }
  throw ValidationError('URL article manifest requires run.json metadata.source.url or metadata.source.filePath.', { stage: 'extract:url' })
}

export const getStoredStep1Metadata = async (
  metadata: Record<string, unknown>,
  source: string
): Promise<DocumentMetadata> => {
  if (isRecord(metadata['step1'])) {
    return validateData(DocumentMetadataSchema, metadata['step1'], 'stored URL step1 metadata')
  }
  return await buildFallbackStep1Metadata(source)
}
