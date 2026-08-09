import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runLocalModel, type LocalModelRunnerProfile } from '../local-model-runner'
import {
  LLAMA_BASE_URL,
  LLAMA_PROCESS_LOCK_NAME
} from './llama-constants'
import { resolveLlamaRequestModel } from './llama-server-identity'
import { stopDefaultLlamaServer as stopLlamaServerForRecovery } from './llama-server-process'
import { ensureLlamaServerRunning } from './llama-server-runtime'

export { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
export { ensureLlamaModelDownloaded } from './llama-model-download'
export {
  evaluateLlamaServerIdentityMatch,
  parseLlamaServerIdentityFromModels,
  parseLlamaServerIdentityFromProps
} from './llama-server-identity'
export {
  stopDefaultLlamaServer
} from './llama-server-process'

export const LLAMA_RUNNER_PROFILE = {
  service: 'llama.cpp',
  baseUrl: LLAMA_BASE_URL,
  stage: 'write:llama',
  processLockName: LLAMA_PROCESS_LOCK_NAME,
  ensureServerRunning: async (model: string) =>
    resolveLlamaRequestModel(await ensureLlamaServerRunning(model)),
  recover: stopLlamaServerForRecovery
} satisfies LocalModelRunnerProfile

export const runLlamaModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await runLocalModel(LLAMA_RUNNER_PROFILE, prompt, model, structuredOpts)
}
