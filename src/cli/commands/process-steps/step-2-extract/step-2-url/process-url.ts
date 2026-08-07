import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { buildExtractionCallOpts } from '../../step-1-download/download-targets/single/document-write'
import { formatHtmlArticleOcrFlagsIgnoredWarning, hasConfiguredOcrProviderSelection } from '../step-2-shared/inactive-flag-warnings'
import { writeUrlRunManifest } from './url-manifest'
import {
  buildFallbackStep1Metadata,
  buildManifestMetadata,
  buildProviderStates,
  buildStep1MetadataFromArticle,
  completionStatusFromProviderStates,
  reserveUrlOutputDir,
  runUrlArticleBackendPlan,
  writeExtractionArtifact,
  writeUrlProviderArtifacts
} from './url-run-state'
import {
  getUrlProviderArtifactDir,
  resolveUrlArticleBackendPlan
} from './url-targets'
import { InfraError } from '~/utils/error-handler'
import type { AggregatedPriceEstimate, BatchChildRunContext, ExtractionOptions, ProcessDocumentOutput, RuntimeOptions, UrlProviderFailure, UrlProviderRunOutcome, UrlProviderSuccess } from '~/types'

const successfulUrlProviderOutcomes = (
  outcomes: UrlProviderRunOutcome[]
): UrlProviderSuccess[] =>
  outcomes
    .filter((outcome): outcome is Extract<UrlProviderRunOutcome, { status: 'succeeded' }> => outcome.status === 'succeeded')
    .map((outcome) => outcome.success)

const failedUrlProviderOutcomes = (
  outcomes: UrlProviderRunOutcome[]
): UrlProviderFailure[] =>
  outcomes
    .filter((outcome): outcome is Extract<UrlProviderRunOutcome, { status: 'failed' }> => outcome.status === 'failed')
    .map((outcome) => ({
      backend: outcome.backend,
      message: outcome.message,
      attempts: outcome.attempts
    }))

export const processUrlArticle = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<ProcessDocumentOutput> => {
  const plan = resolveUrlArticleBackendPlan(source, opts)
  const extractionOpts = buildExtractionCallOpts(source, baseDir, opts) as Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
  const fallbackStep1 = await buildFallbackStep1Metadata(source)

  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(source))
  }

  if (plan.ignoresHostedBackendForLocalHtml) {
    l.warn(`Ignoring --url-provider ${opts.urlBackend} for local HTML inputs; using defuddle instead`)
  }

  if (plan.allUrlMode && !plan.remote && plan.skippedBackends.length > 0) {
    l.warn('--all-providers with a local HTML input skips hosted URL backends; use --all-local to include defuddle')
  }

  const outcomes = await runUrlArticleBackendPlan(source, plan, opts, extractionOpts)
  const successes = successfulUrlProviderOutcomes(outcomes)
  const failures = failedUrlProviderOutcomes(outcomes)
  const step1Metadata = buildStep1MetadataFromArticle(source, successes[0]?.article, fallbackStep1)
  const outputDir = await reserveUrlOutputDir(source, baseDir, opts, fallbackStep1, successes[0]?.article, batchChildContext)
  const step2Metadata = plan.allUrlMode
    ? successes.map((success) => success.metadata)
    : successes[0]?.metadata
  const providerStates = buildProviderStates(
    plan.allUrlMode ? plan.requestedBackends : successes[0] ? [successes[0].backend] : plan.requestedBackends,
    outcomes
  )
  const completionStatus = completionStatusFromProviderStates(providerStates)
  const manifestMetadata = buildManifestMetadata(step1Metadata, step2Metadata, {
    source: plan.sourceRef,
    web: successes[0]?.article.web,
    preflightEstimate,
    completionStatus,
    requestedBackends: providerStates.map((state) => state.service),
    providerStates,
    failures
  })

  if (plan.allUrlMode) {
    await mkdir(join(outputDir, 'providers'), { recursive: true })
    for (const success of successes) {
      await writeUrlProviderArtifacts(outputDir, success)
    }
  } else if (successes[0]) {
    await writeExtractionArtifact(outputDir, successes[0].result, extractionOpts.outputFormat)
  }

  await writeUrlRunManifest(outputDir, manifestMetadata)
  logExtractManifestConsoleSummary(outputDir, manifestMetadata)

  if (successes.length === 0) {
    const message = failures.length > 0
      ? failures.map((failure) => `${failure.backend}: ${failure.message}`).join('; ')
      : 'No URL article providers were run.'
    throw InfraError(`No URL article outputs were generated. ${message}`, { stage: 'extract:url-article' })
  }
  const primarySuccess = successes[0] as UrlProviderSuccess

  const artifactFiles: Record<string, string> = { run: 'run.json' }
  if (plan.allUrlMode) {
    for (const success of successes) {
      artifactFiles[`result-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/result.json`
      artifactFiles[`extraction-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/extraction.txt`
    }
  } else {
    artifactFiles[extractionOpts.outputFormat === 'json' ? 'result' : 'extraction'] = extractionOpts.outputFormat === 'json'
      ? 'result.json'
      : extractionOpts.outputFormat === 'tsv'
        ? 'extraction.tsv'
        : extractionOpts.outputFormat === 'hocr'
          ? 'extraction.hocr'
          : 'extraction.txt'
  }

  if (completionStatus !== 'full') {
    const runStatus = {
      completionStatus,
      requested: providerStates.length,
      succeeded: successes.length,
      failed: failures.length,
      missing: providerStates.filter((state) => state.status === 'missing').length
    }
    l.write('warn', 'Run Status', {
      category: 'pipeline',
      humanTable: createKeyValueTable([
        ['completionStatus', runStatus.completionStatus],
        ['requested', runStatus.requested],
        ['succeeded', runStatus.succeeded],
        ['failed', runStatus.failed],
        ['missing', runStatus.missing]
      ]),
      metadata: runStatus
    })
    if (failures.length > 0) {
      l.write('warn', 'Failed URL Providers', {
        category: 'pipeline',
        humanTable: createHumanTable(failures.map((failure) => ({
          backend: failure.backend,
          attempts: failure.attempts,
          error: failure.message
        })), ['backend', 'attempts', 'error']),
        metadata: { failures }
      })
    }
    l.write('warn', 'Locations', {
      category: 'artifact',
      humanTable: createKeyValueTable([['retryOutputDir', outputDir]], 'artifact', 'path')
    })
  } else {
    l.report.complete(outputDir, artifactFiles, plan.allUrlMode
      ? {
          metrics: {
            providersRequested: providerStates.length,
            providersSucceeded: successes.length,
            providersFailed: failures.length,
            partial: false,
            completionStatus
          }
        }
      : undefined)
  }

  return {
    result: primarySuccess.result,
    step1Metadata,
    step2Metadata: step2Metadata ?? [],
    completionStatus,
    requestedProviders: providerStates.map((state) => ({ service: state.service, model: state.model })),
    providerStates: providerStates as unknown as Array<Record<string, unknown>>,
    missingProviders: providerStates
      .filter((state) => state.status === 'missing' || state.status === 'failed')
      .map((state) => ({ service: state.service, model: state.model })),
    ...(primarySuccess.article.web ? { web: primarySuccess.article.web } : {}),
    ...(failures.length > 0 ? { step2Errors: failures.map((failure) => ({
      service: failure.backend,
      model: failure.backend,
      message: failure.message
    })) } : {}),
    outputDir
  }
}
