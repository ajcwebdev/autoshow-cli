import type {
  AnyCapabilityRecord,
  AttemptSlot,
  AttemptTurn,
  CanonicalAudioProviderProjection,
  CanonicalDialogueTurn,
  CapabilityFixture,
  ComicDialoguePlan,
  CreateCurrentTtsRenderAttemptOptions,
  FalTtsModel,
  GenericTtsDialoguePlan,
  PipelineProviderState,
  PlannedCost,
  PlannedInputs,
  ProtectedAssetRef,
  ProviderRenderBranchCandidate,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderStrategy,
  PureCurrentTtsReadinessPlan,
  PureCurrentTtsRenderPlan,
  PureCurrentTtsRenderPlanOptions,
  ResolvedVoiceBinding,
  SanitizedProviderError,
  TtsTarget,
  TtsTargetInvocation,
  TtsTargetSelection,
  TypedProviderRequestSettings,
  TypedProviderSynthesisSettings,
} from '~/types'
import { getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  SPEECHIFY_DEFAULT_TTS_VOICE,
  validateSpeechifyTtsLanguageForModel,
  validateSpeechifyTtsModel,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError, extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { parseRetryAfterMs } from '~/utils/retries'
import { splitTextIntoChunks } from '../tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '../tts-utils/tts-chunking'
import { getSpeakerVoice, isMultiSpeakerRequested, normalizeDialogueFromOptions, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../dialogue-normalizer'
import { resolveGeminiDialogueStrategyForText, splitGeminiNativeDialogueText } from '../tts-services/tts-gemini/gemini-tts-config'
import { planElevenLabsNativeDialogueBatches } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { ELEVENLABS_TTS_OUTPUT_FORMAT } from '../tts-services/tts-elevenlabs/elevenlabs-utils'
import { planHumeNativeUtteranceBatches } from '../tts-services/hume/hume-native-utterances'
import {
  FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
  FISH_TIMESTAMP_SERIALIZER_VERSION,
  FISH_TTS_SERIALIZER_VERSION,
  isFishNativeDialogueModel,
  isFishTimestampModel,
  planFishNativeDialogueBatches,
} from '../tts-services/fish/fish-tts-request'
import { DEEPINFRA_TTS_SERIALIZER_VERSION, resolveDeepinfraTtsRequestControls, resolveDeepinfraTtsVoiceField } from '../tts-services/tts-deepinfra/deepinfra-tts-request'
import { FAL_TTS_SERIALIZER_VERSION, resolveFalTtsVoiceField } from '../tts-services/tts-fal/fal-tts-request'
import { INWORLD_TTS_SERIALIZER_VERSION } from '../tts-services/inworld/inworld-tts-request'
import { createTtsTargetSelection } from '../tts-targets/tts-target-selection'
import {
  normalizeTtsTurnControls,
  resolveTtsTargetInvocationControls,
  resolveTtsTurnControlOverrides,
} from '../tts-targets/tts-invocation-controls'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from './generic-dialogue-plan'
import {
  canonicalTargetKey,
  canonicalTtsJson,
  computeRenderIdentity,
  computeVoiceContextKey,
  hashCanonicalTtsValue,
  sha256Bytes,
} from './contract-identity'
import {
  projectCanonicalAudioProviderStatus,
  validateGenericTtsDialoguePlan,
  validateGenericTtsSourceIdentity,
  validateCapabilityFacetSet,
  validateProviderRenderPlanIdentity,
} from './contract-validation'
import {
  CAPABILITY_CHECKED_AT,
  CAPABILITY_SOURCE_REFS,
  EPOCH,
  REQUESTED_OUTPUT,
  SCHEMA_VERSION,
  withIdentity,
} from './attempt-shared'
import {
  chunkLimit,
  prepareSegmentedTurnText,
  segmentedSlotGroup,
} from './comic-segmented-audio'
export const typedSettings = (
  target: TtsTarget,
  effectiveControls: Readonly<Record<string, unknown>>,
  protectedAsset?: ProtectedAssetRef | undefined
): TypedProviderSynthesisSettings => {
  const values: TypedProviderSynthesisSettings['values'] = {}
  for (const [key, value] of Object.entries(effectiveControls).sort(([left], [right]) => left.localeCompare(right))) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) values[key] = value
    else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) values[key] = [...value]
  }
  const activeProtectedAsset = protectedAsset ?? target.protectedVoiceAsset
  if (activeProtectedAsset) values['referenceAssetSha256'] = activeProtectedAsset.sha256
  return { schemaVersion: 1, settingsSchema: `${target.service}.tts.${SCHEMA_VERSION}`, values }
}

export const requestSettings = (settings: TypedProviderSynthesisSettings): TypedProviderRequestSettings => ({
  schemaVersion: 1,
  settingsSchema: settings.settingsSchema.replace('.tts.', '.tts.request.'),
  values: { ...settings.values }
})

export const resolveEffectiveInvocationControls = (
  target: TtsTarget,
  invocation: TtsTargetInvocation,
  selection: TtsTargetSelection
): Readonly<Record<string, unknown>> => {
  switch (target.service) {
    case 'openai': {
      const controls = resolveTtsTargetInvocationControls('openai', invocation, {
        instructions: selection.openaiInstructions,
        speed: selection.openaiSpeed,
      })
      if (controls.instructions && target.model !== 'gpt-4o-mini-tts-2025-12-15') {
        throw CLIUsageError(`OpenAI per-turn TTS instructions are not supported by ${target.model}.`)
      }
      return controls
    }
    case 'elevenlabs':
      return resolveTtsTargetInvocationControls('elevenlabs', invocation, {
        languageCode: selection.elevenLabsLanguageCode,
        stability: selection.elevenLabsStability,
        similarityBoost: selection.elevenLabsSimilarityBoost,
        style: selection.elevenLabsStyle,
        ...(selection.elevenLabsUseSpeakerBoost ? { useSpeakerBoost: true } : {}),
        speed: selection.elevenLabsSpeed,
        seed: selection.elevenLabsSeed,
        textNormalization: selection.elevenLabsTextNormalization,
        pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators,
      })
    case 'minimax':
      return resolveTtsTargetInvocationControls('minimax', invocation, {
        languageBoost: selection.minimaxLanguageBoost,
        speed: selection.minimaxSpeed,
        volume: selection.minimaxVolume,
        pitch: selection.minimaxPitch,
        emotion: selection.minimaxEmotion,
        ...(selection.minimaxEnglishNormalization ? { englishNormalization: true } : {}),
        pronunciations: selection.minimaxPronunciations,
      })
    case 'groq':
      return resolveTtsTargetInvocationControls('groq', invocation, {})
    case 'grok':
      return resolveTtsTargetInvocationControls('grok', invocation, {
        language: selection.grokLanguage,
        ...(selection.grokTextNormalization ? { textNormalization: true } : {}),
      })
    case 'mistral':
      return resolveTtsTargetInvocationControls('mistral', invocation, { responseFormat: 'wav' })
    case 'gemini':
      return resolveTtsTargetInvocationControls('gemini', invocation, {})
    case 'deepgram':
      return resolveTtsTargetInvocationControls('deepgram', invocation, {
        speed: selection.deepgramSpeed,
      })
    case 'speechify': {
      const controls = resolveTtsTargetInvocationControls('speechify', invocation, {
        language: selection.speechifyLanguage,
      })
      const language = validateSpeechifyTtsLanguageForModel(
        validateSpeechifyTtsModel(target.model),
        controls.language
      )
      return Object.freeze({
        ...controls,
        ...(language ? { language } : {}),
      })
    }
    case 'hume':
      return resolveTtsTargetInvocationControls('hume', invocation, {})
    case 'cartesia':
      return resolveTtsTargetInvocationControls('cartesia', invocation, { language: selection.cartesiaLanguage })
    case 'fish':
      return resolveTtsTargetInvocationControls('fish', invocation, {})
    case 'inworld':
      return resolveTtsTargetInvocationControls('inworld', invocation, {
        steeringPrompt: selection.inworldInstructions,
      })
    case 'deepinfra':
      return resolveTtsTargetInvocationControls('deepinfra', invocation, {})
    case 'replicate':
      return resolveTtsTargetInvocationControls('replicate', invocation, {})
    case 'fal':
      return resolveTtsTargetInvocationControls('fal', invocation, { voiceInstruction: selection.falInstructions })
  }
}

export const serializerContract = (
  target: TtsTarget,
  voiceValue: string,
  effectiveControls: Readonly<Record<string, unknown>>,
  strategy: ProviderRenderStrategy = 'segmented'
): { endpointKind: string, serializerVersion: string, controls: unknown } => {
  const stringValue = (key: string): string | undefined => typeof effectiveControls[key] === 'string' ? effectiveControls[key] : undefined
  const numberValue = (key: string): number | undefined => typeof effectiveControls[key] === 'number' ? effectiveControls[key] : undefined
  const booleanValue = (key: string): boolean | undefined => typeof effectiveControls[key] === 'boolean' ? effectiveControls[key] : undefined
  const stringArray = (key: string): readonly string[] | undefined => {
    const value = effectiveControls[key]
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined
  }
  switch (target.service) {
    case 'openai':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'openai.tts.phase-0-v1', controls: { responseFormat: 'wav', ...(stringValue('instructions') ? { instructions: stringValue('instructions') } : {}), ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}) } }
    case 'grok':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'grok.tts.phase-0-v1', controls: { language: stringValue('language') ?? 'auto', textNormalization: booleanValue('textNormalization') === true, outputFormat: { codec: 'wav', sample_rate: 24000 } } }
    case 'groq':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'groq.tts.phase-0-v1', controls: { responseFormat: 'wav', ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}) } }
    case 'cartesia':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'cartesia.tts.phase-0-v1', controls: { ...(stringValue('language') ? { language: stringValue('language') } : {}), outputFormat: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 }, version: '2026-03-01' } }
    case 'hume':
      if (strategy === 'native-utterances') return { endpointKind: 'native-utterance-synthesis', serializerVersion: 'hume.native-utterances.phase-3-v1', controls: { version: '2', format: { type: 'mp3' }, numGenerations: 1, includeTimestampTypes: ['word', 'phoneme'] } }
      return { endpointKind: 'speech-synthesis', serializerVersion: 'hume.tts.phase-0-v1', controls: { version: target.model === 'octave-1' ? '1' : '2', format: { type: 'mp3' }, numGenerations: 1, ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}), ...(numberValue('trailingSilence') !== undefined ? { trailingSilence: numberValue('trailingSilence') } : {}), ...(stringValue('description') ? { description: stringValue('description') } : {}) } }
    case 'speechify':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'speechify.tts.phase-0-v1', controls: { audioFormat: 'wav', ...(stringValue('language') ? { language: stringValue('language') } : {}) } }
    case 'deepgram':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'deepgram.tts.phase-0-v1', controls: { encoding: 'linear16', container: 'wav', ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}) } }
    case 'fish':
      if (strategy === 'native-dialogue') return { endpointKind: 'text-to-speech-stream-with-timestamps', serializerVersion: FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION, controls: { format: 'wav', model: 's2.1-pro' } }
      if (isFishTimestampModel(target.model)) return { endpointKind: 'text-to-speech-stream-with-timestamps', serializerVersion: FISH_TIMESTAMP_SERIALIZER_VERSION, controls: { format: 'wav', model: target.model } }
      return { endpointKind: 'speech-synthesis', serializerVersion: FISH_TTS_SERIALIZER_VERSION, controls: { format: 'wav' } }
    case 'inworld': {
      const steeringPrompt = stringValue('steeringPrompt')
      return { endpointKind: 'realtime-tts', serializerVersion: INWORLD_TTS_SERIALIZER_VERSION, controls: { format: 'wav', timestampType: 'WORD', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 }, ...(steeringPrompt ? { steeringPrompt } : {}) } }
    }
    case 'deepinfra':
      return { endpointKind: 'inference', serializerVersion: DEEPINFRA_TTS_SERIALIZER_VERSION, controls: resolveDeepinfraTtsRequestControls(target.model, stringValue('promptInstructions')) }
    case 'replicate':
      return { endpointKind: 'predictions', serializerVersion: 'replicate.kokoro.v1', controls: { format: 'wav', ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}) } }
    case 'fal':
      return { endpointKind: 'queue', serializerVersion: FAL_TTS_SERIALIZER_VERSION, controls: { format: 'wav', ...(stringValue('voiceInstruction') ? { voiceInstruction: stringValue('voiceInstruction') } : {}) } }
    case 'elevenlabs': {
      if (strategy === 'native-dialogue') return {
        endpointKind: 'text-to-dialogue-with-timestamps',
        serializerVersion: 'elevenlabs.dialogue.phase-3-v1',
        controls: {
          outputFormat: ELEVENLABS_TTS_OUTPUT_FORMAT,
          modelId: 'eleven_v3',
          ...(stringValue('languageCode') ? { languageCode: stringValue('languageCode') } : {}),
          ...(numberValue('seed') !== undefined ? { seed: numberValue('seed') } : {}),
          ...(stringValue('textNormalization') ? { textNormalization: stringValue('textNormalization') } : {})
        }
      }
      const voiceSettings = {
        ...(numberValue('stability') !== undefined ? { stability: numberValue('stability') } : {}),
        ...(numberValue('similarityBoost') !== undefined ? { similarity_boost: numberValue('similarityBoost') } : {}),
        ...(numberValue('style') !== undefined ? { style: numberValue('style') } : {}),
        ...(booleanValue('useSpeakerBoost') !== undefined ? { use_speaker_boost: booleanValue('useSpeakerBoost') } : {}),
        ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}),
      }
      const pronunciationDictionaryLocators = stringArray('pronunciationDictionaryLocators')?.map((value) => {
        const [rawId, rawVersion] = value.split(':', 2)
        const id = rawId?.trim()
        const version = rawVersion?.trim()
        if (!id) throw CLIUsageError('Invalid ElevenLabs pronunciation dictionary locator in immutable TTS controls.')
        return { pronunciation_dictionary_id: id, ...(version ? { version_id: version } : {}) }
      })
      return {
        endpointKind: 'speech-synthesis',
        serializerVersion: 'elevenlabs.tts.phase-0-v1',
        controls: {
          outputFormat: ELEVENLABS_TTS_OUTPUT_FORMAT,
          ...(stringValue('languageCode') ? { languageCode: stringValue('languageCode') } : {}),
          ...(Object.keys(voiceSettings).length > 0 ? { voiceSettings } : {}),
          ...(numberValue('seed') !== undefined ? { seed: numberValue('seed') } : {}),
          ...(stringValue('textNormalization') ? { textNormalization: stringValue('textNormalization') } : {}),
          ...(pronunciationDictionaryLocators?.length ? { pronunciationDictionaryLocators } : {}),
        }
      }
    }
    case 'gemini':
      return { endpointKind: 'generate-content-audio', serializerVersion: 'gemini.tts.phase-0-v1', controls: { responseModalities: ['AUDIO'], ...(stringValue('languageCode') ? { languageCode: stringValue('languageCode') } : {}) } }
    case 'mistral':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'mistral.tts.phase-0-v1', controls: { stream: false, responseFormat: stringValue('responseFormat') ?? 'wav' } }
    case 'minimax': {
      const voiceSetting = { voice_id: voiceValue, ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}), ...(numberValue('volume') !== undefined ? { vol: numberValue('volume') } : {}), ...(numberValue('pitch') !== undefined ? { pitch: numberValue('pitch') } : {}), ...(stringValue('emotion') ? { emotion: stringValue('emotion') } : {}), ...(booleanValue('englishNormalization') === true ? { english_normalization: true } : {}) }
      const pronunciationRules = stringArray('pronunciations')?.map((item) => item.trim()).filter(Boolean)
      return { endpointKind: 'async-speech-synthesis-create', serializerVersion: 'minimax.tts.phase-0-v1', controls: { ...(stringValue('languageBoost') ? { languageBoost: stringValue('languageBoost') } : {}), voiceSetting, audioSetting: { format: 'mp3', audio_sample_rate: 32000, channel: 1 }, ...(pronunciationRules?.length ? { pronunciationRules } : {}) } }
    }
  }
}

export const serializerVoiceField = (
  target: TtsTarget,
  strategy: ProviderRenderStrategy,
  voiceKind: AttemptTurn['voice']['kind']
): string => {
  switch (target.service) {
    case 'openai': return 'voice'
    case 'grok': return 'voice_id'
    case 'groq': return 'voice'
    case 'cartesia': return 'voice.id'
    case 'hume': return strategy === 'native-utterances' ? 'utterances[].voice.id' : 'utterances[].voice'
    case 'speechify': return 'voice_id'
    case 'deepgram': return 'query.model'
    case 'elevenlabs': return strategy === 'native-dialogue' ? 'inputs[].voice_id' : 'path.voice_id'
    case 'gemini': return strategy === 'native-dialogue' ? 'speechConfig.multiSpeakerVoiceConfig' : 'speechConfig.voiceConfig'
    case 'mistral': return voiceKind === 'reference-asset' ? 'ref_audio' : 'voice_id'
    case 'minimax': return 'voice_setting.voice_id'
    case 'fish': return strategy === 'native-dialogue' ? 'reference_id[]' : 'reference_id'
    case 'inworld': return 'voiceId'
    case 'deepinfra': return resolveDeepinfraTtsVoiceField(target.model)
    case 'replicate': return 'input.voice'
    case 'fal': return resolveFalTtsVoiceField(target.model as FalTtsModel)
  }
}

export const sanitizeError = (error: unknown, phase: SanitizedProviderError['phase']): SanitizedProviderError => {
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? sanitizeLogText(metadata['stage']).slice(0, 160) : undefined
  const errorName = error instanceof Error && error.name ? sanitizeLogText(error.name).slice(0, 120) : undefined
  const providerMessage = error instanceof Error && error.message
    ? sanitizeLogText(error.message).replace(/\s+/gu, ' ').trim().slice(0, 600)
    : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const requestId = headers?.get('x-request-id') ?? headers?.get('request-id') ?? headers?.get('cf-ray') ?? undefined
  const retryAfterMs = parseRetryAfterMs(headers)
  const explicitRetryable = typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined
  const message = status !== undefined
    ? `TTS provider request failed with HTTP status ${status}.`
    : phase === 'static-validation'
      ? 'TTS target validation failed before provider dispatch.'
      : phase === 'readiness'
        ? 'TTS execution readiness failed before provider dispatch.'
        : phase === 'admission'
          ? 'TTS provider request admission failed.'
          : phase === 'selection'
            ? 'TTS take selection failed.'
            : phase === 'assembly'
              ? 'TTS audio assembly failed.'
              : phase === 'reconciliation'
                ? 'TTS retained provider evidence reconciliation failed.'
                : 'TTS provider synthesis failed.'
  const retryable = explicitRetryable ?? (status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500))
  return {
    phase,
    code: status ? `http_${status}` : typeof metadata['code'] === 'string' ? sanitizeLogText(metadata['code']).slice(0, 120) : 'tts_target_failed',
    message,
    retryable,
    ...(status !== undefined ? { status } : {}),
    ...(stage ? { stage } : {}),
    ...(errorName ? { errorName } : {}),
    ...(providerMessage ? { providerMessage } : {}),
    ...(requestId ? { requestId: sanitizeLogText(requestId).slice(0, 200) } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
  }
}

export const plannedCost = (target: TtsTarget, characters: number, includeSetup: boolean): PlannedCost => {
  const pricing = getTtsPricing(target.service, target.model)
  const cents = pricing.costPerRequestCents !== undefined
    ? pricing.costPerRequestCents
    : pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    ? characters / 1e6 * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents)
    : characters / 1000 * (pricing.costPer1kCharsCents ?? 0)
  const totalCents = cents + (includeSetup ? target.setupCostCents ?? 0 : 0)
  return totalCents === 0 ? { amounts: [] } : { amounts: [{ amount: totalCents / 100, currency: 'USD' }] }
}

export const buildCapabilityFixture = (
  target: TtsTarget,
  transport: string,
  strategy: ProviderRenderStrategy
): CapabilityFixture => {
  const feature = strategy === 'native-dialogue'
    ? 'native-dialogue' as const
    : strategy === 'native-utterances'
      ? 'native-utterances' as const
      : 'turn-synthesis' as const
  const scope = { provider: target.service, feature, model: target.model, transport }
  const documentationEvidence = withIdentity({
    checkedAt: CAPABILITY_CHECKED_AT,
    sourceRefs: CAPABILITY_SOURCE_REFS[target.service]
  }, 'evidenceHash')
  const hasProtectedSpeakerAssets = Object.keys(target.protectedSpeakerVoiceAssets ?? {}).length > 0
  const voiceKinds = target.protectedVoiceAsset
    ? ['reference-asset' as const]
    : hasProtectedSpeakerAssets
      ? ['provider-id' as const, 'reference-asset' as const]
      : ['provider-id' as const]
  const constraints = feature === 'native-dialogue'
    ? target.service === 'elevenlabs'
      ? { voiceKinds, maxCharacters: 2000, supportedOutputFormats: ['mp3', 'wav', 'pcm'], minSpeakers: 1, maxSpeakers: 10 }
      : { voiceKinds, maxCharacters: chunkLimit(target), supportedOutputFormats: ['wav'], minSpeakers: 2, maxSpeakers: 2 }
    : feature === 'native-utterances'
      ? { voiceKinds, maxCharacters: target.service === 'hume' ? 5000 : chunkLimit(target), supportedOutputFormats: ['mp3', 'wav', 'pcm'], maxTakesPerRequest: target.service === 'hume' ? 5 : 1 }
      : { voiceKinds, maxCharacters: chunkLimit(target), supportedOutputFormats: ['wav'] }
  const record = {
    scope,
    maturity: target.service === 'gemini' || target.service === 'groq' ? 'preview' as const : 'stable' as const,
    channel: 'api' as const,
    adapterSupport: 'implemented' as const,
    requirements: [],
    constraints,
    documentationEvidence
  } as AnyCapabilityRecord
  validateCapabilityFacetSet([record])
  const base = { schemaVersion: 1 as const, records: [record] }
  return {
    ...base,
    capabilityFixtureHash: hashCanonicalTtsValue(base),
    capabilityScopeHash: hashCanonicalTtsValue(scope)
  }
}

export const voiceBinding = (target: TtsTarget, kind: AttemptTurn['voice']['kind'], value: string, settings: TypedProviderSynthesisSettings, capabilityFixtureHash: string, protectedAsset?: ProtectedAssetRef | undefined): { voice: AttemptTurn['voice'], binding: Extract<ResolvedVoiceBinding, { kind: 'transient-provider-voice' }> } => {
  const activeProtectedAsset = protectedAsset ?? target.protectedVoiceAsset
  const valueHash = kind === 'reference-asset' ? activeProtectedAsset?.sha256 ?? sha256Bytes(value) : sha256Bytes(value)
  const voice = { kind, ...(kind === 'reference-asset' ? {} : { value }), valueHash }
  const providerVoice = kind === 'reference-asset'
    ? activeProtectedAsset
      ? { kind: 'reference-asset' as const, provider: target.service, protectedAsset: activeProtectedAsset, origin: 'request-reference-audio' as const, authorizationRef: 'explicit-cli:mistral-request-reference-v1' }
      : (() => { throw CLIUsageError('Reference-audio synthesis requires a protected asset before render planning.') })()
    : kind === 'local-model-voice'
      ? { kind: 'local-model-voice' as const, provider: target.service, model: target.model, voiceLocator: value, origin: 'local-model-voice' as const }
      : { kind: 'remote-resource' as const, provider: target.service, resourceId: value, namespace: 'provider' as const, origin: 'provider-stock' as const, ownership: 'provider' as const, deletion: { state: 'provider-managed' as const, checkedAt: EPOCH } }
  const identityHash = hashCanonicalTtsValue({ providerVoice, providerModel: target.model, synthesisSettings: settings })
  return {
    voice,
    binding: { kind: 'transient-provider-voice', providerVoice, providerModel: target.model, identityHash, settingsSchema: settings.settingsSchema, synthesisSettings: settings, capabilityFixtureHash }
  }
}

export const flattenPlanTurns = (plan: GenericTtsDialoguePlan | ComicDialoguePlan): CanonicalDialogueTurn[] =>
  plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)

export const bindingIdentityHash = (binding: ResolvedVoiceBinding): string =>
  binding.kind === 'approved-snapshot' ? binding.entryHash : binding.identityHash

export const requestedOutput = (options: Pick<CreateCurrentTtsRenderAttemptOptions, 'ttsOptions'>) => options.ttsOptions.ttsMasteringProfile
  ? {
      codec: options.ttsOptions.ttsMasteringProfile.codec,
      container: options.ttsOptions.ttsMasteringProfile.container,
      sampleRate: options.ttsOptions.ttsMasteringProfile.sampleRate,
      channels: options.ttsOptions.ttsMasteringProfile.channels,
    }
  : REQUESTED_OUTPUT

export const defaultVoiceValue = (target: TtsTarget): string => {
  switch (target.service) {
    case 'openai': return 'alloy'
    case 'gemini': return 'Kore'
    case 'deepgram': return target.model
    case 'grok': return 'eve'
    case 'minimax': return 'English_expressive_narrator'
    case 'hume': return 'Male English Actor'
    case 'cartesia': return 'f786b574-daa5-4673-aa0c-cbe3e8534c02'
    case 'fish': return '7f92f8afb8ec43bf81429cc1c9199cb1'
    case 'elevenlabs': return ELEVENLABS_DEFAULT_VOICE_ID
    case 'speechify': return SPEECHIFY_DEFAULT_TTS_VOICE
    default: return 'provider-default'
  }
}

const resolveComicTurns = (
  options: CreateCurrentTtsRenderAttemptOptions,
  context: NonNullable<CreateCurrentTtsRenderAttemptOptions['comicContext']>,
  canonicalTurns: ReturnType<typeof flattenPlanTurns>,
  normalizedTurnControls: ReturnType<typeof normalizeTtsTurnControls>,
  selection: TtsTargetSelection,
  entriesById: Map<string, (typeof context.voiceSnapshot.entries)[number]>
): AttemptTurn[] => {
  return canonicalTurns.map((canonical, sourceIndex) => {
    const entryId = context.snapshotEntryIdByTurnId[canonical.turnId]
    const entry = entryId ? entriesById.get(entryId) : undefined
    if (!entry || entry.provider !== options.target.service || entry.providerModel !== options.target.model || entry.subjectKey !== canonical.subjectKey) {
      throw CLIUsageError(`Comic turn ${canonical.turnId} has no exact approved snapshot binding for ${options.target.service}/${options.target.model}.`)
    }
    const providerVoice = entry.providerVoice
    if (providerVoice.provider !== options.target.service) throw CLIUsageError(`Comic snapshot voice for ${canonical.turnId} belongs to another provider.`)
    if (providerVoice.kind === 'shared-library-resource') throw CLIUsageError(`Comic snapshot voice for ${canonical.turnId} must be imported into an account resource before synthesis.`)
    const protectedAsset = providerVoice.kind === 'reference-asset' ? providerVoice.protectedAsset : undefined
    const voice = providerVoice.kind === 'reference-asset'
      ? { kind: 'reference-asset' as const, valueHash: providerVoice.protectedAsset.sha256 }
      : providerVoice.kind === 'local-model-voice'
        ? { kind: 'local-model-voice' as const, value: providerVoice.voiceLocator, valueHash: sha256Bytes(providerVoice.voiceLocator) }
        : { kind: 'provider-id' as const, value: providerVoice.resourceId, valueHash: sha256Bytes(providerVoice.resourceId) }
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: canonical.turnId,
      sourceIndex,
      speaker: context.providerSpeakerLabelByTurnId[canonical.turnId] ?? canonical.originalSpeakerLabel,
      voice: Object.freeze(providerVoice.kind === 'reference-asset'
        ? { kind: 'ref-audio' as const, value: `ref_audio:${providerVoice.protectedAsset.assetId}`, protectedAsset: providerVoice.protectedAsset, authorizationRef: providerVoice.authorizationRef }
        : { kind: 'id' as const, value: voice.value as string }),
      controls: resolveTtsTurnControlOverrides(options.target.service, canonical.turnId, normalizedTurnControls)
    })
    const effectiveControls = resolveEffectiveInvocationControls(options.target, invocation, selection)
    const controls = typedSettings(options.target, effectiveControls, protectedAsset)
    const binding: Extract<ResolvedVoiceBinding, { kind: 'approved-snapshot' }> = {
      kind: 'approved-snapshot',
      snapshotId: context.voiceSnapshot.snapshotId,
      entryId: entry.entryId,
      entryHash: entry.entryHash,
      providerVoice,
      providerModel: entry.providerModel,
      ...(entry.providerRevision ? { providerRevision: entry.providerRevision } : {}),
      settingsSchema: entry.settingsSchema,
      synthesisSettings: entry.synthesisSettings,
      capabilityFixtureHash: entry.capabilityFixtureHash,
    }
    return { sourceIndex, canonical, voice, binding, controls, effectiveControls }
  })
}

const resolveComicNativeGroups = (
  options: CreateCurrentTtsRenderAttemptOptions,
  context: NonNullable<CreateCurrentTtsRenderAttemptOptions['comicContext']>,
  turns: AttemptTurn[],
  normalizedText: string,
  registry: ReturnType<typeof parseSpeakerVoiceMappings>,
  limit: number,
  geminiNative: boolean,
  elevenLabsNative: boolean,
  humeNative: boolean,
  fishNative: boolean
): Array<{ turnIds: string[], providerTexts: string[] }> => {
  if (geminiNative) {
    let nativeTurnCursor = 0
    const groups = splitGeminiNativeDialogueText(normalizedText, registry, limit).map((providerText) => {
      const chunkDialogue = normalizeDialogueText(providerText, resolveDialogueFormat(options.ttsOptions), registry)
      const groupedTurns = turns.slice(nativeTurnCursor, nativeTurnCursor + chunkDialogue.turns.length)
      if (groupedTurns.length !== chunkDialogue.turns.length || groupedTurns.some((turn, index) => turn.canonical.canonicalText !== chunkDialogue.turns[index]?.text)) {
        throw CLIUsageError('Gemini comic native partition did not preserve exact turn boundaries.')
      }
      nativeTurnCursor += groupedTurns.length
      return { turnIds: groupedTurns.map(turn => turn.canonical.turnId), providerTexts: [providerText] }
    })
    if (nativeTurnCursor !== turns.length) throw CLIUsageError('Gemini comic native partition omitted turns.')
    return groups
  }
  if (elevenLabsNative) {
    return planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (humeNative) {
    return planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (fishNative) {
    return planFishNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash, delivery: turn.canonical.delivery?.description }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  return []
}

export const planComicInputs = (options: CreateCurrentTtsRenderAttemptOptions, _capabilityFixtureHash?: string): PlannedInputs => {
  const context = options.comicContext!
  if (context.operation !== 'comic-audio') throw CLIUsageError('Comic render context requires operation comic-audio.')
  if (canonicalTtsJson(context.sourceIdentity) !== canonicalTtsJson(context.dialoguePlan.sourceIdentity)) throw CLIUsageError('Comic dialogue plan does not bind the exact source identity.')
  if (context.dialoguePlan.dialoguePlanId !== hashCanonicalTtsValue({
    schemaVersion: context.dialoguePlan.schemaVersion,
    sceneRunIdentity: context.dialoguePlan.sceneRunIdentity,
    sourceIdentity: context.dialoguePlan.sourceIdentity,
    structuredScript: context.dialoguePlan.structuredScript,
    createdAt: context.dialoguePlan.createdAt,
    pacing: context.dialoguePlan.pacing,
    nodes: context.dialoguePlan.nodes,
  })) throw CLIUsageError('Comic dialogue plan identity is invalid.')
  if (context.voiceSnapshot.dialoguePlanId !== context.dialoguePlan.dialoguePlanId || context.voiceSnapshot.sceneRunIdentity !== context.dialoguePlan.sceneRunIdentity) throw CLIUsageError('Comic voice snapshot does not bind the selected scene/dialogue plan.')

  const canonicalTurns = flattenPlanTurns(context.dialoguePlan)
  const normalizedTurnControls = normalizeTtsTurnControls(
    options.ttsOptions.ttsTurnControls,
    canonicalTurns.map(turn => turn.turnId)
  )
  const selection = createTtsTargetSelection(options.ttsOptions)
  const entriesById = new Map(context.voiceSnapshot.entries.map(entry => [entry.entryId, entry] as const))
  const turns = resolveComicTurns(options, context, canonicalTurns, normalizedTurnControls, selection, entriesById)

  const registry = parseSpeakerVoiceMappings(options.ttsOptions.ttsSpeakers)
  const normalizedText = canonicalTurns.map(turn => `${context.providerSpeakerLabelByTurnId[turn.turnId] ?? turn.originalSpeakerLabel}: ${turn.canonicalText}`).join('\n')
  const distinctSpeakers = new Set(canonicalTurns.map(turn => (context.providerSpeakerLabelByTurnId[turn.turnId] ?? turn.originalSpeakerLabel).normalize('NFKC').trim().toLocaleUpperCase('en-US')))
  const hasOverlapIntent = context.dialoguePlan.nodes.some(node => node.kind === 'overlap')
  const hasDeliveryOrEffect = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const hasSegmentedOnlyIntent = hasOverlapIntent || (hasDeliveryOrEffect && options.target.service !== 'fish')
  const hasTurnControls = canonicalTurns.some(turn => {
    const keys = Object.keys(normalizedTurnControls?.[turn.turnId]?.[options.target.service] ?? {})
    return keys.length > 0 && !(options.target.service === 'hume' && keys.every(key => key === 'speed' || key === 'trailingSilence'))
  })
  const geminiNative = options.target.service === 'gemini'
    && distinctSpeakers.size === 2
    && !hasTurnControls
    && resolveGeminiDialogueStrategyForText(normalizedText, registry, TTS_CHUNK_CHARACTER_LIMITS.gemini, 'auto') === 'native'
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && !hasTurnControls
  const humeNative = options.target.service === 'hume' && options.target.model === 'octave-2' && !hasTurnControls && canonicalTurns.reduce((sum, turn) => sum + [...turn.canonicalText].length, 0) <= 5000
  const fishNative = options.target.service === 'fish' && isFishNativeDialogueModel(options.target.model) && !hasTurnControls
  const nativeEligible = canonicalTurns.length > 0 && !hasSegmentedOnlyIntent && (geminiNative || elevenLabsNative || humeNative || fishNative)
  if (context.modePreference === 'native' && !nativeEligible) throw CLIUsageError('Comic native mode requires a provider-native eligible target whose speaker, direction, control, and request limits can be represented exactly.')
  const native = context.modePreference !== 'segmented' && nativeEligible
  const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
  const limit = chunkLimit(options.target)

  const nativeGroups = native
    ? resolveComicNativeGroups(options, context, turns, normalizedText, registry, limit, geminiNative, elevenLabsNative, humeNative, fishNative)
    : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[], timingSegmentIndexes?: number[] | undefined }> = native
    ? nativeGroups
    : turns.map(turn => segmentedSlotGroup(turn, options.target))

  let includesSetup = true
  const slots: AttemptSlot[] = []
  const batches = slotGroups.map((group, batchIndex) => {
    const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
    const primaryTurn = turns.find(turn => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
    const contract = serializerContract(options.target, primaryTurn.voice.value ?? primaryTurn.voice.valueHash, primaryTurn.effectiveControls, strategy)
    const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
      const cost = plannedCost(options.target, [...providerText].length, includesSetup)
      includesSetup = false
      const timingSegmentIndex = group.timingSegmentIndexes?.[slotIndex]
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion, expectedVoiceField: serializerVoiceField(options.target, strategy, primaryTurn.voice.kind), ...(timingSegmentIndex !== undefined ? { timingSegmentIndex } : {}) }
      slots.push(slot)
      return { generationSlotId: slot.generationSlotId, slotIndex, requestedTakeCount: 1, plannedCost: cost }
    })
    const requestControls = requestSettings(primaryTurn.controls)
    requestControls.values['serializerControlsHash'] = hashCanonicalTtsValue(contract.controls)
    return { batchId, orderedTurnIds: group.turnIds, requestControls, generationSlots, takeSelectionPolicy: 'sole-take' as const, continuation: { kind: 'none' as const }, plannedCost: sumCosts(generationSlots.map(slot => slot.plannedCost)) }
  })
  if (turns.length === 0 || slots.length === 0) throw CLIUsageError('Comic render planning requires at least one dialogue turn and generation slot.')
  return { sourceIdentity: context.sourceIdentity, dialoguePlan: context.dialoguePlan, turns, batches, slots, strategy, normalizedText }
}

const resolveGenericTurns = (
  options: CreateCurrentTtsRenderAttemptOptions,
  dialoguePlan: ReturnType<typeof createGenericTtsDialoguePlan>,
  capabilityFixtureHash: string,
  registry: ReturnType<typeof parseSpeakerVoiceMappings> | undefined,
  normalizedTurnControls: ReturnType<typeof normalizeTtsTurnControls>,
  selection: TtsTargetSelection
): AttemptTurn[] => {
  const canonicalTurns = flattenPlanTurns(dialoguePlan)
  return canonicalTurns.map((canonical, sourceIndex) => {
    const mapping = registry ? getSpeakerVoice(registry, canonical.originalSpeakerLabel) : undefined
    const value = mapping?.voice ?? options.target.voice?.trim() ?? defaultVoiceValue(options.target)
    const protectedAsset = mapping?.voiceKind === 'ref-audio'
      ? options.target.protectedSpeakerVoiceAssets?.[mapping.normalizedSpeaker]
      : !mapping
        ? options.target.protectedVoiceAsset
        : undefined
    if (
      mapping?.voiceKind === 'ref-audio'
      && (!protectedAsset || mapping.voice !== `ref_audio:${protectedAsset.assetId}`)
    ) {
      throw CLIUsageError(`Reference-audio speaker ${mapping.speaker} does not bind its exact protected asset before render planning.`)
    }
    const kind = mapping?.voiceKind === 'ref-audio' || (!mapping && options.target.protectedVoiceAsset)
      ? 'reference-asset'
      : 'provider-id'
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: canonical.turnId,
      sourceIndex,
      speaker: canonical.originalSpeakerLabel,
      voice: Object.freeze(mapping?.voiceKind === 'ref-audio'
        ? {
            kind: 'ref-audio' as const,
            value,
            ...(protectedAsset ? { protectedAsset, authorizationRef: 'explicit-cli:mistral-request-reference-v1' } : {})
          }
        : { kind: 'id' as const, value }),
      controls: resolveTtsTurnControlOverrides(options.target.service, canonical.turnId, normalizedTurnControls)
    })
    const effectiveControls = resolveEffectiveInvocationControls(options.target, invocation, selection)
    const settings = typedSettings(options.target, effectiveControls, protectedAsset)
    const bound = voiceBinding(options.target, kind, value, settings, capabilityFixtureHash, protectedAsset)
    return { sourceIndex, canonical, ...bound, controls: settings, effectiveControls }
  })
}

const resolveGenericNativeGroups = (
  options: CreateCurrentTtsRenderAttemptOptions,
  turns: AttemptTurn[],
  registry: ReturnType<typeof parseSpeakerVoiceMappings>,
  limit: number,
  geminiNative: boolean,
  elevenLabsNative: boolean,
  humeNative: boolean,
  fishNative: boolean,
  normalizedDialogue: ReturnType<typeof normalizeDialogueFromOptions> | undefined
): Array<{ turnIds: string[], providerTexts: string[] }> => {
  if (geminiNative) {
    let nativeTurnCursor = 0
    const groups = splitGeminiNativeDialogueText(normalizedDialogue?.normalizedText ?? '', registry, limit).map((providerText) => {
      const chunkDialogue = normalizeDialogueText(providerText, resolveDialogueFormat(options.ttsOptions), registry)
      const groupedTurns = turns.slice(nativeTurnCursor, nativeTurnCursor + chunkDialogue.turns.length)
      if (
        groupedTurns.length !== chunkDialogue.turns.length
        || groupedTurns.some((turn, index) => turn.canonical.canonicalText !== chunkDialogue.turns[index]?.text || turn.canonical.subjectKey !== chunkDialogue.turns[index]?.speaker)
      ) throw CLIUsageError('Gemini native dialogue partition did not preserve exact normalized turn boundaries.')
      nativeTurnCursor += groupedTurns.length
      return { turnIds: groupedTurns.map((turn) => turn.canonical.turnId), providerTexts: [providerText] }
    })
    if (nativeTurnCursor !== turns.length) throw CLIUsageError('Gemini native dialogue partition omitted normalized turns.')
    return groups
  }
  if (elevenLabsNative) {
    return planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (humeNative) {
    return planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (fishNative) {
    return planFishNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice, delivery: turn.canonical.delivery?.description }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  return []
}

export const planGenericInputs = (options: CreateCurrentTtsRenderAttemptOptions, capabilityFixtureHash: string): PlannedInputs => {
  const fallbackSource = createInlineTtsSourceIdentity(options.sourceText)
  const sourceIdentity = options.sourceIdentity ?? fallbackSource
  if (sourceIdentity.sourceKind === 'inline' && sourceIdentity.contentSha256 !== sha256Bytes(options.sourceText)) {
    throw CLIUsageError('Generic inline TTS source identity does not match the exact selected source bytes.')
  }
  validateGenericTtsSourceIdentity(sourceIdentity)
  const expectedPlan = isMultiSpeakerRequested(options.ttsOptions)
    ? createGenericTtsDialoguePlan(sourceIdentity, options.sourceText, options.ttsOptions, EPOCH)
    : createSingleTurnTtsDialoguePlan(sourceIdentity, options.sourceText, EPOCH)
  const dialoguePlan = options.dialoguePlan ?? expectedPlan
  validateGenericTtsDialoguePlan(dialoguePlan)
  if (canonicalTtsJson(dialoguePlan.sourceIdentity) !== canonicalTtsJson(sourceIdentity)) throw CLIUsageError('Generic TTS dialogue plan does not bind the exact supplied source identity.')
  if (canonicalTtsJson(dialoguePlan.nodes) !== canonicalTtsJson(expectedPlan.nodes)) throw CLIUsageError('Generic TTS dialogue plan does not exactly match normalized turn IDs, source indexes, speakers, text, delivery, and effects.')

  const registry = isMultiSpeakerRequested(options.ttsOptions) ? parseSpeakerVoiceMappings(options.ttsOptions.ttsSpeakers) : undefined
  const canonicalTurns = flattenPlanTurns(dialoguePlan)
  const normalizedTurnControls = normalizeTtsTurnControls(
    options.ttsOptions.ttsTurnControls,
    canonicalTurns.map((turn) => turn.turnId)
  )
  const hasProviderTurnControls = canonicalTurns.some((turn) => {
    const keys = Object.keys(normalizedTurnControls?.[turn.turnId]?.[options.target.service] ?? {})
    return keys.length > 0 && !(options.target.service === 'hume' && keys.every(key => key === 'speed' || key === 'trailingSilence'))
  })
  const selection = createTtsTargetSelection(options.ttsOptions)
  const turns = resolveGenericTurns(options, dialoguePlan, capabilityFixtureHash, registry, normalizedTurnControls, selection)

  const normalizedDialogue = registry ? normalizeDialogueFromOptions(options.sourceText, options.ttsOptions) : undefined
  const hasNativeBlockingIntent = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const geminiNative = options.target.service === 'gemini' && registry
    ? !hasProviderTurnControls && !hasNativeBlockingIntent && resolveGeminiDialogueStrategyForText(normalizedDialogue?.normalizedText ?? '', registry, TTS_CHUNK_CHARACTER_LIMITS.gemini, 'auto') === 'native'
    : false
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent
  const humeNative = options.target.service === 'hume' && options.target.model === 'octave-2' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent && canonicalTurns.reduce((sum, turn) => sum + [...turn.canonicalText].length, 0) <= 5000
  const fishNative = options.target.service === 'fish' && isFishNativeDialogueModel(options.target.model) && registry !== undefined && !hasProviderTurnControls
  const native = geminiNative || elevenLabsNative || humeNative || fishNative
  const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
  const limit = chunkLimit(options.target)

  const nativeGroups = native && registry
    ? resolveGenericNativeGroups(options, turns, registry, limit, geminiNative, elevenLabsNative, humeNative, fishNative, normalizedDialogue)
    : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[] }> = native
    ? nativeGroups
    : turns.map((turn) => ({ turnIds: [turn.canonical.turnId], providerTexts: splitTextIntoChunks(prepareSegmentedTurnText(turn.canonical.canonicalText, options.target, turn.canonical.delivery?.description).providerText, limit) }))

  let includesSetup = true
  const slots: AttemptSlot[] = []
  const batches = slotGroups.map((group, batchIndex) => {
    const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
    const primaryTurn = turns.find((turn) => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
    const primaryVoiceValue = primaryTurn.voice.value ?? primaryTurn.voice.valueHash
    const contract = serializerContract(options.target, primaryVoiceValue, primaryTurn.effectiveControls, strategy)
    const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
      const cost = plannedCost(options.target, [...providerText].length, includesSetup)
      includesSetup = false
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion, expectedVoiceField: serializerVoiceField(options.target, strategy, primaryTurn.voice.kind) }
      slots.push(slot)
      return { generationSlotId: slot.generationSlotId, slotIndex, requestedTakeCount: 1, plannedCost: cost }
    })
    const controls = requestSettings(primaryTurn.controls)
    controls.values['serializerControlsHash'] = hashCanonicalTtsValue(contract.controls)
    const amountByCurrency = new Map<string, number>()
    for (const slot of generationSlots) for (const amount of slot.plannedCost.amounts) amountByCurrency.set(amount.currency, (amountByCurrency.get(amount.currency) ?? 0) + amount.amount)
    return { batchId, orderedTurnIds: group.turnIds, requestControls: controls, generationSlots, takeSelectionPolicy: 'sole-take' as const, continuation: { kind: 'none' as const }, plannedCost: { amounts: [...amountByCurrency].map(([currency, amount]) => ({ currency, amount })) } }
  })
  if (turns.length === 0 || slots.length === 0) throw CLIUsageError('TTS render planning requires at least one normalized turn and generation slot.')
  return { sourceIdentity, dialoguePlan, turns, batches, slots, strategy, normalizedText: normalizedDialogue?.normalizedText ?? options.sourceText }
}

export const planInputs = (options: CreateCurrentTtsRenderAttemptOptions, capabilityFixtureHash: string): PlannedInputs => {
  return options.comicContext
    ? planComicInputs(options, capabilityFixtureHash)
    : planGenericInputs(options, capabilityFixtureHash)
}


export const sumCosts = (costs: readonly PlannedCost[]): PlannedCost => {
  const amounts = new Map<string, number>()
  for (const cost of costs) for (const entry of cost.amounts) amounts.set(entry.currency, (amounts.get(entry.currency) ?? 0) + entry.amount)
  return { amounts: [...amounts].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amount]) => ({ currency, amount })) }
}

export const buildPureCurrentTtsRenderPlan = (options: PureCurrentTtsRenderPlanOptions): PureCurrentTtsRenderPlan => {
  const operation = options.comicContext ? 'comic-audio' as const : 'tts-synthesis' as const
  if (options.target.operation && options.target.operation !== operation) throw CLIUsageError('TTS target operation does not match its render context.')
  const transport = options.target.transport ?? 'hosted-api'
  const targetKey = options.target.targetKey ?? canonicalTargetKey(operation, options.target.service, options.target.model, transport)
  const capabilitySeed = hashCanonicalTtsValue({ schemaVersion: 1, provider: options.target.service, model: options.target.model, transport, adapterSchemaVersion: SCHEMA_VERSION })
  const draft = planInputs({ ...options, outputDir: '.' }, capabilitySeed)
  const capability = buildCapabilityFixture(options.target, transport, draft.strategy)
  const capabilityFixtureHash = capability.capabilityFixtureHash
  const capabilityScopeHash = capability.capabilityScopeHash
  const planned = planInputs({ ...options, outputDir: '.' }, capabilityFixtureHash)
  const voiceContext = options.comicContext
    ? { kind: 'approved-snapshot' as const, snapshotId: options.comicContext.voiceSnapshot.snapshotId }
    : { kind: 'transient' as const, bindingIdentityHashes: planned.turns.map(turn => bindingIdentityHash(turn.binding)) }
  const voiceContextKey = computeVoiceContextKey(options.comicContext
    ? { kind: 'approved-snapshot', snapshotId: options.comicContext.voiceSnapshot.snapshotId }
    : { kind: 'transient', turns: planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, bindingIdentityHash: bindingIdentityHash(turn.binding) })) })
  const requestedAudioOutput = requestedOutput(options)
  const outputProfileHash = hashCanonicalTtsValue(requestedAudioOutput)
  const synthesisSettingsHash = hashCanonicalTtsValue({
    nodes: planned.turns.map((turn) => ({
      turnId: turn.canonical.turnId,
      voiceSynthesisSettings: turn.binding.synthesisSettings,
      providerControls: turn.controls,
      ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description, disposition: options.comicContext?.deliveryDispositionByTurnId?.[turn.canonical.turnId] ?? 'serialized' } } } : {})
    })),
    batchRequestControls: planned.batches.map((batch) => ({ batchId: batch.batchId, requestControls: batch.requestControls }))
  })
  const plannedRenderCost = sumCosts(planned.slots.map((slot) => slot.plannedCost))
  const resolvedTurnById = new Map(planned.turns.map((turn) => [turn.canonical.turnId, {
    ...turn.canonical,
    providerText: prepareSegmentedTurnText(turn.canonical.canonicalText, options.target, turn.canonical.delivery?.description),
    voice: turn.binding,
    providerControls: turn.controls,
    ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1 as const, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description, disposition: options.comicContext?.deliveryDispositionByTurnId?.[turn.canonical.turnId] ?? 'serialized' } } } : {})
  }] as const))
  const resolvedNodes = planned.dialoguePlan.nodes.map((node) => {
    if (node.kind === 'turn') {
      const turn = resolvedTurnById.get(node.turn.turnId)
      if (!turn) throw CLIUsageError(`Provider render plan lost dialogue turn ${node.turn.turnId}.`)
      return { kind: 'turn' as const, turn }
    }
    const turns = node.turns.map((sourceTurn) => {
      const turn = resolvedTurnById.get(sourceTurn.turnId)
      if (!turn) throw CLIUsageError(`Provider render plan lost overlap turn ${sourceTurn.turnId}.`)
      return turn
    })
    return { kind: 'overlap' as const, groupId: node.groupId, turns }
  })
  const branchCandidate = withIdentity({
    strategy: planned.strategy,
    requiredCapabilityScopeHashes: [capabilityScopeHash],
    batchSketches: planned.batches.map((batch) => ({
      orderedTurnIds: batch.orderedTurnIds,
      requestControlsHash: hashCanonicalTtsValue(batch.requestControls),
      generationSlots: batch.generationSlots.map((slot) => ({ slotIndex: slot.slotIndex, requestedTakeCount: slot.requestedTakeCount, plannedCost: slot.plannedCost })),
      takeSelectionPolicy: batch.takeSelectionPolicy,
      continuationPlanHash: hashCanonicalTtsValue(batch.continuation)
    })),
    requestedOutputHash: outputProfileHash,
    plannedCost: plannedRenderCost
  }, 'candidateId') as unknown as ProviderRenderBranchCandidate
  const branchPlan = withIdentity({
    schemaVersion: 1 as const,
    operation,
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    sourceIdentityHash: planned.sourceIdentity.identityHash,
    targetKey,
    voiceContextKey,
    voiceContext,
    provider: options.target.service,
    model: options.target.model,
    transport,
    modePreference: options.comicContext?.modePreference ?? 'auto' as const,
    candidateStrategies: [branchCandidate],
    synthesisSettingsHash,
    outputProfileHash,
    capabilityFixtureHash
  }, 'branchPlanId') as unknown as ProviderRenderBranchPlan
  const textArtifactSha = (value: string): string => sha256Bytes(value.endsWith('\n') ? value : `${value}\n`)
  const jsonArtifactSha = (value: unknown): string => sha256Bytes(`${canonicalTtsJson(value)}\n`)
  const strategyArtifacts = {
    sourceIdentity: { identityHash: planned.sourceIdentity.identityHash, path: 'source-identity.json', sha256: jsonArtifactSha(planned.sourceIdentity) },
    dialoguePlan: { dialoguePlanId: planned.dialoguePlan.dialoguePlanId, path: 'dialogue-plan.json', sha256: jsonArtifactSha(planned.dialoguePlan) },
    normalizedDialogue: { path: 'strategy/dialogue-normalized.txt', sha256: textArtifactSha(planned.normalizedText) },
    turns: planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, path: `strategy/turns/${turn.canonical.turnId}.txt`, sha256: textArtifactSha(turn.canonical.canonicalText) })),
    generationSlots: planned.slots.map((slot) => ({ generationSlotId: slot.generationSlotId, path: `strategy/generation-slots/${slot.generationSlotId}.txt`, sha256: textArtifactSha(slot.providerText) }))
  }
  const planBase = {
    schemaVersion: 1 as const,
    branchPlanId: branchPlan.branchPlanId,
    branchCandidateId: branchCandidate.candidateId,
    operation,
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    sourceIdentityHash: planned.sourceIdentity.identityHash,
    targetKey,
    voiceContextKey,
    provider: options.target.service,
    model: options.target.model,
    transport,
    synthesisSettingsHash,
    outputProfileHash,
    capabilityFixtureHash,
    requiredCapabilityScopeHashes: [capabilityScopeHash],
    resolvedVoiceRevisionHashes: planned.turns.flatMap(turn => turn.binding.kind === 'approved-snapshot' && turn.binding.providerRevision ? [hashCanonicalTtsValue(turn.binding.providerRevision)] : []),
    requestedOutput: requestedAudioOutput,
    batches: planned.batches,
    plannedCost: plannedRenderCost,
    strategyArtifacts,
    nodes: resolvedNodes,
    strategy: planned.strategy,
    voiceContext: branchPlan.voiceContext
  }
  const renderPlanId = hashCanonicalTtsValue(planBase)
  const renderIdentity = computeRenderIdentity({ renderPlanId, targetKey, strategy: planned.strategy, voiceContextKey, synthesisSettingsHash, outputProfileHash })
  const renderPlan = { ...planBase, renderPlanId, renderIdentity } as ProviderRenderPlan
  validateProviderRenderPlanIdentity(renderPlan)
  return { operation, transport, targetKey, capability, capabilityFixtureHash, capabilityScopeHash, planned, voiceContextKey, outputProfileHash, synthesisSettingsHash, plannedRenderCost, branchCandidate, branchPlan, strategyArtifacts, renderPlanId, renderIdentity, renderPlan }
}

export const validateCurrentTtsRenderAttemptInputs = (
  options: Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>
): void => {
  buildPureCurrentTtsRenderPlan(options)
}

export const planCurrentTtsRenderIdentity = (
  options: PureCurrentTtsRenderPlanOptions
): { branchPlanId: string, renderPlanId: string, renderIdentity: string, targetKey: string, strategy: ProviderRenderStrategy } => {
  const planned = buildPureCurrentTtsRenderPlan(options)
  return { branchPlanId: planned.branchPlan.branchPlanId, renderPlanId: planned.renderPlanId, renderIdentity: planned.renderIdentity, targetKey: planned.targetKey, strategy: planned.planned.strategy }
}

export const planCurrentTtsReadiness = (
  options: PureCurrentTtsRenderPlanOptions
): PureCurrentTtsReadinessPlan => {
  const planned = buildPureCurrentTtsRenderPlan(options)
  return {
    operation: planned.operation,
    transport: planned.transport,
    targetKey: planned.targetKey,
    capability: planned.capability,
    capabilityFixtureHash: planned.capabilityFixtureHash,
    capabilityScopeHash: planned.capabilityScopeHash,
    branchCandidate: planned.branchCandidate as ProviderRenderBranchCandidate,
    branchPlan: planned.branchPlan as ProviderRenderBranchPlan,
    renderPlan: planned.renderPlan,
    renderPlanId: planned.renderPlanId,
    renderIdentity: planned.renderIdentity,
    strategy: planned.planned.strategy,
    plannedCost: planned.plannedRenderCost
  }
}

export const stateForProjection = (
  target: TtsTarget,
  targetKey: string,
  transport: string,
  artifactDir: string,
  projection: CanonicalAudioProviderProjection,
  error?: SanitizedProviderError | undefined
): PipelineProviderState => {
  const projected = projectCanonicalAudioProviderStatus(projection)
  const operation = target.operation ?? 'tts-synthesis'
  const namespace = operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return {
    service: target.service,
    model: target.model,
    local: false,
    operation,
    targetKey,
    transport,
    artifactDir,
    status: projected.status,
    attempts: projected.attempts,
    options: {},
    metadata: { [namespace]: projection },
    result: { [namespace]: projection },
    ...(error ? { error } : {})
  }
}

export const readAudioProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.result?.[namespace] as CanonicalAudioProviderProjection | undefined
}

export const readAudioMetadataProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.metadata[namespace] as CanonicalAudioProviderProjection | undefined
}
