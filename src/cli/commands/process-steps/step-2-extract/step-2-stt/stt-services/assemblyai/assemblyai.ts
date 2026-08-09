import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureAssemblyAiSttSetup = ensureApiKeySetup('ASSEMBLYAI_API_KEY', 'stt:assemblyai', 'AssemblyAI transcription')
