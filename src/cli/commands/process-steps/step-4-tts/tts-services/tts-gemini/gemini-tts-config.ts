import type { SpeakerVoiceRegistry } from '~/types'
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
        voiceName: entry.voice
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

export const formatSpeakerRegistrySummary = (registry: SpeakerVoiceRegistry): string =>
  registry.entries.map((e) => `${e.speaker}=${e.voice}`).join(', ')
