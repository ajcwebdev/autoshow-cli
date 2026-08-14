import type { DeepinfraTtsModel } from '~/types'
import { prepareDeepinfraChatterboxText } from './deepinfra-text-preparation'

export const DEEPINFRA_TTS_SERIALIZER_VERSION = 'deepinfra.tts.phase-4-v2'

export const DEEPINFRA_DEFAULT_VOICE_DESCRIPTION = 'A warm, clear, expressive English narrator with natural pacing.'

export const resolveDeepinfraTtsDefaultVoice = (model: DeepinfraTtsModel): string => {
  switch (model) {
    case 'ResembleAI/chatterbox-multilingual':
    case 'ResembleAI/chatterbox-turbo':
      return 'provider-default'
    case 'XiaomiMiMo/MiMo-V2.5-tts':
      return 'mimo_default'
    case 'Qwen/Qwen3-TTS':
      return 'Vivian'
    case 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign':
    case 'Qwen/Qwen3-TTS-VoiceDesign':
      return DEEPINFRA_DEFAULT_VOICE_DESCRIPTION
  }
}

export const resolveDeepinfraTtsVoiceField = (model: string): string =>
  model === 'ResembleAI/chatterbox-multilingual' || model === 'ResembleAI/chatterbox-turbo'
    ? 'voice_id'
    : 'voice'

export const prepareDeepinfraTtsText = (model: DeepinfraTtsModel, text: string): string =>
  model === 'ResembleAI/chatterbox-multilingual'
    ? prepareDeepinfraChatterboxText(text).providerText
    : text

export const resolveDeepinfraTtsRequestControls = (
  model: string,
  promptInstructions?: string | undefined
): Readonly<Record<string, unknown>> => ({
  format: 'wav',
  requestSchema: model,
  ...(promptInstructions ? { promptInstructions } : {})
})

export const buildDeepinfraTtsRequestBody = (input: Readonly<{
  model: DeepinfraTtsModel
  text: string
  voice: string
  promptInstructions?: string | undefined
}>): Readonly<Record<string, unknown>> => {
  const { model, text, voice, promptInstructions } = input
  switch (model) {
    case 'ResembleAI/chatterbox-multilingual':
    case 'ResembleAI/chatterbox-turbo':
      return {
        text,
        response_format: 'wav',
        ...(voice !== 'provider-default' ? { voice_id: voice } : {})
      }
    case 'XiaomiMiMo/MiMo-V2.5-tts':
      return {
        text,
        voice,
        output_format: 'wav',
        stream: false,
        ...(promptInstructions ? { instruct: promptInstructions } : {})
      }
    case 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign':
      return { text, voice, output_format: 'wav', stream: false }
    case 'Qwen/Qwen3-TTS':
      return {
        input: text,
        voice,
        language: 'Auto',
        response_format: 'wav',
        ...(promptInstructions ? { instruct: promptInstructions } : {})
      }
    case 'Qwen/Qwen3-TTS-VoiceDesign':
      return { input: text, voice, language: 'Auto', response_format: 'wav' }
  }
}
