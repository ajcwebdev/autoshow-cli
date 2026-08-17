import type { InworldTtsModel, NormalizedTiming, TimedToken, TtsTimingIdentity } from '~/types'

export const INWORLD_TTS_SERIALIZER_VERSION = 'inworld.tts.phase-3-v3'

export const resolveInworldTtsApiModelId = (model: InworldTtsModel): string => {
  switch (model) {
    case 'realtime-tts-2': return 'inworld-tts-2'
  }
}

type InworldTtsRequestInput = Readonly<{
  text: string
  voiceId: string
  markups?: readonly string[] | undefined
  model: 'realtime-tts-2'
  steeringPrompt?: string | undefined
}>

export const buildInworldTtsRequestBody = (input: InworldTtsRequestInput): Readonly<Record<string, unknown>> => {
  return {
    text: input.text,
    voiceId: input.voiceId,
    modelId: resolveInworldTtsApiModelId(input.model),
    timestampType: 'WORD',
    audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 },
    ...(input.steeringPrompt?.trim() ? { instruction: input.steeringPrompt.trim() } : {})
  }
}

const record = (value: unknown): Readonly<Record<string, unknown>> | undefined => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined
const finiteNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
const milliseconds = (seconds: number): number => Math.round(seconds * 1000)
const scalarLength = (value: string): number => Array.from(value).length

const canonicalRanges = (text: string, words: readonly unknown[]): Array<{ canonicalStart: number, canonicalEnd: number } | undefined> => {
  let cursor = 0
  return words.map((rawWord) => {
    if (typeof rawWord !== 'string') return undefined
    const start = text.indexOf(rawWord, cursor)
    if (start < 0) return undefined
    const end = start + rawWord.length
    cursor = end
    return { canonicalStart: scalarLength(text.slice(0, start)), canonicalEnd: scalarLength(text.slice(0, end)) }
  })
}

export const normalizeInworldTimestampInfo = (input: Readonly<{
  text: string
  timestampInfo: unknown
  identity: TtsTimingIdentity
}>): NormalizedTiming<'take-audio-ms'> => {
  const timestampInfo = record(input.timestampInfo)
  const alignment = record(timestampInfo?.['wordAlignment'])
  const rawWords = Array.isArray(alignment?.['words']) ? alignment['words'] : []
  const starts = Array.isArray(alignment?.['wordStartTimeSeconds']) ? alignment['wordStartTimeSeconds'] : []
  const ends = Array.isArray(alignment?.['wordEndTimeSeconds']) ? alignment['wordEndTimeSeconds'] : []
  const ranges = canonicalRanges(input.text, rawWords)
  const words: TimedToken[] = []
  for (let index = 0; index < rawWords.length; index++) {
    const text = rawWords[index]
    const start = finiteNumber(starts[index])
    const end = finiteNumber(ends[index])
    if (typeof text !== 'string' || start === undefined || end === undefined || end < start) continue
    words.push({ ...input.identity, text, startMs: milliseconds(start), endMs: milliseconds(end), ...ranges[index] })
  }
  const phonemes: TimedToken[] = []
  const details = Array.isArray(alignment?.['phoneticDetails']) ? alignment['phoneticDetails'] : []
  for (const rawDetail of details) {
    const detail = record(rawDetail)
    const phones = Array.isArray(detail?.['phones']) ? detail['phones'] : []
    for (const rawPhone of phones) {
      const phone = record(rawPhone)
      const text = phone?.['phoneSymbol']
      const start = finiteNumber(phone?.['startTimeSeconds'])
      const duration = finiteNumber(phone?.['durationSeconds'])
      const visemeSymbol = typeof phone?.['visemeSymbol'] === 'string' && phone['visemeSymbol'].trim() ? phone['visemeSymbol'].trim() : undefined
      if (typeof text !== 'string' || start === undefined || duration === undefined) continue
      phonemes.push({ ...input.identity, text, startMs: milliseconds(start), endMs: milliseconds(start + duration), ...(visemeSymbol ? { visemeSymbol } : {}) })
    }
  }
  const tokens = [...words, ...phonemes]
  if (tokens.length === 0) return { availability: 'unavailable', clock: 'take-audio-ms', provenance: 'unavailable', turns: [input.identity], reason: 'Inworld returned no valid word or phoneme timestamps.' }
  return {
    availability: 'timed',
    clock: 'take-audio-ms',
    provenance: 'provider-alignment',
    turns: [{ ...input.identity, startMs: Math.min(...tokens.map(token => token.startMs)), endMs: Math.max(...tokens.map(token => token.endMs)) }],
    ...(words.length > 0 ? { words } : {}),
    ...(phonemes.length > 0 ? { phonemes } : {})
  }
}
