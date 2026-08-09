import { defineCliCommand } from '~/cli/native/native-types'
import { videoCommandFlags, videoCommandOptionNames } from '~/cli/flags/video-flags'
import { retargetUsageErrorsToCommandSpellings } from '~/cli/flags/flag-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { selectCheapestDefaultTextVideoSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { normalizeCommandSelectorArgs, normalizeCommandSelectorFlags } from '~/cli/flags/service-selector-normalization/flag-helpers'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { runVideoGen } from './run-video-gen'
import { collectVideoTargets, buildVideoArtifactMap, getVideoArtifactFileName } from './video-targets'
import { isFirstClassVideoImageInput } from './video-utils/video-media-inputs'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import type { RuntimeOptions, VideoProvider, VideoTarget } from '~/types'
import { VIDEO_PRICING_PROVIDERS } from './video-utils/video-pricing'
import { optionsForService } from '~/utils/pricing/model-selection'

const VIDEO_PROVIDER_FLAGS = [
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'ltx-video',
  'replicate-video',
  'lumalabs-video',
  'fal-video'
] as const

const VIDEO_POSITIONAL_IMAGE_CONFLICT_FLAGS = [
  ['video-input-image', '--input-image'],
  ['video-last-frame', '--last-frame'],
  ['video-reference-image', '--reference-image'],
  ['video-input-video', '--input-video']
] as const

const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''

const hasVideoProviderSelection = (flags: Record<string, unknown>): boolean =>
  flags['all-video'] === true || VIDEO_PROVIDER_FLAGS.some((flagName) => hasValue(flags[flagName]))

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

const countGrokInputImages = (opts: RuntimeOptions): number =>
  (opts.videoInputImage ? 1 : 0) + (opts.videoReferenceImages?.length ?? 0)

const countReplicateInputVideos = (opts: RuntimeOptions): number =>
  (opts.videoInputVideo ? 1 : 0) + (opts.replicateVideoReferenceVideos?.length ?? 0)

const buildPricingOptionsForTargets = (
  opts: RuntimeOptions,
  targets: VideoTarget[]
): RuntimeOptions => ({
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
    if (!hasValue(flags['video-mode'])) {
      flags['video-mode'] = 'text'
    }
    return { prompt: input, kind: 'text' }
  }

  const mediaConflict = VIDEO_POSITIONAL_IMAGE_CONFLICT_FLAGS.find(([flagName]) => hasValue(flags[flagName]))
  if (mediaConflict) {
    throw CLIUsageError(`Positional image input cannot be combined with ${mediaConflict[1]}.`)
  }

  const explicitMode = typeof flags['video-mode'] === 'string' ? flags['video-mode'] : undefined
  if (explicitMode !== undefined && explicitMode !== 'image-to-video') {
    throw CLIUsageError(`Positional image input infers --mode image-to-video; do not combine it with --mode ${explicitMode}.`)
  }

  flags['video-mode'] = 'image-to-video'
  flags['video-input-image'] = input
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
      ['bun autoshow video "a cinematic mountain sunrise" --provider minimax=MiniMax-Hailuo-2.3', 'Generate video with MiniMax Hailuo'],
      ['bun autoshow video "a cat playing with yarn" --provider glm=cogvideox-3', 'Generate video with GLM CogVideoX'],
      ['bun autoshow video "a cat playing piano" --provider grok=grok-imagine-video', 'Generate video with Grok'],
      ['bun autoshow video "a cinematic mountain sunrise" --provider runway=gen4.5', 'Generate video with Runway Gen-4.5'],
      ['bun autoshow video "a product reveal shot" --provider ltx=ltx-2-3-fast', 'Generate video with LTX'],
      ['bun autoshow video "a cinematic mountain sunrise" --provider replicate=wan-video/wan-2.7-t2v', 'Generate video with Replicate Wan'],
      ['bun autoshow video "a slow dolly through a misty greenhouse" --provider lumalabs=ray-3.2', 'Generate video with Luma Labs Ray 3.2'],
      ['bun autoshow video "a cinematic mountain sunrise with synchronized ambience" --provider fal=minimax/h3 --duration 5 --resolution 2k', 'Generate video with fal.ai MiniMax H3']
    ]
  }
}, retargetUsageErrorsToCommandSpellings(async (ctx) => {
  const input = ctx.parameters.input
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw CLIUsageError('Missing video input: provide a text prompt or image path, URL, or data URL.')
  }
  const flags = ctx.flags

  const videoMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const rawArgs = Bun.argv.slice(2)
  const explicitFlags = extractExplicitFlags(rawArgs)
  const optionNormalized = normalizeCommandSelectorFlags(flags as Record<string, unknown>, explicitFlags, videoCommandOptionNames)
  const optionNormalizedArgs = normalizeCommandSelectorArgs(rawArgs, videoCommandOptionNames)
  const resolvedInput = resolveVideoInput(input, optionNormalized.flags)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    optionNormalized.flags,
    optionNormalized.explicitFlags,
    'provider',
    STANDALONE_VIDEO_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-video', rawArgs: optionNormalizedArgs }
  )

  if (!hasVideoProviderSelection(providerNormalized.flags)) {
    if (resolvedInput.kind === 'image') {
      providerNormalized.flags['all-video'] = true
    } else if (providerNormalized.flags['video-mode'] === 'text') {
      const selection = selectCheapestDefaultTextVideoSelection()
      setSingleVideoProviderSelection(providerNormalized.flags, selection.provider, selection.model)
    }
  }

  const videoOpts = buildOptsFromFlags(true, providerNormalized.flags, [], {}, providerNormalized.explicitFlags, providerNormalized.rawArgs ?? optionNormalizedArgs)
    const videoTargets = collectVideoTargets(videoOpts)
  if (videoTargets.length === 0) {
    throw CLIUsageError('Specify a video generation provider with --provider gemini|minimax|glm|grok|runway|ltx|replicate|lumalabs|fal[=model]')
  }

  const pricingVideoOpts = buildPricingOptionsForTargets(videoOpts, videoTargets)
  const { estimate: preflightEstimate, shouldExit: videoShouldExit } = await runPreflight('video', input, pricingVideoOpts, videoMaxCents)
  if (videoShouldExit) {
    const singleTarget = videoTargets.length === 1
    l.report.expectedOutput(getGenerationExpectedOutputDir('./output/<timestamp>_video-gen/'), [
      ...videoTargets.map((t) => getVideoArtifactFileName(t, singleTarget)),
      'run.json'
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
    videoSize: videoOpts.videoSize,
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
      ...(videoOpts.videoSize !== undefined ? { videoSize: videoOpts.videoSize } : {}),
      ...(videoOpts.videoAspectRatio !== undefined ? { videoAspectRatio: videoOpts.videoAspectRatio } : {}),
      ...(videoOpts.videoMode !== undefined ? { videoMode: videoOpts.videoMode } : {}),
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'video', metadata, cost, timing, {
    input,
    requestedProviders: videoTargets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildVideoArtifactMap(metadata),
      run: 'run.json'
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
}, videoCommandOptionNames))
