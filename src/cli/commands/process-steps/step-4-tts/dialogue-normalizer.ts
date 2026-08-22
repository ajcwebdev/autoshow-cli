import { basename } from 'node:path'
import type { DialogueNormalization, DialogueTurn, DialogueTurnDelivery, SpeakerVoiceMapping, SpeakerVoiceRegistry, TtsDialogueFormat, TtsOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
const ACTION_VERBS = new Set([
  'freezes',
  'sits',
  'stands',
  'leans',
  'rests',
  'rubs',
  'lowers',
  'stares',
  'turns',
  'walks',
  'runs',
  'looks',
  'nods',
  'shakes',
  'pauses',
  'smiles',
  'frowns',
  'laughs',
  'sighs',
  'waves',
  'points',
  'glances',
  'continues'
])

const REF_AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.m4a', '.m4b', '.ogg', '.oga', '.opus', '.flac', '.aac',
  '.webm', '.weba', '.mp4', '.aiff', '.aif', '.aifc', '.wma', '.amr', '.caf',
  '.mka', '.au', '.pcm'
])

export const normalizeDialogueSpeakerKey = (speaker: string): string =>
  speaker.trim().replace(/\s+/g, ' ').toUpperCase()

const normalizeDialogueWhitespace = (text: string): string =>
  text.trim().replace(/\s+/g, ' ')

const isSceneOrTransitionLine = (line: string): boolean => {
  return /^(?:SCENE|ACT)\b/i.test(line)
    || /^(?:INT|EXT|EST|INT\/EXT|I\/E)\.?\b/i.test(line)
    || /^(?:CUT TO|FADE IN|FADE OUT|DISSOLVE TO)\b/i.test(line)
    || /^(?:MONTAGE|END MONTAGE|TITLE CARD|SUPER|THE END)\b/i.test(line)
}

const sortedSpeakerEntries = (registry: SpeakerVoiceRegistry): SpeakerVoiceMapping[] =>
  [...registry.entries].sort((a, b) => b.normalizedSpeaker.length - a.normalizedSpeaker.length)

const parseLeadingParentheticals = (
  text: string
): { text: string, delivery?: DialogueTurnDelivery | undefined } => {
  const match = text.match(/^(?:\s*\([^)]*\)\s*)+/)
  if (!match) {
    return { text: text.trim() }
  }

  const sourceText = match[0].trim()
  const descriptions = [...sourceText.matchAll(/\(([^)]*)\)/g)]
    .map((entry) => (entry[1] ?? '').trim())
  return {
    text: text.slice(match[0].length).trim(),
    delivery: {
      kind: 'parenthetical',
      sourceText,
      descriptions
    }
  }
}

const combineDeliveries = (
  deliveries: readonly DialogueTurnDelivery[]
): DialogueTurnDelivery | undefined => {
  if (deliveries.length === 0) return undefined
  return {
    kind: 'parenthetical',
    sourceText: deliveries.map((delivery) => delivery.sourceText).join('\n'),
    descriptions: deliveries.flatMap((delivery) => delivery.descriptions)
  }
}

export const detectVoiceKind = (value: string): 'id' | 'ref-audio' => {
  if (value.startsWith('ref_audio:')) return 'ref-audio'
  if (value.includes('/') || value.includes('\\')) return 'ref-audio'
  const dotIndex = value.lastIndexOf('.')
  if (dotIndex > 0) {
    const ext = value.slice(dotIndex).toLowerCase()
    if (REF_AUDIO_EXTENSIONS.has(ext)) return 'ref-audio'
  }
  return 'id'
}

export const parseSpeakerVoiceMappings = (
  values: readonly string[] | undefined
): SpeakerVoiceRegistry => {
  const entries: SpeakerVoiceMapping[] = []
  const bySpeaker = new Map<string, SpeakerVoiceMapping>()

  for (const raw of values ?? []) {
    const idx = raw.indexOf('=')
    if (idx <= 0 || idx === raw.length - 1) {
      throw CLIUsageError(`Invalid --tts-speaker value "${raw}". Expected SPEAKER=VOICE or SPEAKER=path.`)
    }

    const speaker = raw.slice(0, idx).trim()
    const voice = raw.slice(idx + 1).trim()
    if (!speaker || !voice) {
      throw CLIUsageError(`Invalid --tts-speaker value "${raw}". Expected SPEAKER=VOICE or SPEAKER=path.`)
    }

    const normalizedSpeaker = normalizeDialogueSpeakerKey(speaker)
    if (bySpeaker.has(normalizedSpeaker)) {
      throw CLIUsageError(`Duplicate --tts-speaker mapping for speaker ${speaker}.`)
    }

    const entry: SpeakerVoiceMapping = { speaker, normalizedSpeaker, voice, voiceKind: detectVoiceKind(voice) }
    bySpeaker.set(normalizedSpeaker, entry)
    entries.push(entry)
  }

  return { entries, bySpeaker }
}

export const isMultiSpeakerRequested = (options: TtsOptions): boolean =>
  (options.ttsSpeakers?.length ?? 0) > 0

export const resolveDialogueFormat = (options: TtsOptions): TtsDialogueFormat => {
  if (options.ttsDialogueFormat === 'screenplay' || options.ttsDialogueFormat === 'labeled') {
    return options.ttsDialogueFormat
  }

  throw CLIUsageError('Dialogue TTS requires --tts-dialogue-format screenplay|labeled.')
}

export const assertDialogueFormatIsUsable = (
  options: TtsOptions,
  explicitFlags?: ReadonlySet<string>
): void => {
  const format = options.ttsDialogueFormat
  if (format === undefined || isMultiSpeakerRequested(options)) {
    return
  }

  if (explicitFlags?.has('tts-dialogue-format')) {
    throw CLIUsageError('--tts-dialogue-format requires at least one --tts-speaker SPEAKER=VOICE mapping. Speaker mappings select multi-speaker TTS; a dialogue format alone selects nothing.')
  }

  l.warn(
    `--tts-dialogue-format ${format} has no effect without --tts-speaker mappings and was ignored. `
    + 'Pass --tts-speaker SPEAKER=VOICE to run multi-speaker TTS, or remove ttsDialogueFormat from your config defaults.',
    { category: 'tts', metadata: { dialogueFormat: format } }
  )
}

const getSpeakerCue = (
  line: string,
  registry: SpeakerVoiceRegistry
): { speaker: SpeakerVoiceMapping, delivery?: DialogueTurnDelivery | undefined } | undefined => {
  const normalizedLine = normalizeDialogueSpeakerKey(line)
  const exact = registry.bySpeaker.get(normalizedLine)
  if (exact) return { speaker: exact }

  const qualified = line.match(/^(.+?)\s+((?:\([^)]*\)\s*)+)$/)
  if (!qualified) return undefined
  const speaker = registry.bySpeaker.get(normalizeDialogueSpeakerKey(qualified[1] ?? ''))
  if (!speaker) return undefined
  const parsed = parseLeadingParentheticals(qualified[2] ?? '')
  return {
    speaker,
    ...(parsed.delivery ? { delivery: parsed.delivery } : {})
  }
}

const startsWithSpeakerAction = (
  line: string,
  registry: SpeakerVoiceRegistry
): boolean => {
  const upperLine = line.toUpperCase()
  for (const speaker of sortedSpeakerEntries(registry)) {
    if (!upperLine.startsWith(speaker.normalizedSpeaker)) {
      continue
    }

    const rest = line.slice(speaker.speaker.length)
    if (/^\s*['']s\b/i.test(rest)) {
      return true
    }
    if (/^\s+[a-z]/.test(rest)) {
      return true
    }
    const firstWord = rest.trim().match(/^([A-Za-z]+)/)?.[1]?.toLowerCase()
    if (firstWord && ACTION_VERBS.has(firstWord)) {
      return true
    }
  }

  return false
}

const isLikelyScreenplayActionLine = (
  line: string,
  registry: SpeakerVoiceRegistry
): boolean =>
  isSceneOrTransitionLine(line) || startsWithSpeakerAction(line, registry)

const isLikelyInlineDialogueText = (text: string): boolean => {
  const firstWord = text.match(/^([A-Za-z]+)/)?.[1]?.toLowerCase()
  if (firstWord && ACTION_VERBS.has(firstWord)) {
    return false
  }
  return true
}

const getUnmappedInlineSpeaker = (
  line: string,
  registry: SpeakerVoiceRegistry
): string | undefined => {
  const match = line.match(/^([^:]{1,80}):\s*\S/)
  const rawSpeaker = match?.[1]?.trim()
  if (!rawSpeaker || !/^[\p{L}\p{N}][\p{L}\p{N} .'’_&-]*$/u.test(rawSpeaker)) {
    return undefined
  }
  return registry.bySpeaker.has(normalizeDialogueSpeakerKey(rawSpeaker)) ? undefined : rawSpeaker
}

const getUnmappedStandaloneSpeaker = (
  line: string,
  nextLine: string | undefined,
  registry: SpeakerVoiceRegistry
): string | undefined => {
  if (
    !nextLine?.trim()
    || isSceneOrTransitionLine(line)
    || isSceneOrTransitionLine(nextLine.trim())
    || startsWithSpeakerAction(line, registry)
  ) {
    return undefined
  }

  const cue = line.match(/^([A-Z][A-Z0-9 .'’_&-]{0,79}?)(?:\s+\([^)]*\))*$/)?.[1]?.trim()
  if (!cue || registry.bySpeaker.has(normalizeDialogueSpeakerKey(cue))) {
    return undefined
  }
  const cueWords = cue.split(/\s+/)
  if (cueWords.length > 4 || /^(?:A|AN|THE)$/.test(cueWords[0] ?? '')) {
    return undefined
  }
  return cue
}

const parseInlineScreenplayDialogue = (
  line: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn | undefined => {
  const upperLine = line.toUpperCase()
  for (const speaker of sortedSpeakerEntries(registry)) {
    if (!upperLine.startsWith(speaker.normalizedSpeaker)) {
      continue
    }

    const rest = line.slice(speaker.speaker.length)
    if (rest.length === 0) {
      continue
    }

    const boundary = rest[0]
    if (boundary !== ':' && boundary !== ' ' && boundary !== '\t') {
      continue
    }

    const candidate = boundary === ':' ? rest.slice(1).trim() : rest.trim()
    const parsed = parseLeadingParentheticals(candidate)
    if (!parsed.text || !isLikelyInlineDialogueText(parsed.text)) {
      continue
    }

    return {
      speaker: speaker.speaker,
      text: normalizeDialogueWhitespace(parsed.text),
      ...(parsed.delivery ? { delivery: parsed.delivery } : {})
    }
  }

  return undefined
}

const normalizeLabeledDialogue = (
  text: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn[] => {
  const turns: DialogueTurn[] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (!line) {
      continue
    }

    const match = line.match(/^([^:]+):\s*(.+)$/)
    if (!match) {
      throw CLIUsageError(`Invalid labeled dialogue line ${i + 1}. Expected SPEAKER: text.`)
    }

    const rawSpeaker = match[1]?.trim() ?? ''
    const speaker = registry.bySpeaker.get(normalizeDialogueSpeakerKey(rawSpeaker))
    if (!speaker) {
      throw CLIUsageError(`No --tts-speaker mapping found for speaker ${rawSpeaker}.`)
    }

    const rawTurnText = match[2] ?? ''
    const parsed = parseLeadingParentheticals(rawTurnText)
    const turnText = normalizeDialogueWhitespace(rawTurnText)
    if (!turnText) {
      throw CLIUsageError(`Invalid labeled dialogue line ${i + 1}. Dialogue text is empty.`)
    }
    if (parsed.delivery && !parsed.text) {
      throw CLIUsageError(`Invalid labeled dialogue line ${i + 1}. Dialogue text contains delivery but no spoken text.`)
    }

    turns.push({
      speaker: speaker.speaker,
      text: turnText,
      ...(parsed.delivery ? { delivery: parsed.delivery } : {})
    })
  }

  return turns
}

const normalizeScreenplayDialogue = (
  text: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn[] => {
  const turns: DialogueTurn[] = []
  const lines = text.split(/\r?\n/)
  let currentSpeaker: SpeakerVoiceMapping | undefined
  let currentText: string[] = []
  let currentDeliveries: DialogueTurnDelivery[] = []

  const flush = (): void => {
    if (currentSpeaker && currentText.length > 0) {
      const delivery = combineDeliveries(currentDeliveries)
      turns.push({
        speaker: currentSpeaker.speaker,
        text: normalizeDialogueWhitespace(currentText.join(' ')),
        ...(delivery ? { delivery } : {})
      })
    }
    currentSpeaker = undefined
    currentText = []
    currentDeliveries = []
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex] ?? ''
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }

    if (isSceneOrTransitionLine(line)) {
      flush()
      continue
    }

    const cue = getSpeakerCue(line, registry)
    if (cue) {
      flush()
      currentSpeaker = cue.speaker
      if (cue.delivery) currentDeliveries.push(cue.delivery)
      continue
    }

    const inline = parseInlineScreenplayDialogue(line, registry)
    if (inline) {
      flush()
      turns.push(inline)
      continue
    }

    const unmappedSpeaker = getUnmappedInlineSpeaker(line, registry)
      ?? getUnmappedStandaloneSpeaker(line, lines[lineIndex + 1], registry)
    if (unmappedSpeaker) {
      throw CLIUsageError(`No --tts-speaker mapping found for speaker ${unmappedSpeaker}.`)
    }

    if (!currentSpeaker) {
      continue
    }

    if (isLikelyScreenplayActionLine(line, registry)) {
      flush()
      continue
    }

    const parsed = parseLeadingParentheticals(line)
    if (parsed.delivery) {
      currentDeliveries.push(parsed.delivery)
    }
    if (parsed.text) {
      currentText.push(parsed.text)
    }
  }

  flush()
  return turns
}

const formatDialogueTurns = (turns: readonly DialogueTurn[]): string =>
  turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')

export const normalizeDialogueText = (
  text: string,
  format: TtsDialogueFormat,
  registry: SpeakerVoiceRegistry
): DialogueNormalization => {
  const turns = format === 'screenplay'
    ? normalizeScreenplayDialogue(text, registry)
    : normalizeLabeledDialogue(text, registry)

  if (turns.length === 0) {
    throw CLIUsageError('Dialogue TTS found no dialogue turns for the configured speakers.')
  }

  const normalizedText = formatDialogueTurns(turns)
  return {
    turns,
    normalizedText,
    spokenCharacterCount: turns.reduce((sum, turn) => sum + turn.text.length, 0)
  }
}

export const normalizeDialogueFromOptions = (
  text: string,
  options: TtsOptions
): DialogueNormalization => {
  const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
  return normalizeDialogueText(text, resolveDialogueFormat(options), registry)
}

export const formatSpeakerVoiceSummary = (
  registry: SpeakerVoiceRegistry
): string =>
  registry.entries
    .map((entry) => entry.voiceKind === 'ref-audio'
      ? `${entry.speaker}=${entry.voice.startsWith('ref_audio:') ? entry.voice : `ref_audio:${basename(entry.voice)}`}`
      : `${entry.speaker}=${entry.voice}`)
    .join(', ')

export const getSpeakerVoice = (
  registry: SpeakerVoiceRegistry,
  speaker: string
): SpeakerVoiceMapping => {
  const entry = registry.bySpeaker.get(normalizeDialogueSpeakerKey(speaker))
  if (!entry) {
    throw CLIUsageError(`No --tts-speaker mapping found for speaker ${speaker}.`)
  }
  return entry
}
