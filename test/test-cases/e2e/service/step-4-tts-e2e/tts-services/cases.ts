import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  OPENAI_DEFAULT_TTS_VOICE,
  GROK_DEFAULT_TTS_VOICE,
  SPEECHIFY_DEFAULT_TTS_VOICE,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

export const mistralTtsModels = 'voxtral-mini-tts-2603'
export const mistralRefAudioPath = 'input/examples/audio/anthony-voice.mp3'
const naturalShortTtsInputPath = 'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/fixtures/natural-short.txt'
const naturalShortTtsInputTitle = 'natural-short'
const humeTtsInputPath = 'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/fixtures/hume-octave-2-short.txt'
const humeTtsInputTitle = 'hume-octave-2-short'

export const openaiTts = {
  provider: 'openai',
  ttsService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI TTS',
  extraArgs: ['--tts-voice', OPENAI_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => OPENAI_DEFAULT_TTS_VOICE,
} as const

export const minimaxTts = {
  provider: 'minimax',
  ttsService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax TTS',
  inputPath: naturalShortTtsInputPath,
  inputTitle: naturalShortTtsInputTitle,
  extraArgs: ['--tts-voice', 'English_expressive_narrator'],
  resolveExpectedSpeaker: async () => 'English_expressive_narrator',
} as const

export const elevenlabsTts = {
  provider: 'elevenlabs',
  ttsService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs TTS',
  inputPath: naturalShortTtsInputPath,
  inputTitle: naturalShortTtsInputTitle,
  extraArgs: ['--tts-voice', ELEVENLABS_DEFAULT_VOICE_ID],
  resolveExpectedSpeaker: async () => ELEVENLABS_DEFAULT_VOICE_ID,
} as const

export const grokTts = {
  provider: 'grok',
  ttsService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok TTS',
  extraArgs: ['--tts-voice', GROK_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => GROK_DEFAULT_TTS_VOICE,
} as const

export const speechifyTts = {
  provider: 'speechify',
  ttsService: 'speechify',
  envVarKey: 'SPEECHIFY_API_KEY',
  envVarDescription: 'Speechify TTS',
  extraArgs: ['--tts-voice', SPEECHIFY_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => SPEECHIFY_DEFAULT_TTS_VOICE,
} as const

export const humeTts = {
  provider: 'hume',
  ttsService: 'hume',
  envVarKey: 'HUME_API_KEY',
  envVarDescription: 'Hume TTS',
  inputPath: humeTtsInputPath,
  inputTitle: humeTtsInputTitle,
} as const

export const cartesiaTts = {
  provider: 'cartesia',
  ttsService: 'cartesia',
  envVarKey: 'CARTESIA_API_KEY',
  envVarDescription: 'Cartesia TTS',
} as const
