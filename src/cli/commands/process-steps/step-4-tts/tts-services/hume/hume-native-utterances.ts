import type {
  HostedTtsChunkScheduler,
  HumeTtsModel,
  NormalizedTiming,
  Step4Metadata,
  TimedToken,
  TtsRequestEvidenceScope,
} from '~/types'
import { HUME_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'
import { requireApiKey } from '~/utils/validate/env-utils'
import { concatAndConvertToWav } from '../../tts-utils/audio-utils'
import { finalizeTtsRun } from '../../tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '../../tts-utils/hosted-tts-retry'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { providerMilliseconds } from '../../script-to-audio/advanced-provider-contracts'

export const HUME_NATIVE_UTTERANCE_MAX_CHARACTERS = 5000
export const HUME_NATIVE_MAX_TAKES = 5

export type HumeNativeUtteranceTurn = {
  turnId: string
  subjectKey: string
  speaker: string
  canonicalText: string
  voiceId: string
  speed?: number | undefined
  trailingSilence?: number | undefined
  delivery?: string | undefined
}

export type HumeNativeUtteranceBatch = {
  batchIndex: number
  turns: HumeNativeUtteranceTurn[]
  providerText: string
}

export const planHumeNativeUtteranceBatches = (
  turns: readonly HumeNativeUtteranceTurn[],
  maxCharacters = HUME_NATIVE_UTTERANCE_MAX_CHARACTERS
): HumeNativeUtteranceBatch[] => {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw CLIUsageError('Hume native utterance character limit must be a positive integer.')
  const batches: HumeNativeUtteranceBatch[] = []
  let current: HumeNativeUtteranceTurn[] = []
  let characters = 0
  const flush = (): void => {
    if (current.length === 0) return
    batches.push({ batchIndex: batches.length, turns: current, providerText: current.map(turn => `${turn.speaker}: ${turn.canonicalText}`).join('\n') })
    current = []
    characters = 0
  }
  for (const turn of turns) {
    if (turn.delivery) throw CLIUsageError('Hume Octave 2 native utterances cannot serialize required acting descriptions; use segmented rendering or an Octave 1-compatible plan.')
    const length = [...turn.canonicalText].length
    if (length > maxCharacters) throw CLIUsageError(`Hume native utterance ${turn.turnId} exceeds the ${maxCharacters}-character turn-safe boundary.`)
    if (current.length > 0 && characters + length > maxCharacters) flush()
    current.push({ ...turn })
    characters += length
  }
  flush()
  return batches
}

type JsonRecord = Record<string, unknown>
const record = (value: unknown): JsonRecord | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
const flattenSnippets = (value: unknown): JsonRecord[] => {
  if (!Array.isArray(value)) return []
  const snippets: JsonRecord[] = []
  for (const item of value) {
    if (Array.isArray(item)) snippets.push(...flattenSnippets(item))
    else {
      const snippet = record(item)
      if (snippet) snippets.push(snippet)
    }
  }
  return snippets
}

export type HumeGenerationResponse = {
  audio?: unknown
  duration?: unknown
  generation_id?: unknown
  snippets?: unknown
}

const timestampTokens = (input: {
  generation: HumeGenerationResponse
  turns: readonly HumeNativeUtteranceTurn[]
  durationMs?: number | undefined
}): { words: TimedToken[], phonemes: TimedToken[] } => {
  const words: TimedToken[] = []
  const phonemes: TimedToken[] = []
  for (const snippet of flattenSnippets(input.generation.snippets)) {
    const utteranceIndex = typeof snippet['utterance_index'] === 'number' ? snippet['utterance_index'] : undefined
    const turn = utteranceIndex === undefined ? undefined : input.turns[utteranceIndex]
    if (!turn) continue
    const timestamps = Array.isArray(snippet['timestamps']) ? snippet['timestamps'] : []
    for (const rawTimestamp of timestamps) {
      const timestamp = record(rawTimestamp)
      const time = record(timestamp?.['time'])
      const type = timestamp?.['type']
      const text = timestamp?.['text']
      if ((type !== 'word' && type !== 'phoneme') || typeof text !== 'string' || typeof time?.['begin'] !== 'number' || typeof time['end'] !== 'number') continue
      const startMs = providerMilliseconds(time['begin'], input.durationMs)
      const endMs = providerMilliseconds(time['end'], input.durationMs)
      if (endMs < startMs) throw CLIUsageError('Hume timestamp contains a reversed range.')
      const token = { turnId: turn.turnId, subjectKey: turn.subjectKey, text, startMs, endMs }
      if (type === 'word') words.push(token)
      else phonemes.push(token)
    }
  }
  return { words, phonemes }
}

export const normalizeHumeGenerationTiming = (input: {
  generation: HumeGenerationResponse
  turns: readonly HumeNativeUtteranceTurn[]
}): NormalizedTiming<'take-audio-ms'> => {
  const durationMs = typeof input.generation.duration === 'number' ? providerMilliseconds(input.generation.duration * 1000) : undefined
  const { words, phonemes } = timestampTokens({ generation: input.generation, turns: input.turns, durationMs })
  if (words.length === 0 && phonemes.length === 0) return { availability: 'unavailable', clock: 'take-audio-ms', provenance: 'unavailable', turns: input.turns.map(turn => ({ turnId: turn.turnId, subjectKey: turn.subjectKey })), reason: 'Hume returned no word or phoneme timestamps for this Octave 2 generation.' }
  const turnRanges = input.turns.map(turn => {
    const tokens = [...words, ...phonemes].filter(token => token.turnId === turn.turnId)
    if (tokens.length === 0) return undefined
    return { turnId: turn.turnId, subjectKey: turn.subjectKey, startMs: Math.min(...tokens.map(token => token.startMs)), endMs: Math.max(...tokens.map(token => token.endMs)) }
  })
  if (turnRanges.some(turn => turn === undefined)) return { availability: 'unavailable', clock: 'take-audio-ms', provenance: 'unavailable', turns: input.turns.map(turn => ({ turnId: turn.turnId, subjectKey: turn.subjectKey })), reason: 'Hume timestamps did not cover every planned utterance.' }
  return { availability: 'timed', clock: 'take-audio-ms', provenance: 'provider-native', turns: turnRanges as Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>, ...(words.length > 0 ? { words } : {}), ...(phonemes.length > 0 ? { phonemes } : {}) }
}

export const runHumeNativeUtterances = async (
  turns: readonly HumeNativeUtteranceTurn[],
  outputDir: string,
  options: {
    model: HumeTtsModel
    takeCount?: number | undefined
    abortSignal?: AbortSignal | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (options.model !== 'octave-2') throw CLIUsageError('Hume native utterances currently require model octave-2.')
  if (turns.length === 0) throw CLIUsageError('Hume native utterances require at least one turn.')
  const takeCount = options.takeCount ?? 1
  if (!Number.isInteger(takeCount) || takeCount < 1 || takeCount > HUME_NATIVE_MAX_TAKES) throw CLIUsageError(`Hume num_generations must be between 1 and ${HUME_NATIVE_MAX_TAKES}.`)
  if (takeCount > 1 && options.requestEvidence) throw CLIUsageError('Canonical Hume execution requires explicit take selection before continuation; use a one-take run until a selection policy is supplied.')
  const apiKey = requireApiKey('HUME_API_KEY', 'tts:hume', 'Hume native utterances')
  const batches = planHumeNativeUtteranceBatches(turns)
  const startedAt = Date.now()
  const selectedPaths: string[] = []
  const allPaths: string[] = []
  let continuationGenerationId: string | undefined
  try {
    for (const [batchIndex, batch] of batches.entries()) {
      const chunkIndex = batchIndex + 1
      const continuation = continuationGenerationId ? { kind: 'provider-generation-id' as const, value: continuationGenerationId, providerVersion: '2' } : { kind: 'none' as const }
      const requestBody = {
        version: '2',
        format: { type: 'mp3' },
        include_timestamp_types: ['word', 'phoneme'],
        num_generations: takeCount,
        utterances: batch.turns.map(turn => ({
          text: turn.canonicalText,
          voice: { id: turn.voiceId },
          ...(typeof turn.speed === 'number' ? { speed: turn.speed } : {}),
          ...(typeof turn.trailingSilence === 'number' ? { trailing_silence: turn.trailingSilence } : {})
        })),
        ...(continuationGenerationId ? { context: { generation_id: continuationGenerationId } } : {})
      }
      const requestControls = { version: '2', format: { type: 'mp3' }, numGenerations: takeCount, includeTimestampTypes: ['word', 'phoneme'] }
      const payload = await withHostedTtsRetry({ operationName: `hume-native-${chunkIndex}`, abortSignal: options.abortSignal, ttsProvider: 'hume', chunkScheduler: options.chunkScheduler }, async (signal, attempt) => await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'native-utterance-synthesis',
        serializerVersion: 'hume.native-utterances.phase-3-v1',
        serializedRequest: { path: '/v0/tts', body: requestBody },
        providerText: batch.providerText,
        voiceField: 'utterances[].voice.id',
        voices: batch.turns.map(turn => ({ kind: 'provider-id', value: turn.voiceId, speaker: turn.speaker })),
        requestControls,
        continuation
      }, attempt, async ({ accepted }) => {
        const response = await fetch(`${HUME_DEFAULT_BASE_URL}/v0/tts`, { method: 'POST', headers: { 'X-Hume-Api-Key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), ...(signal ? { signal } : {}) })
        if (!response.ok) throw httpResponseError(`Hume native utterance synthesis failed (${response.status}).`, response)
        await accepted({ fields: { httpStatus: response.status } })
        return await response.json() as { generations?: unknown, request_id?: unknown }
      }))
      const generations = Array.isArray(payload.generations) ? payload.generations.map(value => record(value) as HumeGenerationResponse).filter(Boolean) : []
      if (generations.length !== takeCount) throw InfraError(`Hume returned ${generations.length} generations for requested count ${takeCount}.`, { stage: 'tts:hume' })
      for (const [generationIndex, generation] of generations.entries()) {
        if (typeof generation.audio !== 'string' || !generation.audio) throw InfraError('Hume native generation returned no audio.', { stage: 'tts:hume' })
        const bytes = Uint8Array.from(Buffer.from(generation.audio, 'base64'))
        if (bytes.byteLength === 0) throw InfraError('Hume native generation returned empty audio.', { stage: 'tts:hume' })
        const path = `${outputDir}/speech-hume-native-${String(chunkIndex).padStart(3, '0')}-take-${String(generationIndex + 1).padStart(2, '0')}.mp3`
        await Bun.write(path, bytes)
        const providerGenerationId = typeof generation.generation_id === 'string' ? generation.generation_id : undefined
        await options.requestEvidence?.recordOutput({ chunkIndex, path, outputIndex: generationIndex + 1, timing: normalizeHumeGenerationTiming({ generation, turns: batch.turns }), ...(providerGenerationId ? { providerGenerationId } : {}) })
        allPaths.push(path)
        if (generationIndex === 0) selectedPaths.push(path)
      }
      await options.requestEvidence?.complete({ chunkIndex })
      const selectedGenerationId = generations[0]?.generation_id
      if (typeof selectedGenerationId !== 'string' || !selectedGenerationId) throw InfraError('Hume native generation returned no continuation generation_id.', { stage: 'tts:hume' })
      continuationGenerationId = selectedGenerationId
    }
    const audioPath = await concatAndConvertToWav(selectedPaths, outputDir, 'Hume-native', options.abortSignal)
    return finalizeTtsRun({ service: 'hume', model: options.model, speaker: [...new Set(turns.map(turn => turn.voiceId))].join(','), audioPath, chunkCount: batches.length, startTime: startedAt })
  } finally {
    for (const path of allPaths) await Bun.$`rm -f ${path}`.quiet().nothrow()
  }
}
