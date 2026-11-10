import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { logExtractManifestSummary } from '~/cli/commands/command-shared/write-manifest-log/write-manifest-log'
import { writePipelineItemRecords } from '../../command-shared/pipeline-manifest'
import { formatHtmlArticleOcrFlagsIgnoredWarning, hasConfiguredOcrProviderSelection } from '../../command-shared/extract-routing/inactive-flag-warnings'
import {
  buildFallbackStep1Metadata,
  buildManifestMetadata,
  buildProviderStates,
  buildStep1MetadataFromArticle,
  buildUrlExtractionOptions,
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
import type { AggregatedPriceEstimate, BatchChildRunContext, ProcessDocumentOutput, UrlArticleBackendPlan, UrlExtractionOptions, UrlProviderFailure, UrlProviderRunOutcome, UrlProviderSuccess } from '~/types'

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

const warnInactiveUrlArticleSelections = (
  source: string,
  opts: UrlExtractionOptions,
  plan: UrlArticleBackendPlan
): void => {
  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(source), { category: 'pipeline' })
  }

  if (plan.ignoresHostedBackendForLocalHtml) {
    l.warn(`Ignoring --url-provider ${opts.urlBackend} for local HTML inputs; using defuddle instead`, {
      category: 'pipeline',
      metadata: { requestedBackend: opts.urlBackend, resolvedBackend: 'defuddle' }
    })
  }

  if (plan.allUrlMode && !plan.remote && plan.skippedBackends.length > 0) {
    l.warn('--all-providers with a local HTML input skips hosted URL backends; use --all-local to include defuddle', { category: 'pipeline' })
  }
}

const buildUrlArticleArtifactFiles = (
  plan: UrlArticleBackendPlan,
  successes: UrlProviderSuccess[],
  extractionOpts: ReturnType<typeof buildUrlExtractionOptions>
): Record<string, string> => {
  const artifactFiles: Record<string, string> = { manifest: 'manifest.json' }
  if (plan.allUrlMode) {
    for (const success of successes) {
      artifactFiles[`result-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/result.json`
      artifactFiles[`extraction-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/extraction.txt`
    }
  } else {
    artifactFiles[extractionOpts.outputFormat === 'json' ? 'result' : 'extraction'] = extractionOpts.outputFormat === 'json'
      ? 'result.json'
      : 'extraction.txt'
  }
  return artifactFiles
}

const warnIncompleteUrlExtraction = (
  runStatus: { completionStatus: string, requested: number, succeeded: number, failed: number, missing: number },
  failures: UrlProviderFailure[],
  outputDir: string
): void => {
  l.write('warn', `URL extraction ${runStatus.completionStatus}: ${runStatus.succeeded}/${runStatus.requested} providers succeeded`, {
    category: 'pipeline',
    metadata: runStatus
  })
  if (failures.length > 0) {
    l.write('warn', `${failures.length} URL providers failed`, {
      category: 'pipeline',
      metadata: { failures }
    })
    for (const failure of failures) {
      l.write('warn', `${failure.backend} failed after ${failure.attempts} attempts: ${failure.message}`, {
        category: 'pipeline',
        metadata: failure
      })
    }
  }
  l.write('warn', `Retry output retained at ${outputDir}`, {
    category: 'artifact',
    metadata: { retryOutputDir: outputDir }
  })
}

export const processUrlArticle = async (
  source: string,
  baseDir: string,
  opts: UrlExtractionOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<ProcessDocumentOutput> => {
  const plan = resolveUrlArticleBackendPlan(source, opts)
  const extractionOpts = buildUrlExtractionOptions(opts)
  const fallbackStep1 = await buildFallbackStep1Metadata(source)

  warnInactiveUrlArticleSelections(source, opts, plan)

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
    failures,
    requestOptions: opts
  })

  if (plan.allUrlMode) {
    await mkdir(join(outputDir, 'providers'), { recursive: true })
    for (const success of successes) {
      await writeUrlProviderArtifacts(outputDir, success)
    }
  } else if (successes[0]) {
    await writeExtractionArtifact(outputDir, successes[0].result, extractionOpts.outputFormat)
  }

  await writePipelineItemRecords(outputDir, 'extract', 'single', [manifestMetadata], { extractRoute: 'article' })
  logExtractManifestSummary(outputDir, manifestMetadata)

  if (successes.length === 0) {
    const message = failures.length > 0
      ? failures.map((failure) => `${failure.backend}: ${failure.message}`).join('; ')
      : 'No URL article providers were run.'
    throw InfraError(`No URL article outputs were generated. ${message}`, { stage: 'extract:url-article' })
  }
  const primarySuccess = successes[0] as UrlProviderSuccess

  const artifactFiles = buildUrlArticleArtifactFiles(plan, successes, extractionOpts)

  if (completionStatus !== 'full') {
    warnIncompleteUrlExtraction({
      completionStatus,
      requested: providerStates.length,
      succeeded: successes.length,
      failed: failures.length,
      missing: providerStates.filter((state) => state.status === 'missing').length
    }, failures, outputDir)
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
