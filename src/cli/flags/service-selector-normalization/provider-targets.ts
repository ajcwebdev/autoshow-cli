export const STANDALONE_TTS_PROVIDER_TARGETS = {
  kitten: 'kitten-tts',
  elevenlabs: 'elevenlabs-tts',
  minimax: 'minimax-tts',
  groq: 'groq-tts',
  grok: 'grok-tts',
  mistral: 'mistral-tts',
  openai: 'openai-tts',
  gemini: 'gemini-tts',
  deepgram: 'deepgram-tts',
  speechify: 'speechify-tts',
  hume: 'hume-tts',
  cartesia: 'cartesia-tts'
} as const satisfies Record<string, string>

export const STANDALONE_IMAGE_PROVIDER_TARGETS = {
  gemini: 'gemini-image',
  openai: 'openai-image',
  grok: 'grok-image',
  bfl: 'bfl-image',
  recraft: 'recraft-image',
  replicate: 'replicate-image',
  lumalabs: 'lumalabs-image',
  fal: 'fal-image'
} as const satisfies Record<string, string>

export const STANDALONE_VIDEO_PROVIDER_TARGETS = {
  gemini: 'gemini-video',
  minimax: 'minimax-video',
  glm: 'glm-video',
  grok: 'grok-video',
  runway: 'runway-video',
  ltx: 'ltx-video',
  replicate: 'replicate-video',
  lumalabs: 'lumalabs-video',
  fal: 'fal-video'
} as const satisfies Record<string, string>

export const STANDALONE_MUSIC_PROVIDER_TARGETS = {
  elevenlabs: 'elevenlabs-music',
  minimax: 'minimax-music',
  gemini: 'gemini-music'
} as const satisfies Record<string, string>

export const WRITE_STT_PROVIDER_TARGETS = {
  reverb: 'reverb-stt',
  deepinfra: 'deepinfra-stt',
  deepgram: 'deepgram-stt',
  soniox: 'soniox-stt',
  speechmatics: 'speechmatics-stt',
  rev: 'rev-stt',
  groq: 'groq-stt',
  grok: 'grok-stt',
  mistral: 'mistral-stt',
  assemblyai: 'assemblyai-stt',
  gladia: 'gladia-stt',
  happyscribe: 'happyscribe-stt',
  supadata: 'supadata-stt',
  scrapecreators: 'scrapecreators-stt',
  gemini: 'gemini-stt',
  together: 'together-stt',
  whisper: 'whisper-stt',
  whisperfile: 'whisperfile-stt'
} as const satisfies Record<string, string>

export const WRITE_OCR_PROVIDER_TARGETS = {
  tesseract: 'tesseract-ocr',
  mistral: 'mistral-ocr',
  glm: 'glm-ocr',
  kimi: 'kimi-ocr',
  openai: 'openai-ocr',
  grok: 'grok-ocr',
  anthropic: 'anthropic-ocr',
  gemini: 'gemini-ocr',
  deepinfra: 'deepinfra-ocr'
} as const satisfies Record<string, string>

export const WRITE_LLM_PROVIDER_TARGETS = {
  llama: 'llama',
  llamafile: 'llamafile',
  openai: 'openai',
  groq: 'groq',
  gemini: 'gemini',
  anthropic: 'anthropic',
  minimax: 'minimax',
  grok: 'grok',
  glm: 'glm',
  kimi: 'kimi',
  together: 'together',
  cerebras: 'cerebras'
} as const satisfies Record<string, string>

export const BOOLEAN_PROVIDER_TARGETS = new Set<string>([
  'reverb-stt',
  'tesseract-ocr'
])
