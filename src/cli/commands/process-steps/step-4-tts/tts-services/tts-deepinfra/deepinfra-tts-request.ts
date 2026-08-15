import type { DeepinfraTtsModel } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { isRecord, readJsonResponse } from '~/utils/rest-client'
import { prepareDeepinfraChatterboxText } from './deepinfra-text-preparation'

export const DEEPINFRA_TTS_SERIALIZER_VERSION = 'deepinfra.tts.phase-4-v2'

export const DEEPINFRA_DEFAULT_VOICE_DESCRIPTION = 'A warm, clear, expressive English narrator with natural pacing.'

export const DEEPINFRA_VOICE_DESIGN_MODELS = [
  'XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
  'Qwen/Qwen3-TTS-VoiceDesign',
] as const satisfies readonly DeepinfraTtsModel[]

export const DEEPINFRA_VOICE_CLONE_MODELS = [
  'ResembleAI/chatterbox-multilingual',
  'ResembleAI/chatterbox-turbo',
  'Qwen/Qwen3-TTS',
] as const satisfies readonly DeepinfraTtsModel[]

export const isDeepinfraVoiceDesignModel = (model: string): model is typeof DEEPINFRA_VOICE_DESIGN_MODELS[number] =>
  (DEEPINFRA_VOICE_DESIGN_MODELS as readonly string[]).includes(model)

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

export const decodeDeepinfraTtsAudio = async (res: Response): Promise<Uint8Array> => {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.startsWith('audio/') || contentType.includes('application/octet-stream')) {
    const audio = new Uint8Array(await res.arrayBuffer())
    if (audio.byteLength === 0) {
      throw ValidationError('DeepInfra TTS returned an empty audio response', { stage: 'tts:deepinfra:response' })
    }
    return audio
  }
  const json = await readJsonResponse(res, 'DeepInfra TTS response')
  const b64 = isRecord(json)
    ? (typeof json['audio'] === 'string' ? json['audio'] : json['audio_b64'])
    : undefined
  if (typeof b64 === 'string' && b64.trim().length > 0) {
    const cleanB64 = b64.includes('base64,') ? (b64.split('base64,')[1] ?? b64) : b64
    const audio = new Uint8Array(Buffer.from(cleanB64, 'base64'))
    if (audio.byteLength === 0) {
      throw ValidationError('DeepInfra TTS returned empty base64 audio', { stage: 'tts:deepinfra:response' })
    }
    return audio
  }
  throw ValidationError('DeepInfra TTS response did not contain audio', { stage: 'tts:deepinfra:response' })
}
