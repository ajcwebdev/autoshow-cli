import type { FalTtsModel } from '~/types'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'

export const FAL_TTS_SERIALIZER_VERSION = 'fal.tts.v1'

export const FAL_SEED_SPEECH_MODEL = 'fal-ai/bytedance/seed-speech/tts/v2' as const
export const FAL_MAYA_MODEL = 'fal-ai/maya' as const
export const FAL_ASYNC_TTS_PRO_MODEL = 'async/tts-pro/v1.0' as const

export const FAL_SEED_SPEECH_VOICES = [
  'vivi_mixed_en_zh_ja_es_id',
  'mindy_en_es_id_pt_zh',
  'stokie_en',
  'dacey_en',
  'tim_en',
  'kian_en_zh',
  'cedric_en_zh',
  'sophie_en_zh',
  'jean_en_zh',
  'magnus_en_zh',
  'mabel_en_zh',
  'nadia_en_zh',
  'opal_en_zh',
  'pearl_en_zh',
  'quentin_en_zh',
  'vienna_mixed_en_zh',
  'alina_mixed_en_zh',
  'corinne_mixed_en_zh',
  'esther_mixed_en_zh',
  'freya_mixed_en_zh',
  'gigi_mixed_en_zh',
  'holly_mixed_en_zh',
  'lyla_mixed_en_zh',
  'daisy_mixed_en_zh',
  'tracy_es_zh',
  'jess_ja_es_id_pt_en_zh',
  'pinky_es_ko_mixed_en_zh',
  'sweety_ja_es',
  'sandy_es_mixed_en_zh',
  'sven_de',
  'minimi_ja',
  'usseau_fr',
  'felipe_es',
  'han_id',
  'martins_pt',
  'enzo_it',
  'shane_ko',
  'bonnie_zh',
  'felix_zh',
  'celeste_zh',
  'monkey_king_zh',
] as const

export const FAL_SEED_DEFAULT_VOICE = 'stokie_en'
export const FAL_ASYNC_DEFAULT_VOICE = 'Jennie'
export const FAL_MAYA_DEFAULT_VOICE_PROMPT = 'Realistic narrator voice in the 30s with american accent. Normal pitch, warm timbre, conversational pacing, neutral tone delivery at med intensity.'

export const resolveFalTtsDefaultVoice = (model: FalTtsModel): string => {
  switch (model) {
    case FAL_SEED_SPEECH_MODEL:
      return FAL_SEED_DEFAULT_VOICE
    case FAL_MAYA_MODEL:
      return FAL_MAYA_DEFAULT_VOICE_PROMPT
    case FAL_ASYNC_TTS_PRO_MODEL:
      return FAL_ASYNC_DEFAULT_VOICE
  }
}

export const resolveFalTtsVoiceField = (model: FalTtsModel): string =>
  model === FAL_MAYA_MODEL ? 'prompt' : model === FAL_ASYNC_TTS_PRO_MODEL ? 'voice.name' : 'voice'

export const buildFalTtsRequestBody = (input: Readonly<{
  model: FalTtsModel
  text: string
  voice: string
  voiceInstruction?: string | undefined
}>): Readonly<Record<string, unknown>> => {
  switch (input.model) {
    case FAL_SEED_SPEECH_MODEL: {
      if (!(FAL_SEED_SPEECH_VOICES as readonly string[]).includes(input.voice)) {
        throw CLIUsageError(`Invalid fal.ai Seed Speech voice "${input.voice}". Expected one of: ${FAL_SEED_SPEECH_VOICES.join(', ')}.`)
      }
      return {
        text: input.text,
        voice: input.voice,
        output_format: 'mp3',
        sample_rate: 24000,
        ...(input.voiceInstruction?.trim() ? { voice_instruction: input.voiceInstruction.trim() } : {}),
      }
    }
    case FAL_MAYA_MODEL:
      return {
        text: input.text,
        prompt: input.voiceInstruction?.trim() || input.voice,
        output_format: 'wav',
        sample_rate: '48 kHz',
      }
    case FAL_ASYNC_TTS_PRO_MODEL:
      return {
        transcript: input.text,
        voice: { name: input.voice },
      }
  }
}

export const extractFalTtsAudioUrl = (output: unknown): string => {
  if (!output || typeof output !== 'object') throw ValidationError('fal.ai TTS returned an invalid response.', { stage: 'tts:fal', retryable: false })
  const record = output as Record<string, unknown>
  const audio = record['audio']
  if (typeof audio === 'string' && audio.trim()) return audio
  if (audio && typeof audio === 'object') {
    const url = (audio as Record<string, unknown>)['url']
    if (typeof url === 'string' && url.trim()) return url
  }
  throw ValidationError('fal.ai TTS response did not contain an audio URL.', { stage: 'tts:fal', retryable: false })
}
