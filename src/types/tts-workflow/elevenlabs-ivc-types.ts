import type { VoicePromiseContext } from './voice-management-types'
import type { TtsCustomVoiceSampleAudio } from '~/types'

export type ElevenLabsTtsIvcResult = {
  voiceId: string
  voiceName: string
  sourceAudio: TtsCustomVoiceSampleAudio
  requiresVerification: boolean
}

export type ElevenLabsTtsIvcContext = VoicePromiseContext<ElevenLabsTtsIvcResult>

export type ElevenLabsTtsIvcOptions = {
  refAudioPath: string
  voiceName?: string | undefined
  removeBackgroundNoise?: boolean | undefined
  context?: ElevenLabsTtsIvcContext | undefined
}
