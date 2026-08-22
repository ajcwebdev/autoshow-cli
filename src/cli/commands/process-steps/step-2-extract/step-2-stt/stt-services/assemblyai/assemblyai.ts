import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureAssemblyAiSttSetup = ensureProvider('assemblyai', 'stt:assemblyai', 'AssemblyAI transcription')
