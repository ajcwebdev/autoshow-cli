import { resolveMaxCentsFromFlags } from '~/cli/commands/command-shared/generation-command-utils'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveTtsDeliveryOptionsWithLexicon } from '~/cli/options/option-resolution/tts-delivery-options'
import { resolveStandaloneMistralTtsCliReferenceInput, resolveStandaloneMistralTtsSpeakerReferenceInputs } from '~/cli/options/option-resolution/tts-options'
import { ttsCommandFlags } from '~/cli/flags/tts-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { normalizeStandaloneTtsModel } from '~/cli/flags/service-selector-normalization/standalone-tts-model'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { defineCliCommand } from '~/cli/native/native-types'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { selectCheapestDefaultHostedTtsSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { assertDialogueFormatIsUsable } from './dialogue-normalizer'
import { collectTtsTargets } from './tts-targets'
import { planStandaloneMistralReference, planStandaloneMistralSpeakerReferences } from '../voice/voice-assets/standalone-mistral-reference'
import { getTtsInputKind, runSingleTtsInput } from './tts-single-run'
import type { StandaloneTtsCommandOptions } from '~/types'
import { runTtsDirectoryBatch } from './tts-batch-run'
import * as l from '~/utils/app-logger/app-logger'
import { runGeminiRemoteBatch } from './tts-services/tts-gemini/gemini-tts-batch-workflow'
import { UsageError } from '~/utils/error-handler'

export { getTtsBatchAudioFileName, moveTtsBatchAudioFiles, buildTtsBatchSource } from './tts-batch-plan'
export { runSingleTtsInput } from './tts-single-run'
export { runTtsDirectoryBatch } from './tts-batch-run'

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file or directory of text files (default provider: cheapest hosted TTS)',
  parameters: [{ key: '<input>', description: 'Path to a .md/.txt file or a directory containing text files' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --price', 'Estimate Gemini Flash-Lite speech with Kore'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --gemini-tts-mode batch --gemini-tts-batch-wait-seconds 0 --price', 'Estimate a remote Gemini Batch job; remove --price to submit'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-voice YOUR_EXISTING_VOICE_ID', 'Use an existing ElevenLabs voice'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider soniox --model tts-rt-v2 --tts-voice Adrian --tts-language en --tts-speed 1 --price', 'Estimate Soniox REST speech'],
      ['bun autoshow tts input/examples/tts/01-tts-short.md --provider grok=grok-tts --tts-voice eve', 'Generate speech with a Grok voice']
    ]
  }
}, async (ctx) => {
  const inputPath = ctx.parameters.input
  const rawFlags = ctx.flags as Record<string, unknown>
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const configPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(configPath)
  const flags = mergeConfigIntoRawFlags(rawFlags, config, ctx.rawParsed.explicitFlags, 'tts')
  const inputKind = await getTtsInputKind(inputPath)
  const maxCents = await resolveMaxCentsFromFlags(flags)
  const providerNormalized = normalizeStandaloneTtsModel(normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts' }
  ))
  if (
    providerNormalized.flags['all-tts'] !== true
    && !Object.values(STANDALONE_TTS_PROVIDER_TARGETS).some((flag) => {
      const value = providerNormalized.flags[flag]
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== false
    })
  ) {
    const cheapest = selectCheapestDefaultHostedTtsSelection()
    providerNormalized.flags[`${cheapest.provider}-tts`] = cheapest.model
  }
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    providerNormalized.flags,
    providerNormalized.explicitFlags,
    providerNormalized.flagOccurrences
  )
  const speakerReferenceInputs = resolveStandaloneMistralTtsSpeakerReferenceInputs(
    ttsNormalized.flags,
    {
      explicitFlags: ttsNormalized.explicitFlags,
      flagOccurrences: ttsNormalized.flagOccurrences,
      cliReferenceInput: 'standalone-mistral'
    }
  )
  const rawSpeakerMappings = Array.isArray(ttsNormalized.flags['tts-speaker'])
    ? ttsNormalized.flags['tts-speaker'].filter((value): value is string => typeof value === 'string')
    : typeof ttsNormalized.flags['tts-speaker'] === 'string'
      ? [ttsNormalized.flags['tts-speaker']]
      : undefined
  const speakerReferencePlan = await planStandaloneMistralSpeakerReferences(
    rawSpeakerMappings,
    speakerReferenceInputs
  )
  const sanitizedFlags = speakerReferencePlan
    ? { ...ttsNormalized.flags, 'tts-speaker': [...speakerReferencePlan.ttsSpeakers] }
    : ttsNormalized.flags
  const ttsOptionResolutionAuthority = {
    cliReferenceInput: 'standalone-mistral',
    ...(speakerReferencePlan ? { mistralSpeakerReferences: 'sanitized' as const } : {})
  } as const
  const unresolvedTtsOptions: StandaloneTtsCommandOptions = buildOptsFromFlags(sanitizedFlags, {}, ttsNormalized.explicitFlags, {
      flagOccurrences: ttsNormalized.flagOccurrences,
      ttsOptionResolutionAuthority,
      scope: 'tts'
    })
  const referenceInput = resolveStandaloneMistralTtsCliReferenceInput(
    ttsNormalized.flags,
    {
      explicitFlags: ttsNormalized.explicitFlags,
      cliReferenceInput: 'standalone-mistral'
    }
  )

  assertDialogueFormatIsUsable(unresolvedTtsOptions, ttsNormalized.explicitFlags)

  assertNoVoiceIdentityWithDialogue(unresolvedTtsOptions, ttsNormalized.explicitFlags)

  const protectedSpeakerOptions = speakerReferencePlan?.attach(unresolvedTtsOptions) ?? unresolvedTtsOptions
  // Assigned in place: protected Mistral reference authority is keyed on this exact options object.
  const ttsOptions = Object.assign(
    await planStandaloneMistralReference(
      protectedSpeakerOptions,
      referenceInput
    ),
    await resolveTtsDeliveryOptionsWithLexicon(sanitizedFlags)
  )

  let targets = collectTtsTargets(ttsOptions)
  if (
    ttsOptions.ttsAllProvidersSelected === true
    && ttsOptions.price !== true
    && (ttsOptions.mistralTtsModels?.length ?? 0) > 0
    && !targets.some((target) => target.service === 'mistral')
  ) {
    l.warn(
      'Skipping Mistral TTS in the all-provider run because no Mistral voice source was supplied. Pass --tts-voice mistral=VOICE_ID or --tts-ref-audio mistral=PATH to include it.',
      { category: 'pipeline' }
    )
  }

  if (ttsOptions.ttsExport?.book && inputKind !== 'directory') {
    throw UsageError('--tts-book requires a directory input; each input file becomes one chapter.')
  }

  if (ttsOptions.geminiTtsMode === 'batch') {
    await runGeminiRemoteBatch(inputPath, ttsOptions, targets.filter(t => t.service === 'gemini'), maxCents)
    targets = targets.filter(t => t.service !== 'gemini')
    if (!targets.length) return
  }

  if (inputKind === 'directory') {
    await runTtsDirectoryBatch(inputPath, ttsOptions, targets, maxCents)
    return
  }

  await runSingleTtsInput(inputPath, ttsOptions, targets, maxCents)
})
