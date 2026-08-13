import { basename } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { downloadDocument, prepareDocumentMetadata } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { getHtmlArticleBackendDisplayName, prepareHtmlArticle } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItemProcessResult, MetadataOutputOptions, OcrExtractionOptions, OcrRuntimeOptions, OcrSelectionOptions, PreparedDocument, ProcessDocumentOutput, SharedPipelineOptions, Step1SourceRef, UrlExtractionOptions } from '~/types'
import { formatHtmlArticleOcrFlagsIgnoredWarning, hasConfiguredOcrProviderSelection } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { buildDocumentMetadataView, writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'
import { appendChapterExportArtifacts, buildExtractionCallOpts } from './document-write'

const warnHtmlArticleFlagBehavior = (target: string, opts: OcrSelectionOptions, backend: PreparedDocument['htmlArticleBackend']): void => {
  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(target))
  }
  if (backend && backend !== 'defuddle') {
    l.write('info', `Article extraction backend: ${getHtmlArticleBackendDisplayName(backend)}`)
  }
}

export const prepareArticleDocument = async (
  source: string,
  baseDir: string,
  opts: UrlExtractionOptions,
  batchChildContext?: BatchChildRunContext
): Promise<PreparedDocument> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const prepared = await prepareHtmlArticle(source, effectiveBaseDir, opts.urlBackend, batchChildContext, {
    timeoutMs: opts.urlRequestTimeoutMs,
    requestAttempts: opts.urlRequestAttempts
  })
  warnHtmlArticleFlagBehavior(source, opts, prepared.htmlArticleBackend)
  return prepared
}

const countOcrSuccesses = (
  step2Metadata: ProcessDocumentOutput['step2Metadata']
): number =>
  Array.isArray(step2Metadata) ? step2Metadata.length : 1

export const logIncompleteOcrRunSummary = (
  extraction: Pick<
    ProcessDocumentOutput,
    'completionStatus'
    | 'requestedProviders'
    | 'step2Metadata'
    | 'step2Errors'
    | 'missingProviders'
    | 'blockedProviders'
    | 'providerStates'
    | 'ocrProviderMode'
    | 'ocrPool'
    | 'outputDir'
  >,
  requestedMultipleProviders: boolean
): void => {
  const requestedCount = extraction.requestedProviders?.length ?? 0
  const succeededCount = extraction.ocrProviderMode === 'pool'
    ? extraction.ocrPool?.targets.filter((target) => target.acceptedPages > 0).length ?? 0
    : countOcrSuccesses(extraction.step2Metadata)
  const failedCount = extraction.step2Errors?.length ?? 0
  const missingCount = extraction.missingProviders?.length ?? 0
  const blockedCount = extraction.blockedProviders?.length ?? 0
  const retryableMissingCount = Math.max(0, missingCount - blockedCount)
  const runStatus = {
    completionStatus: extraction.completionStatus ?? 'incomplete',
    requested: requestedCount,
    succeeded: succeededCount,
    failed: failedCount,
    missing: missingCount,
    retryable: retryableMissingCount,
    blocked: blockedCount
  }
  l.write('warn', 'Run Status', {
    category: 'pipeline',
    humanTable: createKeyValueTable([
      ['completionStatus', runStatus.completionStatus],
      ['requested', runStatus.requested],
      ['succeeded', runStatus.succeeded],
      ['failed', runStatus.failed],
      ['missing', runStatus.missing],
      ['retryable', runStatus.retryable],
      ['blocked', runStatus.blocked]
    ]),
    metadata: runStatus
  })

  if (failedCount > 0 && extraction.step2Errors) {
    const formatFallbackPages = (pages: NonNullable<NonNullable<typeof extraction.step2Errors>[number]['fallbackPages']>): string => {
      const okPages = pages.succeeded + pages.cached + pages.resumed
      const parts = [`${okPages} ok`]
      if (pages.failed > 0) {
        parts.push(`${pages.failed} failed`)
      }
      if (pages.canceled > 0) {
        parts.push(`${pages.canceled} canceled`)
      }
      return parts.join(' / ')
    }
    const failureRows = extraction.step2Errors.map((failure) => ({
      provider: `${failure.service}/${failure.model}`,
      category: failure.failureKind ?? failure.category ?? 'unknown',
      retryable: failure.retryable === false ? 'no' : 'yes',
      attempts: typeof failure.attemptsMade === 'number' ? String(failure.attemptsMade) : '',
      pages: failure.fallbackPages ? formatFallbackPages(failure.fallbackPages) : '',
      errorFile: failure.errorFile ?? '',
      reason: failure.blockedReason ?? failure.failureKind ?? failure.category ?? 'failed'
    }))
    const failureTable = createHumanTable(failureRows, ['provider', 'category', 'retryable', 'attempts', 'pages', 'errorFile', 'reason'])
    l.write('warn', 'Provider Failures', {
      category: 'pipeline',
      humanTable: {
        ...failureTable,
        details: [
          ...(failureTable.details ?? []),
          ...extraction.step2Errors.flatMap((failure) => [
            {
              label: `${failure.service}/${failure.model} detail`,
              value: failure.message
            },
            ...(failure.fallbackTerminalReason
              ? [{
                  label: `${failure.service}/${failure.model} fallback`,
                  value: failure.fallbackTerminalReason
                }]
              : [])
          ])
        ]
      },
      metadata: { failures: extraction.step2Errors }
    })
  }

  if (requestedMultipleProviders && extraction.ocrProviderMode !== 'pool' && Array.isArray(extraction.providerStates)) {
    const outputRows = extraction.providerStates
      .filter((state) => state['status'] === 'succeeded')
      .map((state) => ({
        provider: `${String(state['service'])}/${String(state['model'])}`,
        status: 'succeeded',
        output: `${extraction.outputDir}/${String(state['artifactDir'])}/result.json`
      }))
    if (outputRows.length > 0) {
      l.write('warn', 'Provider Outputs', {
        category: 'artifact',
        humanTable: createHumanTable(outputRows, ['provider', 'status', 'output']),
        metadata: { outputs: outputRows }
      })
    }
  }

  l.write('warn', 'Locations', {
    category: 'artifact',
    humanTable: createKeyValueTable(
      [[retryableMissingCount > 0 ? 'retryOutputDir' : 'outputDir', extraction.outputDir]],
      'artifact',
      'path'
    )
  })

  if (blockedCount > 0) {
    l.write('warn', 'Blocked OCR Providers', {
      category: 'pipeline',
      humanTable: createKeyValueTable([
        ['automaticResume', 'skips blocked OCR providers'],
        ['override', 'bun autoshow resume <outputDir> --provider provider=model'],
        ['when', 'after intentional repair, policy, or model change']
      ]),
      metadata: {
        automaticResume: 'skip-blocked-providers',
        command: `bun autoshow resume ${extraction.outputDir} --provider provider=model`,
        outputDir: extraction.outputDir
      }
    })
  }

  if (retryableMissingCount > 0) {
    l.write('warn', 'Retry OCR', {
      category: 'pipeline',
      humanTable: createKeyValueTable([
        ['action', 'resume'],
        ['command', 'bun autoshow resume <retryOutputDir>']
      ]),
      metadata: {
        command: `bun autoshow resume ${extraction.outputDir}`,
        outputDir: extraction.outputDir
      }
    })
  }
}

export const processOcrSingle = async (
  target: string,
  baseDir: string,
  opts: OcrExtractionOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || opts.outputRootDir, opts.password, sourceRef, batchChildContext)
    : undefined)
  const extraction = await processOcr(
    target,
    {
      ...buildExtractionCallOpts(target, baseDir, opts),
      ...(batchChildContext?.hostedOcrScheduler ? { hostedOcrScheduler: batchChildContext.hostedOcrScheduler } : {})
    },
    sourceRef,
    resolvedPreparedDocument,
    preflightEstimate
  )

  const artifactFiles: Record<string, string> = {
    manifest: 'manifest.json'
  }
  switch (opts.out) {
    case 'json':
      artifactFiles['result'] = 'result.json'
      break
    case 'tsv':
      artifactFiles['extraction'] = 'extraction.tsv'
      break
    case 'hocr':
      artifactFiles['extraction'] = 'extraction.hocr'
      break
    default:
      artifactFiles['extraction'] = 'extraction.txt'
      break
  }
  await appendChapterExportArtifacts(artifactFiles, extraction.step2Metadata, extraction.outputDir)

  const requestedCount = extraction.requestedProviders?.length ?? 0
  const succeededCount = extraction.ocrProviderMode === 'pool'
    ? extraction.ocrPool?.targets.filter((target) => target.acceptedPages > 0).length ?? 0
    : Array.isArray(extraction.step2Metadata) ? extraction.step2Metadata.length : 1
  const failedCount = extraction.step2Errors?.length ?? 0
  const requestedMultipleProviders = requestedCount > 1

  if (requestedMultipleProviders && extraction.ocrProviderMode !== 'pool' && !opts.primaryOcr) {
    delete artifactFiles['result']
    delete artifactFiles['extraction']
  }

  if (requestedMultipleProviders && extraction.ocrProviderMode !== 'pool' && Array.isArray(extraction.providerStates)) {
    for (const state of extraction.providerStates) {
      const artifactDir = typeof state['artifactDir'] === 'string' ? state['artifactDir'] : undefined
      const service = typeof state['service'] === 'string' ? state['service'] : undefined
      const model = typeof state['model'] === 'string' ? state['model'] : undefined
      if (!artifactDir || !service || !model || state['status'] !== 'succeeded') {
        continue
      }
      artifactFiles[`result-${service}-${model}`] = `${artifactDir}/result.json`
    }
  }

  if (extraction.completionStatus === 'incomplete' || extraction.completionStatus === 'failed') {
    logIncompleteOcrRunSummary(extraction, requestedMultipleProviders)
    return { outputDir: extraction.outputDir }
  }

  l.report.complete(extraction.outputDir, artifactFiles, requestedMultipleProviders
    ? {
        metrics: {
          providersRequested: requestedCount,
          providersSucceeded: succeededCount,
          providersFailed: failedCount,
          partial: false,
          completionStatus: extraction.completionStatus ?? 'full'
        }
      }
    : undefined)
  return { outputDir: extraction.outputDir }
}

export const processMetadataDocument = async (
  target: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'> & Pick<OcrRuntimeOptions, 'password'> & MetadataOutputOptions,
  baseDir: string,
  password?: string,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const prepared = await prepareDocumentMetadata(target, password, sourceRef)
  try {
    const step1 = prepared.step1Metadata
    const title = step1.title ?? basename(target).replace(/\.[^.]+$/, '')
    const metadata = {
      ...(step1.title ? { title: step1.title } : {}),
      slug: step1.slug,
      ...(step1.author ? { author: step1.author } : {}),
      pageCount: step1.pageCount,
      format: step1.format,
      fileSize: step1.fileSize,
      ...(step1.sourceFormat ? { sourceFormat: step1.sourceFormat } : {}),
      ...(step1.normalizedFormat ? { normalizedFormat: step1.normalizedFormat } : {}),
      ...(step1.conversionChain ? { conversionChain: step1.conversionChain } : {}),
      ...(step1.metadataSchemaVersion ? { metadataSchemaVersion: step1.metadataSchemaVersion } : {})
    }

    writeMetadataTerminalOutput(metadata, opts.markdown)

    const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
    const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
      slug: step1.slug,
      fallbackLabel: title
    }) ?? resolveRunDirectory(effectiveBaseDir, title, 'document')
    await ensureDirectory(outputDir)
    await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
    return { outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

export const processMetadataPreparedDocument = async (
  prepared: PreparedDocument,
  opts: MetadataOutputOptions
): Promise<BatchItemProcessResult> => {
  try {
    const metadata = buildDocumentMetadataView(prepared.step1Metadata, prepared.web)
    writeMetadataTerminalOutput(metadata, opts.markdown)
    await writeSavedMetadataArtifacts(prepared.outputDir, metadata, opts.markdown, opts.save)
    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

export const processDownloadDocument = async (
  target: string,
  baseDir: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'> & Pick<OcrRuntimeOptions, 'password'>,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const prepared = await downloadDocument(target, effectiveBaseDir, opts.password, sourceRef, batchChildContext)
  try {
    const cost = {
      estimated: { totalCost: 0, steps: [] as never[] },
      actual: { totalCost: 0, steps: [] as never[] }
    }

    await writeManifest(prepared.outputDir, createManifest('download', 'single', [
      createPipelineItemFromRecord(prepared.outputDir, { step1: prepared.step1Metadata, cost }, { status: 'full' })
    ]))

    l.report.complete(prepared.outputDir, { manifest: PIPELINE_MANIFEST_FILE })

    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

export const processDownloadPreparedDocument = async (
  prepared: PreparedDocument
): Promise<{ outputDir: string }> => {
  try {
    const cost = {
      estimated: { totalCost: 0, steps: [] as never[] },
      actual: { totalCost: 0, steps: [] as never[] }
    }

    await writeManifest(prepared.outputDir, createManifest('download', 'single', [
      createPipelineItemFromRecord(prepared.outputDir, {
        step1: prepared.step1Metadata,
        ...(prepared.web ? { web: prepared.web } : {}),
        cost
      }, { status: 'full' })
    ]))

    l.report.complete(prepared.outputDir, { manifest: PIPELINE_MANIFEST_FILE })

    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}
