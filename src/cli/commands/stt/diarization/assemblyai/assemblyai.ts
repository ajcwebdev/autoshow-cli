import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureAssemblyAiSttSetup = async (): Promise<void> => { resolveCredential('assemblyai', 'require', { stage: 'stt:assemblyai', description: 'AssemblyAI transcription' }) }
