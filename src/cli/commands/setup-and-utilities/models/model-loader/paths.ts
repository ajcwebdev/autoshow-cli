import { resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

const MODELS_DIR = resolve(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/models')

export const STT_PATH = resolve(MODELS_DIR, 'stt-config')
export const OCR_PATH = resolve(MODELS_DIR, 'ocr-config')
export const LLM_PATH = resolve(MODELS_DIR, 'llm-config.json')
export const TTS_PATH = resolve(MODELS_DIR, 'tts-config')
export const IMAGE_PATH = resolve(MODELS_DIR, 'image-config.json')
export const MUSIC_PATH = resolve(MODELS_DIR, 'music-config.json')
export const VIDEO_PATH = resolve(MODELS_DIR, 'video-config.json')

export const MODEL_CONFIG_FRAGMENT_PREFIXES = {
  stt: 'stt',
  extract: 'ocr',
  tts: 'tts',
} as const

export const MODEL_CONFIG_PATHS = {
  stt: STT_PATH,
  extract: OCR_PATH,
  llm: LLM_PATH,
  tts: TTS_PATH,
  image: IMAGE_PATH,
  music: MUSIC_PATH,
  video: VIDEO_PATH,
} as const
