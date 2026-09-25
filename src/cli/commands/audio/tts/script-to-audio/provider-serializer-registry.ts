import { sonioxTtsRequestControls, SONIOX_TTS_SERIALIZER_VERSION } from '../tts-services/tts-soniox/soniox-tts-request'
import type {
  AttemptTurn,
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
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'
import { resolveTtsTargetInvocationControls } from '../tts-targets/tts-invocation-controls'
import { ELEVENLABS_TTS_OUTPUT_FORMAT, validateElevenLabsVoiceSettings, parseElevenLabsDictionaryLocator, type ELEVENLABS_TTS_RESPONSE_FORMATS } from '../tts-services/tts-elevenlabs/elevenlabs-utils'
import { INWORLD_TTS_SERIALIZER_VERSION, inworldTtsRequestControls } from '../tts-services/inworld/inworld-tts-request'
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
const buildGrokSerializer: SerializerBuilder = ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: 'grok.tts.phase-0-v1', controls: { ...(controls.number('speed') !== undefined ? { speed: controls.number('speed') } : {}), language: controls.string('language') ?? 'auto', textNormalization: controls.boolean('textNormalization') === true, outputFormat: { codec: 'wav', sample_rate: 24000 } } })

const buildInworldSerializer: SerializerBuilder = ({ target, controls }) => ({ endpointKind: 'realtime-tts', serializerVersion: INWORLD_TTS_SERIALIZER_VERSION, controls: inworldTtsRequestControls(target.model, controls.string('steeringPrompt'), controls.number('speed')) })

const buildElevenLabsSerializer: SerializerBuilder = ({ target, strategy, controls }) => {
  validateElevenLabsVoiceSettings(target.model, {
    speed: controls.number('speed'), similarity_boost: controls.number('similarityBoost'),
    style: controls.number('style'), use_speaker_boost: controls.boolean('useSpeakerBoost'),
  })
  if (strategy === 'native-dialogue') return {
    endpointKind: 'text-to-dialogue-with-timestamps',
    serializerVersion: 'elevenlabs.dialogue.phase-3-v1',
    controls: {
      outputFormat: controls.string('responseFormat') ?? ELEVENLABS_TTS_OUTPUT_FORMAT,
      modelId: 'eleven_v3',
      ...(controls.number('stability') !== undefined ? { settings: { stability: controls.number('stability') } } : {}),
      ...(controls.stringArray('pronunciationDictionaryLocators')?.length ? { pronunciationDictionaryLocators: controls.stringArray('pronunciationDictionaryLocators')!.map(parseElevenLabsDictionaryLocator) } : {}),
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
      outputFormat: controls.string('responseFormat') ?? ELEVENLABS_TTS_OUTPUT_FORMAT,
      ...(controls.string('languageCode') ? { languageCode: controls.string('languageCode') } : {}),
      ...(Object.keys(voiceSettings).length > 0 ? { voiceSettings } : {}),
      ...(controls.number('seed') !== undefined ? { seed: controls.number('seed') } : {}),
      ...(controls.string('textNormalization') ? { textNormalization: controls.string('textNormalization') } : {}),
      ...(pronunciationDictionaryLocators?.length ? { pronunciationDictionaryLocators } : {}),
    },
  }
}

const SERIALIZER_BUILDERS = {
  gemini: ({ target, controls }) => ({ endpointKind: target.transport === 'gemini-batch' ? 'batchGenerateContent' : 'interactions', serializerVersion: 'gemini.tts.v1', controls: { ...(controls.string('instructions') ? { instructions: controls.string('instructions') } : {}), responseFormat: controls.string('responseFormat') ?? (target.transport === 'gemini-stream' ? 'pcm' : 'wav'), mode: target.transport?.replace('gemini-', '') ?? 'unary' } }),
  openai: buildOpenAiSerializer,
  soniox: ({ controls }) => ({ endpointKind: 'speech-synthesis', serializerVersion: SONIOX_TTS_SERIALIZER_VERSION, controls: sonioxTtsRequestControls(controls.string('language'), controls.number('speed')) }),
  grok: buildGrokSerializer,
  inworld: buildInworldSerializer,
  elevenlabs: buildElevenLabsSerializer,
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
    case 'elevenlabs': return resolveTtsTargetInvocationControls('elevenlabs', invocation, { languageCode: selection.elevenLabsLanguageCode, stability: selection.elevenLabsStability, similarityBoost: selection.elevenLabsSimilarityBoost, style: selection.elevenLabsStyle, ...(selection.elevenLabsUseSpeakerBoost ? { useSpeakerBoost: true } : {}), speed: selection.elevenLabsSpeed, seed: selection.elevenLabsSeed, textNormalization: selection.elevenLabsTextNormalization, pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators, responseFormat: selection.elevenLabsResponseFormat as (typeof ELEVENLABS_TTS_RESPONSE_FORMATS)[number] | undefined })
    case 'gemini': return resolveTtsTargetInvocationControls('gemini', invocation, { instructions: selection.geminiInstructions, responseFormat: selection.geminiResponseFormat })
    case 'soniox': return resolveTtsTargetInvocationControls('soniox', invocation, { language: selection.sonioxLanguage ?? 'en', speed: selection.sonioxSpeed ?? 1 })
    case 'grok': return resolveTtsTargetInvocationControls('grok', invocation, { speed: selection.grokSpeed, language: selection.grokLanguage, ...(selection.grokTextNormalization ? { textNormalization: true } : {}) })
    case 'inworld': return resolveTtsTargetInvocationControls('inworld', invocation, { steeringPrompt: selection.inworldInstructions, speed: selection.inworldSpeed })
  }
}

export const providerSerializerVoiceField = (
  target: TtsTarget,
  strategy: ProviderRenderStrategy,
  _voiceKind: AttemptTurn['voice']['kind']
): string => {
  switch (target.service) {
    case 'openai': return 'voice'
    case 'gemini': return 'generation_config.speech_config'
    case 'soniox': return 'voice'
    case 'grok': return 'voice_id'
    case 'elevenlabs': return strategy === 'native-dialogue' ? 'inputs[].voice_id' : 'path.voice_id'
    case 'inworld': return 'voiceId'
  }
}
