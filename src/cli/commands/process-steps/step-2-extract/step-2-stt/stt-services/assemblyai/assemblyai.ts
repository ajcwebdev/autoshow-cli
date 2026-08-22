import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureAssemblyAiSttSetup = async (): Promise<void> => { requireProviderKey('assemblyai', 'stt:assemblyai', 'AssemblyAI transcription') }
