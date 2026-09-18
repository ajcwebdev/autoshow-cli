import type { VoicePromiseContext } from './voice-management-types'
import type { TtsCustomVoiceSampleAudio } from '~/types'

export type SpeechifyTtsCustomVoiceGender =
  typeof import('~/cli/commands/audio/tts/tts-services/speechify/speechify-custom-voices').SPEECHIFY_CUSTOM_VOICE_GENDERS[number]

export type SpeechifyTtsCustomVoiceResult = {
  voiceId: string
  voiceName: string
  locale: string
  gender: SpeechifyTtsCustomVoiceGender
  sourceAudio: TtsCustomVoiceSampleAudio
}

export type SpeechifyTtsCustomVoiceContext = VoicePromiseContext<SpeechifyTtsCustomVoiceResult>

export type SpeechifyTtsCustomVoiceOptions = {
  refAudioPath: string
  voiceName?: string | undefined
  consentName?: string | undefined
  consentEmail?: string | undefined
  locale?: string | undefined
  gender?: string | undefined
  context?: SpeechifyTtsCustomVoiceContext | undefined
}
