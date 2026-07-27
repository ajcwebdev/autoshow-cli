import type { TtsCustomVoiceSampleAudio } from '~/types'

export type ElevenLabsTtsIvcResult = {
  voiceId: string
  voiceName: string
  sourceAudio: TtsCustomVoiceSampleAudio
  requiresVerification: boolean
}

export type ElevenLabsTtsIvcContext = {
  voicePromise?: Promise<ElevenLabsTtsIvcResult> | undefined
}

export type ElevenLabsTtsIvcOptions = {
  refAudioPath: string
  voiceName?: string | undefined
  removeBackgroundNoise?: boolean | undefined
  context?: ElevenLabsTtsIvcContext | undefined
}
