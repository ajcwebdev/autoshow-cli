import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runLocalModelWithRetry } from '~/utils/retries'
import { withProcessLock } from '~/utils/process-lock'
import { requestLlamaCompletion } from './llama-client'
import { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
import { resolveLlamaRequestModel } from './llama-server-identity'
import { stopDefaultLlamaServer as stopLlamaServerForRecovery } from './llama-server-process'
import { ensureLlamaServerRunning } from './llama-server-runtime'

const LLAMA_REQUEST_TIMEOUT_MS = 1_800_000

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

const withLlamaServerLock = async <T,>(fn: () => Promise<T>): Promise<T> =>
  await withProcessLock(LLAMA_PROCESS_LOCK_NAME, fn)

export const runLlamaModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const inputTokenCount = countTokens(prompt)

  try {
    return await withLlamaServerLock(async () =>
      // Retry on the simple fact that a failure happened: a crashed server, a
      // dropped connection, an empty completion, or anything else. `recover`
      // stops the server after a failed attempt so the next attempt's
      // ensureLlamaServerRunning() restarts it cleanly.
      await runLocalModelWithRetry({
        operationName: 'llama.cpp completion',
        timeoutMs: LLAMA_REQUEST_TIMEOUT_MS,
        recover: () => stopLlamaServerForRecovery(),
        attempt: async (signal) => {
          const identity = await ensureLlamaServerRunning(model)
          const requestModel = resolveLlamaRequestModel(identity)

          const startTime = Date.now()
          const completion = await requestLlamaCompletion(prompt, requestModel, signal)
          const processingTime = Date.now() - startTime

          const metadata: Step3Metadata = {
            llmService: 'llama.cpp',
            llmModel: model,
            processingTime,
            inputTokenCount,
            outputTokenCount: completion.outputTokenCount,
            tokenCountSource: 'local_count',
            outputFileName: '',
            outputFormat: 'json',
            structuredMode: structuredOpts?.strategy ?? 'schema-guided',
            structuredPresetNames: []
          }

          return { result: completion.responseText, metadata }
        }
      })
    )
  } catch (error) {
    l.error(`Failed to run llama.cpp model`, error)
    throw error
  }
}
