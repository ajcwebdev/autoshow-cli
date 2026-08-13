import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { withProcessLock } from '~/utils/process-lock'
import { runLocalModelWithRetry } from '~/utils/retries'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import {
  requestLocalCompletion,
  type LocalCompletionProfile
} from './local-completion-client'

export type LocalModelRunnerProfile = {
  service: Extract<Step3Metadata['llmService'], 'llama.cpp' | 'llamafile'>
  baseUrl: string
  stage: string
  processLockName: string
  ensureServerRunning: (model: string) => Promise<string>
  recover: () => Promise<void>
} & LocalCompletionProfile

const LOCAL_MODEL_REQUEST_TIMEOUT_MS = 1_800_000

export const runLocalModel = async (
  profile: LocalModelRunnerProfile,
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: profile.service,
    model,
    requestedReasoningEffort: structuredOpts?.requestedReasoningEffort
  })
  const inputTokenCount = countTokens(prompt)
  const updatedOpts: StructuredRequestOptions | undefined = structuredOpts
    ? { ...structuredOpts, requestedReasoningEffort: policy.requested, effectiveReasoningEffort: policy.effective }
    : {
        schemaName: '',
        schema: {},
        strict: false,
        strategy: 'native',
        requestedReasoningEffort: policy.requested,
        effectiveReasoningEffort: policy.effective
      }

  try {
    return await withProcessLock(profile.processLockName, async () =>
      await runLocalModelWithRetry({
        operationName: `${profile.service} completion`,
        timeoutMs: LOCAL_MODEL_REQUEST_TIMEOUT_MS,
        recover: profile.recover,
        attempt: async (signal) => {
          const requestModel = await profile.ensureServerRunning(model)
          const startTime = Date.now()
          const completion = await requestLocalCompletion(profile, prompt, requestModel, updatedOpts, signal)
          const processingTime = Date.now() - startTime

          const metadata: Step3Metadata = {
            llmService: profile.service,
            llmModel: model,
            processingTime,
            inputTokenCount,
            outputTokenCount: completion.outputTokenCount,
            tokenCountSource: 'local_count',
            outputFileName: '',
            outputFormat: 'json',
            structuredMode: structuredOpts?.strategy ?? 'schema-guided',
            structuredPresetNames: [],
            ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
            effectiveReasoningEffort: policy.effective
          }

          return { result: completion.responseText, metadata }
        }
      })
    )
  } catch (error) {
    l.error(`Failed to run ${profile.service} model`, error)
    throw error
  }
}
