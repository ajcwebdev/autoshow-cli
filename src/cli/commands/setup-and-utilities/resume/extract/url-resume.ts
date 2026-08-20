import { partialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-batch-state'
import { isRecord } from '~/utils/rest-client'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createPipelineItemFromRecord, derivePipelineItemRecord, PIPELINE_MANIFEST_FILE, readManifest, readSinglePipelineItemRecord, resolveManifestRelativePath, writeManifest, writePipelineItemRecords } from '~/cli/commands/process-steps/pipeline-manifest'
import {
buildManifestMetadata,
buildProviderStates,
buildUrlExtractionOptions,
completionStatusFromProviderStates,
getStoredStep1Metadata,
getUrlArticleSource,
parseBackendFromExtractionMetadata,
parseStoredProviderStates,
parseStoredStep2Metadata,
parseStoredUrlBackends,
runAllUrlBackends,
writeExtractionArtifact,
writeUrlProviderArtifacts
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-run-state'
import {
collectUrlTargets,
getUrlProviderArtifactDir,
getUrlTargetBackends,
toUrlArticleTarget,
uniqueUrlTargets
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-targets'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildArticleEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-article-estimates'
import type { AggregatedPriceEstimate, HtmlArticleBackend, ProviderCompletionStatus, ResolvedStep2Execution, ResumeDisplayOptions, ResumeResult, ResumeTarget, Step2ProviderSelectionFilter, StepEstimate, UrlArticleResumePlan, UrlArticleResumeResult, UrlArticleTarget, UrlExtractionOptions, UrlProviderRunOutcome, WebArticleMetadata } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { ValidationError } from '~/utils/error-handler'
import { logResumeItem, logResumeSummary } from '../resume-logging'


const EXPLICIT_URL_SELECTION_FILTER = {
  includeOrigins: ['explicit', 'all-shortcut']
} as const satisfies Step2ProviderSelectionFilter

export const getSelectedUrlTargets = (
  opts: UrlExtractionOptions
): UrlArticleTarget[] | undefined => {
  const targets = collectUrlTargets(opts, EXPLICIT_URL_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const readUrlArticleRunMetadata = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  return await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'article' })
}

export const resolveUrlArticleResumePlan = (
  metadata: Record<string, unknown>,
  selectedTargets?: readonly UrlArticleTarget[] | undefined
): UrlArticleResumePlan => {
  const providerStates = parseStoredProviderStates(metadata)
  const storedBackends = parseStoredUrlBackends(providerStates)
  const storedTargets = storedBackends.map(toUrlArticleTarget)
  const successfulBackends = new Set<HtmlArticleBackend>(
    providerStates.filter((state) => state.status === 'succeeded').map((state) => state.service)
  )
  const runnableStoredBackends = providerStates
    .filter((state) => state.status === 'running' || state.status === 'missing' || state.status === 'failed')
    .map((state) => state.service)
  const runnableStoredTargets = runnableStoredBackends.map(toUrlArticleTarget)

  if (selectedTargets === undefined) {
    const targetsToRun = uniqueUrlTargets(runnableStoredTargets)
    return {
      requestedTargets: storedTargets,
      targetsToRun,
      skippedSuccessfulTargets: [],
      requestedBackends: storedBackends,
      backendsToRun: getUrlTargetBackends(targetsToRun),
      skippedSuccessfulBackends: []
    }
  }

  const selected = uniqueUrlTargets(selectedTargets)
  const requestedTargets = uniqueUrlTargets([...storedTargets, ...selected])
  const targetsToRun = selected.filter((target) => !successfulBackends.has(target.service))
  const skippedSuccessfulTargets = selected.filter((target) => successfulBackends.has(target.service))
  return {
    requestedTargets,
    targetsToRun,
    skippedSuccessfulTargets,
    requestedBackends: getUrlTargetBackends(requestedTargets),
    backendsToRun: getUrlTargetBackends(targetsToRun),
    skippedSuccessfulBackends: getUrlTargetBackends(skippedSuccessfulTargets)
  }
}

export const resumeUrlArticleProviders = async (
  outputDir: string,
  opts: UrlExtractionOptions,
  selectedTargets?: readonly UrlArticleTarget[] | undefined
): Promise<UrlArticleResumeResult> => {
  const metadata = await readUrlArticleRunMetadata(outputDir)
  if (!metadata) {
    throw ValidationError(`Invalid URL article manifest at ${join(outputDir, PIPELINE_MANIFEST_FILE)}`, { stage: 'resume:url' })
  }

  const { source, sourceRef, sourceUrl } = getUrlArticleSource(metadata)
  const step1Metadata = getStoredStep1Metadata(metadata)
  const existingStep2Metadata = parseStoredStep2Metadata(metadata)
  const existingProviderStates = parseStoredProviderStates(metadata)
  const plan = resolveUrlArticleResumePlan(metadata, selectedTargets)
  const extractionOpts = buildUrlExtractionOptions(opts)

  const outcomes = plan.backendsToRun.length > 0
    ? await runAllUrlBackends(source, plan.backendsToRun, sourceUrl, opts, extractionOpts)
    : []
  const successes = outcomes
    .filter((outcome): outcome is Extract<UrlProviderRunOutcome, { status: 'succeeded' }> => outcome.status === 'succeeded')
    .map((outcome) => outcome.success)
  const rerunBackends = new Set(plan.backendsToRun)
  const nextStep2Metadata = [
    ...existingStep2Metadata.filter((entry) => {
      const backend = parseBackendFromExtractionMetadata(entry)
      return backend === undefined || !rerunBackends.has(backend)
    }),
    ...successes.map((success) => success.metadata)
  ]

  const runStates = buildProviderStates(plan.backendsToRun, outcomes)
  const runStateByBackend = new Map(runStates.map((state) => [state.service, state]))
  const existingStateByBackend = new Map(existingProviderStates.map((state) => [state.service, state]))
  const providerStates = plan.requestedBackends.map((backend) =>
    runStateByBackend.get(backend)
    ?? existingStateByBackend.get(backend)
    ?? {
      service: backend,
      model: backend,
      artifactDir: getUrlProviderArtifactDir(backend),
      status: 'missing' as const,
      attempts: 0
    }
  )

  if (successes.length > 0) {
    if (plan.requestedBackends.length === 1 && nextStep2Metadata.length === 1) {
      await writeExtractionArtifact(outputDir, successes[0]!.result, extractionOpts.outputFormat)
    }
    await mkdir(join(outputDir, 'providers'), { recursive: true })
    for (const success of successes) {
      await writeUrlProviderArtifacts(outputDir, success)
    }
  }

  const failures = providerStates
    .filter((state) => state.status === 'failed')
    .map((state) => ({
      backend: state.service,
      message: state.lastError?.message ?? 'Provider failed',
      attempts: state.attempts
    }))
  const completionStatus = completionStatusFromProviderStates(providerStates)
  const existingWeb = isRecord(metadata['web']) ? metadata['web'] as WebArticleMetadata : undefined
  const manifestMetadata = buildManifestMetadata(step1Metadata, nextStep2Metadata, {
    source: sourceRef,
    web: existingWeb ?? successes[0]?.article.web,
    completionStatus,
    requestedBackends: plan.requestedBackends,
    providerStates,
    failures
  })
  await writePipelineItemRecords(outputDir, 'extract', 'single', [manifestMetadata], { extractRoute: 'article' })
  logExtractManifestConsoleSummary(outputDir, manifestMetadata)

  return {
    outputDir,
    requestedBackends: plan.requestedBackends,
    backendsToRun: plan.backendsToRun,
    skippedSuccessfulBackends: plan.skippedSuccessfulBackends,
    completionStatus,
    selectedBackendsComplete: plan.backendsToRun.every((backend) =>
      providerStates.find((state) => state.service === backend)?.status === 'succeeded'
    ),
    succeeded: providerStates.filter((state) => state.status === 'succeeded').length,
    failed: providerStates.filter((state) => state.status === 'failed').length
  }
}

const resolveBatchOutputDirs = async (
  target: ResumeTarget
): Promise<string[]> => {
  if (target.scope === 'single') {
    return [target.dir]
  }

  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== 'extract' || manifest.scope !== 'batch') {
    return []
  }

  return manifest.items.flatMap((item) =>
    typeof item.outputDir === 'string' && item.outputDir.length > 0
      ? [resolveManifestRelativePath(target.dir, item.outputDir)]
      : []
  )
}

const writeUpdatedUrlBatchManifest = async (
  target: ResumeTarget
): Promise<void> => {
  if (target.scope !== 'batch') {
    return
  }

  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== 'extract' || manifest.scope !== 'batch') {
    return
  }

  const updatedItems = await Promise.all(manifest.items.map(async (item) => {
    const storedOutputDir = item.outputDir
    if (typeof storedOutputDir !== 'string' || storedOutputDir.length === 0) {
      return item
    }

    const outputDir = resolveManifestRelativePath(target.dir, storedOutputDir)
    const metadata = await readUrlArticleRunMetadata(outputDir)
    return metadata
      ? createPipelineItemFromRecord(target.dir, {
          ...derivePipelineItemRecord(target.dir, item),
          ...metadata,
          outputDir
        })
      : item
  }))

  await writeManifest(target.dir, { ...manifest, items: updatedItems })
}

const getStoredUrlCompletionStatus = (
  metadata: Record<string, unknown>
): ProviderCompletionStatus => {
  if (metadata['completionStatus'] === 'full' || metadata['completionStatus'] === 'failed') {
    return metadata['completionStatus']
  }
  return 'incomplete'
}

export const hasResumableUrlArticleWork = async (
  target: ResumeTarget,
  selectedTargets?: readonly UrlArticleTarget[] | undefined
): Promise<boolean> => {
  for (const outputDir of await resolveBatchOutputDirs(target)) {
    const metadata = await readUrlArticleRunMetadata(outputDir)
    if (!metadata) {
      continue
    }
    if (resolveUrlArticleResumePlan(metadata, selectedTargets).backendsToRun.length > 0) {
      return true
    }
  }
  return false
}

export const resumeUrlArticleTarget = async (
  target: ResumeTarget,
  opts: UrlExtractionOptions,
  selectedTargets?: readonly UrlArticleTarget[] | undefined,
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const outputDirs = await resolveBatchOutputDirs(target)
  let full = 0
  let incomplete = 0
  let failed = 0

  for (let index = 0; index < outputDirs.length; index++) {
    const outputDir = outputDirs[index] as string
    const item = target.scope === 'single' && displayOptions.itemLabel
      ? displayOptions.itemLabel
      : `${index + 1}/${outputDirs.length}`
    const metadata = await readUrlArticleRunMetadata(outputDir)
    if (!metadata) {
      logResumeItem(l, {
        item,
        status: 'skipped',
        outputDir,
        providers: 'none',
        detail: 'not a URL article extract run'
      }, 'warn')
      continue
    }

    const plan = resolveUrlArticleResumePlan(metadata, selectedTargets)
    if (plan.backendsToRun.length === 0) {
      const storedCompletionStatus = getStoredUrlCompletionStatus(metadata)
      const noBackendsStatus = selectedTargets !== undefined ? 'full' : storedCompletionStatus
      const runStillIncomplete = storedCompletionStatus !== 'full'
      const selectedCompleteWithIncompleteRun = selectedTargets !== undefined && runStillIncomplete
      logResumeItem(l, {
        item,
        status: noBackendsStatus,
        outputDir,
        providers: plan.skippedSuccessfulBackends.length > 0
          ? plan.skippedSuccessfulBackends.join(', ')
          : 'none',
        detail: selectedCompleteWithIncompleteRun
          ? 'selected providers complete; canonical item still incomplete'
          : plan.skippedSuccessfulBackends.length > 0
          ? 'selected URL providers already succeeded'
          : noBackendsStatus === 'failed'
          ? 'canonical item failed with no resumable URL providers'
          : 'no failed or missing URL providers'
      }, noBackendsStatus === 'full' ? 'success' : noBackendsStatus === 'failed' ? 'error' : 'warn')
      if (noBackendsStatus === 'full') {
        full += 1
      } else if (noBackendsStatus === 'failed') {
        failed += 1
      } else {
        incomplete += 1
      }
      continue
    }

    logResumeItem(l, {
      item,
      status: 'processing',
      outputDir,
      providers: plan.backendsToRun.join(', '),
      detail: selectedTargets ? 'resuming selected URL providers' : 'resuming failed or missing URL providers'
    }, 'info')

    const result = await resumeUrlArticleProviders(outputDir, opts, selectedTargets)
    if (result.completionStatus === 'full' || (selectedTargets !== undefined && result.selectedBackendsComplete)) {
      full += 1
      logResumeItem(l, {
        item,
        status: 'full',
        outputDir,
        providers: result.backendsToRun.join(', '),
        detail: result.completionStatus === 'full'
          ? 'resume complete'
          : 'selected providers complete; canonical item still incomplete'
      }, 'success')
    } else if (result.completionStatus === 'failed') {
      failed += 1
      logResumeItem(l, {
        item,
        status: 'failed',
        outputDir,
        providers: result.backendsToRun.join(', '),
        detail: 'resume failed'
      }, 'error')
    } else {
      incomplete += 1
      logResumeItem(l, {
        item,
        status: 'incomplete',
        outputDir,
        providers: result.backendsToRun.join(', '),
        detail: 'resume incomplete'
      }, 'warn')
    }
  }

  logResumeSummary(l, { full, incomplete, failed })
  await writeUpdatedUrlBatchManifest(target)

  if (incomplete > 0 || failed > 0) {
    throw partialCompletionError(`URL article resume still has ${incomplete} incomplete and ${failed} failed item(s)`, {
      stage: 'resume:url',
      metadata: { incomplete, failed }
    })
  }
  return { full, incomplete, failed }
}

const isRemoteArticleSource = (
  source: string
): boolean => /^https?:\/\//i.test(source)

const buildResolvedArticleStep = (
  backends: HtmlArticleBackend[]
): Extract<ResolvedStep2Execution, { route: 'article' }> => ({
  route: 'article',
  sourceKind: 'article',
  providers: backends.map((backend) => ({
    service: backend,
    model: backend
  }))
})

export const priceUrlArticleTarget = async (
  target: ResumeTarget,
  opts: UrlExtractionOptions,
  selectedTargets?: readonly UrlArticleTarget[] | undefined
): Promise<AggregatedPriceEstimate> => {
  const outputDirs = await resolveBatchOutputDirs(target)
  const steps: StepEstimate[] = []
  const notes: string[] = []

  for (const outputDir of outputDirs) {
    const metadata = await readUrlArticleRunMetadata(outputDir)
    if (!metadata) {
      continue
    }

    const plan = resolveUrlArticleResumePlan(metadata, selectedTargets)
    if (plan.backendsToRun.length === 0) {
      continue
    }

    const { source } = getUrlArticleSource(metadata)
    const estimate = buildArticleEstimates(
      buildResolvedArticleStep(plan.backendsToRun),
      opts,
      isRemoteArticleSource(source)
    )
    steps.push(...estimate.estimates)
    notes.push(...estimate.notes)
  }

  return aggregateExplicitPriceEstimate(steps, opts, { notes })
}
