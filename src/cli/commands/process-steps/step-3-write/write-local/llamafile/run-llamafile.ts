import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runLocalModelWithRetry } from '~/utils/retries'
import { withProcessLock } from '~/utils/process-lock'
import { requestLlamafileCompletion } from './llamafile-client'
import { LLAMAFILE_PROCESS_LOCK_NAME } from './llamafile-constants'
import { ensureLlamafileServerRunning, stopLlamafileServerForRecovery } from './llamafile-server'

const LLAMAFILE_REQUEST_TIMEOUT_MS = 1_800_000

export { LLAMAFILE_PROCESS_LOCK_NAME } from './llamafile-constants'
export { ensureLlamafileBundleDownloaded } from './llamafile-download'
export { stopLlamafileServer } from './llamafile-server'

const withLlamafileServerLock = async <T,>(fn: () => Promise<T>): Promise<T> =>
  await withProcessLock(LLAMAFILE_PROCESS_LOCK_NAME, fn)

export const runLlamafileModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const inputTokenCount = countTokens(prompt)

  try {
    return await withLlamafileServerLock(async () =>
      // Retry on any failure: crashed server, dropped connection, empty
      // completion, etc. `recover` stops the server after a failed attempt so
      // the next attempt restarts it cleanly.
      await runLocalModelWithRetry({
        operationName: 'llamafile completion',
        timeoutMs: LLAMAFILE_REQUEST_TIMEOUT_MS,
        recover: () => stopLlamafileServerForRecovery(),
        attempt: async (signal) => {
          const { requestModel } = await ensureLlamafileServerRunning(model)

          const startTime = Date.now()
          const completion = await requestLlamafileCompletion(prompt, requestModel, signal)
          const processingTime = Date.now() - startTime

          const metadata: Step3Metadata = {
            llmService: 'llamafile',
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
    l.error(`Failed to run llamafile model`, error)
    throw error
  }
}
