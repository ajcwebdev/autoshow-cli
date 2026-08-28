import type { FishGlobalTimelineSegment, FishNativeDialogueBatch, FishNativeDialogueTurn, FishPreparedDialogueTurn, FishTtsModel, NormalizedTiming, PreparedProviderText, TimedToken, TtsTimingIdentity } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalOffsetForProviderOffset } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-timing-mapping'

export {
  buildFishGlobalTimeline,
  emptyFishTimestampStreamState,
  parseFishSseFrame,
  parseFishTimestampStreamEvent,
  reduceFishTimestampStreamEvent,
  splitFishSseFrames,
} from '~/utils/fish-client/fish-timestamp-stream'

export const FISH_TTS_SERIALIZER_VERSION = 'fish.tts.phase-0-v1'
export const FISH_TIMESTAMP_SERIALIZER_VERSION = 'fish.tts.timestamp.phase-6-v1'
export const FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION = 'fish.dialogue.phase-6-v1'
const FISH_NATIVE_DIALOGUE_MAX_CHARACTERS = 4000
export const FISH_S21_PRO_MODEL = 's2.1-pro'
export const FISH_VOICE_DESIGN_MODEL = 'voice-design-1'

export const isFishNativeDialogueModel = (model: string | undefined): boolean => model === FISH_S21_PRO_MODEL
export const isFishTimestampModel = (model: string | undefined): boolean => model === FISH_S21_PRO_MODEL

const FISH_S2_DELIVERY_TAGS = [
  { tag: 'happy', pattern: /\b(?:happy|happily|cheerful|jolly)\b/i },
  { tag: 'sad', pattern: /\b(?:sad|wistful|melancholy|mournful)\b/i },
  { tag: 'angry', pattern: /\b(?:angry|furious|rage|indignant)\b/i },
  { tag: 'excited', pattern: /\b(?:excited|delighted|ecstatic|enthusiastic|thrilled)\b/i },
  { tag: 'calm', pattern: /\b(?:calm|peaceful|relaxed)\b/i },
  { tag: 'nervous', pattern: /\b(?:nervous|anxious|uncertain)\b/i },
  { tag: 'whispering', pattern: /\b(?:whisper(?:s|ed|ing)?|softly|quietly)\b/i },
  { tag: 'shouting', pattern: /\b(?:shout(?:s|ed|ing)?|yell(?:s|ed|ing)?)\b/i },
  { tag: 'laughing', pattern: /\b(?:laugh(?:s|ed|ing)?|chuckl(?:e|es|ed|ing))\b/i },
  { tag: 'sighing', pattern: /\b(?:sigh(?:s|ed|ing)?)\b/i },
  { tag: 'sarcastic', pattern: /\b(?:sarcastic|sarcasm|dry|deadpan)\b/i },
] as const

const speakerTag = (index: number): string => `<|speaker:${index}|>`

const deliveryMarker = (delivery: string | undefined): string => {
  if (!delivery) return ''
  const tag = FISH_S2_DELIVERY_TAGS.find(candidate => candidate.pattern.test(delivery.normalize('NFKC')))?.tag
  if (!tag) return ''
  return `[${tag}]`
}

export const prepareFishDialogueText = (
  canonicalText: string,
  delivery?: string | undefined,
  _model: FishTtsModel | string = FISH_S21_PRO_MODEL
): PreparedProviderText => {
  const canonicalLength = [...canonicalText].length
  const marker = deliveryMarker(delivery)
  const prefix = marker ? `${marker} ` : ''
  const prefixLength = [...prefix].length
  return {
    schemaVersion: 1,
    canonicalText,
    providerText: `${prefix}${canonicalText}`,
    preparationVersion: 'fish-s2-dialogue-v1',
    canonicalIndexUnit: 'unicode-scalar-value',
    providerIndexUnit: 'unicode-scalar-value',
    spans: [
      ...(prefixLength > 0 ? [{ kind: 'provider-only' as const, providerStart: 0, providerEnd: prefixLength, transform: 's2-delivery-marker' }] : []),
      ...(canonicalLength > 0 ? [{ kind: 'mapped' as const, canonicalStart: 0, canonicalEnd: canonicalLength, providerStart: prefixLength, providerEnd: prefixLength + canonicalLength }] : []),
    ],
  }
}

export const planFishNativeDialogueBatches = (
  turns: readonly FishNativeDialogueTurn[],
  maxCharacters = FISH_NATIVE_DIALOGUE_MAX_CHARACTERS
): FishNativeDialogueBatch[] => {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw UsageError('Fish native dialogue character limit must be a positive integer.')
  const speakerOrder: string[] = []
  for (const turn of turns) {
    if (!speakerOrder.includes(turn.voiceId)) speakerOrder.push(turn.voiceId)
  }
  const speakerIndex = new Map(speakerOrder.map((voiceId, index) => [voiceId, index]))
  const prepared: FishPreparedDialogueTurn[] = turns.map(turn => ({
    ...turn,
    preparedText: prepareFishDialogueText(turn.canonicalText, turn.delivery, FISH_S21_PRO_MODEL),
    speakerIndex: speakerIndex.get(turn.voiceId) ?? 0,
  }))
  const batches: FishNativeDialogueBatch[] = []
  let current: FishPreparedDialogueTurn[] = []
  let characters = 0
  const flush = (): void => {
    if (current.length === 0) return
    const referenceIds: string[] = []
    for (const turn of current) {
      if (!referenceIds.includes(turn.voiceId)) referenceIds.push(turn.voiceId)
    }
    const remapped = current.map(turn => ({ ...turn, speakerIndex: referenceIds.indexOf(turn.voiceId) }))
    batches.push({
      batchIndex: batches.length,
      turns: remapped,
      providerText: remapped.map(turn => `${speakerTag(turn.speakerIndex)}${turn.preparedText.providerText}`).join(''),
      referenceIds,
    })
    current = []
    characters = 0
  }
  for (const turn of prepared) {
    const taggedLength = [...speakerTag(turn.speakerIndex)].length + [...turn.preparedText.providerText].length
    if (taggedLength > maxCharacters) throw UsageError(`Fish native dialogue turn ${turn.turnId} exceeds the ${maxCharacters}-character turn-safe boundary.`)
    if (current.length > 0 && characters + taggedLength > maxCharacters) flush()
    current.push(turn)
    characters += taggedLength
  }
  flush()
  return batches
}

const milliseconds = (seconds: number): number => Math.round(seconds * 1000)


export const normalizeFishTimestampAlignment = (input: Readonly<{
  text: string
  timeline: readonly FishGlobalTimelineSegment[]
  identity: TtsTimingIdentity
}>): NormalizedTiming<'take-audio-ms'> => {
  let cursor = 0
  const words: TimedToken[] = []
  for (const segment of input.timeline) {
    const start = input.text.indexOf(segment.text, cursor)
    const providerStart = start < 0 ? undefined : [...input.text.slice(0, start)].length
    const providerEnd = start < 0 ? undefined : providerStart! + [...segment.text].length
    if (start >= 0) cursor = start + segment.text.length
    words.push({
      ...input.identity,
      text: segment.text,
      startMs: milliseconds(segment.start),
      endMs: milliseconds(segment.end),
      ...(providerStart === undefined || providerEnd === undefined ? {} : { providerStart, providerEnd, canonicalStart: providerStart, canonicalEnd: providerEnd }),
    })
  }
  if (words.length === 0) {
    return { availability: 'unavailable', clock: 'take-audio-ms', provenance: 'unavailable', turns: [input.identity], reason: 'Fish returned no valid timestamp alignment segments.' }
  }
  return {
    availability: 'timed',
    clock: 'take-audio-ms',
    provenance: 'provider-alignment',
    turns: [{ ...input.identity, startMs: Math.min(...words.map(word => word.startMs)), endMs: Math.max(...words.map(word => word.endMs)) }],
    words,
  }
}

export const normalizeFishNativeDialogueTiming = (input: Readonly<{
  timeline: readonly FishGlobalTimelineSegment[]
  turns: readonly FishPreparedDialogueTurn[]
}>): NormalizedTiming<'take-audio-ms'> => {
  const providerText = input.turns.map(turn => `${speakerTag(turn.speakerIndex)}${turn.preparedText.providerText}`).join('')
  let searchFrom = 0
  const words: TimedToken[] = []
  const turnRanges = input.turns.map(turn => {
    const starts: number[] = []
    const ends: number[] = []
    return { turn, starts, ends }
  })
  for (const segment of input.timeline) {
    const found = providerText.indexOf(segment.text, searchFrom)
    if (found < 0) continue
    searchFrom = found + segment.text.length
    let cursor = 0
    let matched: FishPreparedDialogueTurn | undefined
    let localProviderStart = 0
    for (const turn of input.turns) {
      const tagged = `${speakerTag(turn.speakerIndex)}${turn.preparedText.providerText}`
      const next = cursor + tagged.length
      if (found >= cursor && found < next) {
        matched = turn
        localProviderStart = found - cursor - speakerTag(turn.speakerIndex).length
        break
      }
      cursor = next
    }
    if (!matched || localProviderStart < 0) continue
    const startMs = milliseconds(segment.start)
    const endMs = milliseconds(segment.end)
    const canonicalStart = canonicalOffsetForProviderOffset(matched.preparedText, localProviderStart)
    const range = turnRanges.find(entry => entry.turn.turnId === matched!.turnId)
    range?.starts.push(startMs)
    range?.ends.push(endMs)
    words.push({
      turnId: matched.turnId,
      subjectKey: matched.subjectKey,
      text: segment.text,
      startMs,
      endMs,
      providerStart: localProviderStart,
      providerEnd: localProviderStart + [...segment.text].length,
      ...(canonicalStart === undefined ? {} : { canonicalStart, canonicalEnd: canonicalStart + [...segment.text].length }),
    })
  }
  const turns = turnRanges.map(({ turn, starts, ends }) => starts.length === 0 || ends.length === 0
    ? undefined
    : { turnId: turn.turnId, subjectKey: turn.subjectKey, startMs: Math.min(...starts), endMs: Math.max(...ends) })
  if (turns.some(turn => turn === undefined)) {
    return {
      availability: 'unavailable',
      clock: 'take-audio-ms',
      provenance: 'unavailable',
      turns: input.turns.map(turn => ({ turnId: turn.turnId, subjectKey: turn.subjectKey })),
      reason: 'Fish did not return a complete timestamp range for every native dialogue turn.',
    }
  }
  return {
    availability: 'timed',
    clock: 'take-audio-ms',
    provenance: 'provider-alignment',
    turns: turns as Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>,
    ...(words.length > 0 ? { words } : {}),
  }
}
