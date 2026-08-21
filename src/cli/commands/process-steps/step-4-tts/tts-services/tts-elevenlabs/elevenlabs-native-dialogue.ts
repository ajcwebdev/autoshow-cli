import type {
  ElevenLabsDialogueTimingResponse,
  ElevenLabsNativeDialogueBatch,
  ElevenLabsNativeDialogueTurn,
  ElevenLabsPreparedDialogueTurn,
  ElevenlabsTtsModel,
  ElevenLabsTtsRequestControls,
  ElevenLabsVoiceSegment,
  HostedTtsChunkScheduler,
  NormalizedTiming,
  PreparedProviderText,
  Step4Metadata,
  TtsRequestEvidenceScope,
} from '~/types'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'
import { requireApiKey } from '~/utils/validate/env-utils'
import { concatAndConvertToWav } from '../../tts-utils/audio-utils'
import { finalizeTtsRun } from '../../tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '../../tts-utils/hosted-tts-retry'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { providerSecondsToMilliseconds } from '../../script-to-audio/advanced-provider-contracts'
import { ELEVENLABS_TTS_OUTPUT_FORMAT, readElevenLabsError } from './elevenlabs-utils'
import { canonicalOffsetForProviderOffset } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-timing-mapping'

const ELEVENLABS_NATIVE_DIALOGUE_MAX_CHARACTERS = 2000
const ELEVENLABS_NATIVE_DIALOGUE_MAX_VOICES = 10

const ELEVENLABS_DOCUMENTED_ACTION_TAGS = [
  { tag: 'whispers', pattern: /\b(?:whisper(?:s|ed|ing)?|softly|quiet(?:ly)?|under (?:his|her|their) breath)\b/i },
  { tag: 'shouts', pattern: /\b(?:shout(?:s|ed|ing)?|yell(?:s|ed|ing)?|roar(?:s|ed|ing)?|scream(?:s|ed|ing)?)\b/i },
  { tag: 'exhales', pattern: /\bexhal(?:e|es|ed|ing)\b/i },
  { tag: 'sighs', pattern: /\bsigh(?:s|ed|ing)?\b/i },
  { tag: 'laughs', pattern: /\b(?:laugh(?:s|ed|ing)?|chuckl(?:e|es|ed|ing)|giggl(?:e|es|ed|ing))\b/i },
] as const

const ELEVENLABS_DOCUMENTED_EMOTION_TAGS = [
  { tag: 'sarcastic', pattern: /\b(?:sarcastic|sarcasm|dry|deadpan|wry)\b/i },
  { tag: 'curious', pattern: /\b(?:curious|curiosity|questioning|wondering)\b/i },
  { tag: 'excited', pattern: /\b(?:excited|delighted|gleeful|glee|ecstatic|enthusiastic|thrilled|grinning)\b/i },
  { tag: 'mischievously', pattern: /\b(?:mischievous|mischievously|sly|playful)\b/i },
  { tag: 'crying', pattern: /\b(?:crying|cries|sob(?:s|bed|bing)?|tearful)\b/i },
  { tag: 'angry', pattern: /\b(?:angry|furious|rage|indignant)\b/i },
  { tag: 'sad', pattern: /\b(?:sad|wistful|whistful|melancholy|mournful|wounded)\b/i },
  { tag: 'happily', pattern: /\b(?:happy|happily|cheerful|jolly)\b/i },
] as const

const documentedAudioTags = (delivery: string): string[] => {
  const normalized = delivery.normalize('NFKC')
  const action = ELEVENLABS_DOCUMENTED_ACTION_TAGS.find(candidate => candidate.pattern.test(normalized))?.tag
  const emotion = ELEVENLABS_DOCUMENTED_EMOTION_TAGS.find(candidate => candidate.pattern.test(normalized))?.tag
  return [...(action ? [action] : []), ...(emotion ? [emotion] : [])]
}

const safeAudioTag = (delivery: string): string => documentedAudioTags(delivery).map(tag => `[${tag}]`).join(' ')

export const prepareElevenLabsDialogueText = (canonicalText: string, delivery?: string | undefined): PreparedProviderText => {
  const canonicalLength = [...canonicalText].length
  const audioTags = delivery ? safeAudioTag(delivery) : ''
  const prefix = audioTags ? `${audioTags} ` : ''
  const prefixLength = [...prefix].length
  const providerText = `${prefix}${canonicalText}`
  return {
    schemaVersion: 1,
    canonicalText,
    providerText,
    preparationVersion: 'elevenlabs-v3-dialogue-v2',
    canonicalIndexUnit: 'unicode-scalar-value',
    providerIndexUnit: 'provider-character-array-index',
    spans: [
      ...(prefixLength > 0 ? [{ kind: 'provider-only' as const, providerStart: 0, providerEnd: prefixLength, transform: 'v3-delivery-audio-tag' }] : []),
      ...(canonicalLength > 0 ? [{ kind: 'mapped' as const, canonicalStart: 0, canonicalEnd: canonicalLength, providerStart: prefixLength, providerEnd: prefixLength + canonicalLength }] : [])
    ]
  }
}

export const planElevenLabsNativeDialogueBatches = (
  turns: readonly ElevenLabsNativeDialogueTurn[],
  maxCharacters = ELEVENLABS_NATIVE_DIALOGUE_MAX_CHARACTERS
): ElevenLabsNativeDialogueBatch[] => {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw CLIUsageError('ElevenLabs native dialogue character limit must be a positive integer.')
  const prepared = turns.map(turn => ({ ...turn, preparedText: prepareElevenLabsDialogueText(turn.canonicalText, turn.delivery) }))
  const batches: ElevenLabsNativeDialogueBatch[] = []
  let current: ElevenLabsPreparedDialogueTurn[] = []
  let characters = 0
  let voices = new Set<string>()
  const flush = (): void => {
    if (current.length === 0) return
    batches.push({ batchIndex: batches.length, turns: current, providerText: current.map(turn => `${turn.speaker}: ${turn.preparedText.providerText}`).join('\n') })
    current = []
    characters = 0
    voices = new Set<string>()
  }
  for (const turn of prepared) {
    const length = [...turn.preparedText.providerText].length
    if (length > maxCharacters) throw CLIUsageError(`ElevenLabs native dialogue turn ${turn.turnId} exceeds the ${maxCharacters}-character turn-safe boundary.`)
    const wouldAddVoice = !voices.has(turn.voiceId)
    if (current.length > 0 && (characters + length > maxCharacters || (wouldAddVoice && voices.size >= ELEVENLABS_NATIVE_DIALOGUE_MAX_VOICES))) flush()
    current.push(turn)
    characters += length
    voices.add(turn.voiceId)
  }
  flush()
  return batches
}

const numberAt = (value: unknown, index: number): number | undefined => Array.isArray(value) && typeof value[index] === 'number' ? value[index] : undefined


export const normalizeElevenLabsDialogueTiming = (input: {
  response: ElevenLabsDialogueTimingResponse
  turns: readonly ElevenLabsPreparedDialogueTurn[]
  durationMs?: number | undefined
}): NormalizedTiming<'take-audio-ms'> => {
  const rawSegments = Array.isArray(input.response.voice_segments) ? input.response.voice_segments : []
  const segments = rawSegments.map(value => value && typeof value === 'object' && !Array.isArray(value) ? value as ElevenLabsVoiceSegment : {})
  const turns = input.turns.map((turn, index) => {
    const matching = segments.filter(segment => segment.dialogue_input_index === index)
    const starts = matching.flatMap(segment => typeof segment.start_time_seconds === 'number' ? [providerSecondsToMilliseconds(segment.start_time_seconds, input.durationMs)] : [])
    const ends = matching.flatMap(segment => typeof segment.end_time_seconds === 'number' ? [providerSecondsToMilliseconds(segment.end_time_seconds, input.durationMs)] : [])
    if (starts.length === 0 || ends.length === 0) return undefined
    const startMs = Math.min(...starts)
    const endMs = Math.max(...ends)
    if (endMs < startMs) throw CLIUsageError('ElevenLabs dialogue timing contains a reversed voice segment.')
    return { turnId: turn.turnId, subjectKey: turn.subjectKey, startMs, endMs }
  })
  if (turns.some(turn => turn === undefined)) {
    return { availability: 'unavailable', clock: 'take-audio-ms', provenance: 'unavailable', turns: input.turns.map(turn => ({ turnId: turn.turnId, subjectKey: turn.subjectKey })), reason: 'ElevenLabs did not return a complete voice-segment range for every dialogue input.' }
  }
  const alignment = input.response.normalized_alignment ?? input.response.alignment
  const characters = Array.isArray(alignment?.characters) ? alignment.characters : []
  const cumulativeStarts: number[] = []
  let cursor = 0
  for (const turn of input.turns) { cumulativeStarts.push(cursor); cursor += [...turn.preparedText.providerText].length }
  const timedCharacters = characters.flatMap((character, index) => {
    if (typeof character !== 'string') return []
    const startSeconds = numberAt(alignment?.character_start_times_seconds, index)
    const endSeconds = numberAt(alignment?.character_end_times_seconds, index)
    if (startSeconds === undefined || endSeconds === undefined) return []
    const matchingSegment = segments.find(segment =>
      typeof segment.dialogue_input_index === 'number'
      && typeof segment.character_start_index === 'number'
      && typeof segment.character_end_index === 'number'
      && index >= segment.character_start_index
      && index < segment.character_end_index)
    const segmentTurnIndex = typeof matchingSegment?.dialogue_input_index === 'number' ? matchingSegment.dialogue_input_index : undefined
    const turnIndex = segmentTurnIndex ?? cumulativeStarts.findLastIndex(start => start <= index)
    const turn = input.turns[turnIndex]
    const turnStart = typeof matchingSegment?.character_start_index === 'number'
      ? matchingSegment.character_start_index
      : cumulativeStarts[turnIndex]
    if (!turn || turnStart === undefined) return []
    const providerStart = index - turnStart
    const canonicalStart = canonicalOffsetForProviderOffset(turn.preparedText, providerStart)
    const startMs = providerSecondsToMilliseconds(startSeconds, input.durationMs)
    const endMs = providerSecondsToMilliseconds(endSeconds, input.durationMs)
    if (endMs < startMs) throw CLIUsageError('ElevenLabs character alignment contains a reversed range.')
    return [{ turnId: turn.turnId, subjectKey: turn.subjectKey, text: character, startMs, endMs, ...(canonicalStart === undefined ? {} : { canonicalStart, canonicalEnd: canonicalStart + 1 }), providerStart, providerEnd: providerStart + 1 }]
  })
  return { availability: 'timed', clock: 'take-audio-ms', provenance: 'provider-alignment', turns: turns as Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>, ...(timedCharacters.length > 0 ? { characters: timedCharacters } : {}) }
}

export const runElevenLabsNativeDialogue = async (
  turns: readonly ElevenLabsNativeDialogueTurn[],
  outputDir: string,
  options: {
    model: ElevenlabsTtsModel
    controls?: ElevenLabsTtsRequestControls | undefined
    abortSignal?: AbortSignal | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (options.model !== 'eleven_v3') throw CLIUsageError('ElevenLabs native Text-to-Dialogue requires model eleven_v3.')
  if (turns.length === 0) throw CLIUsageError('ElevenLabs native Text-to-Dialogue requires at least one turn.')
  const apiKey = requireApiKey('ELEVENLABS_API_KEY', 'tts:elevenlabs', 'ElevenLabs Text-to-Dialogue')
  const batches = planElevenLabsNativeDialogueBatches(turns)
  const outputFormat = ELEVENLABS_TTS_OUTPUT_FORMAT
  const paths: string[] = []
  let completed = false
  const startedAt = Date.now()
  try {
    for (const [batchIndex, batch] of batches.entries()) {
      options.abortSignal?.throwIfAborted()
      const chunkIndex = batchIndex + 1
      const requestBody = {
        inputs: batch.turns.map(turn => ({ text: turn.preparedText.providerText, voice_id: turn.voiceId })),
        model_id: 'eleven_v3',
        ...(options.controls?.languageCode ? { language_code: options.controls.languageCode } : {}),
        ...(typeof options.controls?.seed === 'number' ? { seed: options.controls.seed } : {}),
        ...(options.controls?.textNormalization ? { apply_text_normalization: options.controls.textNormalization } : {})
      }
      const requestControls = {
        outputFormat,
        modelId: 'eleven_v3',
        ...(options.controls?.languageCode ? { languageCode: options.controls.languageCode } : {}),
        ...(typeof options.controls?.seed === 'number' ? { seed: options.controls.seed } : {}),
        ...(options.controls?.textNormalization ? { textNormalization: options.controls.textNormalization } : {})
      }
      const payload = await withHostedTtsRetry({ operationName: `elevenlabs-dialogue-${chunkIndex}`, abortSignal: options.abortSignal }, async (signal, attempt) => await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'text-to-dialogue-with-timestamps',
        serializerVersion: 'elevenlabs.dialogue.phase-3-v1',
        serializedRequest: { path: '/v1/text-to-dialogue/with-timestamps', query: { output_format: outputFormat }, body: requestBody },
        providerText: batch.providerText,
        voiceField: 'inputs[].voice_id',
        voices: batch.turns.map(turn => ({ kind: 'provider-id', value: turn.voiceId, speaker: turn.speaker })),
        requestControls,
        continuation: { kind: 'none' }
      }, attempt, async ({ accepted }) => {
        const response = await fetch(`${ELEVENLABS_DEFAULT_BASE_URL}/text-to-dialogue/with-timestamps?${new URLSearchParams({ output_format: outputFormat })}`, {
          method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), ...(signal ? { signal } : {})
        })
        if (!response.ok) throw httpResponseError(`ElevenLabs Text-to-Dialogue failed (${response.status}): ${await readElevenLabsError(response)}`, response)
        await accepted({ fields: { httpStatus: response.status } })
        return await response.json() as ElevenLabsDialogueTimingResponse & { audio_base64?: unknown }
      }))
      if (typeof payload.audio_base64 !== 'string' || !payload.audio_base64) throw InfraError('ElevenLabs Text-to-Dialogue returned no audio.', { stage: 'tts:elevenlabs' })
      const bytes = Uint8Array.from(Buffer.from(payload.audio_base64, 'base64'))
      if (bytes.byteLength === 0) throw InfraError('ElevenLabs Text-to-Dialogue returned empty audio.', { stage: 'tts:elevenlabs' })
      const path = `${outputDir}/speech-elevenlabs-dialogue-${String(chunkIndex).padStart(3, '0')}.mp3`
      await Bun.write(path, bytes)
      const timing = normalizeElevenLabsDialogueTiming({ response: payload, turns: batch.turns })
      await options.requestEvidence?.recordOutput({ chunkIndex, path, timing })
      await options.requestEvidence?.complete({ chunkIndex })
      paths.push(path)
    }
    const audioPath = await concatAndConvertToWav(paths, outputDir, 'ElevenLabs-dialogue', options.abortSignal)
    const finalized = finalizeTtsRun({ service: 'elevenlabs', model: options.model, speaker: [...new Set(turns.map(turn => turn.voiceId))].join(','), audioPath, chunkCount: batches.length, startTime: startedAt })
    completed = true
    return finalized
  } finally {
    if (completed) for (const path of paths) await Bun.$`rm -f ${path}`.quiet().nothrow()
  }
}
