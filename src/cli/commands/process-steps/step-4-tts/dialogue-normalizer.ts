import { basename } from 'node:path'
import type { DialogueNormalization, DialogueTurn, SpeakerVoiceMapping, SpeakerVoiceRegistry, TtsDialogueFormat, TtsOptions } from '~/types'
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

const normalizeSpeaker = (speaker: string): string =>
  speaker.trim().replace(/\s+/g, ' ').toUpperCase()

const normalizeDialogueWhitespace = (text: string): string =>
  text.trim().replace(/\s+/g, ' ')

const isSceneOrTransitionLine = (line: string): boolean => {
  return /^(?:SCENE|ACT)\b/i.test(line)
    || /^(?:INT|EXT|EST|INT\/EXT|I\/E)\.?\b/i.test(line)
    || /^(?:CUT TO|FADE IN|FADE OUT|DISSOLVE TO)\b/i.test(line)
}

const sortedSpeakerEntries = (registry: SpeakerVoiceRegistry): SpeakerVoiceMapping[] =>
  [...registry.entries].sort((a, b) => b.normalizedSpeaker.length - a.normalizedSpeaker.length)

const stripLeadingParentheticals = (text: string): string =>
  text.replace(/^(?:\s*\([^)]*\)\s*)+/, '').trim()

export const detectVoiceKind = (value: string): 'id' | 'ref-audio' => {
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

    const normalizedSpeaker = normalizeSpeaker(speaker)
    if (bySpeaker.has(normalizedSpeaker)) {
      throw CLIUsageError(`Duplicate --tts-speaker mapping for speaker ${speaker}.`)
    }

    const entry: SpeakerVoiceMapping = { speaker, normalizedSpeaker, voice, voiceKind: detectVoiceKind(voice) }
    bySpeaker.set(normalizedSpeaker, entry)
    entries.push(entry)
  }

  return { entries, bySpeaker }
}

// Speaker mappings alone are the mode switch. A dialogue format without them can only ever fail,
// so counting it here turned a `ttsDialogueFormat` stored in config defaults into a step-4 abort
// for every pipeline run. `assertDialogueFormatIsUsable` reports that case instead.
export const isMultiSpeakerRequested = (options: TtsOptions): boolean =>
  (options.ttsSpeakers?.length ?? 0) > 0

export const resolveDialogueFormat = (options: TtsOptions): TtsDialogueFormat => {
  if (options.ttsDialogueFormat === 'screenplay' || options.ttsDialogueFormat === 'labeled') {
    return options.ttsDialogueFormat
  }

  throw CLIUsageError('Dialogue TTS requires --tts-dialogue-format screenplay|labeled.')
}

// A format with no speaker mappings selects nothing. Typed on the command line that is a usage
// error; inherited from config defaults it is inert, so say so rather than failing the run.
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
    + 'Pass --tts-speaker SPEAKER=VOICE to run multi-speaker TTS, or remove ttsDialogueFormat from your config defaults.'
  )
}

const getSpeakerCue = (
  line: string,
  registry: SpeakerVoiceRegistry
): SpeakerVoiceMapping | undefined => {
  const normalizedLine = normalizeSpeaker(line)
  return registry.bySpeaker.get(normalizedLine)
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
    const text = stripLeadingParentheticals(candidate)
    if (!text || !isLikelyInlineDialogueText(text)) {
      continue
    }

    return {
      speaker: speaker.speaker,
      text: normalizeDialogueWhitespace(text)
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
    const speaker = registry.bySpeaker.get(normalizeSpeaker(rawSpeaker))
    if (!speaker) {
      throw CLIUsageError(`No --tts-speaker mapping found for speaker ${rawSpeaker}.`)
    }

    const turnText = normalizeDialogueWhitespace(match[2] ?? '')
    if (!turnText) {
      throw CLIUsageError(`Invalid labeled dialogue line ${i + 1}. Dialogue text is empty.`)
    }

    turns.push({
      speaker: speaker.speaker,
      text: turnText
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

  const flush = (): void => {
    if (currentSpeaker && currentText.length > 0) {
      turns.push({
        speaker: currentSpeaker.speaker,
        text: normalizeDialogueWhitespace(currentText.join(' '))
      })
    }
    currentSpeaker = undefined
    currentText = []
  }

  for (const rawLine of lines) {
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
      currentSpeaker = cue
      continue
    }

    const inline = parseInlineScreenplayDialogue(line, registry)
    if (inline) {
      flush()
      turns.push(inline)
      continue
    }

    if (!currentSpeaker) {
      continue
    }

    if (isLikelyScreenplayActionLine(line, registry)) {
      flush()
      continue
    }

    const dialogue = stripLeadingParentheticals(line)
    if (dialogue) {
      currentText.push(dialogue)
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
      ? `${entry.speaker}=ref_audio:${basename(entry.voice)}`
      : `${entry.speaker}=${entry.voice}`)
    .join(', ')

export const getSpeakerVoice = (
  registry: SpeakerVoiceRegistry,
  speaker: string
): SpeakerVoiceMapping => {
  const entry = registry.bySpeaker.get(normalizeSpeaker(speaker))
  if (!entry) {
    throw CLIUsageError(`No --tts-speaker mapping found for speaker ${speaker}.`)
  }
  return entry
}
