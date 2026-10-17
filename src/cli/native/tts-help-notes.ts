import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { ELEVENLABS_DEFAULT_VOICE_ID, GROK_DEFAULT_TTS_VOICE, INWORLD_DEFAULT_TTS_VOICE, OPENAI_DEFAULT_TTS_VOICE, SONIOX_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/audio/tts/tts-utils/tts-chunk-limits'
import type { TtsProvider } from '~/types'

const VOICE_DEFAULTS: Record<TtsProvider, string> = {
  gemini: 'Kore', elevenlabs: ELEVENLABS_DEFAULT_VOICE_ID, grok: GROK_DEFAULT_TTS_VOICE,
  inworld: INWORLD_DEFAULT_TTS_VOICE, openai: OPENAI_DEFAULT_TTS_VOICE, soniox: SONIOX_DEFAULT_TTS_VOICE,
}

const VOICE_INPUTS: Record<TtsProvider, string> = {
  gemini: 'Prebuilt voice name, library ID, or persistent voice_ resource; stateless voicekey_ values are rejected.',
  elevenlabs: 'Existing provider voice ID; create or import durable registrations with the voice commands.',
  grok: 'Built-in voice name or an 8-character alphanumeric custom voice ID.',
  inworld: 'Non-empty existing provider voice ID.',
  openai: 'Built-in voice name or an eligible custom voice ID beginning with voice_.',
  soniox: 'Built-in voice name or existing cloned-voice ID, at most 50 characters; access is checked by Soniox.',
}

export const ttsProviderHelpNotes = (provider: string): string[] => {
  if (!Object.hasOwn(VOICE_DEFAULTS, provider)) return []
  const service = provider as TtsProvider
  const entry = getModelRegistry().tts[provider]
  const voices = entry?.voices ?? []
  const limits = Object.keys(entry?.models ?? {}).map(model => `${model}=${resolveTtsChunkCharacterLimit(service, model) ?? 'provider-defined'}`)
  return [
    `--tts-voice default: ${VOICE_DEFAULTS[service]}. ${VOICE_INPUTS[service]}`,
    ...(voices.length ? [`Registered built-in voices: ${voices.join('|')}.`] : []),
    `--tts-chunk-size model ceilings in characters: ${limits.join(', ')}. Effective defaults and explicit limits can be lower to fit UTF-8, metadata, or instruction budgets; boundaries are always smart.`,
  ]
}
