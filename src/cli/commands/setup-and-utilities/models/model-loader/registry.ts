import { validateData } from '~/utils/validate/validation'
import { loadModelConfigJson } from './model-config-loader'
import { MODEL_CONFIG_FRAGMENT_PREFIXES, IMAGE_PATH, LLM_PATH, MUSIC_PATH, OCR_PATH, STT_PATH, TTS_PATH, VIDEO_PATH } from './paths'
import {
  ExtractRegistrySchema,
  ImageRegistrySchema,
  LlmRegistrySchema,
  MusicRegistrySchema,
  SttRegistrySchema,
  TtsRegistrySchema,
  VideoRegistrySchema
} from './model-loader-schemas'
import type { ModelRegistry } from '~/types'

let cached: ModelRegistry | undefined

export const getModelRegistry = (): ModelRegistry => {
  if (cached) return cached

  const stt = validateData(SttRegistrySchema, loadModelConfigJson(STT_PATH, { fragmentFilenamePrefix: MODEL_CONFIG_FRAGMENT_PREFIXES.stt }), `STT models at ${STT_PATH}`)
  const extract = validateData(ExtractRegistrySchema, loadModelConfigJson(OCR_PATH, { fragmentFilenamePrefix: MODEL_CONFIG_FRAGMENT_PREFIXES.extract }), `extract models at ${OCR_PATH}`)
  const llm = validateData(LlmRegistrySchema, loadModelConfigJson(LLM_PATH), `LLM models at ${LLM_PATH}`)
  const tts = validateData(TtsRegistrySchema, loadModelConfigJson(TTS_PATH, { fragmentFilenamePrefix: MODEL_CONFIG_FRAGMENT_PREFIXES.tts }), `TTS models at ${TTS_PATH}`)
  const image = validateData(ImageRegistrySchema, loadModelConfigJson(IMAGE_PATH), `image models at ${IMAGE_PATH}`)
  const music = validateData(MusicRegistrySchema, loadModelConfigJson(MUSIC_PATH), `music models at ${MUSIC_PATH}`)
  const video = validateData(VideoRegistrySchema, loadModelConfigJson(VIDEO_PATH), `video models at ${VIDEO_PATH}`)

  cached = { stt, extract, llm, tts, image, music, video }
  return cached
}

export const getRegistryServiceType = (
  step: keyof ModelRegistry,
  service: string
): 'local' | 'api' | undefined => {
  return getModelRegistry()[step][service]?.type
}

export const findRegistryServiceForModel = (
  step: keyof ModelRegistry,
  modelId: string
): string | undefined => {
  const services = getModelRegistry()[step]
  for (const [service, config] of Object.entries(services)) {
    if (config.models[modelId]) {
      return service
    }
  }
  return undefined
}
