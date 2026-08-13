import type { GeminiDialogueMode, MultiSpeakerStrategy, SpeakerVoiceRegistry } from '~/types'
import { validateGeminiTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const buildGeminiSpeakerVoiceConfigs = (
  registry: SpeakerVoiceRegistry
): Array<{ speaker: string, voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } }> =>
  registry.entries.map((entry) => ({
    speaker: entry.speaker,
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: validateGeminiTtsVoice(entry.voice)
      }
    }
  }))

export const validateGeminiMultiSpeakerTranscriptFromRegistry = (
  text: string,
  registry: SpeakerVoiceRegistry
): void => {
  for (const entry of registry.entries) {
    const pattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(entry.speaker)}\\s*:`, 'm')
    if (!pattern.test(text)) {
      throw CLIUsageError(`Gemini multispeaker TTS requires the input text to include "${entry.speaker}:" labels.`)
    }
  }
}

export const resolveGeminiDialogueStrategy = (
  registeredSpeakerCount: number,
  mode: GeminiDialogueMode = 'auto'
): MultiSpeakerStrategy => {
  if (mode === 'segmented') return 'segment-and-concat'
  if (registeredSpeakerCount === 2) return 'native'
  if (mode === 'native') {
    throw CLIUsageError(
      `Gemini native dialogue requires exactly two registered speakers; received ${registeredSpeakerCount}.`
    )
  }
  return 'segment-and-concat'
}

export const resolveGeminiDialogueStrategyForText = (
  text: string,
  registry: SpeakerVoiceRegistry,
  maxCharacters: number,
  mode: GeminiDialogueMode = 'auto'
): MultiSpeakerStrategy => {
  const strategy = resolveGeminiDialogueStrategy(registry.entries.length, mode)
  if (strategy !== 'native') return strategy

  const maxChars = Math.max(1, Math.floor(maxCharacters))
  const oversizedLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > maxChars)
  if (!oversizedLine) return strategy
  if (mode === 'auto') return 'segment-and-concat'

  const separator = oversizedLine.indexOf(':')
  const speaker = separator > 0 ? oversizedLine.slice(0, separator).trim() : 'unknown speaker'
  throw CLIUsageError(
    `Gemini native dialogue turn for ${speaker} is ${oversizedLine.length} characters, exceeding the ${maxChars}-character request limit. Use segmented rendering for this dialogue.`
  )
}

const normalizeSpeaker = (speaker: string): string =>
  speaker.trim().replace(/\s+/g, ' ').toUpperCase()

export const splitGeminiNativeDialogueText = (
  text: string,
  registry: SpeakerVoiceRegistry,
  maxCharacters: number
): string[] => {
  resolveGeminiDialogueStrategy(registry.entries.length, 'native')
  const maxChars = Math.max(1, Math.floor(maxCharacters))
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const line of lines) {
    const separator = line.indexOf(':')
    const rawSpeaker = separator > 0 ? line.slice(0, separator) : ''
    const spokenText = separator > 0 ? line.slice(separator + 1).trim() : ''
    if (!registry.bySpeaker.has(normalizeSpeaker(rawSpeaker)) || !spokenText) {
      throw CLIUsageError(
        'Gemini native dialogue must be normalized into non-empty SPEAKER: text turns before request partitioning.'
      )
    }
    if (line.length > maxChars) {
      throw CLIUsageError(
        `Gemini native dialogue turn for ${rawSpeaker.trim()} is ${line.length} characters, exceeding the ${maxChars}-character request limit. Use segmented rendering for this dialogue.`
      )
    }

    const candidate = current ? `${current}\n${line}` : line
    if (candidate.length > maxChars) {
      chunks.push(current)
      current = line
    } else {
      current = candidate
    }
  }

  if (current) chunks.push(current)
  return chunks
}

export const formatSpeakerRegistrySummary = (registry: SpeakerVoiceRegistry): string =>
  registry.entries.map((e) => `${e.speaker}=${e.voice}`).join(', ')
