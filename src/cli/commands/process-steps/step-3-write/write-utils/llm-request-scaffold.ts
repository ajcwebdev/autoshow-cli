import { buildStep3Metadata, runWithLLMInstrumentation } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import type { ExecuteLlmRequestSpec, LlmApiCallResult, Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { ValidationError } from '~/utils/error-handler'
import { withRetry } from '~/utils/retries'
import { LLM_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'

const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

export const executeLlmRequest = async <TPrepared = undefined>(
  prompt: string,
  model: string,
  structuredOpts: StructuredRequestOptions | undefined,
  spec: ExecuteLlmRequestSpec<TPrepared>
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    // Resolve credentials/configuration inside the logged boundary but before the retry loop. Missing
    // configuration is deterministic and must not be mistaken for a retryable request failure.
    const prepared = spec.prepare?.() as TPrepared
    const apiCall = (): Promise<LlmApiCallResult> => withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: spec.operationName,
        ...(spec.policy ? { policy: spec.policy } : {})
      },
      async (signal) => {
        const result = await spec.execute(
          () => createCombinedSignal(signal),
          prepared
        )
        const text = typeof result === 'string' ? result : result.text
        if (!text) {
          throw ValidationError('No response text from model', { stage: spec.emptyResponseStage })
        }
        return result
      },
      spec.classifier
    )

    const instrumentation = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata(spec.service, model, instrumentation, structuredOpts)

    return { result: instrumentation.responseText, metadata }
  } catch (error) {
    l.error(`Failed to run ${spec.providerLabel} model`, error)
    throw error
  }
}
