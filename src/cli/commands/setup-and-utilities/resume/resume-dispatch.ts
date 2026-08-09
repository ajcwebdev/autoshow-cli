import { join, resolve as resolvePath } from 'node:path'
import { readBatchManifestOutcome, readExtractBatchManifestOutcome, readRunManifestOutcome, unsupportedManifestVersionError } from '~/cli/commands/process-steps/manifest-utils'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import { logResumeSuiteSummary } from './resume-logging'
import * as l from '~/utils/app-logger/app-logger'
import type { AggregatedPriceEstimate, BatchManifest, CliFlagOccurrence, ExtractRoute, ExtractSelectorInputRoutes, ResumeDispatchOutcome, ResumeDisplayOptions, ResumeResult, ResumeSelectorNormalizationResult, ResumeTarget, ResumeTargetKind, RunManifest } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { getResumeHandler } from './resume-registry'

const SUPPORTED_RESUME_KINDS = new Set<ResumeTargetKind>(['extract', 'write', 'tts', 'image', 'video', 'music'])

const PROVIDER_TARGETS_BY_KIND = {
  write: WRITE_LLM_PROVIDER_TARGETS,
  tts: STANDALONE_TTS_PROVIDER_TARGETS,
  image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  video: STANDALONE_VIDEO_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS
} as const satisfies Record<Exclude<ResumeTargetKind, 'extract'>, Record<string, string>>

const ALL_PROVIDERS_TARGET_BY_KIND = {
  write: 'all-llm',
  tts: 'all-tts',
  image: 'all-image',
  video: 'all-video',
  music: 'all-music'
} as const satisfies Record<Exclude<ResumeTargetKind, 'extract'>, string>

const ALL_LOCAL_TARGET_BY_KIND = {
  write: 'all-local-llm',
  tts: 'all-local-tts',
  image: undefined,
  video: undefined,
  music: undefined
} as const satisfies Record<Exclude<ResumeTargetKind, 'extract'>, string | undefined>

const extractRoutesForTarget = (
  target: ResumeTarget
): ExtractSelectorInputRoutes => ({
  media: target.extractRoute === undefined || target.extractRoute === 'media',
  document: target.extractRoute === undefined || target.extractRoute === 'document',
  article: target.extractRoute === undefined || target.extractRoute === 'article'
})

const isExtractRoute = (value: unknown): value is ExtractRoute =>
  value === 'media' || value === 'document' || value === 'article' || value === 'x-space'

const inferExtractRouteFromBatchManifest = (
  manifest: BatchManifest
): ExtractRoute | undefined => {
  if (manifest.kind !== 'extract') {
    return undefined
  }

  const routes = new Set<ExtractRoute>()
  for (const item of manifest.items) {
    if (isExtractRoute(item['extractRoute'])) {
      routes.add(item['extractRoute'])
    }
  }

  return routes.size === 1 ? [...routes][0] : undefined
}

const readExtractRouteFromRunManifest = (
  manifest: RunManifest
): ExtractRoute | undefined => {
  if (manifest.kind !== 'extract') {
    return undefined
  }
  return isExtractRoute(manifest.metadata['extractRoute'])
    ? manifest.metadata['extractRoute']
    : undefined
}

const toResumeTarget = (
  kind: string,
  scope: ResumeTarget['scope'],
  dir: string,
  manifestPath: string,
  extractRoute?: ExtractRoute | undefined
): ResumeTarget | undefined =>
  SUPPORTED_RESUME_KINDS.has(kind as ResumeTargetKind)
    ? {
        kind: kind as ResumeTargetKind,
        ...(extractRoute ? { extractRoute } : {}),
        scope,
        dir,
        manifestPath
      }
    : undefined

const resolveExplicitResumeTarget = async (
  outputDirInput: string
): Promise<ResumeTarget> => {
  const dir = resolvePath(outputDirInput)
  const extractBatchOutcome = await readExtractBatchManifestOutcome(dir)
  if (extractBatchOutcome.status === 'unsupported-version') {
    throw unsupportedManifestVersionError(extractBatchOutcome)
  }
  const extractBatchManifest = extractBatchOutcome.status === 'ok' ? extractBatchOutcome.manifest : undefined
  if (extractBatchManifest) {
    return {
      kind: 'extract',
      scope: 'batch',
      dir,
      manifestPath: extractBatchManifest.manifestPath
    }
  }

  const batchOutcome = await readBatchManifestOutcome(dir)
  if (batchOutcome.status === 'unsupported-version') {
    throw unsupportedManifestVersionError(batchOutcome)
  }
  const batchManifest = batchOutcome.status === 'ok' ? batchOutcome.manifest : undefined
  if (batchManifest) {
    const target = toResumeTarget(
      batchManifest.manifest.kind,
      'batch',
      dir,
      batchManifest.manifestPath,
      inferExtractRouteFromBatchManifest(batchManifest.manifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, write, TTS, image, video, and music manifests. Found "${batchManifest.manifest.kind}" at ${batchManifest.manifestPath}.`)
  }

  const runOutcome = await readRunManifestOutcome(dir)
  if (runOutcome.status === 'unsupported-version') {
    throw unsupportedManifestVersionError(runOutcome)
  }
  const runManifest = runOutcome.status === 'ok' ? runOutcome.manifest : undefined
  if (runManifest) {
    const target = toResumeTarget(
      runManifest.kind,
      'single',
      dir,
      join(dir, 'run.json'),
      readExtractRouteFromRunManifest(runManifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, write, TTS, image, video, and music manifests. Found "${runManifest.kind}" at ${join(dir, 'run.json')}.`)
  }

  throw CLIUsageError(`Could not find extract-batch.json, batch.json, or run.json under ${dir}.`)
}

export const normalizeResumeSelectorFlagsForTarget = (
  target: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): ResumeSelectorNormalizationResult => {
  if (target.kind === 'extract') {
    const routes = extractRoutesForTarget(target)
    return normalizeExtractGenericSelectorFlags(flags, explicitFlags, flagOccurrences, routes)
  }

  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    explicitFlags,
    flagOccurrences,
    'provider',
    PROVIDER_TARGETS_BY_KIND[target.kind],
    {
      allProvidersTarget: ALL_PROVIDERS_TARGET_BY_KIND[target.kind],
      allLocalTarget: ALL_LOCAL_TARGET_BY_KIND[target.kind],
    }
  )

  if (target.kind === 'tts') {
    const ttsNormalized = normalizeGenericTtsOptionFlags(
      providerNormalized.flags,
      providerNormalized.explicitFlags,
      providerNormalized.flagOccurrences
    )
    return {
      flags: ttsNormalized.flags,
      explicitFlags: ttsNormalized.explicitFlags,
      flagOccurrences: ttsNormalized.flagOccurrences
    }
  }

  return {
    flags: providerNormalized.flags,
    explicitFlags: providerNormalized.explicitFlags,
    flagOccurrences: providerNormalized.flagOccurrences
  }
}

const normalizeOutputDirInputs = (
  outputDirInput: string | string[] | undefined
): string[] =>
  Array.isArray(outputDirInput)
    ? outputDirInput.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : typeof outputDirInput === 'string' && outputDirInput.trim().length > 0
      ? [outputDirInput]
      : []

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const buildResumeFailureError = (
  failures: Array<{ outputDir: string, message: string }>
): Error => {
  const noun = failures.length === 1 ? 'directory' : 'directories'
  const lines = [
    `Resume failed for ${failures.length} output ${noun}:`,
    ...failures.map((failure) => `- ${failure.outputDir}: ${failure.message}`)
  ]
  return InfraError(lines.join('\n'), { stage: 'resume:dispatch', exitCode: 2 })
}

const dispatchSingleResume = async (
  outputDirInput: string,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = [],
  flagOccurrences: readonly CliFlagOccurrence[] = [],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeDispatchOutcome> => {
  const target = await resolveExplicitResumeTarget(outputDirInput)
  const rawExplicitFlags = new Set(flagOccurrences.map((occurrence) => occurrence.name))
  const normalized = normalizeResumeSelectorFlagsForTarget(target, rawFlags, rawExplicitFlags, flagOccurrences)
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const mergedFlags = mergeConfigIntoRawFlags(normalized.flags, config, normalized.explicitFlags)
  const opts = {
    ...buildOptsFromFlags(false, mergedFlags, doubleDash, {}, normalized.explicitFlags, normalized.flagOccurrences),
    configPath: resolvedConfigPath
  }

  assertNoVoiceIdentityWithDialogue(opts, normalized.explicitFlags)

  const handler = getResumeHandler(target.kind)
  if (!handler) {
    throw CLIUsageError(`Resume is not supported for "${target.kind}".`)
  }

  if (opts.price) {
    const estimate = await handler.price(target, opts, normalized.explicitFlags)
    l.report.estimate(estimate)
    return { estimate }
  }

  const result = await handler.resume(target, opts, normalized.explicitFlags, displayOptions)
  return { result }
}

export const dispatchResume = async (
  outputDirInput: string | string[] | undefined,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = [],
  flagOccurrences: readonly CliFlagOccurrence[] = []
): Promise<void> => {
  if (doubleDash.length > 0) {
    throw CLIUsageError(`Unexpected positional outputs after "--" for "resume": ${doubleDash.join(' ')}. Run: bun autoshow help resume`)
  }

  const outputDirs = normalizeOutputDirInputs(outputDirInput)
  if (outputDirs.length === 0) {
    throw CLIUsageError('Missing required output directory. Usage: bun autoshow resume <outputDirs...> [flags]')
  }

  const failures: Array<{ outputDir: string, message: string }> = []
  const estimates: AggregatedPriceEstimate[] = []
  const resumeResults: ResumeResult[] = []

  for (let index = 0; index < outputDirs.length; index++) {
    const outputDir = outputDirs[index] as string
    try {
      const outcome = await dispatchSingleResume(
        outputDir,
        rawFlags,
        doubleDash,
        flagOccurrences,
        outputDirs.length > 1 ? { itemLabel: `${index + 1}/${outputDirs.length}` } : {}
      )
      if (outcome.estimate) {
        estimates.push(outcome.estimate)
      }
      if (outcome.result) {
        resumeResults.push(outcome.result)
      }
    } catch (error) {
      failures.push({ outputDir, message: errorMessage(error) })
    }
  }

  if (outputDirs.length > 1 && estimates.length > 0) {
    logSuitePriceSummary(l, {
      checkedLabel: estimates.length === 1 ? 'resume directory' : 'resume directories',
      checkedCount: estimates.length,
      totalEstimatedCost: estimates.reduce((sum, estimate) => sum + estimate.totalEstimatedCost, 0)
    })
  }

  if (outputDirs.length > 1 && resumeResults.length > 0) {
    logResumeSuiteSummary(l, {
      directories: outputDirs.length,
      full: resumeResults.reduce((sum, result) => sum + result.full, 0),
      incomplete: resumeResults.reduce((sum, result) => sum + result.incomplete, 0),
      failed: resumeResults.reduce((sum, result) => sum + result.failed, failures.length)
    })
  }

  if (failures.length > 0) {
    throw buildResumeFailureError(failures)
  }
}
