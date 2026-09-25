import { UsageError } from '~/utils/error-handler'
import { validateSonioxTtsLanguage, validateSonioxTtsModel, validateSonioxTtsVoice } from '~/cli/commands/setup-and-utilities/models/tts-models'

export const SONIOX_TTS_SERIALIZER_VERSION = 'soniox.tts.rest.v1'
export const sonioxTtsRequestControls = (language = 'en', speed = 1) => {
  if (!Number.isFinite(speed) || speed < 0.7 || speed > 1.3) throw UsageError('Soniox TTS speed must be between 0.7 and 1.3.')
  return { language: validateSonioxTtsLanguage(language), speed, audio_format: 'wav' as const, sample_rate: 24000 }
}

export const serializeSonioxTts = (model: string, voice: string, text: string, language?: string, speed?: number) => ({
  model: validateSonioxTtsModel(model), voice: validateSonioxTtsVoice(voice), text,
  ...sonioxTtsRequestControls(language, speed),
})
