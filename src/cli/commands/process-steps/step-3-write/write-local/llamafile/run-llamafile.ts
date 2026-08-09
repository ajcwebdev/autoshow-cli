import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runLocalModel, type LocalModelRunnerProfile } from '../local-model-runner'
import {
  LLAMAFILE_BASE_URL,
  LLAMAFILE_PROCESS_LOCK_NAME
} from './llamafile-constants'
import { ensureLlamafileServerRunning, stopLlamafileServerForRecovery } from './llamafile-server'

export { LLAMAFILE_PROCESS_LOCK_NAME } from './llamafile-constants'
export { stopLlamafileServer } from './llamafile-server'

export const LLAMAFILE_RUNNER_PROFILE = {
  service: 'llamafile',
  baseUrl: LLAMAFILE_BASE_URL,
  stage: 'write:llamafile',
  processLockName: LLAMAFILE_PROCESS_LOCK_NAME,
  ensureServerRunning: async (model: string) =>
    (await ensureLlamafileServerRunning(model)).requestModel,
  recover: stopLlamafileServerForRecovery
} satisfies LocalModelRunnerProfile

export const runLlamafileModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await runLocalModel(LLAMAFILE_RUNNER_PROFILE, prompt, model, structuredOpts)
}
