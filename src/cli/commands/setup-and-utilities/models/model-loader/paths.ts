import { resolve } from 'node:path'
import { IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'

const MODELS_DIR = resolve(IMMUTABLE_ASSET_ROOT, Bun.isStandaloneExecutable ? 'models' : 'src/cli/commands/setup-and-utilities/models')
const segmentedConfigPath = (name: string): string => resolve(
  Bun.isStandaloneExecutable ? IMMUTABLE_ASSET_ROOT : MODELS_DIR,
  name
)

export const STT_PATH = segmentedConfigPath('stt-config')
export const OCR_PATH = segmentedConfigPath('ocr-config')
export const LLM_PATH = resolve(MODELS_DIR, 'llm-config.json')
export const TTS_PATH = segmentedConfigPath('tts-config')
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
