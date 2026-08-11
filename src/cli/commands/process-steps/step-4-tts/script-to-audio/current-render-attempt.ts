import { lstat, mkdir, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import type {
  AudioRun,
  AccountCapabilityObservation,
  AnyCapabilityRecord,
  CanonicalAudioProviderProjection,
  CanonicalDialogueTurn,
  ComicDialoguePlan,
  ComicTtsRenderContext,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  ObservedAudioFormat,
  NormalizedTiming,
  ObservedProviderRequest,
  PipelineProviderState,
  PlannedCost,
  ProtectedAssetRef,
  ProviderBatchInvocationPlan,
  ProviderBatchOutput,
  ProviderBatchResult,
  ProviderBatchResultRef,
  ProviderRenderPlan,
  ProviderRenderBranchCandidate,
  ProviderRenderBranchPlan,
  ProviderReadinessResult,
  ProviderRenderResult,
  ProviderRenderStrategy,
  ProviderRetryRecord,
  RenderAdmissionJournalSnapshot,
  ResolvedVoiceBinding,
  SanitizedProviderError,
  TtsOptions,
  TtsMasteringProfile,
  TtsRequestEvidenceScope,
  TtsSerializedRequestObservation,
  TtsTarget,
  TtsTargetInvocation,
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
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { concatAndConvertToWav, filterAudioToWav, mixAudioToWav, splitTextIntoChunks } from '../tts-utils/audio-utils'
import { resolveTtsChunkCharacterLimit, TTS_CHUNK_CHARACTER_LIMITS } from '../tts-utils/tts-chunking'
import { getSpeakerVoice, isMultiSpeakerRequested, normalizeDialogueFromOptions, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../dialogue-normalizer'
import { resolveGeminiDialogueStrategyForText, splitGeminiNativeDialogueText } from '../tts-services/tts-gemini/gemini-tts-config'
import { planElevenLabsNativeDialogueBatches } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { planHumeNativeUtteranceBatches } from '../tts-services/hume/hume-native-utterances'
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
  validateAccountCapabilityObservation,
  validateCapabilityFacetSet,
  validateProviderBatchResult,
  validateProviderRenderPlanIdentity,
  validateProviderRenderResult,
  validateRenderAdmissionJournalSnapshot,
} from './contract-validation'
import type { CurrentTtsRenderArtifacts } from './current-render-artifacts'
import {
  readContainedArtifactFile,
  releasePreparedInvocationAttemptClaim,
  reserveInvocationAttemptDirectory,
  writeImmutableArtifactFile,
} from './safe-artifact-store'

const SCHEMA_VERSION = 'phase-0-v1'
const PREPARATION_VERSION = 'generic-tts-v1'
const EPOCH = new Date(0).toISOString()
const CAPABILITY_CHECKED_AT = '2026-08-11T00:00:00.000Z'
const LOCAL_ACTOR = { namespace: 'local-user' as const, actorId: 'current-cli-user' }
const REQUESTED_OUTPUT = { codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 }

const CAPABILITY_SOURCE_REFS: Record<TtsTarget['service'], string[]> = {
  openai: ['https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create'],
  gemini: ['https://ai.google.dev/gemini-api/docs/speech-generation'],
  mistral: ['https://docs.mistral.ai/studio-api/audio/text_to_speech/speech'],
  deepgram: ['https://developers.deepgram.com/docs/tts-models'],
  grok: ['https://docs.x.ai/developers/model-capabilities/audio/text-to-speech'],
  groq: ['https://console.groq.com/docs/text-to-speech/orpheus'],
  elevenlabs: ['https://elevenlabs.io/docs/overview/capabilities/text-to-speech'],
  speechify: ['https://docs.sws.speechify.com/tts/text-to-speech/get-started/models'],
  hume: ['https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json'],
  cartesia: ['https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5'],
  minimax: ['https://platform.minimax.io/docs/api-reference/api-overview'],
  kitten: ['https://github.com/KittenML/KittenTTS']
}

type WrittenJson<T> = { value: T, path: string, sha256: string }
type AttemptTurn = {
  sourceIndex: number
  canonical: CanonicalDialogueTurn
  voice: { kind: 'provider-id' | 'reference-asset' | 'local-model-voice', value?: string | undefined, valueHash: string }
  binding: ResolvedVoiceBinding
  controls: TypedProviderSynthesisSettings
  effectiveControls: Readonly<Record<string, unknown>>
}
type AttemptSlot = {
  batchId: string
  generationSlotId: string
  slotIndex: number
  turnIds: string[]
  providerText: string
  plannedCost: PlannedCost
  expectedRequestControlsHash: string
  expectedEndpointKind: string
  expectedSerializerVersion: string
}
type RecordedOutput = {
  path: string
  relativeToBatchResult: string
  sha256: string
  format: ObservedAudioFormat
  durationMs: number
  timing?: NormalizedTiming<'take-audio-ms'> | undefined
  providerGenerationId?: string | undefined
  warnings?: readonly string[] | undefined
}
type RuntimeRequest = {
  slot: AttemptSlot
  invocationFile: WrittenJson<ProviderBatchInvocationPlan>
  request: ObservedProviderRequest
  retry?: ProviderRetryRecord | undefined
  terminal: 'completed' | 'provider-rejected' | 'ambiguous' | undefined
}
type CapabilityFixture = {
  schemaVersion: 1
  records: AnyCapabilityRecord[]
  capabilityFixtureHash: string
  capabilityScopeHash: string
}

export type CurrentTtsRecoveredGenerationSlot = Readonly<{
  value: Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>
  path: string
  sha256: string
  attemptRoot: string
  outputPaths: readonly string[]
}>

export type CurrentTtsRenderAttempt = {
  requestEvidence: TtsRequestEvidenceScope
  preparedState: PipelineProviderState
  finalizeSuccess: (audioPath: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
  finalizeFailure: (error: unknown) => Promise<PipelineProviderState>
}

export type CreateCurrentTtsRenderAttemptOptions = {
  outputDir: string
  artifactRoot?: string | undefined
  target: TtsTarget
  sourceText: string
  ttsOptions: TtsOptions
  sourceIdentity?: GenericTtsSourceIdentity | undefined
  dialoguePlan?: GenericTtsDialoguePlan | undefined
  comicContext?: ComicTtsRenderContext | undefined
  /** Canonical provider-attempt count retained before preparing this render. */
  priorAttemptCount?: number | undefined
  /** Verified completed slots from an earlier attempt of this exact render. */
  recoveredSlots?: readonly CurrentTtsRecoveredGenerationSlot[] | undefined
  /** Planned provider spend already represented by retained canonical dispatch attempts. */
  retainedCumulativePlannedCost?: PlannedCost | undefined
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  now?: (() => string) | undefined
}

const withIdentity = <T extends Record<string, unknown>, K extends string>(value: T, field: K): T & Record<K, string> =>
  ({ ...value, [field]: hashCanonicalTtsValue(value) }) as T & Record<K, string>

const writeJson = async <T>(rootDir: string, path: string, value: T): Promise<WrittenJson<T>> => {
  const bytes = `${canonicalTtsJson(value)}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { value, path, sha256: written.sha256 }
}

const writeJsonCreateOnly = writeJson

const writeTextCreateOnly = async (rootDir: string, path: string, value: string): Promise<{ path: string, sha256: string }> => {
  const bytes = value.endsWith('\n') ? value : `${value}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { path, sha256: written.sha256 }
}

const contained = (root: string, path: string): string => {
  const value = relative(root, path)
  if (!value || value === '..' || value.startsWith(`..${sep}`)) throw CLIUsageError('TTS evidence escaped its stable provider artifact directory.')
  return value.split(sep).join('/')
}

const readObservedAudio = async (rootDir: string, path: string): Promise<{ bytes: Buffer, format: ObservedAudioFormat, durationMs: number }> => {
  const bytes = (await readContainedArtifactFile(rootDir, contained(rootDir, path))).bytes
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 16
  let byteRate = 0
  let dataBytes = 0
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', offset, offset + 4)
      const size = bytes.readUInt32LE(offset + 4)
      const content = offset + 8
      if (kind === 'fmt ' && content + 16 <= bytes.length) {
        channels = bytes.readUInt16LE(content + 2)
        sampleRate = bytes.readUInt32LE(content + 4)
        byteRate = bytes.readUInt32LE(content + 8)
        bitsPerSample = bytes.readUInt16LE(content + 14)
      } else if (kind === 'data') dataBytes += Math.min(size, Math.max(0, bytes.length - content))
      offset = content + size + (size % 2)
    }
    if (sampleRate <= 0 || channels <= 0) throw CLIUsageError(`Retained TTS WAV output has no valid audio format metadata: ${path}`)
    return { bytes, format: { codec: bitsPerSample === 24 ? 'pcm_s24le' : 'pcm_s16le', container: 'wav', sampleRate, channels }, durationMs: byteRate > 0 ? Math.round(dataBytes / byteRate * 1000) : 0 }
  }

  const probe = Bun.spawn([
    getFfprobeBinary(),
    '-v', 'error',
    '-show_entries', 'format=format_name,duration,bit_rate:stream=codec_name,sample_rate,channels,bit_rate',
    '-of', 'json',
    path
  ], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(probe.stdout).text(),
    new Response(probe.stderr).text(),
    probe.exited
  ])
  if (exitCode !== 0) throw CLIUsageError(`Could not probe retained TTS audio output ${path}: ${stderr.trim() || `ffprobe exited ${exitCode}`}`)
  let parsed: {
    format?: { format_name?: string | undefined, duration?: string | undefined, bit_rate?: string | undefined } | undefined
    streams?: Array<{ codec_name?: string | undefined, sample_rate?: string | undefined, channels?: number | undefined, bit_rate?: string | undefined }> | undefined
  }
  try {
    parsed = JSON.parse(stdout) as typeof parsed
  } catch {
    throw CLIUsageError(`Could not parse retained TTS audio metadata for ${path}.`)
  }
  const stream = parsed.streams?.find((entry) => Number(entry.sample_rate) > 0 && Number(entry.channels) > 0)
  const codec = stream?.codec_name?.trim()
  const container = parsed.format?.format_name?.split(',').map((entry) => entry.trim()).find(Boolean)
  sampleRate = Number(stream?.sample_rate)
  channels = Number(stream?.channels)
  if (!codec || !container || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(channels) || channels <= 0) {
    throw CLIUsageError(`Retained TTS audio output has incomplete observed format metadata: ${path}`)
  }
  const bitRate = Number(stream?.bit_rate ?? parsed.format?.bit_rate)
  const durationSeconds = Number(parsed.format?.duration)
  return {
    bytes,
    format: { codec, container, sampleRate, channels, ...(Number.isFinite(bitRate) && bitRate > 0 ? { bitRate } : {}) },
    durationMs: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : 0
  }
}

const typedSettings = (
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

const requestSettings = (settings: TypedProviderSynthesisSettings): TypedProviderRequestSettings => ({
  schemaVersion: 1,
  settingsSchema: settings.settingsSchema.replace('.tts.', '.tts.request.'),
  values: { ...settings.values }
})

type TtsTargetSelection = ReturnType<typeof createTtsTargetSelection>

const resolveEffectiveInvocationControls = (
  target: TtsTarget,
  invocation: TtsTargetInvocation,
  selection: TtsTargetSelection
): Readonly<Record<string, unknown>> => {
  switch (target.service) {
    case 'kitten':
      return resolveTtsTargetInvocationControls('kitten', invocation, { maxChunkChars: TTS_CHUNK_CHARACTER_LIMITS.kitten })
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
        outputFormat: selection.elevenLabsOutputFormat,
        languageCode: selection.elevenLabsLanguageCode,
        stability: selection.elevenLabsStability,
        similarityBoost: selection.elevenLabsSimilarityBoost,
        style: selection.elevenLabsStyle,
        ...(selection.elevenLabsUseSpeakerBoost ? { useSpeakerBoost: true } : {}),
        speed: selection.elevenLabsSpeed,
        seed: selection.elevenLabsSeed,
        textNormalization: selection.elevenLabsTextNormalization,
        pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators,
        optimizeStreamingLatency: selection.elevenLabsOptimizeStreamingLatency,
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
        encoding: selection.deepgramEncoding,
        container: selection.deepgramContainer,
        bitRate: selection.deepgramBitRate,
        sampleRate: selection.deepgramSampleRate,
        speed: selection.deepgramSpeed,
      })
    case 'speechify': {
      const controls = resolveTtsTargetInvocationControls('speechify', invocation, {
        audioFormat: selection.speechifyAudioFormat,
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
  }
}

const serializerContract = (
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
    case 'kitten':
      return { endpointKind: 'local-runner', serializerVersion: 'kitten.tts.phase-0-v1', controls: { maxChunkChars: numberValue('maxChunkChars') ?? TTS_CHUNK_CHARACTER_LIMITS.kitten } }
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
      return { endpointKind: 'speech-synthesis', serializerVersion: 'hume.tts.phase-0-v1', controls: { version: '2', format: { type: 'mp3' }, numGenerations: 1, ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}), ...(numberValue('trailingSilence') !== undefined ? { trailingSilence: numberValue('trailingSilence') } : {}) } }
    case 'speechify':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'speechify.tts.phase-0-v1', controls: { audioFormat: stringValue('audioFormat') ?? 'mp3', ...(stringValue('language') ? { language: stringValue('language') } : {}) } }
    case 'deepgram':
      return { endpointKind: 'speech-synthesis', serializerVersion: 'deepgram.tts.phase-0-v1', controls: { ...(stringValue('encoding') ? { encoding: stringValue('encoding') } : {}), ...(stringValue('container') ? { container: stringValue('container') } : {}), ...(numberValue('bitRate') !== undefined ? { bitRate: numberValue('bitRate') } : {}), ...(numberValue('sampleRate') !== undefined ? { sampleRate: numberValue('sampleRate') } : {}), ...(numberValue('speed') !== undefined ? { speed: numberValue('speed') } : {}) } }
    case 'elevenlabs': {
      if (strategy === 'native-dialogue') return {
        endpointKind: 'text-to-dialogue-with-timestamps',
        serializerVersion: 'elevenlabs.dialogue.phase-3-v1',
        controls: {
          outputFormat: stringValue('outputFormat') ?? 'mp3_44100_128',
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
          outputFormat: stringValue('outputFormat') ?? 'mp3_44100_128',
          ...(stringValue('languageCode') ? { languageCode: stringValue('languageCode') } : {}),
          ...(Object.keys(voiceSettings).length > 0 ? { voiceSettings } : {}),
          ...(numberValue('seed') !== undefined ? { seed: numberValue('seed') } : {}),
          ...(stringValue('textNormalization') ? { textNormalization: stringValue('textNormalization') } : {}),
          ...(pronunciationDictionaryLocators?.length ? { pronunciationDictionaryLocators } : {}),
          ...(numberValue('optimizeStreamingLatency') !== undefined ? { optimizeStreamingLatency: numberValue('optimizeStreamingLatency') } : {}),
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

const preparedText = (text: string) => ({
  schemaVersion: 1 as const,
  canonicalText: text,
  providerText: text,
  preparationVersion: PREPARATION_VERSION,
  canonicalIndexUnit: 'unicode-scalar-value' as const,
  providerIndexUnit: 'unicode-scalar-value' as const,
  spans: [...text].length === 0 ? [] : [{ kind: 'mapped' as const, canonicalStart: 0, canonicalEnd: [...text].length, providerStart: 0, providerEnd: [...text].length }]
})

const sanitizeError = (error: unknown, phase: SanitizedProviderError['phase']): SanitizedProviderError => {
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined
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
  return { phase, code: status ? `http_${status}` : 'tts_target_failed', message, retryable: status === 408 || status === 429 || (status !== undefined && status >= 500) }
}

const plannedCost = (target: TtsTarget, characters: number, includeSetup: boolean): PlannedCost => {
  const pricing = getTtsPricing(target.service, target.model)
  const cents = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    ? characters / 1e6 * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents)
    : characters / 1000 * (pricing.costPer1kCharsCents ?? 0)
  const totalCents = cents + (includeSetup ? target.setupCostCents ?? 0 : 0)
  return totalCents === 0 ? { amounts: [] } : { amounts: [{ amount: totalCents / 100, currency: 'USD' }] }
}

const buildCapabilityFixture = (
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
  const voiceKinds = target.service === 'kitten'
    ? ['local-model-voice' as const]
    : target.protectedVoiceAsset
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

const voiceBinding = (target: TtsTarget, kind: AttemptTurn['voice']['kind'], value: string, settings: TypedProviderSynthesisSettings, capabilityFixtureHash: string, protectedAsset?: ProtectedAssetRef | undefined): { voice: AttemptTurn['voice'], binding: Extract<ResolvedVoiceBinding, { kind: 'transient-provider-voice' }> } => {
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

const flattenPlanTurns = (plan: GenericTtsDialoguePlan | ComicDialoguePlan): CanonicalDialogueTurn[] =>
  plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)

const bindingIdentityHash = (binding: ResolvedVoiceBinding): string =>
  binding.kind === 'approved-snapshot' ? binding.entryHash : binding.identityHash

const requestedOutput = (options: Pick<CreateCurrentTtsRenderAttemptOptions, 'ttsOptions'>) => options.ttsOptions.ttsMasteringProfile
  ? {
      codec: options.ttsOptions.ttsMasteringProfile.codec,
      container: options.ttsOptions.ttsMasteringProfile.container,
      sampleRate: options.ttsOptions.ttsMasteringProfile.sampleRate,
      channels: options.ttsOptions.ttsMasteringProfile.channels,
    }
  : REQUESTED_OUTPUT

const localVoiceEffectFilter = (turn: CanonicalDialogueTurn): string | undefined => {
  const kind = turn.effect?.kind ?? ''
  if (!/(?:radio|intercom|telephone|computer)/u.test(kind)) return undefined
  return 'highpass=f=250,lowpass=f=3500,acompressor=threshold=-18dB:ratio=3:attack=10:release=100'
}

const assembleComicSegmentedAudio = async (input: {
  dialoguePlan: ComicDialoguePlan
  turns: readonly CanonicalDialogueTurn[]
  slots: readonly Pick<AttemptSlot, 'generationSlotId' | 'turnIds'>[]
  outputPathsBySlot: ReadonlyMap<string, readonly string[]>
  masteringDir: string
  providerLabel: string
  profile: TtsMasteringProfile
}): Promise<string> => {
  const turnAudio = new Map<string, string>()
  for (const turn of input.turns) {
    const turnDir = join(input.masteringDir, 'turns', turn.turnId)
    await mkdir(turnDir, { recursive: true })
    const chunkPaths = input.slots.filter(slot => slot.turnIds.includes(turn.turnId)).flatMap((slot) => {
      const paths = input.outputPathsBySlot.get(slot.generationSlotId)
      if (!paths) throw CLIUsageError(`Comic assembly is missing generation slot ${slot.generationSlotId}.`)
      return [...paths]
    })
    if (chunkPaths.length === 0) throw CLIUsageError(`Comic assembly has no retained provider output for ${turn.turnId}.`)
    const concatenated = await concatAndConvertToWav(chunkPaths, turnDir, `${input.providerLabel}-${turn.turnId}`, undefined, input.profile)
    const effectFilter = localVoiceEffectFilter(turn)
    if (effectFilter) {
      const effected = join(turnDir, 'effected.wav')
      await filterAudioToWav(concatenated, effected, `${input.providerLabel}-${turn.turnId}`, effectFilter, input.profile)
      turnAudio.set(turn.turnId, effected)
    } else {
      turnAudio.set(turn.turnId, concatenated)
    }
  }
  const nodePaths: string[] = []
  for (const [nodeIndex, node] of input.dialoguePlan.nodes.entries()) {
    if (node.kind === 'turn') {
      const path = turnAudio.get(node.turn.turnId)
      if (!path) throw CLIUsageError(`Comic assembly lost turn ${node.turn.turnId}.`)
      nodePaths.push(path)
      continue
    }
    const overlapPaths = node.turns.map((turn) => {
      const path = turnAudio.get(turn.turnId)
      if (!path) throw CLIUsageError(`Comic overlap assembly lost turn ${turn.turnId}.`)
      return path
    })
    const overlapDir = join(input.masteringDir, 'overlaps', `${String(nodeIndex + 1).padStart(3, '0')}-${node.groupId}`)
    await mkdir(overlapDir, { recursive: true })
    nodePaths.push(await mixAudioToWav(overlapPaths, join(overlapDir, 'speech.wav'), `${input.providerLabel}-${node.groupId}`, input.profile))
  }
  if (nodePaths.length === 0) throw CLIUsageError('Comic segmented assembly has no dialogue nodes.')
  const assemblyDir = join(input.masteringDir, 'assembly')
  await mkdir(assemblyDir, { recursive: true })
  return await concatAndConvertToWav(nodePaths, assemblyDir, `${input.providerLabel}-comic-assembly`, undefined, input.profile)
}

const comicTimelineLayout = (
  dialoguePlan: ComicDialoguePlan,
  durationForTurn: (turnId: string) => number
): {
  turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>
  overlaps: Array<{ groupId: string, start: number, end: number }>
} => {
  let cursorMs = 0
  const turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }> = []
  const overlaps: Array<{ groupId: string, start: number, end: number }> = []
  for (const node of dialoguePlan.nodes) {
    if (node.kind === 'turn') {
      const startMs = cursorMs
      cursorMs += durationForTurn(node.turn.turnId)
      turns.push({ turnId: node.turn.turnId, subjectKey: node.turn.subjectKey, startMs, endMs: cursorMs })
      continue
    }
    const startMs = cursorMs
    let endMs = startMs
    for (const turn of node.turns) {
      const turnEndMs = startMs + durationForTurn(turn.turnId)
      turns.push({ turnId: turn.turnId, subjectKey: turn.subjectKey, startMs, endMs: turnEndMs })
      endMs = Math.max(endMs, turnEndMs)
    }
    cursorMs = endMs
    overlaps.push({ groupId: node.groupId, start: startMs, end: endMs })
  }
  return { turns, overlaps }
}

const chunkLimit = (target: TtsTarget): number =>
  target.service === 'kitten'
    ? Number.MAX_SAFE_INTEGER
    : resolveTtsChunkCharacterLimit(target.service, target.model)
      ?? TTS_CHUNK_CHARACTER_LIMITS[target.service]
      ?? 2000

const defaultVoiceValue = (target: TtsTarget): string => {
  switch (target.service) {
    case 'openai': return 'alloy'
    case 'gemini': return 'Kore'
    case 'deepgram': return target.model
    case 'grok': return 'eve'
    case 'minimax': return 'English_expressive_narrator'
    case 'hume': return 'Male English Actor'
    case 'cartesia': return 'f786b574-daa5-4673-aa0c-cbe3e8534c02'
    case 'elevenlabs': return ELEVENLABS_DEFAULT_VOICE_ID
    case 'speechify': return SPEECHIFY_DEFAULT_TTS_VOICE
    default: return 'provider-default'
  }
}

const planInputs = (options: CreateCurrentTtsRenderAttemptOptions, capabilityFixtureHash: string) => {
  if (options.comicContext) {
    const context = options.comicContext
    if (context.operation !== 'comic-audio') throw CLIUsageError('Comic render context requires operation comic-audio.')
    if (canonicalTtsJson(context.sourceIdentity) !== canonicalTtsJson(context.dialoguePlan.sourceIdentity)) throw CLIUsageError('Comic dialogue plan does not bind the exact source identity.')
    if (context.dialoguePlan.dialoguePlanId !== hashCanonicalTtsValue({
      schemaVersion: context.dialoguePlan.schemaVersion,
      sceneRunIdentity: context.dialoguePlan.sceneRunIdentity,
      sourceIdentity: context.dialoguePlan.sourceIdentity,
      structuredScript: context.dialoguePlan.structuredScript,
      createdAt: context.dialoguePlan.createdAt,
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
    const turns: AttemptTurn[] = canonicalTurns.map((canonical, sourceIndex) => {
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
    const registry = parseSpeakerVoiceMappings(options.ttsOptions.ttsSpeakers)
    const normalizedText = canonicalTurns.map(turn => `${context.providerSpeakerLabelByTurnId[turn.turnId] ?? turn.originalSpeakerLabel}: ${turn.canonicalText}`).join('\n')
    const distinctSpeakers = new Set(canonicalTurns.map(turn => (context.providerSpeakerLabelByTurnId[turn.turnId] ?? turn.originalSpeakerLabel).normalize('NFKC').trim().toLocaleUpperCase('en-US')))
    const hasSegmentedOnlyIntent = context.dialoguePlan.nodes.some(node => node.kind === 'overlap')
      || canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
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
    const nativeEligible = canonicalTurns.length > 0 && !hasSegmentedOnlyIntent && (geminiNative || elevenLabsNative || humeNative)
    if (context.modePreference === 'native' && !nativeEligible) throw CLIUsageError('Comic native mode requires a provider-native eligible target whose speaker, direction, control, and request limits can be represented exactly.')
    const native = context.modePreference !== 'segmented' && nativeEligible
    const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
    const limit = chunkLimit(options.target)
    let nativeTurnCursor = 0
    const nativeGroups = geminiNative
      ? splitGeminiNativeDialogueText(normalizedText, registry, limit).map((providerText) => {
          const chunkDialogue = normalizeDialogueText(providerText, resolveDialogueFormat(options.ttsOptions), registry)
          const groupedTurns = turns.slice(nativeTurnCursor, nativeTurnCursor + chunkDialogue.turns.length)
          if (groupedTurns.length !== chunkDialogue.turns.length || groupedTurns.some((turn, index) => turn.canonical.canonicalText !== chunkDialogue.turns[index]?.text)) throw CLIUsageError('Gemini comic native partition did not preserve exact turn boundaries.')
          nativeTurnCursor += groupedTurns.length
          return { turnIds: groupedTurns.map(turn => turn.canonical.turnId), providerTexts: [providerText] }
        })
      : elevenLabsNative
        ? planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
        : humeNative
          ? planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
          : []
    const slotGroups: Array<{ turnIds: string[], providerTexts: string[] }> = native
      ? nativeGroups
      : turns.map(turn => ({ turnIds: [turn.canonical.turnId], providerTexts: splitTextIntoChunks(turn.canonical.canonicalText, limit) }))
    if (geminiNative && native && nativeTurnCursor !== turns.length) throw CLIUsageError('Gemini comic native partition omitted turns.')
    let includesSetup = true
    const slots: AttemptSlot[] = []
    const batches = slotGroups.map((group, batchIndex) => {
      const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
      const primaryTurn = turns.find(turn => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
      const contract = serializerContract(options.target, primaryTurn.voice.value ?? primaryTurn.voice.valueHash, primaryTurn.effectiveControls, strategy)
      const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
        const cost = plannedCost(options.target, [...providerText].length, includesSetup)
        includesSetup = false
        const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion }
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
  const turns: AttemptTurn[] = canonicalTurns.map((canonical, sourceIndex) => {
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
      : options.target.service === 'kitten'
        ? 'local-model-voice'
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
  const normalizedDialogue = registry ? normalizeDialogueFromOptions(options.sourceText, options.ttsOptions) : undefined
  const hasNativeBlockingIntent = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const geminiNative = options.target.service === 'gemini' && registry
    ? !hasProviderTurnControls && !hasNativeBlockingIntent && resolveGeminiDialogueStrategyForText(normalizedDialogue?.normalizedText ?? '', registry, TTS_CHUNK_CHARACTER_LIMITS.gemini, 'auto') === 'native'
    : false
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent
  const humeNative = options.target.service === 'hume' && options.target.model === 'octave-2' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent && canonicalTurns.reduce((sum, turn) => sum + [...turn.canonicalText].length, 0) <= 5000
  const native = geminiNative || elevenLabsNative || humeNative
  const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
  const limit = chunkLimit(options.target)
  let nativeTurnCursor = 0
  const nativeGroups = geminiNative && registry
    ? splitGeminiNativeDialogueText(normalizedDialogue?.normalizedText ?? '', registry, limit).map((providerText) => {
        const chunkDialogue = normalizeDialogueText(providerText, resolveDialogueFormat(options.ttsOptions), registry)
        const groupedTurns = turns.slice(nativeTurnCursor, nativeTurnCursor + chunkDialogue.turns.length)
        if (
          groupedTurns.length !== chunkDialogue.turns.length
          || groupedTurns.some((turn, index) => turn.canonical.canonicalText !== chunkDialogue.turns[index]?.text || turn.canonical.subjectKey !== chunkDialogue.turns[index]?.speaker)
        ) throw CLIUsageError('Gemini native dialogue partition did not preserve exact normalized turn boundaries.')
        nativeTurnCursor += groupedTurns.length
        return { turnIds: groupedTurns.map((turn) => turn.canonical.turnId), providerTexts: [providerText] }
      })
    : elevenLabsNative && registry
      ? planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
      : humeNative && registry
        ? planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
        : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[] }> = native
    ? nativeGroups
    : turns.map((turn) => ({ turnIds: [turn.canonical.turnId], providerTexts: splitTextIntoChunks(turn.canonical.canonicalText, limit) }))
  if (geminiNative && nativeTurnCursor !== turns.length) throw CLIUsageError('Gemini native dialogue partition omitted normalized turns.')
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
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion }
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

export const validateCurrentTtsRenderAttemptInputs = (
  options: Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>
): void => {
  buildPureCurrentTtsRenderPlan(options)
}

const sumCosts = (costs: readonly PlannedCost[]): PlannedCost => {
  const amounts = new Map<string, number>()
  for (const cost of costs) for (const entry of cost.amounts) amounts.set(entry.currency, (amounts.get(entry.currency) ?? 0) + entry.amount)
  return { amounts: [...amounts].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amount]) => ({ currency, amount })) }
}

export type PureCurrentTtsRenderPlanOptions = Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>

const buildPureCurrentTtsRenderPlan = (options: PureCurrentTtsRenderPlanOptions) => {
  const operation = options.comicContext ? 'comic-audio' as const : 'tts-synthesis' as const
  if (options.target.operation && options.target.operation !== operation) throw CLIUsageError('TTS target operation does not match its render context.')
  const transport = options.target.transport ?? (options.target.service === 'kitten' ? 'local-process' : 'hosted-api')
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
      ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description } } } : {})
    })),
    batchRequestControls: planned.batches.map((batch) => ({ batchId: batch.batchId, requestControls: batch.requestControls }))
  })
  const plannedRenderCost = sumCosts(planned.slots.map((slot) => slot.plannedCost))
  const resolvedTurnById = new Map(planned.turns.map((turn) => [turn.canonical.turnId, {
    ...turn.canonical,
    providerText: preparedText(turn.canonical.canonicalText),
    voice: turn.binding,
    providerControls: turn.controls,
    ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1 as const, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description } } } : {})
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
  }, 'candidateId')
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
  }, 'branchPlanId')
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

export const planCurrentTtsRenderIdentity = (
  options: PureCurrentTtsRenderPlanOptions
): { branchPlanId: string, renderPlanId: string, renderIdentity: string, targetKey: string, strategy: ProviderRenderStrategy } => {
  const planned = buildPureCurrentTtsRenderPlan(options)
  return { branchPlanId: planned.branchPlan.branchPlanId, renderPlanId: planned.renderPlanId, renderIdentity: planned.renderIdentity, targetKey: planned.targetKey, strategy: planned.planned.strategy }
}

export type PureCurrentTtsReadinessPlan = Readonly<{
  operation: 'tts-synthesis' | 'comic-audio'
  transport: string
  targetKey: string
  capability: CapabilityFixture
  capabilityFixtureHash: string
  capabilityScopeHash: string
  branchCandidate: ProviderRenderBranchCandidate
  branchPlan: ProviderRenderBranchPlan
  renderPlan: ProviderRenderPlan
  renderPlanId: string
  renderIdentity: string
  strategy: ProviderRenderStrategy
  plannedCost: PlannedCost
}>

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

export const assertCurrentTtsProviderStateSafeForRedispatch = async (options: {
  rootDir: string
  state: PipelineProviderState
  expectedRenderIdentity: string
}): Promise<void> => {
  const projection = readAudioProjection(options.state)
  const render = projection?.renderHistory.find((entry) => entry.renderIdentity === options.expectedRenderIdentity)
  if (!projection || !render) {
    throw CLIUsageError(`Stored TTS target ${options.state.service}/${options.state.model ?? ''} does not match the exact planned render identity; rebuild instead of resuming it.`)
  }
  const journalEvent = [...render.events].reverse().find((event) => event.admissionJournalRef)
  if (!journalEvent?.admissionJournalRef) return
  if (!journalEvent.admissionJournalSha256 || !journalEvent.admissionJournalSnapshotId) {
    throw CLIUsageError('Stored TTS admission journal is missing its immutable checksum binding; automatic provider redispatch is unsafe.')
  }
  const providerRoot = resolve(options.rootDir, options.state.artifactDir)
  const journalPath = resolve(providerRoot, journalEvent.admissionJournalRef)
  const journalRelative = relative(providerRoot, journalPath)
  if (!journalRelative || journalRelative === '..' || journalRelative.startsWith(`..${sep}`)) {
    throw CLIUsageError('Stored TTS admission journal escapes its provider artifact directory.')
  }
  const journal = await readVerifiedJson<RenderAdmissionJournalSnapshot>(
    options.rootDir,
    journalPath,
    journalEvent.admissionJournalSha256,
    'Stored TTS admission journal'
  )
  if (journal.renderIdentity !== options.expectedRenderIdentity || journal.snapshotId !== journalEvent.admissionJournalSnapshotId) {
    throw CLIUsageError('Stored TTS admission journal does not bind the exact retained render; automatic provider redispatch is unsafe.')
  }
  const unsafeRequest = journal.requests.find((request) => {
    const terminal = request.transitions.at(-1)?.state
    return terminal !== 'prepared' && terminal !== 'provider-rejected' && terminal !== 'confirmed-not-admitted'
  })
  if (unsafeRequest) {
    throw CLIUsageError(
      `Stored TTS render has admitted, completed, or ambiguous provider work in generation slot ${unsafeRequest.generationSlotId}; automatic redispatch is blocked until retained output reuse or provider reconciliation is available.`
    )
  }
}

const stateForProjection = (
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
    local: target.service === 'kitten',
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

const readAudioProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.result?.[namespace] as CanonicalAudioProviderProjection | undefined
}

const readAudioMetadataProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.metadata[namespace] as CanonicalAudioProviderProjection | undefined
}

type LoadedRecoveryBatch = CurrentTtsRecoveredGenerationSlot

export type CurrentTtsCompletedRecovery = {
  kind: 'complete-render'
  preparedState: PipelineProviderState
  chunkCount: number
  finalize: (workspaceDir: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
}

export type CurrentTtsPartialRecovery = {
  kind: 'partial-slots'
  recoveredSlots: readonly CurrentTtsRecoveredGenerationSlot[]
  retainedCumulativePlannedCost: PlannedCost
}

export type CurrentTtsSafeRedispatch = {
  kind: 'safe-redispatch'
  retainedCumulativePlannedCost: PlannedCost
}

export const resolveCurrentTtsPriorAdmittedAttemptCount = async (options: {
  rootDir: string
  state: PipelineProviderState
}): Promise<number> => {
  const retainedCount = options.state.attempts
  const projection = readAudioProjection(options.state)
  const active = projection?.activeWork
  if (!projection || active?.kind !== 'render' || retainedCount === 0) return retainedCount
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (
    event?.status !== 'running'
    || event.attempt !== retainedCount
    || !event.admissionJournalRef
    || !event.admissionJournalSha256
    || !event.admissionJournalSnapshotId
  ) return retainedCount

  const providerRoot = resolve(options.rootDir, options.state.artifactDir)
  const journalPath = resolveRetainedPath(providerRoot, event.admissionJournalRef, 'Stored TTS admission journal')
  const journal = await readVerifiedJson<RenderAdmissionJournalSnapshot>(
    options.rootDir,
    journalPath,
    event.admissionJournalSha256,
    'Stored TTS admission journal'
  )
  if (
    journal.snapshotId !== event.admissionJournalSnapshotId
    || journal.renderIdentity !== active.renderIdentity
    || journal.attempt !== retainedCount
  ) {
    throw CLIUsageError('Stored TTS admission journal does not bind the retained provider-attempt count.')
  }
  const hasDurableDispatch = journal.requests.some((request) =>
    request.transitions.some((transition) => transition.state !== 'prepared'))
  if (hasDurableDispatch) return retainedCount
  if (journal.requests.length === 0 || journal.requests.some((request) => request.transitions.length !== 1 || request.transitions[0]?.state !== 'prepared')) {
    throw CLIUsageError('Stored TTS provider attempt has no durable dispatch but is not an exact prepared-only journal.')
  }
  const attemptsDirectory = dirname(dirname(journalPath))
  const claimPath = join(attemptsDirectory, `.attempt-${String(journal.attempt).padStart(3, '0')}.claim`)
  try {
    await lstat(claimPath)
  } catch (error) {
    if ((error as { code?: unknown })?.code === 'ENOENT') return retainedCount - 1
    throw error
  }
  await releasePreparedInvocationAttemptClaim(options.rootDir, {
    attemptsDirectory: contained(options.rootDir, attemptsDirectory),
    attempt: journal.attempt,
    invocationId: journal.invocationId
  })
  return retainedCount - 1
}

const resolveRetainedPath = (baseDir: string, artifactRef: string, label: string): string => {
  const base = resolve(baseDir)
  const path = resolve(base, artifactRef)
  const fromBase = relative(base, path)
  if (!fromBase || fromBase === '..' || fromBase.startsWith(`..${sep}`)) {
    throw CLIUsageError(`${label} escapes its retained evidence directory.`)
  }
  return path
}

const readVerifiedJson = async <T>(rootDir: string, path: string, expectedSha256: string, label: string): Promise<T> => {
  let retained
  try {
    retained = await readContainedArtifactFile(rootDir, contained(rootDir, path))
  } catch (error) {
    throw CLIUsageError(`${label} could not be read as a contained regular artifact: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (retained.sha256 !== expectedSha256) throw CLIUsageError(`${label} checksum does not match retained canonical evidence.`)
  try {
    return JSON.parse(retained.bytes.toString('utf8')) as T
  } catch {
    throw CLIUsageError(`${label} is not valid JSON.`)
  }
}

const copyCreateOnly = async (rootDir: string, source: string, destination: string): Promise<void> => {
  const sourceFile = await readContainedArtifactFile(rootDir, contained(rootDir, source))
  await writeImmutableArtifactFile(rootDir, contained(rootDir, destination), sourceFile.bytes)
}

export const prepareCurrentTtsCompletedRecovery = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state: PipelineProviderState
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
}): Promise<CurrentTtsCompletedRecovery | CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> => {
  const pure = buildPureCurrentTtsRenderPlan(options)
  if (options.state.targetKey !== pure.targetKey || options.state.artifactDir.trim().length === 0) {
    throw CLIUsageError('Stored TTS provider state does not bind the exact planned target identity.')
  }
  const resultProjection = readAudioProjection(options.state)
  const metadataProjection = readAudioMetadataProjection(options.state)
  if (!resultProjection || !metadataProjection || canonicalTtsJson(resultProjection) !== canonicalTtsJson(metadataProjection)) {
    throw CLIUsageError('Stored TTS provider state is missing one exact canonical projection.')
  }
  const retainedRender = resultProjection.renderHistory.find((entry) => entry.renderIdentity === pure.renderIdentity)
  if (!retainedRender) {
    throw CLIUsageError(`Stored TTS target ${options.state.service}/${options.state.model ?? ''} does not match the exact planned render identity; rebuild instead of resuming it.`)
  }
  const providerRoot = resolve(options.rootDir, options.state.artifactDir)
  const renderRoot = resolveRetainedPath(providerRoot, retainedRender.renderDir, 'Stored TTS render directory')
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
  type RetainedJournalEvidence = {
    value: RenderAdmissionJournalSnapshot
    path: string
    sha256: string
    attemptRoot: string
  }
  const journalEvidenceById = new Map<string, RetainedJournalEvidence>()
  const knownJournalSnapshots = new Set<string>()
  const directJournalEvidence: RetainedJournalEvidence[] = []
  for (const event of retainedRender.events) {
    if (!event.admissionJournalRef && !event.admissionJournalSha256 && !event.admissionJournalSnapshotId) continue
    if (!event.admissionJournalRef || !event.admissionJournalSha256 || !event.admissionJournalSnapshotId) {
      throw CLIUsageError('Stored TTS admission journal reference is incomplete.')
    }
    if (knownJournalSnapshots.has(event.admissionJournalSnapshotId)) continue
    const path = resolveRetainedPath(providerRoot, event.admissionJournalRef, 'Stored TTS admission journal')
    const value = await readVerifiedJson<RenderAdmissionJournalSnapshot>(options.rootDir, path, event.admissionJournalSha256, 'Stored TTS admission journal')
    validateRenderAdmissionJournalSnapshot(value)
    if (
      value.snapshotId !== event.admissionJournalSnapshotId
      || value.renderIdentity !== pure.renderIdentity
      || value.renderPlanId !== pure.renderPlanId
      || value.requests.some((request) => !plannedSlotIds.includes(request.generationSlotId))
    ) throw CLIUsageError('Stored TTS admission journal does not bind the exact planned render and generation-slot set.')
    const evidence = { value, path, sha256: event.admissionJournalSha256, attemptRoot: dirname(path) }
    journalEvidenceById.set(value.journalId, evidence)
    knownJournalSnapshots.add(value.snapshotId)
    directJournalEvidence.push(evidence)
  }
  let terminalJournalEvidence = directJournalEvidence.at(-1)
  if (!terminalJournalEvidence) return undefined
  const orphanJournalCandidates: RetainedJournalEvidence[] = []
  for (const name of (await readdir(terminalJournalEvidence.attemptRoot)).filter((entry) => /^admission-journal-\d+\.json$/.test(entry)).sort()) {
    const path = resolve(terminalJournalEvidence.attemptRoot, name)
    const retained = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, path))
    let value: RenderAdmissionJournalSnapshot
    try {
      value = JSON.parse(retained.bytes.toString('utf8')) as RenderAdmissionJournalSnapshot
      validateRenderAdmissionJournalSnapshot(value)
    } catch {
      throw CLIUsageError('Stored TTS attempt contains an invalid orphan admission-journal artifact; reconciliation is required.')
    }
    if (knownJournalSnapshots.has(value.snapshotId)) continue
    if (
      value.journalId !== terminalJournalEvidence.value.journalId
      || value.renderIdentity !== pure.renderIdentity
      || value.renderPlanId !== pure.renderPlanId
      || value.invocationId !== terminalJournalEvidence.value.invocationId
      || value.attempt !== terminalJournalEvidence.value.attempt
    ) throw CLIUsageError('Stored TTS attempt contains a cross-attempt orphan journal; reconciliation is required.')
    orphanJournalCandidates.push({ value, path, sha256: retained.sha256, attemptRoot: terminalJournalEvidence.attemptRoot })
  }
  // A canonical event may point at a later snapshot without publishing every
  // immutable ancestor as its own event. Those older files are retained chain
  // evidence, not orphan descendants of the canonical frontier.
  const attemptJournalBySnapshot = new Map<string, RetainedJournalEvidence>(
    directJournalEvidence
      .filter((entry) => entry.attemptRoot === terminalJournalEvidence?.attemptRoot)
      .map((entry) => [entry.value.snapshotId, entry])
  )
  for (const candidate of orphanJournalCandidates) attemptJournalBySnapshot.set(candidate.value.snapshotId, candidate)
  let ancestor = terminalJournalEvidence
  while (ancestor.value.previousSnapshotId) {
    const candidate = attemptJournalBySnapshot.get(ancestor.value.previousSnapshotId)
    if (!candidate) break
    validateRenderAdmissionJournalSnapshot(ancestor.value, candidate.value)
    const orphanIndex = orphanJournalCandidates.indexOf(candidate)
    if (orphanIndex >= 0) orphanJournalCandidates.splice(orphanIndex, 1)
    ancestor = candidate
  }
  while (true) {
    const children = orphanJournalCandidates.filter((candidate) => candidate.value.previousSnapshotId === terminalJournalEvidence?.value.snapshotId)
    if (children.length === 0) break
    if (children.length !== 1) throw CLIUsageError('Stored TTS attempt contains a forked orphan journal chain; reconciliation is required.')
    const child = children[0] as RetainedJournalEvidence
    validateRenderAdmissionJournalSnapshot(child.value, terminalJournalEvidence.value)
    terminalJournalEvidence = child
    knownJournalSnapshots.add(child.value.snapshotId)
    orphanJournalCandidates.splice(orphanJournalCandidates.indexOf(child), 1)
  }
  if (orphanJournalCandidates.length > 0) {
    throw CLIUsageError('Stored TTS attempt contains an unchained orphan journal; reconciliation is required.')
  }
  journalEvidenceById.set(terminalJournalEvidence.value.journalId, terminalJournalEvidence)

  type RetainedBatchCandidate = {
    batchId: string
    generationSlotId: string
    batchResultId: string
    path: string
    sha256: string
    attemptRoot: string
  }
  const batchCandidates = new Map<string, RetainedBatchCandidate>()
  const addBatchCandidate = (candidate: RetainedBatchCandidate): void => {
    const existing = batchCandidates.get(candidate.batchResultId)
    if (existing && canonicalTtsJson(existing) !== canonicalTtsJson(candidate)) {
      throw CLIUsageError('Stored TTS batch-result identity has conflicting retained artifact bindings.')
    }
    batchCandidates.set(candidate.batchResultId, candidate)
  }
  for (const evidence of journalEvidenceById.values()) {
    for (const reference of evidence.value.recordedBatchResults) {
      addBatchCandidate({
        batchId: reference.batchId,
        generationSlotId: reference.generationSlotId,
        batchResultId: reference.batchResultId,
        path: resolveRetainedPath(evidence.attemptRoot, reference.batchResultRef, 'Stored provider batch result'),
        sha256: reference.batchResultSha256,
        attemptRoot: evidence.attemptRoot
      })
    }
  }
  for (const event of retainedRender.events) {
    for (const batch of event.batchProgress ?? []) {
      for (const slot of batch.generationSlots) {
        if (slot.source !== 'provider-dispatch' || !slot.batchResult) continue
        const path = resolveRetainedPath(renderRoot, slot.batchResult.path, 'Stored provider batch result')
        const relativeResult = relative(renderRoot, path).split(sep)
        const batchResultsIndex = relativeResult.lastIndexOf('batch-results')
        if (batchResultsIndex < 1) throw CLIUsageError('Stored provider batch result is outside an immutable provider attempt.')
        addBatchCandidate({
          batchId: batch.batchId,
          generationSlotId: slot.generationSlotId,
          batchResultId: slot.batchResult.batchResultId,
          path,
          sha256: slot.batchResult.sha256,
          attemptRoot: resolve(renderRoot, ...relativeResult.slice(0, batchResultsIndex))
        })
      }
    }
  }

  const loadedBatches: LoadedRecoveryBatch[] = []
  for (const candidate of batchCandidates.values()) {
    const { path, attemptRoot } = candidate
    const value = await readVerifiedJson<ProviderBatchResult>(options.rootDir, path, candidate.sha256, 'Stored provider batch result')
    validateProviderBatchResult(value)
    if (
      value.batchResultId !== candidate.batchResultId
      || value.batchId !== candidate.batchId
      || value.generationSlotId !== candidate.generationSlotId
      || value.renderIdentity !== pure.renderIdentity
      || value.renderPlanId !== pure.renderPlanId
      || value.provenance !== 'provider-dispatch'
    ) throw CLIUsageError('Stored provider batch result is not a complete success for the exact planned render.')
    const admissionPath = resolveRetainedPath(attemptRoot, value.admissionBasis.artifactRef, 'Stored provider batch admission basis')
    const admission = await readVerifiedJson<RenderAdmissionJournalSnapshot>(options.rootDir, admissionPath, value.admissionBasis.sha256, 'Stored provider batch admission basis')
    validateRenderAdmissionJournalSnapshot(admission)
    if (
      admission.journalId !== value.admissionBasis.journalId
      || admission.snapshotId !== value.admissionBasis.snapshotId
      || admission.renderIdentity !== pure.renderIdentity
      || admission.renderPlanId !== pure.renderPlanId
    ) throw CLIUsageError('Stored provider batch result does not bind its exact admission-journal basis.')
    knownJournalSnapshots.add(admission.snapshotId)
    if (!journalEvidenceById.has(admission.journalId)) {
      journalEvidenceById.set(admission.journalId, { value: admission, path: admissionPath, sha256: value.admissionBasis.sha256, attemptRoot })
    }
    if (value.status !== 'succeeded') continue
    const invocationPlanPath = resolveRetainedPath(attemptRoot, value.batchInvocationPlan.artifactRef, 'Stored batch invocation plan')
    const invocationPlan = await readVerifiedJson<ProviderBatchInvocationPlan>(
      options.rootDir,
      invocationPlanPath,
      value.batchInvocationPlan.sha256,
      'Stored batch invocation plan'
    )
    if (
      invocationPlan.batchInvocationPlanId !== value.batchInvocationPlan.batchInvocationPlanId
      || invocationPlan.renderIdentity !== pure.renderIdentity
      || invocationPlan.renderPlanId !== pure.renderPlanId
      || invocationPlan.generationSlotId !== value.generationSlotId
    ) throw CLIUsageError('Stored batch invocation plan does not bind its exact promoted generation slot.')
    const outputPaths: string[] = []
    for (const output of value.outputs) {
      const outputPath = resolveRetainedPath(dirname(path), output.artifactRef, 'Stored provider batch audio')
      const outputFile = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, outputPath))
      if (outputFile.sha256 !== output.sha256) {
        throw CLIUsageError('Stored provider batch audio checksum does not match its promoted result.')
      }
      outputPaths.push(outputPath)
    }
    if (outputPaths.length === 0) throw CLIUsageError('Stored successful provider batch result has no retained audio output.')
    const conflictingSlot = loadedBatches.find((batch) => batch.value.generationSlotId === value.generationSlotId)
    if (conflictingSlot && conflictingSlot.value.batchResultId !== value.batchResultId) {
      throw CLIUsageError(`Stored TTS generation slot ${value.generationSlotId} has conflicting promoted batch results.`)
    }
    if (!conflictingSlot) loadedBatches.push({ value: value as Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>, path, sha256: candidate.sha256, attemptRoot, outputPaths })
  }

  const completedSlotIds = new Set<string>()
  const retainedAttemptCosts: PlannedCost[] = []
  const costedDispatches = new Set<string>()
  for (const evidence of journalEvidenceById.values()) {
    for (const request of evidence.value.requests) {
      if (!plannedSlotIds.includes(request.generationSlotId)) {
        throw CLIUsageError('Stored TTS admission journal contains a request outside the immutable generation-slot plan.')
      }
      const terminal = request.transitions.at(-1)?.state
      if (terminal === 'completed') completedSlotIds.add(request.generationSlotId)
      if (request.retryOfRequestOrdinal === undefined && request.transitions.some((transition) => transition.state === 'dispatch-started')) {
        const key = `${evidence.value.invocationId}\0${request.generationSlotId}`
        if (!costedDispatches.has(key)) {
          const slot = pure.planned.slots.find((entry) => entry.generationSlotId === request.generationSlotId)
          if (!slot) throw CLIUsageError('Stored TTS dispatch has no matching immutable planned slot cost.')
          costedDispatches.add(key)
          retainedAttemptCosts.push(slot.plannedCost)
        }
      }
    }
  }
  for (const slotId of plannedSlotIds) {
    const requests = [...journalEvidenceById.values()].flatMap((evidence) => evidence.value.requests.filter((request) => request.generationSlotId === slotId))
    const terminalStates = requests.map((request) => request.transitions.at(-1)?.state)
    if (terminalStates.filter((state) => state === 'completed').length > 1) {
      throw CLIUsageError(`Stored TTS generation slot ${slotId} has more than one completed deliberate request.`)
    }
    const unsafe = terminalStates.find((state) =>
      state !== 'completed'
      && state !== 'prepared'
      && state !== 'provider-rejected'
      && state !== 'confirmed-not-admitted')
    if (unsafe !== undefined) {
      throw CLIUsageError(`Stored TTS generation slot ${slotId} has ${unsafe} provider work; automatic redispatch is blocked pending reconciliation.`)
    }
  }
  for (const batch of loadedBatches) {
    if (!completedSlotIds.has(batch.value.generationSlotId)) {
      throw CLIUsageError('Stored successful provider batch result is not backed by one completed slot request.')
    }
    const key = `${batch.value.invocationId}\0${batch.value.generationSlotId}`
    if (!costedDispatches.has(key)) {
      costedDispatches.add(key)
      retainedAttemptCosts.push(batch.value.cost.planned)
    }
  }
  const retainedCumulativePlannedCost = sumCosts(retainedAttemptCosts)
  for (const slotId of completedSlotIds) {
    if (loadedBatches.filter((batch) => batch.value.generationSlotId === slotId).length !== 1) {
      throw CLIUsageError(`Stored completed TTS generation slot ${slotId} has no exact promoted batch result.`)
    }
  }
  if (loadedBatches.length === 0) return { kind: 'safe-redispatch', retainedCumulativePlannedCost }
  const allCompleted = loadedBatches.length === plannedSlotIds.length
    && plannedSlotIds.every((slotId) => loadedBatches.some((batch) => batch.value.generationSlotId === slotId))
  if (!allCompleted) {
    if (pure.planned.strategy !== 'segmented') {
      throw CLIUsageError('Partial completed-slot recovery is supported only for immutable segmented dialogue renders; redispatch is blocked.')
    }
    return { kind: 'partial-slots', recoveredSlots: loadedBatches, retainedCumulativePlannedCost }
  }

  let terminalJournal = terminalJournalEvidence.value
  let terminalJournalPath = terminalJournalEvidence.path
  let terminalJournalSha256 = terminalJournalEvidence.sha256
  let renderResult: ProviderRenderResult | undefined
  let resultPath: string | undefined
  let resultSha256: string | undefined
  for (const aggregateJournalEvidence of [...journalEvidenceById.values()].reverse()) {
    const aggregateReference = aggregateJournalEvidence.value.recordedResult
    if (!aggregateReference) continue
    const candidatePath = resolveRetainedPath(aggregateJournalEvidence.attemptRoot, aggregateReference.resultRef, 'Stored provider render result')
    const candidate = await readVerifiedJson<ProviderRenderResult>(options.rootDir, candidatePath, aggregateReference.resultSha256, 'Stored provider render result')
    validateProviderRenderResult(candidate)
    if (
      candidate.resultIdentity !== aggregateReference.resultIdentity
      || candidate.renderIdentity !== pure.renderIdentity
      || candidate.renderPlanId !== pure.renderPlanId
    ) throw CLIUsageError('Stored provider render result does not bind the exact planned render.')
    if (candidate.status !== 'succeeded') continue
    if (renderResult && renderResult.resultIdentity !== candidate.resultIdentity) {
      throw CLIUsageError('Stored TTS render has conflicting successful aggregate provider results; reconciliation is required.')
    }
    renderResult = candidate
    resultPath = candidatePath
    resultSha256 = aggregateReference.resultSha256
    terminalJournal = aggregateJournalEvidence.value
    terminalJournalPath = aggregateJournalEvidence.path
    terminalJournalSha256 = aggregateJournalEvidence.sha256
  }
  const terminalReadinessAuthorization = [...retainedRender.events].reverse().find((event) =>
    event.attempt === terminalJournal.attempt && event.readinessAuthorization)?.readinessAuthorization

  return {
    kind: 'complete-render',
    preparedState: options.state,
    chunkCount: plannedSlotIds.length,
    finalize: async (workspaceDir, reportedOutputPath) => {
      const orderedBatches = pure.planned.slots.map((slot) => loadedBatches.find((batch) => batch.value.generationSlotId === slot.generationSlotId) as LoadedRecoveryBatch)
      if (!renderResult || !resultPath || !resultSha256) {
        const batchRefs: ProviderBatchResultRef[] = orderedBatches.map((batch) => ({
          batchId: batch.value.batchId,
          generationSlotId: batch.value.generationSlotId,
          batchResultId: batch.value.batchResultId,
          artifactRef: contained(renderRoot, batch.path),
          sha256: batch.sha256
        }))
        const observedRequests = orderedBatches.flatMap((batch) => batch.value.observedRequests)
        const requestedTurnIds = pure.planned.turns.map((turn) => turn.canonical.turnId)
        const turnOutcomes = requestedTurnIds.map((turnId) => {
          const batches = orderedBatches.filter((batch) => batch.value.requestedTurnIds.includes(turnId))
          const requests = batches.flatMap((batch) => batch.value.observedRequests.filter((request) =>
            request.turns.some((turn) => turn.turnId === turnId)))
          return {
            turnId,
            status: 'succeeded' as const,
            observedRequests: requests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
            batchIds: [...new Set(batches.map((batch) => batch.value.batchId))],
            generationSlotIds: batches.map((batch) => batch.value.generationSlotId),
            outputIds: batches.flatMap((batch) => batch.value.outputs.map((output) => output.outputId))
          }
        })
        const compositionId = hashCanonicalTtsValue({
          renderPlanId: pure.renderPlanId,
          renderIdentity: pure.renderIdentity,
          batchResults: batchRefs
        })
        const promoted = withIdentity({
          schemaVersion: 1 as const,
          closedBy: { kind: 'local-composition' as const, compositionId },
          renderPlanId: pure.renderPlanId,
          renderIdentity: pure.renderIdentity,
          status: 'succeeded' as const,
          requestedTurnIds,
          batchResults: batchRefs,
          observedRequests,
          outputs: orderedBatches.flatMap((batch) => batch.value.outputs.map((output) => ({ ...output, batchResultId: batch.value.batchResultId }))),
          generatedBatches: orderedBatches.flatMap((batch) => batch.value.generatedBatch ? [batch.value.generatedBatch] : []),
          turnOutcomes,
          createdResources: orderedBatches.flatMap((batch) => batch.value.createdResources),
          retryAttempts: orderedBatches.flatMap((batch) => batch.value.retryAttempts),
          cost: {
            currentComposition: { planned: pure.plannedRenderCost, observed: [] },
            closingAttempt: { planned: { amounts: [] }, observed: [] },
            cumulativeRenderHistory: { planned: retainedCumulativePlannedCost, observed: [] }
          }
        }, 'resultIdentity') as ProviderRenderResult
        validateProviderRenderResult(promoted)
        const resultFile = await writeJsonCreateOnly(options.rootDir, `${renderRoot}/compositions/${compositionId}/provider-render-result.json`, promoted)
        renderResult = promoted
        resultPath = resultFile.path
        resultSha256 = resultFile.sha256
      }
      const activeRenderResult = renderResult
      const activeResultPath = resultPath
      const activeResultSha256 = resultSha256
      if (!activeRenderResult || !activeResultPath || !activeResultSha256) {
        throw InternalError('Completed TTS recovery did not promote one aggregate provider result.', { stage: 'tts:reconciliation' })
      }
      const orderedOutputs = orderedBatches.flatMap((batch) => batch.outputPaths)
      const masteringProfile = options.ttsOptions.ttsMasteringProfile
      const assembledPath = options.comicContext && pure.planned.strategy === 'segmented'
        ? await assembleComicSegmentedAudio({
            dialoguePlan: options.comicContext.dialoguePlan,
            turns: pure.planned.turns.map(turn => turn.canonical),
            slots: pure.planned.slots,
            outputPathsBySlot: new Map(orderedBatches.map(batch => [batch.value.generationSlotId, batch.outputPaths] as const)),
            masteringDir: workspaceDir,
            providerLabel: `${options.target.service}-recovery`,
            profile: masteringProfile ?? (() => { throw CLIUsageError('Comic segmented recovery requires an explicit mastering profile.') })(),
          })
        : await concatAndConvertToWav(orderedOutputs, workspaceDir, `${options.target.service}-recovery`, undefined, masteringProfile)
      const recoveryAt = terminalJournal.capturedAt
      const audioRunRoot = `${renderRoot}/results/${activeRenderResult.resultIdentity}/recovery-audio-run-${terminalJournal.snapshotId.slice(0, 16)}`
      const finalPath = `${audioRunRoot}/final.wav`
      await copyCreateOnly(options.rootDir, assembledPath, finalPath)
      const finalAudio = await readObservedAudio(options.rootDir, finalPath)
      const speechSources = activeRenderResult.outputs.map((output) => ({ kind: 'provider-output' as const, sourceId: output.outputId, resultIdentity: activeRenderResult.resultIdentity, batchResultId: output.batchResultId, outputId: output.outputId, artifactRef: output.artifactRef, sha256: output.sha256 }))
      const assemblyParametersHash = hashCanonicalTtsValue({ sourceIds: speechSources.map((source) => source.sourceId), strategy: pure.planned.strategy, requestedOutput: requestedOutput(options), recoveryJournalSnapshotId: terminalJournal.snapshotId, dialogueNodes: pure.planned.dialoguePlan.nodes })
      const mixPlan = withIdentity({
        schemaVersion: 1 as const,
        renderIdentity: pure.renderIdentity,
        outputProfileHash: pure.outputProfileHash,
        sources: speechSources,
        operations: [{ kind: options.comicContext && pure.planned.strategy === 'segmented' ? 'dialogue-node-assembly' : speechSources.length > 1 ? 'ordered-concat' : 'single-source', parametersHash: assemblyParametersHash }],
        createdAt: recoveryAt
      }, 'mixPlanId')
      const mixPlanFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/mix-plan.json`, mixPlan)
      const transcodeParametersHash = hashCanonicalTtsValue({ ...requestedOutput(options), orderedConcat: speechSources.length > 1 })
      const transformOperation = {
        operationId: hashCanonicalTtsValue({ kind: 'transcode', transcodeParametersHash, finalDurationMs: finalAudio.durationMs }),
        kind: 'transcode' as const,
        finalRangeMs: { start: 0, end: finalAudio.durationMs },
        parametersHash: transcodeParametersHash
      }
      const turnDuration = (turnId: string): number => loadedBatches
          .filter((batch) => batch.value.requestedTurnIds.length === 1 && batch.value.requestedTurnIds[0] === turnId)
          .flatMap((batch) => batch.value.outputs)
          .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
      const layout = options.comicContext ? comicTimelineLayout(options.comicContext.dialoguePlan, turnDuration) : undefined
      let genericTimelineCursorMs = 0
      const assembledTurns = layout?.turns ?? pure.planned.turns.map((turn) => {
        const startMs = genericTimelineCursorMs
        genericTimelineCursorMs += turnDuration(turn.canonical.turnId)
        return { turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, startMs, endMs: genericTimelineCursorMs }
      })
      const effectOperations = assembledTurns.flatMap((assembled) => {
        const turn = pure.planned.turns.find(candidate => candidate.canonical.turnId === assembled.turnId)?.canonical
        if (!turn?.effect || !localVoiceEffectFilter(turn)) return []
        const parametersHash = hashCanonicalTtsValue(turn.effect)
        return [{ operationId: hashCanonicalTtsValue({ kind: 'effect', turnId: assembled.turnId, parametersHash, finalRangeMs: { start: assembled.startMs, end: assembled.endMs } }), kind: 'effect' as const, finalRangeMs: { start: assembled.startMs, end: assembled.endMs }, parametersHash }]
      })
      const overlapOperations = (layout?.overlaps ?? []).map((overlap) => {
        const parametersHash = hashCanonicalTtsValue({ groupId: overlap.groupId })
        return { operationId: hashCanonicalTtsValue({ kind: 'overlap', groupId: overlap.groupId, parametersHash, finalRangeMs: { start: overlap.start, end: overlap.end } }), kind: 'overlap' as const, finalRangeMs: { start: overlap.start, end: overlap.end }, parametersHash }
      })
      const ledger = withIdentity({ schemaVersion: 1 as const, renderIdentity: pure.renderIdentity, operations: [transformOperation, ...effectOperations, ...overlapOperations] }, 'transformLedgerId')
      const ledgerFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/transform-ledger.json`, ledger)
      const hasTiming = pure.planned.strategy === 'segmented' && assembledTurns.every((turn) => turn.endMs > turn.startMs)
      const timeline = withIdentity({
        schemaVersion: 1 as const,
        renderIdentity: pure.renderIdentity,
        timing: hasTiming
          ? { availability: 'timed' as const, clock: 'final-audio-ms' as const, provenance: 'assembled-segments' as const, turns: assembledTurns }
          : { availability: 'unavailable' as const, clock: 'final-audio-ms' as const, provenance: 'unavailable' as const, turns: pure.planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey })), reason: 'Recovered provider timing was not exposed at exact turn boundaries.' },
        speechSources,
        transformLedgerRef: { path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 }
      }, 'timelineId')
      const timelineFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/final-timeline.json`, timeline)
      const audioRun = withIdentity({
        schemaVersion: 1 as const,
        targetKey: pure.targetKey,
        renderPlanId: pure.renderPlanId,
        renderIdentity: pure.renderIdentity,
        providerResult: { resultIdentity: activeRenderResult.resultIdentity, path: contained(renderRoot, activeResultPath), sha256: activeResultSha256 },
        takeSelections: [],
        continuationCheckpoints: [],
        mixPlan: { mixPlanId: mixPlan.mixPlanId, path: contained(audioRunRoot, mixPlanFile.path), sha256: mixPlanFile.sha256 },
        transformLedger: { transformLedgerId: ledger.transformLedgerId, path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
        finalTimeline: { timelineId: timeline.timelineId, path: contained(audioRunRoot, timelineFile.path), sha256: timelineFile.sha256 },
        finalOutputs: [{ path: contained(audioRunRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes), format: finalAudio.format, durationMs: finalAudio.durationMs }],
        createdAt: recoveryAt
      }, 'audioRunId') as AudioRun
      const audioRunFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/audio-run.json`, audioRun)
      await copyCreateOnly(options.rootDir, assembledPath, reportedOutputPath)
      const reportedBytes = (await readContainedArtifactFile(options.rootDir, contained(options.rootDir, reportedOutputPath))).bytes
      const readinessAuthorization = terminalReadinessAuthorization
      if (activeRenderResult.closedBy.kind === 'provider-attempt' && !readinessAuthorization) {
        throw CLIUsageError('Stored completed TTS attempt has no exact readiness authorization.')
      }
      const nextEventSequence = (retainedRender.events.at(-1)?.sequence ?? 0) + 1
      const batchProgress = pure.planned.batches.map((batch) => ({
        batchId: batch.batchId,
        generationSlots: batch.generationSlots.map((slot) => {
          const loaded = loadedBatches.find((entry) => entry.value.generationSlotId === slot.generationSlotId) as LoadedRecoveryBatch
          return {
            generationSlotId: slot.generationSlotId,
            source: 'provider-dispatch' as const,
            batchInvocationPlan: {
              batchInvocationPlanId: loaded.value.batchInvocationPlan.batchInvocationPlanId,
              path: contained(renderRoot, resolveRetainedPath(loaded.attemptRoot, loaded.value.batchInvocationPlan.artifactRef, 'Stored batch invocation plan')),
              sha256: loaded.value.batchInvocationPlan.sha256
            },
            batchResult: { batchResultId: loaded.value.batchResultId, path: contained(renderRoot, loaded.path), sha256: loaded.sha256, status: loaded.value.status }
          }
        })
      }))
      const terminalEvent = {
        sequence: nextEventSequence,
        status: 'succeeded' as const,
        at: recoveryAt,
        attempt: terminalJournal.attempt,
        ...(activeRenderResult.closedBy.kind === 'provider-attempt' ? {
          readinessAuthorization: readinessAuthorization as NonNullable<typeof readinessAuthorization>,
          admissionJournalSnapshotId: terminalJournal.snapshotId,
          admissionJournalRef: contained(providerRoot, terminalJournalPath),
          admissionJournalSha256: terminalJournalSha256
        } : {}),
        providerRenderResultIdentity: activeRenderResult.resultIdentity,
        providerRenderResultRef: contained(providerRoot, activeResultPath),
        providerRenderResultSha256: activeResultSha256,
        batchProgress,
        outputRefs: [{ path: contained(providerRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes) }],
        reportedOutputRefs: [{ path: contained(options.rootDir, reportedOutputPath), sha256: sha256Bytes(reportedBytes) }],
        audioRunId: audioRun.audioRunId,
        audioRunRef: contained(providerRoot, audioRunFile.path),
        audioRunSha256: audioRunFile.sha256
      }
      const renderHistory = resultProjection.renderHistory.map((entry) => entry.renderIdentity === pure.renderIdentity
        ? { ...entry, events: [...entry.events, terminalEvent] }
        : entry)
      const pointerAt = recoveryAt
      const pointerStart = resultProjection.pointerEvents.reduce((maximum, entry) => Math.max(maximum, entry.sequence), 0) + 1
      const projection: CanonicalAudioProviderProjection = {
        activeWork: { kind: 'render', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence },
        selectedSuccess: { renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId },
        branchHistory: resultProjection.branchHistory,
        readinessAttempts: resultProjection.readinessAttempts,
        renderHistory,
        pointerEvents: [
          ...resultProjection.pointerEvents,
          { sequence: pointerStart, action: 'activate-render', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, actor: LOCAL_ACTOR, at: pointerAt },
          { sequence: pointerStart + 1, action: 'select-success', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId, actor: LOCAL_ACTOR, at: pointerAt }
        ]
      }
      const state = stateForProjection(options.target, pure.targetKey, pure.transport, options.state.artifactDir, projection)
      await options.onProviderState?.(state)
      return { artifactDir: options.state.artifactDir, operation: pure.operation, targetKey: pure.targetKey, transport: pure.transport, renderIdentity: pure.renderIdentity, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId, strategy: pure.planned.strategy, projection }
    }
  }
}

export const createCurrentTtsRenderAttempt = async (
  options: CreateCurrentTtsRenderAttemptOptions
): Promise<CurrentTtsRenderAttempt> => {
  const now = options.now ?? (() => new Date().toISOString())
  const purePlan = buildPureCurrentTtsRenderPlan(options)
  const {
    operation,
    transport,
    targetKey,
    capability,
    capabilityFixtureHash,
    capabilityScopeHash,
    planned,
    voiceContextKey,
    outputProfileHash,
    synthesisSettingsHash,
    plannedRenderCost,
    branchCandidate,
    branchPlan,
    strategyArtifacts,
    renderPlanId,
    renderIdentity,
    renderPlan,
  } = purePlan
  const artifactRoot = (options.artifactRoot ?? 'providers').replace(/\/+$/, '')
  if (!artifactRoot || artifactRoot.includes('\\') || artifactRoot.split('/').some((part) => !part || part === '.' || part === '..')) throw CLIUsageError(`Invalid TTS provider artifact root: ${artifactRoot}`)
  const targetRelativeDir = `${artifactRoot}/${targetKey}`
  const targetDir = `${options.outputDir}/${targetRelativeDir}`
  if ((options.recoveredSlots?.length ?? 0) > 0 && planned.strategy !== 'segmented') {
    throw CLIUsageError('Recovered TTS generation slots may seed only an immutable segmented render.')
  }
  const recoveredBySlot = new Map<string, CurrentTtsRecoveredGenerationSlot>()
  for (const recovered of options.recoveredSlots ?? []) {
    const slot = planned.slots.find((entry) => entry.generationSlotId === recovered.value.generationSlotId)
    if (
      !slot
      || recoveredBySlot.has(recovered.value.generationSlotId)
      || recovered.value.renderPlanId !== renderPlanId
      || recovered.value.renderIdentity !== renderIdentity
      || recovered.value.batchId !== slot.batchId
      || recovered.value.status !== 'succeeded'
      || recovered.value.outputs.length === 0
      || recovered.outputPaths.length !== recovered.value.outputs.length
    ) throw CLIUsageError('Recovered TTS batch output does not bind one exact immutable generation slot.')
    recoveredBySlot.set(recovered.value.generationSlotId, recovered)
  }
  const unresolvedSlots = planned.slots.filter((slot) => !recoveredBySlot.has(slot.generationSlotId))
  if (unresolvedSlots.length === 0) {
    throw CLIUsageError('A new TTS provider attempt requires at least one unresolved immutable generation slot.')
  }
  const unresolvedBatchIds = [...new Set(unresolvedSlots.map((slot) => slot.batchId))]
  const unresolvedPlannedCost = sumCosts(unresolvedSlots.map((slot) => slot.plannedCost))
  const cumulativePlannedCost = sumCosts([
    options.retainedCumulativePlannedCost ?? { amounts: [] },
    unresolvedPlannedCost
  ])
  const renderRoot = `${targetDir}/renders/${renderIdentity}`
  const branchRoot = `${targetDir}/branches/${branchPlan.branchPlanId}`
  const attemptsRoot = `${renderRoot}/attempts`
  const priorAttemptNumbers = (await readdir(attemptsRoot).catch(() => []))
    .flatMap((name) => /^attempt-(\d+)(?:-|$)/.exec(name)?.[1] ? [Number.parseInt(/^attempt-(\d+)(?:-|$)/.exec(name)?.[1] as string, 10)] : [])
    .filter(Number.isFinite)
  if (options.priorAttemptCount !== undefined && (!Number.isSafeInteger(options.priorAttemptCount) || options.priorAttemptCount < 0)) {
    throw CLIUsageError('Retained TTS provider attempt count must be a non-negative safe integer.')
  }
  const priorAttemptCount = options.priorAttemptCount
    ?? (priorAttemptNumbers.length > 0 ? Math.max(...priorAttemptNumbers) : 0)
  const attemptNumber = priorAttemptCount + 1
  const invocationId = `invocation-${randomUUID()}`
  const attemptRoot = `${attemptsRoot}/attempt-${String(attemptNumber).padStart(3, '0')}-${invocationId}`
  await writeJsonCreateOnly(options.outputDir, `${renderRoot}/source-identity.json`, planned.sourceIdentity)
  await writeJsonCreateOnly(options.outputDir, `${renderRoot}/dialogue-plan.json`, planned.dialoguePlan)
  await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.normalizedDialogue.path}`, planned.normalizedText)
  await Promise.all(planned.turns.map(async (turn, index) => await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.turns[index]?.path as string}`, turn.canonical.canonicalText)))
  await Promise.all(planned.slots.map(async (slot, index) => await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.generationSlots[index]?.path as string}`, slot.providerText)))
  const capabilityFixtureFile = await writeJsonCreateOnly(options.outputDir, `${targetDir}/capability-fixtures/${capabilityFixtureHash}.json`, capability)
  const branchFile = await writeJsonCreateOnly(options.outputDir, `${branchRoot}/branch-plan.json`, branchPlan)
  const renderPlanFile = await writeJsonCreateOnly(options.outputDir, `${renderRoot}/render-plan.json`, renderPlan)
  const readinessCheckedAt = now()
  const accountScopeHash = hashCanonicalTtsValue({
    provider: options.target.service,
    transport,
    credentialScope: options.target.service === 'kitten' ? 'local-process' : 'configured-provider-account'
  })
  const capabilityObservation = withIdentity({
    capabilityScopeHash,
    capabilityFixtureHash,
    accountScopeHash,
    state: 'available' as const,
    satisfiedRequirements: [],
    unmetRequirements: [],
    checkedAt: readinessCheckedAt,
    evidenceRefs: [contained(targetDir, capabilityFixtureFile.path)]
  }, 'observationHash') as AccountCapabilityObservation
  validateAccountCapabilityObservation(capabilityObservation, { capabilityScopeHash, capabilityFixtureHash, accountScopeHash })
  const readinessResult = withIdentity({
    schemaVersion: 1 as const,
    branchPlanId: branchPlan.branchPlanId,
    targetKey,
    status: 'ready' as const,
    capabilityFixture: { capabilityFixtureHash, path: contained(targetDir, capabilityFixtureFile.path), sha256: capabilityFixtureFile.sha256 },
    capabilityObservations: [capabilityObservation],
    candidateReadiness: [{ candidateId: branchCandidate.candidateId, strategy: planned.strategy, requiredCapabilityScopeHashes: [capabilityScopeHash], accountObservationHashes: [capabilityObservation.observationHash], status: 'ready' as const, errors: [] }],
    resolvedVoices: planned.turns.map((turn) => ({
      locatorHash: bindingIdentityHash(turn.binding),
      providerVoice: turn.binding.providerVoice,
      ...(turn.binding.kind === 'approved-snapshot' && turn.binding.providerRevision ? { providerRevision: turn.binding.providerRevision } : {}),
      externallyMutable: turn.binding.providerVoice.kind === 'remote-resource'
    })),
    checkedAt: readinessCheckedAt,
    errors: []
  }, 'readinessResultHash') as ProviderReadinessResult
  const priorReadinessArtifactNumbers = (await readdir(branchRoot).catch(() => []))
    .flatMap((name) => /^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1]
      ? [Number.parseInt(/^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1] as string, 10)]
      : [])
    .filter(Number.isFinite)
  const readinessArtifactNumber = (priorReadinessArtifactNumbers.length > 0
    ? Math.max(...priorReadinessArtifactNumbers)
    : 0) + 1
  const readinessFile = await writeJsonCreateOnly(
    options.outputDir,
    `${branchRoot}/readiness-result-attempt-${String(readinessArtifactNumber).padStart(3, '0')}.json`,
    readinessResult
  )
  const readinessAuthorization = {
    readinessAttemptSequence: 1,
    branchPlanId: branchPlan.branchPlanId,
    branchCandidateId: branchCandidate.candidateId,
    readinessResultRef: contained(targetDir, readinessFile.path),
    readinessResultHash: readinessFile.sha256,
    accountObservationHashes: [capabilityObservation.observationHash]
  }
  const journalId = hashCanonicalTtsValue({ renderPlanId, renderIdentity, attempt: attemptNumber, invocationId })
  let journal = withIdentity({
    schemaVersion: 1 as const,
    journalId,
    renderPlanId,
    renderIdentity,
    invocationId,
    attempt: attemptNumber,
    plannedRequestCount: unresolvedSlots.length,
    plannedBatchIds: unresolvedBatchIds,
    plannedGenerationSlots: unresolvedSlots.map((slot) => ({ batchId: slot.batchId, generationSlotId: slot.generationSlotId })),
    requests: [],
    recordedBatchResults: [],
    capturedAt: now()
  }, 'snapshotId') as unknown as RenderAdmissionJournalSnapshot
  validateRenderAdmissionJournalSnapshot(journal)
  let journalSequence = 1
  let journalFile: WrittenJson<RenderAdmissionJournalSnapshot> | undefined
  let attemptReservation: Awaited<ReturnType<typeof reserveInvocationAttemptDirectory>> | undefined
  const requireJournalFile = (): WrittenJson<RenderAdmissionJournalSnapshot> => {
    if (!journalFile) throw InternalError('TTS admission journal was not started before attempted provider work.', { stage: 'tts:admission' })
    return journalFile
  }
  const ensureJournalStarted = async (): Promise<void> => {
    if (journalFile) return
    const reserved = await reserveInvocationAttemptDirectory(options.outputDir, {
      attemptsDirectory: contained(options.outputDir, attemptsRoot),
      attempt: attemptNumber,
      invocationId
    })
    if (reserved.relativePath !== contained(options.outputDir, attemptRoot)) {
      throw InternalError('Reserved TTS attempt directory does not match its immutable invocation identity.', { stage: 'tts:admission' })
    }
    attemptReservation = reserved
    journalFile = await writeJson(options.outputDir, `${attemptRoot}/admission-journal-${String(journalSequence).padStart(4, '0')}.json`, journal)
  }
  const preparedAt = journal.capturedAt
  const events: CanonicalAudioProviderProjection['renderHistory'][number]['events'] = [{
    sequence: 1,
    status: 'missing',
    at: preparedAt,
    attempt: 0
  }]
  const pointerEvents: CanonicalAudioProviderProjection['pointerEvents'] = [
    { sequence: 1, action: 'activate-branch', branchPlanId: branchPlan.branchPlanId, actor: LOCAL_ACTOR, at: preparedAt },
    { sequence: 2, action: 'project-branch-readiness', branchPlanId: branchPlan.branchPlanId, readinessAttemptSequence: 1, actor: LOCAL_ACTOR, at: readinessCheckedAt },
    { sequence: 3, action: 'activate-render', renderIdentity, eventSequence: 1, actor: LOCAL_ACTOR, at: preparedAt }
  ]
  const buildProjection = (terminal?: {
    result?: WrittenJson<ProviderRenderResult> | undefined
    audioRun?: WrittenJson<AudioRun> | undefined
  }): CanonicalAudioProviderProjection => ({
      activeWork: { kind: 'render', renderIdentity, eventSequence: events.length },
      ...(terminal?.result && terminal.audioRun ? { selectedSuccess: { renderIdentity, eventSequence: events.length, resultIdentity: terminal.result.value.resultIdentity, audioRunId: terminal.audioRun.value.audioRunId } } : {}),
      branchHistory: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, branchPlanRef: contained(targetDir, branchFile.path), branchPlanSha256: branchFile.sha256, createdAt: preparedAt }],
      readinessAttempts: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, readinessResultRef: contained(targetDir, readinessFile.path), readinessResultHash: readinessFile.sha256, accountObservationHashes: [capabilityObservation.observationHash], at: readinessCheckedAt, status: 'ready', admissionDisposition: 'eligible' }],
      renderHistory: [{ renderIdentity, renderPlanId, renderPlanRef: contained(targetDir, renderPlanFile.path), renderPlanSha256: renderPlanFile.sha256, voiceContextKey, synthesisSettingsHash, outputProfileHash, renderDir: contained(targetDir, renderRoot), events: events.map((event) => ({ ...event })) }],
      pointerEvents: pointerEvents.map((event) => ({ ...event }))
    })
  let currentProjection = buildProjection()
  let preparedState = stateForProjection(options.target, targetKey, transport, targetRelativeDir, currentProjection)
  const publish = async (state: PipelineProviderState): Promise<void> => {
    await options.onProviderState?.(state)
  }
  await publish(preparedState)

  let mutation: Promise<void> = Promise.resolve()
  const locked = async <T>(work: () => Promise<T>): Promise<T> => {
    const prior = mutation
    let release = () => {}
    mutation = new Promise<void>((resolve) => { release = resolve })
    await prior
    try { return await work() } finally { release() }
  }
  const runtimeRequests: RuntimeRequest[] = []
  const outputsBySlot = new Map<string, RecordedOutput[]>()
  const recoveredBatchFiles: Array<WrittenJson<ProviderBatchResult>> = planned.slots.flatMap((slot) => {
    const recovered = recoveredBySlot.get(slot.generationSlotId)
    return recovered ? [{ value: recovered.value, path: recovered.path, sha256: recovered.sha256 }] : []
  })
  const promotedBatchFiles = new Map<string, WrittenJson<ProviderBatchResult>>()
  const buildBatchProgress = (resultFiles: readonly WrittenJson<ProviderBatchResult>[]) => planned.batches.map((batch) => ({
    batchId: batch.batchId,
    generationSlots: batch.generationSlots.flatMap((slot) => {
      const request = runtimeRequests.find((entry) => entry.slot.generationSlotId === slot.generationSlotId)
      const recovered = recoveredBySlot.get(slot.generationSlotId)
      const result = resultFiles.find((file) => file.value.generationSlotId === slot.generationSlotId)
      const invocationPlan = request
        ? { batchInvocationPlanId: request.invocationFile.value.batchInvocationPlanId, path: contained(renderRoot, request.invocationFile.path), sha256: request.invocationFile.sha256 }
        : recovered
          ? {
              batchInvocationPlanId: recovered.value.batchInvocationPlan.batchInvocationPlanId,
              path: contained(renderRoot, resolveRetainedPath(recovered.attemptRoot, recovered.value.batchInvocationPlan.artifactRef, 'Recovered batch invocation plan')),
              sha256: recovered.value.batchInvocationPlan.sha256
            }
          : undefined
      return invocationPlan ? [{
        generationSlotId: slot.generationSlotId,
        source: 'provider-dispatch' as const,
        batchInvocationPlan: invocationPlan,
        ...(result ? { batchResult: { batchResultId: result.value.batchResultId, path: contained(renderRoot, result.path), sha256: result.sha256, status: result.value.status } } : {})
      }] : []
    })
  })).filter((batch) => batch.generationSlots.length > 0)
  let publishJournalState = async (): Promise<void> => {}
  const writeNextJournal = async (next: RenderAdmissionJournalSnapshot): Promise<void> => {
    requireJournalFile()
    const previous = journal
    const { snapshotId: _discardedSnapshotId, ...base } = next
    const candidate = withIdentity(base as unknown as Record<string, unknown>, 'snapshotId') as unknown as RenderAdmissionJournalSnapshot
    validateRenderAdmissionJournalSnapshot(candidate, previous)
    const candidateSequence = journalSequence + 1
    const candidateFile = await writeJson(options.outputDir, `${attemptRoot}/admission-journal-${String(candidateSequence).padStart(4, '0')}.json`, candidate)
    journal = candidate
    journalSequence = candidateSequence
    journalFile = candidateFile
    await publishJournalState()
  }
  publishJournalState = async () => {
    const at = now()
    const activeJournal = requireJournalFile()
    const retainedProgress = buildBatchProgress([...recoveredBatchFiles, ...promotedBatchFiles.values()])
    events.push({ sequence: events.length + 1, status: 'running', at, attempt: attemptNumber, readinessAuthorization, admissionJournalSnapshotId: journal.snapshotId, admissionJournalRef: contained(targetDir, activeJournal.path), admissionJournalSha256: activeJournal.sha256, ...(retainedProgress.length > 0 ? { batchProgress: retainedProgress } : {}) })
    pointerEvents.push({ sequence: pointerEvents.length + 1, action: 'activate-render', renderIdentity, eventSequence: events.length, actor: LOCAL_ACTOR, at })
    currentProjection = buildProjection()
    await publish(stateForProjection(options.target, targetKey, transport, targetRelativeDir, currentProjection))
  }
  const appendTerminalProjection = (
    status: 'succeeded' | 'failed',
    terminal: {
      result?: WrittenJson<ProviderRenderResult> | undefined
      audioRun?: WrittenJson<AudioRun> | undefined
      outputRefs?: Array<{ path: string, sha256: string }> | undefined
      reportedOutputRefs?: Array<{ path: string, sha256: string }> | undefined
      error?: SanitizedProviderError | undefined
      batchResultFiles?: Array<WrittenJson<ProviderBatchResult>> | undefined
    }
  ): CanonicalAudioProviderProjection => {
    const at = now()
    const activeJournal = requireJournalFile()
    events.push({
      sequence: events.length + 1,
      status,
      at,
      attempt: attemptNumber,
      readinessAuthorization,
      admissionJournalSnapshotId: journal.snapshotId,
      admissionJournalRef: contained(targetDir, activeJournal.path),
      admissionJournalSha256: activeJournal.sha256,
      ...(terminal.result ? { providerRenderResultIdentity: terminal.result.value.resultIdentity, providerRenderResultRef: contained(targetDir, terminal.result.path), providerRenderResultSha256: terminal.result.sha256 } : {}),
      ...(terminal.outputRefs ? { outputRefs: terminal.outputRefs } : {}),
      ...(terminal.reportedOutputRefs ? { reportedOutputRefs: terminal.reportedOutputRefs } : {}),
      ...(terminal.audioRun ? { audioRunId: terminal.audioRun.value.audioRunId, audioRunRef: contained(targetDir, terminal.audioRun.path), audioRunSha256: terminal.audioRun.sha256 } : {}),
      ...(terminal.batchResultFiles?.length ? { batchProgress: buildBatchProgress(terminal.batchResultFiles) } : {}),
      ...(terminal.error ? { error: terminal.error } : {})
    })
    pointerEvents.push({ sequence: pointerEvents.length + 1, action: 'activate-render', renderIdentity, eventSequence: events.length, actor: LOCAL_ACTOR, at })
    if (status === 'succeeded' && terminal.result && terminal.audioRun) pointerEvents.push({ sequence: pointerEvents.length + 1, action: 'select-success', renderIdentity, eventSequence: events.length, resultIdentity: terminal.result.value.resultIdentity, audioRunId: terminal.audioRun.value.audioRunId, actor: LOCAL_ACTOR, at })
    return buildProjection(terminal)
  }
  const advanceJournal = async (requests: RenderAdmissionJournalSnapshot['requests'], capturedAt = now()): Promise<void> => await writeNextJournal({
    ...journal,
    previousSnapshotId: journal.snapshotId,
    requests,
    capturedAt
  })
  const promoteBatchResult = async (
    slot: AttemptSlot,
    closingError?: SanitizedProviderError | undefined
  ): Promise<WrittenJson<ProviderBatchResult>> => {
    const existing = promotedBatchFiles.get(slot.generationSlotId)
    if (existing) return existing
    const requests = runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId)
    if (requests.length === 0) {
      throw InternalError('A provider batch result cannot be promoted before serializer dispatch.', { stage: 'tts:admission' })
    }
    const recordedOutputs = outputsBySlot.get(slot.generationSlotId) ?? []
    const providerCompleted = requests.some((entry) => entry.terminal === 'completed')
    const succeeded = providerCompleted && recordedOutputs.length > 0
    const ambiguous = !succeeded && requests.some((entry) => entry.terminal === 'ambiguous' || entry.terminal === undefined)
    const status = succeeded ? 'succeeded' as const : ambiguous ? 'ambiguous' as const : 'failed' as const
    const batchResultDir = `${attemptRoot}/batch-results/${slot.batchId}/${slot.generationSlotId}`
    const outputs: ProviderBatchOutput[] = recordedOutputs.map((output, outputIndex) => ({
      outputId: `output-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputIndex, sha256: output.sha256, format: output.format }).slice(0, 24)}`,
      artifactRef: output.relativeToBatchResult,
      sha256: output.sha256,
      format: output.format,
      durationMs: output.durationMs
    }))
    const localError = status === 'succeeded' ? undefined : closingError ?? {
      phase: 'synthesis' as const,
      code: status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'provider_request_failed',
      message: status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'Provider request failed.',
      retryable: status === 'ambiguous'
    }
    const admissionBasis = requireJournalFile()
    const admissionSnapshotId = journal.snapshotId
    const firstRequest = requests[0]
    if (!firstRequest) {
      throw InternalError('A provider batch result is missing its immutable invocation plan.', { stage: 'tts:admission' })
    }
    const resultBase = {
      schemaVersion: 1 as const,
      renderPlanId,
      renderIdentity,
      batchId: slot.batchId,
      generationSlotId: slot.generationSlotId,
      status,
      requestedTurnIds: slot.turnIds,
      outputs: succeeded ? outputs : [],
      ...(succeeded ? {
        generatedBatch: {
          batchId: slot.batchId,
          generationSlotId: slot.generationSlotId,
          takes: outputs.map((output, outputIndex) => ({
            ...(() => {
              const recorded = recordedOutputs[outputIndex]
              return recorded?.providerGenerationId
                ? { providerGenerationId: recorded.providerGenerationId, continuationCandidate: { kind: 'provider-generation-id' as const, value: recorded.providerGenerationId } }
                : {}
            })(),
            takeId: `take-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputId: output.outputId, sha256: output.sha256 }).slice(0, 24)}`,
            generationSlotId: slot.generationSlotId,
            audio: { artifactRef: output.artifactRef, outputId: output.outputId, sha256: output.sha256, format: output.format },
            durationMs: output.durationMs ?? 0,
            timing: recordedOutputs[outputIndex]?.timing ?? {
              availability: 'unavailable' as const,
              clock: 'take-audio-ms' as const,
              provenance: 'unavailable' as const,
              turns: slot.turnIds.map((turnId) => ({
                turnId,
                subjectKey: (planned.turns.find((turn) => turn.canonical.turnId === turnId) as AttemptTurn).canonical.subjectKey
              })),
              reason: 'Provider timing was not exposed by the adapter.'
            },
            warnings: [...(recordedOutputs[outputIndex]?.warnings ?? [])]
          })),
          batchCost: { planned: slot.plannedCost, observed: [] },
          costEvidence: [],
          generatedAt: now(),
          source: 'provider-dispatch' as const,
          batchInvocationPlanId: firstRequest.invocationFile.value.batchInvocationPlanId,
          observedRequestOrdinals: requests.map((entry) => entry.request.requestOrdinal)
        }
      } : {}),
      turnOutcomes: slot.turnIds.map((turnId) => ({
        turnId,
        status,
        outputIds: succeeded ? outputs.map((output) => output.outputId) : [],
        ...(localError ? { error: localError } : {})
      })),
      createdResources: [],
      cost: { planned: slot.plannedCost, observed: [] },
      ...(localError ? { error: localError } : {}),
      provenance: 'provider-dispatch' as const,
      invocationId,
      attempt: attemptNumber,
      batchInvocationPlan: {
        batchInvocationPlanId: firstRequest.invocationFile.value.batchInvocationPlanId,
        artifactRef: contained(attemptRoot, firstRequest.invocationFile.path),
        sha256: firstRequest.invocationFile.sha256
      },
      admissionBasis: {
        journalId,
        snapshotId: admissionSnapshotId,
        artifactRef: contained(attemptRoot, admissionBasis.path),
        sha256: admissionBasis.sha256
      },
      observedRequests: requests.map((entry) => entry.request),
      retryAttempts: requests.flatMap((entry) => entry.retry ? [entry.retry] : [])
    }
    const result = withIdentity(resultBase, 'batchResultId') as unknown as ProviderBatchResult
    validateProviderBatchResult(result)
    const file = await writeJson(options.outputDir, `${batchResultDir}/provider-batch-result.json`, result)
    promotedBatchFiles.set(slot.generationSlotId, file)
    const reference = {
      batchId: file.value.batchId,
      generationSlotId: file.value.generationSlotId,
      batchResultId: file.value.batchResultId,
      batchResultRef: contained(attemptRoot, file.path),
      batchResultSha256: file.sha256,
      admissionBasisSnapshotId: admissionSnapshotId
    }
    const existingReference = journal.recordedBatchResults.find((entry) => entry.generationSlotId === slot.generationSlotId)
    if (existingReference) {
      if (canonicalTtsJson(existingReference) !== canonicalTtsJson(reference)) {
        throw CLIUsageError('TTS admission journal contains conflicting batch-result evidence for one generation slot.')
      }
      return file
    }
    await writeNextJournal({
      ...journal,
      previousSnapshotId: journal.snapshotId,
      recordedBatchResults: [...journal.recordedBatchResults, reference],
      capturedAt: now()
    })
    return file
  }
  const slotFor = (invocation: TtsTargetInvocation | undefined, observation: TtsSerializedRequestObservation): AttemptSlot => {
    const candidates = invocation
      ? planned.slots.filter((slot) => slot.turnIds.includes(invocation.sourceId))
      : planned.slots
    const slot = candidates[observation.chunkIndex - 1]
    if (!slot) throw CLIUsageError(`Serializer emitted unplanned TTS chunk ${observation.chunkIndex}; dispatch was blocked before transport.`)
    return slot
  }
  const scopeFor = (invocation?: TtsTargetInvocation | undefined): TtsRequestEvidenceScope => ({
    forInvocation: (child) => scopeFor(child),
    recoverCompletedOutputs: invocation ? async () => {
      const invocationSlots = planned.slots.filter((slot) => slot.turnIds.includes(invocation.sourceId))
      const recovered = invocationSlots.flatMap((slot) => {
        const retained = recoveredBySlot.get(slot.generationSlotId)
        return retained ? [retained] : []
      })
      if (recovered.length === 0) return undefined
      if (recovered.length !== invocationSlots.length) {
        throw CLIUsageError(`Recovered TTS output covers only part of invocation ${invocation.sourceId}; provider redispatch is blocked.`)
      }
      return {
        paths: recovered.flatMap((entry) => [...entry.outputPaths]),
        generationSlotIds: recovered.map((entry) => entry.value.generationSlotId)
      }
    } : undefined,
    dispatch: async (observation, attempt, operationFn) => {
      const slot = slotFor(invocation, observation)
      if (recoveredBySlot.has(slot.generationSlotId)) {
        throw CLIUsageError(`TTS generation slot ${slot.generationSlotId} already has verified retained output; provider redispatch is blocked.`)
      }
      if (observation.providerText !== slot.providerText) throw CLIUsageError('TTS serializer text differs from the immutable planned generation slot; dispatch was blocked.')
      if (observation.endpointKind !== slot.expectedEndpointKind || observation.serializerVersion !== slot.expectedSerializerVersion) throw CLIUsageError('TTS serializer endpoint/version is not authorized by the immutable render plan; dispatch was blocked.')
      if (hashCanonicalTtsValue(observation.requestControls ?? {}) !== slot.expectedRequestControlsHash) throw CLIUsageError('TTS serializer controls differ from the immutable render plan; dispatch was blocked.')
      if (hashCanonicalTtsValue(observation.continuation ?? { kind: 'none' }) !== hashCanonicalTtsValue({ kind: 'none' })) throw CLIUsageError('TTS serializer continuation differs from the immutable render plan; dispatch was blocked.')
      for (const turnId of slot.turnIds) {
        const plannedTurn = planned.turns.find((turn) => turn.canonical.turnId === turnId) as AttemptTurn
        const expectedSpeaker = options.comicContext?.providerSpeakerLabelByTurnId[turnId] ?? plannedTurn.canonical.subjectKey
        const serializedVoice = observation.voices.find((voice) => voice.speaker?.trim().toUpperCase() === expectedSpeaker.trim().toUpperCase()) ?? (slot.turnIds.length === 1 ? observation.voices[0] : undefined)
        const serializedVoiceHash = serializedVoice?.valueHash ?? (serializedVoice?.value ? sha256Bytes(serializedVoice.value) : undefined)
        if (!serializedVoice || serializedVoice.kind !== plannedTurn.voice.kind || serializedVoiceHash !== plannedTurn.voice.valueHash) throw CLIUsageError(`TTS serializer voice differs from the immutable binding for ${plannedTurn.canonical.turnId}; dispatch was blocked.`)
      }
      const requestBodyHash = hashCanonicalTtsValue(observation.serializedRequest)
      const requestFingerprint = hashCanonicalTtsValue({ endpointKind: observation.endpointKind, serializerVersion: observation.serializerVersion, requestBodyHash })
      let runtime = await locked(async () => {
        const priorForSlot = runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId)
        const retryOf = attempt.attempt > 1 ? priorForSlot.at(-1) : undefined
        if (attempt.attempt > 1 && (!retryOf || retryOf.request.requestBodyHash !== requestBodyHash)) throw CLIUsageError('TTS retry changed its generation slot or serialized request fingerprint; dispatch was blocked.')
        if (attempt.attempt === 1 && priorForSlot.length > 0) throw CLIUsageError('TTS serializer attempted a second deliberate request for one planned generation slot.')
        let dispatchStarted = false
        try {
          await ensureJournalStarted()
          const invocationPlanPath = `${attemptRoot}/invocations/${slot.generationSlotId}.json`
          let invocationFile: WrittenJson<ProviderBatchInvocationPlan>
          if (retryOf) invocationFile = retryOf.invocationFile
          else {
            const invocationPlan = withIdentity({ schemaVersion: 1 as const, renderPlanId, renderIdentity, invocationId, attempt: attemptNumber, batchId: slot.batchId, generationSlotId: slot.generationSlotId, resolvedContinuation: { kind: 'none' as const }, requestFingerprint, createdAt: now() }, 'batchInvocationPlanId') as ProviderBatchInvocationPlan
            invocationFile = await writeJson(options.outputDir, invocationPlanPath, invocationPlan)
          }
          const requestOrdinal = runtimeRequests.length + 1
          const turnIds = slot.turnIds
          const observed: ObservedProviderRequest = {
          requestOrdinal,
          invocationId,
          batchId: slot.batchId,
          generationSlotId: slot.generationSlotId,
          batchInvocationPlanId: invocationFile.value.batchInvocationPlanId,
          provider: options.target.service,
          model: options.target.model,
          transport,
          endpointKind: observation.endpointKind,
          serializerVersion: observation.serializerVersion,
          requestBodyHash,
          actualRequestControlsHash: hashCanonicalTtsValue(observation.requestControls ?? {}),
          actualContinuationHash: hashCanonicalTtsValue(observation.continuation ?? { kind: 'none' }),
          turns: turnIds.map((turnId) => {
            const turn = planned.turns.find((entry) => entry.canonical.turnId === turnId) as AttemptTurn
            const expectedSpeaker = options.comicContext?.providerSpeakerLabelByTurnId[turnId] ?? turn.canonical.subjectKey
            const serializedVoice = observation.voices.find((voice) => voice.speaker?.trim().toUpperCase() === expectedSpeaker.trim().toUpperCase()) ?? (turnIds.length === 1 ? observation.voices[0] : undefined)
            if (!serializedVoice) throw CLIUsageError('TTS serializer did not expose the serialized voice before dispatch.')
            return {
              turnId,
              providerTextHash: sha256Bytes(observation.providerText),
              voiceField: observation.voiceField,
              actualSerializedVoice: { kind: serializedVoice.kind, valueHash: serializedVoice.valueHash ?? sha256Bytes(serializedVoice.value ?? ''), provider: options.target.service },
              actualSerializedControlsHash: hashCanonicalTtsValue(observation.requestControls ?? {})
            }
          })
          }
          const record = {
          requestOrdinal,
          batchId: slot.batchId,
          generationSlotId: slot.generationSlotId,
          batchInvocationPlanId: invocationFile.value.batchInvocationPlanId,
          batchInvocationPlanRef: contained(attemptRoot, invocationFile.path),
          batchInvocationPlanSha256: invocationFile.sha256,
          requestFingerprint,
          ...(retryOf ? { retryOfRequestOrdinal: retryOf.request.requestOrdinal } : {}),
          transitions: [{ sequence: 1, state: 'prepared' as const, at: now(), requestBodyHash }]
          }
          await advanceJournal([...journal.requests, record])
          const dispatchRecord = { ...record, transitions: [...record.transitions, { sequence: 2, state: 'dispatch-started' as const, at: now(), transportEvidenceHash: hashCanonicalTtsValue({ requestFingerprint, requestOrdinal }) }] }
          await advanceJournal([...journal.requests.slice(0, -1), dispatchRecord])
          dispatchStarted = true
          const entry: RuntimeRequest = {
          slot,
          invocationFile,
          request: observed,
          ...(retryOf ? { retry: { invocationId, requestOrdinal, retryOfRequestOrdinal: retryOf.request.requestOrdinal, reasonCode: attempt.retryReasonCode ?? 'provider-retry' } } : {}),
          terminal: undefined
          }
          runtimeRequests.push(entry)
          return entry
        } catch (error) {
          const durableDispatchStarted = journal.requests.some((request) =>
            request.transitions.at(-1)?.state === 'dispatch-started')
          if (!dispatchStarted && !durableDispatchStarted && attemptReservation) {
            await attemptReservation.release()
            attemptReservation = undefined
          }
          throw error
        }
      })
      let accepted = false
      const accept = async (acceptance?: { providerRequestId?: string | undefined, fields?: Readonly<Record<string, string | number | boolean | null>> | undefined }) => await locked(async () => {
        if (accepted) return
        accepted = true
        runtime.request = { ...runtime.request, ...(acceptance?.providerRequestId ? { providerRequestId: acceptance.providerRequestId } : {}), acceptedAt: now() }
        const evidence = withIdentity({ schemaVersion: 1 as const, journalId, invocationId, provider: options.target.service, requestOrdinal: runtime.request.requestOrdinal, requestFingerprint, evidenceKind: 'acceptance' as const, observedAt: runtime.request.acceptedAt, fields: { accepted: true, ...(acceptance?.fields ?? {}) } }, 'evidenceHash')
        const file = await writeJson(options.outputDir, `${attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-acceptance.json`, evidence)
        const requests = journal.requests.map((entry) => entry.requestOrdinal === runtime.request.requestOrdinal ? { ...entry, transitions: [...entry.transitions, { sequence: entry.transitions.length + 1, state: 'provider-accepted' as const, at: runtime.request.acceptedAt as string, ...(acceptance?.providerRequestId ? { providerRequestId: acceptance.providerRequestId } : {}), evidence: { journalId, invocationId, requestOrdinal: entry.requestOrdinal, requestFingerprint, proofKind: 'acceptance' as const, kind: 'sanitized-artifact' as const, path: contained(attemptRoot, file.path), sha256: file.sha256 } }] } : entry)
        await advanceJournal(requests)
      })
      try {
        const value = await operationFn({ accepted: accept })
        await accept()
        return value
      } catch (error) {
        let rejected = false
        await locked(async () => {
          if (accepted) {
            runtime.terminal = 'ambiguous'
            return
          }
          rejected = !accepted && typeof (error as { status?: unknown })?.status === 'number'
          const kind = rejected ? 'rejection' as const : 'ambiguity' as const
          const state = rejected ? 'provider-rejected' as const : 'ambiguous' as const
          const sanitized = sanitizeError(error, 'synthesis')
          const evidence = withIdentity({ schemaVersion: 1 as const, journalId, invocationId, provider: options.target.service, requestOrdinal: runtime.request.requestOrdinal, requestFingerprint, evidenceKind: kind, observedAt: now(), fields: { code: sanitized.code, retryable: sanitized.retryable } }, 'evidenceHash')
          const file = await writeJson(options.outputDir, `${attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-${kind}.json`, evidence)
          const transition = rejected
            ? { sequence: 0, state: 'provider-rejected' as const, at: evidence.observedAt, evidence: { journalId, invocationId, requestOrdinal: runtime.request.requestOrdinal, requestFingerprint, proofKind: 'rejection' as const, kind: 'sanitized-artifact' as const, path: contained(attemptRoot, file.path), sha256: file.sha256 } }
            : { sequence: 0, state: 'ambiguous' as const, at: evidence.observedAt, evidence: { journalId, invocationId, requestOrdinal: runtime.request.requestOrdinal, requestFingerprint, proofKind: 'ambiguity' as const, kind: 'sanitized-artifact' as const, path: contained(attemptRoot, file.path), sha256: file.sha256 } }
          const requests = journal.requests.map((entry) => entry.requestOrdinal === runtime.request.requestOrdinal ? { ...entry, transitions: [...entry.transitions, { ...transition, sequence: entry.transitions.length + 1 }] } : entry)
          runtime.terminal = state
          await advanceJournal(requests)
        })
        if (!rejected && error instanceof Error) Object.defineProperty(error, 'ttsAdmissionAmbiguous', { value: true, configurable: true })
        throw error
      }
    },
    recordOutput: async ({ chunkIndex, path, outputIndex = 1, timing, providerGenerationId, warnings }) => await locked(async () => {
      const slot = slotFor(invocation, { chunkIndex } as TtsSerializedRequestObservation)
      if (!journalFile || !runtimeRequests.some((entry) => entry.slot.generationSlotId === slot.generationSlotId)) {
        throw CLIUsageError('TTS serializer output does not bind one dispatched generation slot.')
      }
      const batchResultDir = `${attemptRoot}/batch-results/${slot.batchId}/${slot.generationSlotId}`
      const suffix = extname(path) || '.audio'
      const destination = `${batchResultDir}/audio-${String(outputIndex).padStart(3, '0')}${suffix}`
      await copyCreateOnly(options.outputDir, path, destination)
      const audio = await readObservedAudio(options.outputDir, destination)
      const recorded = {
        path: destination,
        relativeToBatchResult: contained(batchResultDir, destination),
        sha256: sha256Bytes(audio.bytes),
        format: audio.format,
        durationMs: audio.durationMs,
        ...(timing ? { timing } : {}),
        ...(providerGenerationId ? { providerGenerationId } : {}),
        ...(warnings ? { warnings: [...warnings] } : {})
      }
      outputsBySlot.set(slot.generationSlotId, [...(outputsBySlot.get(slot.generationSlotId) ?? []), recorded])
    }),
    complete: async ({ chunkIndex }) => await locked(async () => {
      const slot = slotFor(invocation, { chunkIndex } as TtsSerializedRequestObservation)
      const runtime = runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId).at(-1)
      if (!runtime || runtime.terminal !== undefined) throw CLIUsageError('TTS serializer completion does not bind one open dispatched request.')
      if (!(outputsBySlot.get(slot.generationSlotId)?.length)) throw CLIUsageError('TTS serializer cannot complete a request before durable output promotion.')
      const requestFingerprint = journal.requests.find((entry) => entry.requestOrdinal === runtime.request.requestOrdinal)?.requestFingerprint
      if (!requestFingerprint) throw CLIUsageError('TTS serializer completion is missing its admission request fingerprint.')
      const evidence = withIdentity({ schemaVersion: 1 as const, journalId, invocationId, provider: options.target.service, requestOrdinal: runtime.request.requestOrdinal, requestFingerprint, evidenceKind: 'completion' as const, observedAt: now(), fields: { completed: true } }, 'evidenceHash')
      const file = await writeJson(options.outputDir, `${attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-completion.json`, evidence)
      const requests = journal.requests.map((entry) => entry.requestOrdinal === runtime.request.requestOrdinal ? { ...entry, transitions: [...entry.transitions, { sequence: entry.transitions.length + 1, state: 'completed' as const, at: evidence.observedAt, evidence: { journalId, invocationId, requestOrdinal: entry.requestOrdinal, requestFingerprint, proofKind: 'completion' as const, kind: 'sanitized-artifact' as const, path: contained(attemptRoot, file.path), sha256: file.sha256 } }] } : entry)
      runtime.terminal = 'completed'
      await advanceJournal(requests)
      await promoteBatchResult(slot)
    })
  })

  type ClosedProviderAttempt = {
    resultFile?: WrittenJson<ProviderRenderResult> | undefined
    batchResultFiles: Array<WrittenJson<ProviderBatchResult>>
  }
  let closedProviderAttempt: ClosedProviderAttempt | undefined
  const closeProviderAttempt = async (closingError?: SanitizedProviderError | undefined): Promise<ClosedProviderAttempt> => {
    if (closedProviderAttempt) return closedProviderAttempt
    return await locked(async () => {
      if (closedProviderAttempt) return closedProviderAttempt
    const touchedSlots = planned.slots.filter((slot) => runtimeRequests.some((entry) => entry.slot.generationSlotId === slot.generationSlotId))
    if (touchedSlots.length === 0) {
      throw InternalError('A provider attempt cannot close before serializer dispatch.', { stage: 'tts:admission' })
    }
    const currentBatchResultFiles: Array<WrittenJson<ProviderBatchResult>> = []
    for (const slot of touchedSlots) {
      currentBatchResultFiles.push(await promoteBatchResult(slot, closingError))
    }
    const batchResultFiles = planned.slots.map((slot) => {
      const file = [...recoveredBatchFiles, ...currentBatchResultFiles]
        .find((entry) => entry.value.generationSlotId === slot.generationSlotId)
      if (!file) throw InternalError(`TTS provider attempt did not resolve generation slot ${slot.generationSlotId}.`, { stage: 'tts:reconciliation' })
      return file
    })
    const batchRefs: ProviderBatchResultRef[] = batchResultFiles.map((file) => ({ batchId: file.value.batchId, generationSlotId: file.value.generationSlotId, batchResultId: file.value.batchResultId, artifactRef: contained(renderRoot, file.path), sha256: file.sha256 }))
    const allObserved = batchResultFiles.flatMap((file) => file.value.observedRequests)
    const requestedTurnIds = planned.turns.map((turn) => turn.canonical.turnId)
    const turnOutcomes = requestedTurnIds.map((turnId) => {
      const results = batchResultFiles.map((file) => file.value).filter((result) => result.requestedTurnIds.includes(turnId))
      const status = results.length === 0 ? 'unstarted' as const : results.every((result) => result.status === 'succeeded') ? 'succeeded' as const : results.some((result) => result.status === 'ambiguous') ? 'ambiguous' as const : 'failed' as const
      const linkedRequests = allObserved.filter((request) => request.turns.some((turn) => turn.turnId === turnId))
      return {
        turnId,
        status,
        observedRequests: linkedRequests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
        batchIds: [...new Set(results.map((result) => result.batchId))],
        generationSlotIds: results.map((result) => result.generationSlotId),
        outputIds: status === 'succeeded' ? results.flatMap((result) => result.outputs.map((output) => output.outputId)) : [],
        ...(status === 'succeeded' ? {} : { error: closingError ?? { phase: 'synthesis' as const, code: status === 'unstarted' ? 'generation_slot_unstarted' : status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'provider_request_failed', message: status === 'unstarted' ? 'Generation slot was not dispatched.' : status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'Provider request failed.', retryable: status !== 'failed' } })
      }
    })
    const succeededCount = turnOutcomes.filter((outcome) => outcome.status === 'succeeded').length
    const status = succeededCount === requestedTurnIds.length ? 'succeeded' as const : succeededCount > 0 ? 'partial' as const : turnOutcomes.some((outcome) => outcome.status === 'ambiguous') ? 'ambiguous' as const : 'failed' as const
    const renderResultBase = {
      schemaVersion: 1 as const,
      closedBy: { kind: 'provider-attempt' as const, invocationId, attempt: attemptNumber },
      renderPlanId,
      renderIdentity,
      status,
      requestedTurnIds,
      batchResults: batchRefs,
      observedRequests: allObserved,
      outputs: batchResultFiles.flatMap((file) => file.value.outputs.map((output) => ({ ...output, batchResultId: file.value.batchResultId }))),
      generatedBatches: batchResultFiles.flatMap((file) => file.value.generatedBatch ? [file.value.generatedBatch] : []),
      turnOutcomes,
      createdResources: [],
      retryAttempts: batchResultFiles.flatMap((file) => file.value.retryAttempts),
      cost: { currentComposition: { planned: plannedRenderCost, observed: [] }, closingAttempt: { planned: unresolvedPlannedCost, observed: [] }, cumulativeRenderHistory: { planned: cumulativePlannedCost, observed: [] } },
      ...(status === 'succeeded' ? {} : { error: closingError ?? { phase: 'synthesis' as const, code: status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'tts_target_failed', message: status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'TTS target failed.', retryable: status === 'ambiguous' } })
    }
    const renderResult = withIdentity(renderResultBase, 'resultIdentity') as ProviderRenderResult
    validateProviderRenderResult(renderResult)
    const resultFile = await writeJson(options.outputDir, `${attemptRoot}/provider-render-result.json`, renderResult)
    await writeNextJournal({
      ...journal,
      previousSnapshotId: journal.snapshotId,
      recordedResult: { resultIdentity: renderResult.resultIdentity, resultRef: contained(attemptRoot, resultFile.path), resultSha256: resultFile.sha256, batchResultSetHash: hashCanonicalTtsValue(batchRefs) },
      capturedAt: now()
    })
      closedProviderAttempt = { resultFile, batchResultFiles }
      return closedProviderAttempt
    })
  }

  let terminalState: PipelineProviderState | undefined

  const finalizeFailure = async (error: unknown): Promise<PipelineProviderState> => {
    if (terminalState) return terminalState
    const sanitized = sanitizeError(error, runtimeRequests.length > 0 ? 'synthesis' : 'static-validation')
    if (runtimeRequests.length === 0) {
      const at = now()
      events.push({ sequence: events.length + 1, status: 'failed', at, attempt: priorAttemptCount, error: sanitized })
      pointerEvents.push({ sequence: pointerEvents.length + 1, action: 'activate-render', renderIdentity, eventSequence: events.length, actor: LOCAL_ACTOR, at })
      currentProjection = buildProjection()
      terminalState = stateForProjection(options.target, targetKey, transport, targetRelativeDir, currentProjection, sanitized)
      await publish(terminalState)
      return terminalState
    }
    let resultFile: WrittenJson<ProviderRenderResult> | undefined
    let batchResultFiles: Array<WrittenJson<ProviderBatchResult>> = []
    try {
      const closed = await closeProviderAttempt(sanitized)
      resultFile = closed.resultFile
      batchResultFiles = closed.batchResultFiles
    } catch (evidenceError) {
      const evidenceFailure = sanitizeError(evidenceError, 'reconciliation')
      sanitized.message = `${sanitized.message}; evidence finalization: ${evidenceFailure.message}`.slice(0, 600)
    }
    currentProjection = appendTerminalProjection('failed', { result: resultFile, batchResultFiles, error: sanitized })
    terminalState = stateForProjection(options.target, targetKey, transport, targetRelativeDir, currentProjection, sanitized)
    await publish(terminalState)
    return terminalState
  }

  const finalizeSuccess = async (audioPath: string, reportedOutputPath: string): Promise<CurrentTtsRenderArtifacts> => {
    if (terminalState) throw CLIUsageError('TTS render attempt was already finalized.')
    if (
      runtimeRequests.length === 0
      || planned.slots.some((slot) => !recoveredBySlot.has(slot.generationSlotId) && !(outputsBySlot.get(slot.generationSlotId)?.length))
    ) throw CLIUsageError('TTS target returned success without serializer-observed or verified recovered output for every planned generation slot.')
    const { resultFile, batchResultFiles } = await closeProviderAttempt()
    if (!resultFile || resultFile.value.status !== 'succeeded') throw CLIUsageError('TTS provider attempt did not close as a complete success.')
    const audioRunRoot = `${renderRoot}/results/${resultFile.value.resultIdentity}/audio-run`
    const finalPath = `${audioRunRoot}/final.wav`
    const masteringDir = `${attemptRoot}/mastering`
    await mkdir(masteringDir, { recursive: true })
    const masteringProfile = options.ttsOptions.ttsMasteringProfile
    let masteredPath: string
    if (options.comicContext && planned.strategy === 'segmented') {
      if (!masteringProfile) throw CLIUsageError('Comic segmented assembly requires an explicit mastering profile.')
      const resultBySlot = new Map(batchResultFiles.map(file => [file.value.generationSlotId, file] as const))
      const outputPathsBySlot = new Map(planned.slots.map((slot) => {
        const file = resultBySlot.get(slot.generationSlotId)
        if (!file) throw CLIUsageError(`Comic assembly is missing generation slot ${slot.generationSlotId}.`)
        return [slot.generationSlotId, file.value.outputs.map(output => resolveRetainedPath(dirname(resolve(options.outputDir, file.path)), output.artifactRef, `Comic generation slot ${slot.generationSlotId} provider output`))] as const
      }))
      masteredPath = await assembleComicSegmentedAudio({ dialoguePlan: options.comicContext.dialoguePlan, turns: planned.turns.map(turn => turn.canonical), slots: planned.slots, outputPathsBySlot, masteringDir, providerLabel: options.target.service, profile: masteringProfile })
    } else {
      masteredPath = await concatAndConvertToWav([audioPath], masteringDir, `${options.target.service}-mastering`, undefined, masteringProfile)
    }
    await copyCreateOnly(options.outputDir, masteredPath, finalPath)
    const finalAudio = await readObservedAudio(options.outputDir, finalPath)
    const speechSources = resultFile.value.outputs.map((output) => ({ kind: 'provider-output' as const, sourceId: output.outputId, resultIdentity: resultFile.value.resultIdentity, batchResultId: output.batchResultId, outputId: output.outputId, artifactRef: output.artifactRef, sha256: output.sha256 }))
    const assemblyParametersHash = hashCanonicalTtsValue({ sourceIds: speechSources.map((source) => source.sourceId), strategy: planned.strategy, requestedOutput: requestedOutput(options), dialogueNodes: planned.dialoguePlan.nodes })
    const mixPlan = withIdentity({
      schemaVersion: 1 as const,
      renderIdentity,
      outputProfileHash,
      sources: speechSources,
      operations: [{ kind: options.comicContext && planned.strategy === 'segmented' ? 'dialogue-node-assembly' : speechSources.length > 1 ? 'ordered-concat' : 'single-source', parametersHash: assemblyParametersHash }],
      createdAt: now()
    }, 'mixPlanId')
    const mixPlanFile = await writeJson(options.outputDir, `${audioRunRoot}/mix-plan.json`, mixPlan)
    const transcodeParametersHash = hashCanonicalTtsValue({ ...requestedOutput(options), orderedConcat: speechSources.length > 1 })
    const transformOperation = {
      operationId: hashCanonicalTtsValue({ kind: 'transcode', transcodeParametersHash, finalDurationMs: finalAudio.durationMs }),
      kind: 'transcode' as const,
      finalRangeMs: { start: 0, end: finalAudio.durationMs },
      parametersHash: transcodeParametersHash
    }
    const turnDuration = (turnId: string): number => {
      return batchResultFiles
        .filter((file) => file.value.requestedTurnIds.length === 1 && file.value.requestedTurnIds[0] === turnId)
        .flatMap((file) => file.value.outputs)
        .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
    }
    const layout = options.comicContext ? comicTimelineLayout(options.comicContext.dialoguePlan, turnDuration) : undefined
    let genericTimelineCursorMs = 0
    const assembledTurns = layout?.turns ?? planned.turns.map((turn) => {
      const startMs = genericTimelineCursorMs
      genericTimelineCursorMs += turnDuration(turn.canonical.turnId)
      return { turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, startMs, endMs: genericTimelineCursorMs }
    })
    const effectOperations = assembledTurns.flatMap((assembled) => {
      const turn = planned.turns.find(candidate => candidate.canonical.turnId === assembled.turnId)?.canonical
      if (!turn?.effect || !localVoiceEffectFilter(turn)) return []
      const parametersHash = hashCanonicalTtsValue(turn.effect)
      return [{ operationId: hashCanonicalTtsValue({ kind: 'effect', turnId: assembled.turnId, parametersHash, finalRangeMs: { start: assembled.startMs, end: assembled.endMs } }), kind: 'effect' as const, finalRangeMs: { start: assembled.startMs, end: assembled.endMs }, parametersHash }]
    })
    const overlapOperations = (layout?.overlaps ?? []).map((overlap) => {
      const parametersHash = hashCanonicalTtsValue({ groupId: overlap.groupId })
      return { operationId: hashCanonicalTtsValue({ kind: 'overlap', groupId: overlap.groupId, parametersHash, finalRangeMs: { start: overlap.start, end: overlap.end } }), kind: 'overlap' as const, finalRangeMs: { start: overlap.start, end: overlap.end }, parametersHash }
    })
    const ledger = withIdentity({ schemaVersion: 1 as const, renderIdentity, operations: [transformOperation, ...effectOperations, ...overlapOperations] }, 'transformLedgerId')
    const ledgerFile = await writeJson(options.outputDir, `${audioRunRoot}/transform-ledger.json`, ledger)
    const hasAssembledTurnTiming = planned.strategy === 'segmented' && assembledTurns.every((turn) => turn.endMs > turn.startMs)
    let nativeCursorMs = 0
    const nativeTimingParts = batchResultFiles.map((file) => {
      const take = file.value.generatedBatch?.takes[0]
      const timing = take?.timing
      const offsetMs = nativeCursorMs
      nativeCursorMs += take?.durationMs ?? file.value.outputs[0]?.durationMs ?? 0
      if (!timing || timing.availability !== 'timed') return undefined
      const shiftToken = (token: NonNullable<typeof timing.words>[number]) => ({ ...token, startMs: token.startMs + offsetMs, endMs: token.endMs + offsetMs })
      return {
        provenance: timing.provenance,
        turns: timing.turns.map(turn => ({ ...turn, startMs: turn.startMs + offsetMs, endMs: turn.endMs + offsetMs })),
        words: timing.words?.map(shiftToken) ?? [],
        phonemes: timing.phonemes?.map(shiftToken) ?? [],
        characters: timing.characters?.map(shiftToken) ?? []
      }
    })
    const hasNativeTiming = planned.strategy !== 'segmented' && nativeTimingParts.length > 0 && nativeTimingParts.every(part => part !== undefined)
    const nativeTiming = hasNativeTiming
      ? {
          availability: 'timed' as const,
          clock: 'final-audio-ms' as const,
          provenance: nativeTimingParts.some(part => part?.provenance === 'provider-alignment') ? 'provider-alignment' as const : 'provider-native' as const,
          turns: nativeTimingParts.flatMap(part => part?.turns ?? []),
          ...(nativeTimingParts.some(part => (part?.words.length ?? 0) > 0) ? { words: nativeTimingParts.flatMap(part => part?.words ?? []) } : {}),
          ...(nativeTimingParts.some(part => (part?.phonemes.length ?? 0) > 0) ? { phonemes: nativeTimingParts.flatMap(part => part?.phonemes ?? []) } : {}),
          ...(nativeTimingParts.some(part => (part?.characters.length ?? 0) > 0) ? { characters: nativeTimingParts.flatMap(part => part?.characters ?? []) } : {})
        }
      : undefined
    const timeline = withIdentity({
      schemaVersion: 1 as const,
      renderIdentity,
      timing: nativeTiming ?? (hasAssembledTurnTiming
        ? { availability: 'timed' as const, clock: 'final-audio-ms' as const, provenance: 'assembled-segments' as const, turns: assembledTurns }
        : { availability: 'unavailable' as const, clock: 'final-audio-ms' as const, provenance: 'unavailable' as const, turns: planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey })), reason: 'Native/provider timing was not exposed at exact turn boundaries.' }),
      speechSources,
      transformLedgerRef: { path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 }
    }, 'timelineId')
    const timelineFile = await writeJson(options.outputDir, `${audioRunRoot}/final-timeline.json`, timeline)
    const audioRun = withIdentity({
      schemaVersion: 1 as const,
      targetKey,
      renderPlanId,
      renderIdentity,
      providerResult: { resultIdentity: resultFile.value.resultIdentity, path: contained(renderRoot, resultFile.path), sha256: resultFile.sha256 },
      takeSelections: [],
      continuationCheckpoints: [],
      mixPlan: { mixPlanId: mixPlan.mixPlanId, path: contained(audioRunRoot, mixPlanFile.path), sha256: mixPlanFile.sha256 },
      transformLedger: { transformLedgerId: ledger.transformLedgerId, path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
      finalTimeline: { timelineId: timeline.timelineId, path: contained(audioRunRoot, timelineFile.path), sha256: timelineFile.sha256 },
      finalOutputs: [{ path: contained(audioRunRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes), format: finalAudio.format, durationMs: finalAudio.durationMs }],
      createdAt: now()
    }, 'audioRunId') as AudioRun
    const audioRunFile = await writeJson(options.outputDir, `${audioRunRoot}/audio-run.json`, audioRun)
    if (resolve(masteredPath) !== resolve(reportedOutputPath)) {
      await copyCreateOnly(options.outputDir, masteredPath, reportedOutputPath)
    }
    const reportedAudio = (await readContainedArtifactFile(options.outputDir, contained(options.outputDir, reportedOutputPath))).bytes
    const outputRefs = [{ path: contained(targetDir, finalPath), sha256: sha256Bytes(finalAudio.bytes) }]
    const reportedOutputRefs = [{ path: contained(options.outputDir, reportedOutputPath), sha256: sha256Bytes(reportedAudio) }]
    currentProjection = appendTerminalProjection('succeeded', { result: resultFile, batchResultFiles, audioRun: audioRunFile, outputRefs, reportedOutputRefs })
    terminalState = stateForProjection(options.target, targetKey, transport, targetRelativeDir, currentProjection)
    await publish(terminalState)
    return { artifactDir: targetRelativeDir, operation, targetKey, transport, renderIdentity, resultIdentity: resultFile.value.resultIdentity, audioRunId: audioRun.audioRunId, strategy: planned.strategy, projection: currentProjection }
  }

  return { requestEvidence: scopeFor(), preparedState, finalizeSuccess, finalizeFailure }
}
