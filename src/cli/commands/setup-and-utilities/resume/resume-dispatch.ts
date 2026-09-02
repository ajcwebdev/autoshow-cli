import { partialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-batch-state'
import { join, resolve as resolvePath } from 'node:path'
import { PIPELINE_MANIFEST_FILE, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import { logResumeSuiteSummary } from './resume-logging'
import * as l from '~/utils/app-logger/app-logger'
import type { AggregatedPriceEstimate, CliFlagOccurrence, ExtractRoute, ExtractSelectorInputRoutes, HostedConcurrencyCoordinator, PipelineManifest, ResumeDispatchOutcome, ResumeDisplayOptions, ResumeResult, ResumeSelectorNormalizationResult, ResumeTarget, ResumeTargetKind } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getResumeHandler } from './resume-registry'
import { formatErrorMessage } from '~/utils/value-helpers'

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
  write: undefined,
  tts: undefined,
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

const readExtractRoute = (
  manifest: PipelineManifest
): ExtractRoute | undefined => {
  if (manifest.command !== 'extract') {
    return undefined
  }

  const routes = new Set<ExtractRoute>()
  for (const item of manifest.items) {
    if (isExtractRoute(item.extractRoute)) {
      routes.add(item.extractRoute)
    }
  }

  return routes.size === 1 ? [...routes][0] : undefined
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
  const manifest = await readManifest(dir)
  const manifestPath = join(dir, PIPELINE_MANIFEST_FILE)
  if (manifest) {
    const target = toResumeTarget(
      manifest.command,
      manifest.scope,
      dir,
      manifestPath,
      readExtractRoute(manifest)
    )
    if (target) {
      return target
    }
    throw UsageError(`Resume supports only extract, write, TTS, image, video, and music manifests. Found "${manifest.command}" at ${manifestPath}.`)
  }

  throw UsageError(`Could not find ${PIPELINE_MANIFEST_FILE} under ${dir}.`)
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

const buildResumeFailureError = (
  failures: Array<{ outputDir: string, message: string }>
): Error => {
  const noun = failures.length === 1 ? 'directory' : 'directories'
  const lines = [
    `Resume failed for ${failures.length} output ${noun}:`,
    ...failures.map((failure) => `- ${failure.outputDir}: ${failure.message}`)
  ]
  return partialCompletionError(lines.join('\n'), { stage: 'resume:dispatch' })
}

const dispatchSingleResume = async (
  outputDirInput: string,
  rawFlags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[] = [],
  displayOptions: ResumeDisplayOptions = {},
  sharedHostedConcurrency?: { current?: HostedConcurrencyCoordinator | undefined }
): Promise<ResumeDispatchOutcome> => {
  const target = await resolveExplicitResumeTarget(outputDirInput)
  const rawExplicitFlags = new Set(flagOccurrences.map((occurrence) => occurrence.name))
  const normalized = normalizeResumeSelectorFlagsForTarget(target, rawFlags, rawExplicitFlags, flagOccurrences)
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const mergedFlags = mergeConfigIntoRawFlags(normalized.flags, config, normalized.explicitFlags, target.kind)
  const opts = {
    ...buildOptsFromFlags(mergedFlags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences }),
    configPath: resolvedConfigPath
  }
  if (sharedHostedConcurrency) {
    sharedHostedConcurrency.current ??= opts.hostedConcurrencyCoordinator
    opts.hostedConcurrencyCoordinator = sharedHostedConcurrency.current
  }

  assertNoVoiceIdentityWithDialogue(opts, normalized.explicitFlags)

  const handler = getResumeHandler(target.kind)
  if (!handler) {
    throw UsageError(`Resume is not supported for "${target.kind}".`)
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
    throw UsageError(`Unexpected positional outputs after "--" for "resume": ${doubleDash.join(' ')}. Run: bun autoshow help resume`)
  }

  const outputDirs = normalizeOutputDirInputs(outputDirInput)
  if (outputDirs.length === 0) {
    throw UsageError('Missing required output directory. Usage: bun autoshow resume <outputDirs...> [flags]')
  }

  const failures: Array<{ outputDir: string, message: string }> = []
  const estimates: AggregatedPriceEstimate[] = []
  const resumeResults: ResumeResult[] = []
  const sharedHostedConcurrency: { current?: HostedConcurrencyCoordinator | undefined } = {}

  for (let index = 0; index < outputDirs.length; index++) {
    const outputDir = outputDirs[index] as string
    try {
      const outcome = await dispatchSingleResume(
        outputDir,
        rawFlags,
        flagOccurrences,
        outputDirs.length > 1 ? { itemLabel: `${index + 1}/${outputDirs.length}` } : {},
        sharedHostedConcurrency
      )
      if (outcome.estimate) {
        estimates.push(outcome.estimate)
      }
      if (outcome.result) {
        resumeResults.push(outcome.result)
      }
    } catch (error) {
      failures.push({ outputDir, message: formatErrorMessage(error) })
    }
  }

  if (outputDirs.length > 1 && estimates.length > 0) {
    logSuitePriceSummary({
      checkedLabel: estimates.length === 1 ? 'resume directory' : 'resume directories',
      checkedCount: estimates.length,
      totalEstimatedCost: estimates.reduce((sum, estimate) => sum + estimate.totalEstimatedCost, 0)
    })
  }

  if (outputDirs.length > 1 && resumeResults.length > 0) {
    logResumeSuiteSummary({
      directories: outputDirs.length,
      full: resumeResults.reduce((sum, result) => sum + result.full, 0),
      incomplete: resumeResults.reduce((sum, result) => sum + result.incomplete, 0),
      failed: resumeResults.reduce((sum, result) => sum + result.failed, failures.length)
    })
  }

  if (failures.length > 0) {
    throw buildResumeFailureError(failures)
  }

  if (estimates.length > 0) {
    l.report.price({
      steps: estimates.flatMap(estimate => estimate.steps),
      totalEstimatedCost: estimates.reduce((sum, estimate) => sum + estimate.totalEstimatedCost, 0)
    })
    return
  }

  l.report.result({
    directories: outputDirs,
    results: resumeResults,
    totals: {
      full: resumeResults.reduce((sum, result) => sum + result.full, 0),
      incomplete: resumeResults.reduce((sum, result) => sum + result.incomplete, 0),
      failed: resumeResults.reduce((sum, result) => sum + result.failed, 0)
    }
  }, 'Resume complete')
}
