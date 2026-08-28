import { defineCliCommand } from '~/cli/native/native-types'
import { musicCommandFlags } from '~/cli/flags/music-flags'
import { UsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_MUSIC_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { runMusicGen } from './run-music-gen'
import { runMusicLyricVideo } from './lyrics-video/run-lyrics-video'
import { buildMusicArtifactMap, collectMusicTargets, getMusicArtifactFileName } from './music-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildMusicEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { fileExists } from '~/utils/cli-utils'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import type { CliFlagOccurrence, StandaloneMusicCommandOptions } from '~/types'

const HOSTED_MUSIC_FLAGS = [
  'all-providers',
  'provider',
  'duration',
  'lyrics-file',
  'instrumental',
  'output-dir'
] as const

const LYRIC_VIDEO_FLAGS = [
  'audio',
  'captions',
  'batch',
  'model',
  'font'
] as const

const collectExplicitFlags = (
  explicitFlags: ReadonlySet<string>,
  flagNames: readonly string[]
): string[] => flagNames.filter((flag) => explicitFlags.has(flag)).map((flag) => `--${flag}`)

const runHostedMusicGeneration = async (
  input: string,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): Promise<void> => {
  const prompt = isTextInputPath(input) && await fileExists(input)
    ? await Bun.file(input).text()
    : input

  const musicMaxCents = await resolveMaxCentsFromFlags(flags)
  const musicDurationRaw = typeof flags['duration'] === 'string'
    ? parseInt(flags['duration'], 10)
    : undefined
  const musicDuration = Number.isFinite(musicDurationRaw) ? musicDurationRaw : undefined
  const musicLyricsFile = typeof flags['lyrics-file'] === 'string' ? flags['lyrics-file'] : undefined
  const musicInstrumental = flags['instrumental'] === true
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    explicitFlags,
    flagOccurrences,
    'provider',
    STANDALONE_MUSIC_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-music' }
  )
  const musicOpts: StandaloneMusicCommandOptions = buildOptsFromFlags(providerNormalized.flags, {}, providerNormalized.explicitFlags, { flagOccurrences: providerNormalized.flagOccurrences, scope: 'music' })

  const musicTargets = collectMusicTargets(musicOpts)
  if (musicTargets.length === 0) {
    throw UsageError('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model]')
  }

  const { estimate: preflightEstimate, shouldExit: musicShouldExit } = evaluatePreflightEstimate(
    aggregateExplicitPriceEstimate(await buildMusicEstimates(musicOpts), {}),
    musicOpts,
    musicMaxCents
  )
  if (musicShouldExit) {
    const singleTarget = musicTargets.length === 1
    const expectedFiles = [
      ...musicTargets.map((target) => getMusicArtifactFileName(target, singleTarget)),
      'manifest.json'
    ]
    l.report.expectedOutput(getGenerationExpectedOutputDir('./output/<timestamp>_music-gen/'), expectedFiles)
    return
  }

  const outputDir = await createGenerationOutputDir('music-gen')

  const { metadata } = await runWithLogContext({ step: 'step-7-music' }, async () =>
    await runMusicGen(prompt, outputDir, musicOpts)
  )

  const estimatedMusicTargets = musicTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(musicDuration !== undefined ? { durationSeconds: musicDuration } : {})
  }))
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    musicTargets: estimatedMusicTargets,
    musicDuration,
    musicLyricsFile,
    musicInstrumental
  })
  const actual = computeActualCosts({ step7: metadata })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      musicTargets: estimatedMusicTargets,
    }),
    actual: computeActualProcessingTimes({ step7: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'music', metadata, cost, timing, {
    input: prompt,
    requestedProviders: musicTargets.map((t) => ({ service: t.service, model: t.model })),
    completedProviders: metadata.map((entry) => ({ service: entry.musicService, model: entry.musicModel }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildMusicArtifactMap(metadata),
      manifest: 'manifest.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Music',
        'music',
        metadata,
        actual.steps,
        (entry) => `${entry.musicService}/${entry.musicModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost,
      includeOutputDir: false
    }
  )
}

export const musicCommand = defineCliCommand({
  name: 'music',
  description: 'Generate hosted music or render lyric videos from local audio',
  parameters: [{ key: '[input]', description: 'Hosted music prompt or path to a local .md/.txt file' }],
  flags: musicCommandFlags,
  help: {
    examples: [
      ['bun autoshow music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v2', 'Generate music with ElevenLabs Music v2'],
      ['bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental', 'Generate instrumental music with MiniMax Music 3.0'],
      ['bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview', 'Generate a Lyria 3 Pro song with Gemini'],
      ['bun autoshow music input/examples/tts/1-tts.md --provider minimax=music-3.0', 'Use a local markdown file as the prompt body'],
      ['bun autoshow music --audio input/examples/lyrics/01-example-song.mp3', 'Render a lyric video from local audio'],
      ['bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt', 'Rerender from edited captions without rerunning Whisper'],
      ['bun autoshow music --batch input --model small', 'Render lyric videos for every supported audio file under input directory']
    ]
  }
}, async (ctx) => {
  const input = typeof ctx.parameters.input === 'string' ? ctx.parameters.input : undefined
  const flags = ctx.flags as Record<string, unknown>
  const hostedFlags = collectExplicitFlags(ctx.rawParsed.explicitFlags, HOSTED_MUSIC_FLAGS)
  const lyricVideoFlags = collectExplicitFlags(ctx.rawParsed.explicitFlags, LYRIC_VIDEO_FLAGS)

  if (input && lyricVideoFlags.length > 0) {
    throw UsageError(`Do not combine lyric-video flags (${lyricVideoFlags.join(', ')}) with a hosted music prompt`)
  }

  if (lyricVideoFlags.length > 0 && hostedFlags.length > 0) {
    throw UsageError(`Do not combine hosted music flags (${hostedFlags.join(', ')}) with lyric-video flags (${lyricVideoFlags.join(', ')})`)
  }

  if (lyricVideoFlags.length > 0) {
    await runMusicLyricVideo(flags)
    return
  }

  if (!input) {
    throw UsageError(
      hostedFlags.length > 0
        ? 'Missing hosted music prompt input'
        : 'Missing music mode: provide a prompt with --provider, or use --audio/--batch for lyric-video rendering'
    )
  }

  await runHostedMusicGeneration(input, flags, ctx.rawParsed.explicitFlags, ctx.rawParsed.flagOccurrences)
})
