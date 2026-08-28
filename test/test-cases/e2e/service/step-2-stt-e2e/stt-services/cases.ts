export const assemblyaiTranscription = {
  provider: 'assemblyai',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
} as const

export const deepgramNova3 = {
  provider: 'deepgram',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
} as const

export const deepinfraWhisper = {
  provider: 'deepinfra',
  sttService: 'deepinfra',
  envVarKey: 'DEEPINFRA_API_KEY',
  envVarDescription: 'DeepInfra transcription',
} as const

export const togetherTranscription = {
  provider: 'together',
  sttService: 'together',
  envVarKey: 'TOGETHER_API_KEY',
  envVarDescription: 'Together transcription',
} as const

export const gladiaTranscription = {
  provider: 'gladia',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
} as const

export const groqWhisper = {
  provider: 'groq',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
} as const

export const grokSpeechToText = {
  provider: 'grok',
  sttService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok transcription',
} as const

export const mistralVoxtralMini = {
  provider: 'mistral',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
} as const

export const sonioxTranscription = {
  provider: 'soniox',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
} as const

export const speechmaticsTranscription = {
  provider: 'speechmatics',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
} as const

export const geminiTranscription = {
  provider: 'gemini',
  sttService: 'gemini-stt',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini transcription',
  inputPath: 'input/examples/audio/0-audio-short.mp3',
  inputTitle: '0-audio-short',
} as const

export const supadataUrlTranscript = {
  service: 'supadata',
  model: 'auto',
  provider: 'supadata',
  envVarKey: 'SUPADATA_API_KEY',
  envVarDescription: 'Supadata YouTube transcript retrieval',
} as const

export const scrapecreatorsUrlTranscript = {
  service: 'scrapecreators',
  model: 'youtube-transcript',
  provider: 'scrapecreators',
  envVarKey: 'SCRAPECREATORS_API_KEY',
  envVarDescription: 'ScrapeCreators YouTube transcript retrieval',
} as const
