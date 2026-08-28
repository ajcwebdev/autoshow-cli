import type {
  AttemptTurn,
  FalTtsModel,
  ProtectedAssetRef,
  ProviderRenderStrategy,
  TtsProvider,
  TtsTarget,
  TtsTargetInvocation,
  TtsTargetSelection,
  TypedProviderRequestSettings,
  TypedProviderSynthesisSettings,
} from '~/types'
import {
  validateSpeechifyTtsLanguageForModel,
  validateSpeechifyTtsModel,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'
import { resolveTtsTargetInvocationControls } from '../tts-targets/tts-invocation-controls'
import { ELEVENLABS_TTS_OUTPUT_FORMAT } from '../tts-services/tts-elevenlabs/elevenlabs-utils'
import {
  FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
  FISH_TIMESTAMP_SERIALIZER_VERSION,
  FISH_TTS_SERIALIZER_VERSION,
  isFishTimestampModel,
} from '../tts-services/fish/fish-tts-request'
import {
  DEEPINFRA_TTS_SERIALIZER_VERSION,
  resolveDeepinfraTtsRequestControls,
  resolveDeepinfraTtsVoiceField,
} from '../tts-services/tts-deepinfra/deepinfra-tts-request'
import { FAL_TTS_SERIALIZER_VERSION, resolveFalTtsVoiceField } from '../tts-services/tts-fal/fal-tts-request'
import { INWORLD_TTS_SERIALIZER_VERSION } from '../tts-services/inworld/inworld-tts-request'
import { SCHEMA_VERSION } from './attempt-shared'

export type ProviderSerializerDescriptor = Readonly<{
  endpointKind: string
  serializerVersion: string
  controls: unknown
}>

type SerializerBuilderInput = Readonly<{
  target: TtsTarget
  voiceValue: string
  strategy: ProviderRenderStrategy
  controls: ControlReader
}>

type SerializerBuilder = (input: SerializerBuilderInput) => ProviderSerializerDescriptor

type ControlReader = Readonly<{
  string: (key: string) => string | undefined
  number: (key: string) => number | undefined
  boolean: (key: string) => boolean | undefined
  stringArray: (key: string) => readonly string[] | undefined
}>

const controlReader = (effectiveControls: Readonly<Record<string, unknown>>): ControlReader => ({
  string: key => typeof effectiveControls[key] === 'string' ? effectiveControls[key] : undefined,
  number: key => typeof effectiveControls[key] === 'number' ? effectiveControls[key] : undefined,
  boolean: key => typeof effectiveControls[key] === 'boolean' ? effectiveControls[key] : undefined,
  stringArray: key => {
    const value = effectiveControls[key]
    return Array.isArray(value) && value.every(entry => typeof entry === 'string') ? value : undefined
  },
})

const buildOpenAiSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'openai.tts.phase-0-v1', controls: { responseFormat: 'wav', ...(controls.string('instructions') ? { instructions: controls.string('instructions') } : {}), ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}) } })
const buildGrokSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'grok.tts.phase-0-v1', controls: { language: controls.string('language') ?? 'auto', textNormalization: controls.boolean('textNormalization') === true, outputFormat: { codec: 'wav', sample_rate: 24000 } } })
const buildGroqSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'groq.tts.phase-0-v1', controls: { responseFormat: 'wav', ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}) } })
const buildCartesiaSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'cartesia.tts.phase-0-v1', controls: { ...(controls.string('language') ? { language: controls.string('language') } : {}), outputFormat: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 }, version: '2026-03-01' } })
const buildSpeechifySerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'speechify.tts.phase-0-v1', controls: { audioFormat: 'wav', ...(controls.string('language') ? { language: controls.string('language') } : {}) } })
const buildDeepgramSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'deepgram.tts.phase-0-v1', controls: { encoding: 'linear16', container: 'wav', ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}) } })
const buildGeminiSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'generate-content-audio', serializerVersion: 'gemini.tts.phase-0-v1', controls: { responseModalities: ['AUDIO'], ...(controls.string('languageCode') ? { languageCode: controls.string('languageCode') } : {}) } })
const buildMistralSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'mistral.tts.phase-0-v1', controls: { stream: false, responseFormat: controls.string('responseFormat') ?? 'wav' } })
const buildReplicateSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'predictions', serializerVersion: 'replicate.kokoro.v1', controls: { format: 'wav', ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}) } })
const buildFalSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'queue', serializerVersion: FAL_TTS_SERIALIZER_VERSION, controls: { format: 'wav', ...(controls.string('voiceInstruction') ? { voiceInstruction: controls.string('voiceInstruction') } : {}) } })
const buildDeepinfraSerializer: SerializerBuilder = ({ target, controls }) => ({ endpointKind: 'inference', serializerVersion: DEEPINFRA_TTS_SERIALIZER_VERSION, controls: resolveDeepinfraTtsRequestControls(target.model, controls.string('promptInstructions')) })

const buildHumeSerializer: SerializerBuilder = ({ target, strategy, controls }) => strategy === 'native-utterances'
  ? { endpointKind: 'native-utterance-synthesis', serializerVersion: 'hume.native-utterances.phase-3-v1', controls: { version: '2', format: { type: 'mp3' }, numGenerations: 1, includeTimestampTypes: ['word', 'phoneme'] } }
  : { endpointKind: 'speech-synthesis', serializerVersion: 'hume.tts.phase-0-v1', controls: { version: target.model === 'octave-1' ? '1' : '2', format: { type: 'mp3' }, numGenerations: 1, ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}), ...(controls.number('trailingSilence') !== undefined ? { trailingSilence: controls.number('trailingSilence') } : {}), ...(controls.string('description') ? { description: controls.string('description') } : {}) } }

const buildFishSerializer: SerializerBuilder = ({ target, strategy }) => {
  if (strategy === 'native-dialogue') return { endpointKind: 'text-to-speech-stream-with-timestamps', serializerVersion: FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION, controls: { format: 'wav', model: 's2.1-pro' } }
  if (isFishTimestampModel(target.model)) return { endpointKind: 'text-to-speech-stream-with-timestamps', serializerVersion: FISH_TIMESTAMP_SERIALIZER_VERSION, controls: { format: 'wav', model: target.model } }
  return { endpointKind: 'speech-synthesis', serializerVersion: FISH_TTS_SERIALIZER_VERSION, controls: { format: 'wav' } }
}

const buildInworldSerializer: SerializerBuilder = ({ controls }) => {
  const steeringPrompt = controls.string('steeringPrompt')
  return { endpointKind: 'realtime-tts', serializerVersion: INWORLD_TTS_SERIALIZER_VERSION, controls: { format: 'wav', timestampType: 'WORD', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 }, ...(steeringPrompt ? { steeringPrompt } : {}) } }
}

const buildElevenLabsSerializer: SerializerBuilder = ({ strategy, controls }) => {
  if (strategy === 'native-dialogue') return {
    endpointKind: 'text-to-dialogue-with-timestamps',
    serializerVersion: 'elevenlabs.dialogue.phase-3-v1',
    controls: {
      outputFormat: ELEVENLABS_TTS_OUTPUT_FORMAT,
      modelId: 'eleven_v3',
      ...(controls.string('languageCode') ? { languageCode: controls.string('languageCode') } : {}),
      ...(controls.number('seed') !== undefined ? { seed: controls.number('seed') } : {}),
      ...(controls.string('textNormalization') ? { textNormalization: controls.string('textNormalization') } : {}),
    },
  }
  const voiceSettings = {
    ...(controls.number('stability') !== undefined ? { stability: controls.number('stability') } : {}),
    ...(controls.number('similarityBoost') !== undefined ? { similarity_boost: controls.number('similarityBoost') } : {}),
    ...(controls.number('style') !== undefined ? { style: controls.number('style') } : {}),
    ...(controls.boolean('useSpeakerBoost') !== undefined ? { use_speaker_boost: controls.boolean('useSpeakerBoost') } : {}),
    ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}),
  }
  const pronunciationDictionaryLocators = controls.stringArray('pronunciationDictionaryLocators')?.map(value => {
    const [rawId, rawVersion] = value.split(':', 2)
    const id = rawId?.trim()
    const version = rawVersion?.trim()
    if (!id) throw UsageError('Invalid ElevenLabs pronunciation dictionary locator in immutable TTS controls.')
    return { pronunciation_dictionary_id: id, ...(version ? { version_id: version } : {}) }
  })
  return {
    endpointKind: 'speech-synthesis',
    serializerVersion: 'elevenlabs.tts.phase-0-v1',
    controls: {
      outputFormat: ELEVENLABS_TTS_OUTPUT_FORMAT,
      ...(controls.string('languageCode') ? { languageCode: controls.string('languageCode') } : {}),
      ...(Object.keys(voiceSettings).length > 0 ? { voiceSettings } : {}),
      ...(controls.number('seed') !== undefined ? { seed: controls.number('seed') } : {}),
      ...(controls.string('textNormalization') ? { textNormalization: controls.string('textNormalization') } : {}),
      ...(pronunciationDictionaryLocators?.length ? { pronunciationDictionaryLocators } : {}),
    },
  }
}

const buildMiniMaxSerializer: SerializerBuilder = ({ voiceValue, controls }) => {
  const voiceSetting = { voice_id: voiceValue, ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}), ...(controls.number('volume') !== undefined ? { vol: controls.number('volume') } : {}), ...(controls.number('pitch') !== undefined ? { pitch: controls.number('pitch') } : {}), ...(controls.string('emotion') ? { emotion: controls.string('emotion') } : {}), ...(controls.boolean('englishNormalization') === true ? { english_normalization: true } : {}) }
  const pronunciationRules = controls.stringArray('pronunciations')?.map(item => item.trim()).filter(Boolean)
  return { endpointKind: 'async-speech-synthesis-create', serializerVersion: 'minimax.tts.phase-0-v1', controls: { ...(controls.string('languageBoost') ? { languageBoost: controls.string('languageBoost') } : {}), voiceSetting, audioSetting: { format: 'mp3', audio_sample_rate: 32000, channel: 1 }, ...(pronunciationRules?.length ? { pronunciationRules } : {}) } }
}

const SERIALIZER_BUILDERS = {
  openai: buildOpenAiSerializer,
  grok: buildGrokSerializer,
  groq: buildGroqSerializer,
  cartesia: buildCartesiaSerializer,
  hume: buildHumeSerializer,
  speechify: buildSpeechifySerializer,
  deepgram: buildDeepgramSerializer,
  fish: buildFishSerializer,
  inworld: buildInworldSerializer,
  deepinfra: buildDeepinfraSerializer,
  replicate: buildReplicateSerializer,
  fal: buildFalSerializer,
  elevenlabs: buildElevenLabsSerializer,
  gemini: buildGeminiSerializer,
  mistral: buildMistralSerializer,
  minimax: buildMiniMaxSerializer,
} satisfies Record<TtsProvider, SerializerBuilder>

export const buildProviderSerializerDescriptor = (
  target: TtsTarget,
  voiceValue: string,
  effectiveControls: Readonly<Record<string, unknown>>,
  strategy: ProviderRenderStrategy = 'segmented'
): ProviderSerializerDescriptor => SERIALIZER_BUILDERS[target.service]({ target, voiceValue, strategy, controls: controlReader(effectiveControls) })

export const createTypedProviderSettings = (
  target: TtsTarget,
  effectiveControls: Readonly<Record<string, unknown>>,
  protectedAsset?: ProtectedAssetRef | undefined
): TypedProviderSynthesisSettings => {
  const values: TypedProviderSynthesisSettings['values'] = {}
  for (const [key, value] of Object.entries(effectiveControls).sort(([left], [right]) => left.localeCompare(right))) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) values[key] = value
    else if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) values[key] = [...value]
  }
  const activeProtectedAsset = protectedAsset ?? target.protectedVoiceAsset
  if (activeProtectedAsset) values['referenceAssetSha256'] = activeProtectedAsset.sha256
  return { schemaVersion: 1, settingsSchema: `${target.service}.tts.${SCHEMA_VERSION}`, values }
}

export const createProviderRequestSettings = (settings: TypedProviderSynthesisSettings): TypedProviderRequestSettings => ({
  schemaVersion: 1,
  settingsSchema: settings.settingsSchema.replace('.tts.', '.tts.request.'),
  values: { ...settings.values },
})

export const resolveEffectiveProviderControls = (
  target: TtsTarget,
  invocation: TtsTargetInvocation,
  selection: TtsTargetSelection
): Readonly<Record<string, unknown>> => {
  switch (target.service) {
    case 'openai': {
      const controls = resolveTtsTargetInvocationControls('openai', invocation, { instructions: selection.openaiInstructions, speed: selection.openaiSpeed })
      if (controls.instructions && target.model !== 'gpt-4o-mini-tts-2025-12-15') throw UsageError(`OpenAI per-turn TTS instructions are not supported by ${target.model}.`)
      return controls
    }
    case 'elevenlabs': return resolveTtsTargetInvocationControls('elevenlabs', invocation, { languageCode: selection.elevenLabsLanguageCode, stability: selection.elevenLabsStability, similarityBoost: selection.elevenLabsSimilarityBoost, style: selection.elevenLabsStyle, ...(selection.elevenLabsUseSpeakerBoost ? { useSpeakerBoost: true } : {}), speed: selection.elevenLabsSpeed, seed: selection.elevenLabsSeed, textNormalization: selection.elevenLabsTextNormalization, pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators })
    case 'minimax': return resolveTtsTargetInvocationControls('minimax', invocation, { languageBoost: selection.minimaxLanguageBoost, speed: selection.minimaxSpeed, volume: selection.minimaxVolume, pitch: selection.minimaxPitch, emotion: selection.minimaxEmotion, ...(selection.minimaxEnglishNormalization ? { englishNormalization: true } : {}), pronunciations: selection.minimaxPronunciations })
    case 'groq': return resolveTtsTargetInvocationControls('groq', invocation, {})
    case 'grok': return resolveTtsTargetInvocationControls('grok', invocation, { language: selection.grokLanguage, ...(selection.grokTextNormalization ? { textNormalization: true } : {}) })
    case 'mistral': return resolveTtsTargetInvocationControls('mistral', invocation, { responseFormat: 'wav' })
    case 'gemini': return resolveTtsTargetInvocationControls('gemini', invocation, {})
    case 'deepgram': return resolveTtsTargetInvocationControls('deepgram', invocation, { speed: selection.deepgramSpeed })
    case 'speechify': {
      const controls = resolveTtsTargetInvocationControls('speechify', invocation, { language: selection.speechifyLanguage })
      const language = validateSpeechifyTtsLanguageForModel(validateSpeechifyTtsModel(target.model), controls.language)
      return Object.freeze({ ...controls, ...(language ? { language } : {}) })
    }
    case 'hume': return resolveTtsTargetInvocationControls('hume', invocation, {})
    case 'cartesia': return resolveTtsTargetInvocationControls('cartesia', invocation, { language: selection.cartesiaLanguage })
    case 'fish': return resolveTtsTargetInvocationControls('fish', invocation, {})
    case 'inworld': return resolveTtsTargetInvocationControls('inworld', invocation, { steeringPrompt: selection.inworldInstructions })
    case 'deepinfra': return resolveTtsTargetInvocationControls('deepinfra', invocation, {})
    case 'replicate': return resolveTtsTargetInvocationControls('replicate', invocation, {})
    case 'fal': return resolveTtsTargetInvocationControls('fal', invocation, { voiceInstruction: selection.falInstructions })
  }
}

export const providerSerializerVoiceField = (
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
