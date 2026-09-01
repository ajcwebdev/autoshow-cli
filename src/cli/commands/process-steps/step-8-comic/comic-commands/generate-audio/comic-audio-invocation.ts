import type {
  CliCommandContext,
  ComicAudioDeliveryPolicy,
  ComicAudioMode,
  ComicAudioPacingProfile,
  ComicAudioRolePolicy,
  ComicAudioSoundscapeTimingPolicy,
  ResolvedComicAudioInvocation,
  TtsOptions,
} from '~/types'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { selectCheapestDefaultHostedTtsSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { preparePresentationVisualInputs, resolvePresentationVisualInputs } from '../../comic-utils/comic-presentation-inputs'
import { reconcilePresentationDialogue } from '../../comic-utils/comic-presentation-plan'
import { selectPresentationVideoEncoder } from '../../comic-utils/comic-presentation-renderer'
import { createComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { assertProtectedStoreOutputDisjoint } from '../../../step-4-tts/voice-assets/protected-output-boundary'
import { MANAGED_VOICE_STORE_ROOT } from '../../../step-4-tts/voice-management/managed-voice-store'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '../../../step-4-tts/soundscape/soundscape-planner'
import { parseSoundEffectLicenseUseClassification } from '../../comic-utils/comic-soundscape-workflow'

const DEFAULT_PROFILE = 'default'

const repeatableStrings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string')
  : typeof value === 'string' ? [value] : []

const parseInteger = (value: unknown, fallback: number, label: string): number => {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) <= 0) throw UsageError(`${label} must be a positive integer.`)
  return Number(value)
}

const parseOptionalPositiveInteger = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) throw UsageError(`${label} must be a positive safe integer.`)
  return Number(value)
}

const parseRolePolicies = (values: readonly string[]): ComicAudioRolePolicy[] => values.map((value) => {
  const separator = value.indexOf('=')
  const speakerLabel = value.slice(0, separator).trim()
  const subjectKey = value.slice(separator + 1).trim()
  if (separator <= 0 || !speakerLabel || !/^(?:role|voice):[a-z0-9][a-z0-9_-]{0,127}$/.test(subjectKey)) throw UsageError(`Invalid --role "${value}". Expected LABEL=role:key or LABEL=voice:key.`)
  return { speakerLabel, subjectKey }
})

const parseMode = (value: unknown): ComicAudioMode => {
  const mode = value ?? 'auto'
  if (mode !== 'auto' && mode !== 'native' && mode !== 'segmented') throw UsageError('--mode must be auto, native, or segmented.')
  return mode
}

const parseDeliveryPolicy = (value: unknown): ComicAudioDeliveryPolicy => {
  const policy = value ?? 'strict'
  if (policy !== 'strict' && policy !== 'best-effort') throw UsageError('--delivery-policy must be strict or best-effort.')
  return policy
}

const parsePacingProfile = (value: unknown): ComicAudioPacingProfile => {
  const profile = value ?? 'none'
  if (profile !== 'none' && profile !== 'loose-comedy') throw UsageError('--pacing-profile must be none or loose-comedy.')
  return profile
}

const parseSoundscapeTimingPolicy = (value: unknown): ComicAudioSoundscapeTimingPolicy => {
  const policy = value ?? 'strict'
  if (policy !== 'strict' && policy !== 'proportional') throw UsageError('--soundscape-timing-policy must be strict or proportional.')
  return policy
}

export const flattenTurns = (plan: Awaited<ReturnType<typeof createComicDialoguePlan>>) =>
  plan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)

const withoutInheritedVoiceSelection = (options: TtsOptions): TtsOptions => ({
  ...options,
  ttsDialogueFormat: undefined,
  ttsSpeakers: undefined,
  grokTtsVoice: undefined,
  mistralTtsVoice: undefined,
  openaiVoiceId: undefined,
  elevenlabsVoiceId: undefined,
  minimaxTtsVoice: undefined,
  speechifyVoice: undefined,
  humeTtsVoice: undefined,
  cartesiaTtsVoice: undefined,
  inworldTtsVoice: undefined,
})

export const resolveComicAudioInvocation = async (ctx: CliCommandContext, scriptPath: string): Promise<ResolvedComicAudioInvocation> => {
  const flags = ctx.flags as Record<string, unknown>
  const profileKey = typeof flags['profile'] === 'string' && flags['profile'].trim() ? flags['profile'].trim() : DEFAULT_PROFILE
  const mode = parseMode(flags['mode'])
  const deliveryPolicy = parseDeliveryPolicy(flags['delivery-policy'])
  const pacingProfile = parsePacingProfile(flags['pacing-profile'])
  const soundscapeTimingPolicy = parseSoundscapeTimingPolicy(flags['soundscape-timing-policy'])
  const rolePolicies = parseRolePolicies(repeatableStrings(flags['role']))
  const { sampleRate, channels, codec } = DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE
  const price = flags['price'] === true
  const allowAmbiguousRedispatch = flags['allow-ambiguous-redispatch'] === true
  const maxGenerationSlots = parseOptionalPositiveInteger(flags['max-generation-slots'], '--max-generation-slots')
  const sfxSelector = typeof flags['sfx-provider'] === 'string' && flags['sfx-provider'].trim() ? flags['sfx-provider'].trim() : undefined
  const sfxLicenseUseClassification = parseSoundEffectLicenseUseClassification(flags['sfx-license-use'])
  const sfxConcurrency = parseInteger(flags['sfx-concurrency'], 2, '--sfx-concurrency')
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts' }
  )
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
  const baseOptions = withoutInheritedVoiceSelection(buildOptsFromFlags(providerNormalized.flags, {}, providerNormalized.explicitFlags, { flagOccurrences: providerNormalized.flagOccurrences, scope: 'tts' }) as TtsOptions)
  baseOptions.ttsAllowAmbiguousRedispatch = allowAmbiguousRedispatch
  baseOptions.ttsMaxGenerationSlots = maxGenerationSlots
  if (allowAmbiguousRedispatch) l.write('warn', 'Ambiguous TTS redispatch is explicitly authorized for this run; a provider-admitted slot without retained audio may be purchased again.', { category: 'tts' })
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath })
  await assertProtectedStoreOutputDisjoint(compatible.sceneRunDir, MANAGED_VOICE_STORE_ROOT)
  const dialoguePlan = createComicDialoguePlan({
    structuredScript: compatible.structuredScript,
    sourceIdentity: compatible.sourceIdentity,
    structuredScriptRef: compatible.comicMetadata.audio.structuredScript as NonNullable<typeof compatible.comicMetadata.audio.structuredScript>,
    sceneRunIdentity: compatible.comicMetadata.audio.sceneRunIdentity as string,
    createdAt: compatible.manifest.createdAt,
    pacingProfile,
    rolePolicies,
  })
  const presentationRequested = Boolean(flags['slideshow'])
  if (presentationRequested) {
    const visualInputs = await resolvePresentationVisualInputs(compatible)
    reconcilePresentationDialogue({ scene: visualInputs.scene, dialoguePlan })
    if (!price) {
      await preparePresentationVisualInputs(compatible, visualInputs)
      await selectPresentationVideoEncoder()
    }
  }

  return {
    profileKey,
    mode,
    deliveryPolicy,
    pacingProfile,
    soundscapeTimingPolicy,
    rolePolicies,
    sampleRate,
    channels,
    codec,
    price,
    allowAmbiguousRedispatch,
    maxGenerationSlots,
    sfxSelector,
    sfxLicenseUseClassification,
    sfxConcurrency,
    presentationRequested,
    baseOptions,
    compatible,
    dialoguePlan,
  }
}
