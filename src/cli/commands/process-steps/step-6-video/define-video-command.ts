import { defineCliCommand } from '~/cli/native/native-types'
import { videoCommandFlags } from '~/cli/flags/video-flags'
import { UsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { selectCheapestDefaultTextVideoSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { runVideoGen } from './run-video-gen'
import { collectVideoTargets, buildVideoArtifactMap, getVideoArtifactFileName } from './video-targets'
import { isFirstClassVideoImageInput } from './video-utils/video-media-inputs'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildVideoEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import type { StandaloneVideoCommandOptions, VideoProvider, VideoRuntimeOptions, VideoTarget } from '~/types'
import { VIDEO_PRICING_PROVIDERS } from './video-utils/video-pricing'
import { optionsForService } from '~/utils/pricing/model-selection'

const VIDEO_POSITIONAL_IMAGE_CONFLICT_FLAGS = [
  ['input-image', '--input-image'],
  ['last-frame', '--last-frame'],
  ['reference-image', '--reference-image'],
  ['input-video', '--input-video']
] as const

const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''

const hasVideoProviderSelection = (flags: Record<string, unknown>): boolean =>
  flags['all-video'] === true || Object.values(STANDALONE_VIDEO_PROVIDER_TARGETS).some((flagName) => hasValue(flags[flagName]))

const rejectRetiredVideoProviderSelectors = (occurrences: readonly { name: string, value: unknown }[]): void => {
  for (const occurrence of occurrences) {
    if (occurrence.name !== 'provider' || typeof occurrence.value !== 'string') continue
    const separator = occurrence.value.indexOf('=')
    if (separator < 1) continue
    const provider = occurrence.value.slice(0, separator)
    const model = occurrence.value.slice(separator + 1)
    const replacement = getRetiredModelReplacement('video', provider, model)
    if (replacement !== undefined) {
      throw UsageError(`Model "${model}" is retired for --provider ${provider}=<model>. Use "${replacement}" instead. AutoShow will not silently substitute a different model identity.`)
    }
  }
}

const setSingleVideoProviderSelection = (
  flags: Record<string, unknown>,
  provider: VideoProvider,
  model: string
): void => {
  flags[`${provider}-video`] = model
}

const providerModelsFromTargets = (
  targets: VideoTarget[],
  provider: VideoProvider
): string[] =>
  targets
    .filter((target) => target.service === provider)
    .map((target) => target.model)

const countGrokInputImages = (opts: Pick<VideoRuntimeOptions, 'videoInputImage' | 'videoReferenceImages'>): number =>
  (opts.videoInputImage ? 1 : 0) + (opts.videoReferenceImages?.length ?? 0)

const countReplicateInputVideos = (opts: Pick<VideoRuntimeOptions, 'videoInputVideo' | 'videoReferenceVideos'>): number =>
  (opts.videoInputVideo ? 1 : 0) + (opts.videoReferenceVideos?.length ?? 0)

const buildPricingOptionsForTargets = <T extends VideoRuntimeOptions>(
  opts: T,
  targets: VideoTarget[]
): T => ({
  ...opts,
  allVideo: false,
  ...Object.assign({}, ...VIDEO_PRICING_PROVIDERS.map((provider) =>
    optionsForService(
      VIDEO_PRICING_PROVIDERS,
      provider.service,
      providerModelsFromTargets(targets, provider.service)
    )
  ))
})

const resolveVideoInput = (
  input: string,
  flags: Record<string, unknown>
): { prompt: string | undefined, kind: 'image' | 'text' } => {
  if (!isFirstClassVideoImageInput(input)) {
    if (!hasValue(flags['mode'])) {
      flags['mode'] = 'text'
    }
    return { prompt: input, kind: 'text' }
  }

  const mediaConflict = VIDEO_POSITIONAL_IMAGE_CONFLICT_FLAGS.find(([flagName]) => hasValue(flags[flagName]))
  if (mediaConflict) {
    throw UsageError(`Positional image input cannot be combined with ${mediaConflict[1]}.`)
  }

  const explicitMode = typeof flags['mode'] === 'string' ? flags['mode'] : undefined
  if (explicitMode !== undefined && explicitMode !== 'image-to-video') {
    throw UsageError(`Positional image input infers --mode image-to-video; do not combine it with --mode ${explicitMode}.`)
  }

  flags['mode'] = 'image-to-video'
  flags['input-image'] = input
  return { prompt: undefined, kind: 'image' }
}

export const videoCommand = defineCliCommand({
  name: 'video',
  description: 'Generate a video from a text prompt or input image',
  parameters: [{ key: '<input>', description: 'Text prompt or image path, URL, or data URL for video generation' }],
  flags: videoCommandFlags,
  help: {
    examples: [
      ['bun autoshow video input/ajc.png', 'Generate image-to-video outputs from an input image'],
      ['bun autoshow video "a cinematic mountain sunrise"', 'Generate text-to-video with the cheapest default target'],
      ['bun autoshow video "a cinematic mountain sunrise" --provider gemini=veo-3.1-lite-generate-preview', 'Generate video with Gemini Veo'],
      ['bun autoshow video "a cat playing piano" --provider grok=grok-imagine-video', 'Generate video with Grok'],
      ['bun autoshow video "a product reveal shot" --provider ltx=ltx-2-3-fast', 'Generate video with LTX'],
      ['bun autoshow video "a cinematic mountain sunrise" --provider replicate=bytedance/seedance-2.0-fast', 'Generate video with Replicate Seedance'],
      ['bun autoshow video "a slow dolly through a misty greenhouse" --provider lumalabs=ray-3.2', 'Generate video with Luma Labs Ray 3.2'],
      ['bun autoshow video "a cinematic mountain sunrise with synchronized ambience" --provider fal=minimax/h3 --duration 5 --resolution 2k', 'Generate video with fal.ai MiniMax H3']
    ]
  }
}, async (ctx) => {
  const input = ctx.parameters.input
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw UsageError('Missing video input: provide a text prompt or image path, URL, or data URL.')
  }
  const flags = ctx.flags as Record<string, unknown>

  const videoMaxCents = await resolveMaxCentsFromFlags(flags)
  const resolvedInput = resolveVideoInput(input, flags)
  rejectRetiredVideoProviderSelectors(ctx.rawParsed.flagOccurrences)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_VIDEO_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-video' }
  )

  if (!hasVideoProviderSelection(providerNormalized.flags)) {
    if (resolvedInput.kind === 'image') {
      providerNormalized.flags['all-video'] = true
    } else if (providerNormalized.flags['mode'] === 'text') {
      const selection = selectCheapestDefaultTextVideoSelection()
      setSingleVideoProviderSelection(providerNormalized.flags, selection.provider, selection.model)
    }
  }

  const videoOpts: StandaloneVideoCommandOptions = buildOptsFromFlags(providerNormalized.flags, {}, providerNormalized.explicitFlags, { flagOccurrences: providerNormalized.flagOccurrences })
  const videoTargets = collectVideoTargets(videoOpts)
  if (videoTargets.length === 0) {
    throw UsageError('Specify a video generation provider with --provider gemini|grok|ltx|replicate|lumalabs|fal[=model]')
  }

  const pricingVideoOpts = buildPricingOptionsForTargets(videoOpts, videoTargets)
  const { estimate: preflightEstimate, shouldExit: videoShouldExit } = evaluatePreflightEstimate(
    aggregateExplicitPriceEstimate(await buildVideoEstimates(pricingVideoOpts), {}),
    pricingVideoOpts,
    videoMaxCents
  )
  if (videoShouldExit) {
    const singleTarget = videoTargets.length === 1
    l.report.expectedOutput(getGenerationExpectedOutputDir('./output/<timestamp>_video-gen/'), [
      ...videoTargets.map((t) => getVideoArtifactFileName(t, singleTarget)),
      'manifest.json'
    ])
    return
  }

  const outputDir = await createGenerationOutputDir('video-gen')

  const { metadata } = await runWithLogContext({ step: 'step-6-video' }, async () =>
    await runVideoGen(resolvedInput.prompt, outputDir, videoOpts)
  )

  const estimatedVideoTargets = videoTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(videoOpts.videoDuration !== undefined ? { durationSeconds: videoOpts.videoDuration } : {})
  }))
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    videoTargets: estimatedVideoTargets,
    videoDuration: videoOpts.videoDuration,
    videoAspectRatio: videoOpts.videoAspectRatio,
    videoResolution: videoOpts.videoResolution,
    videoMode: videoOpts.videoMode,
    replicateVideoReferenceVideoCount: countReplicateInputVideos(videoOpts),
    grokInputImageCount: countGrokInputImages(videoOpts),
    grokInputVideoDurationSeconds: metadata.find((entry) => entry.videoGenService === 'grok' && typeof entry.inputVideoDurationSeconds === 'number')?.inputVideoDurationSeconds
  })
  const actual = computeActualCosts({ step6: metadata })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      videoTargets: estimatedVideoTargets,
      ...(videoOpts.videoResolution !== undefined ? { videoResolution: videoOpts.videoResolution } : {}),
      ...(videoOpts.videoAspectRatio !== undefined ? { videoAspectRatio: videoOpts.videoAspectRatio } : {}),
      ...(videoOpts.videoMode !== undefined ? { videoMode: videoOpts.videoMode } : {}),
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'video', metadata, cost, timing, {
    input,
    requestedProviders: videoTargets.map((t) => ({ service: t.service, model: t.model })),
    completedProviders: metadata.map((entry) => ({ service: entry.videoGenService, model: entry.videoGenModel }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildVideoArtifactMap(metadata),
      manifest: 'manifest.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Video',
        'video',
        metadata,
        actual.steps,
        (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost,
      includeOutputDir: false
    }
  )
})
