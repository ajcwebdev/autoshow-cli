import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import type { IndexedLlmTarget, LLMTarget, TargetSchedulerConcurrency } from '~/types'
import { InfraError } from '~/utils/error-handler'

export const isLocalLlmTarget = (
  target: Pick<LLMTarget, 'service'>
): boolean => target.service === 'llama.cpp' || target.service === 'llamafile'

const isHostedLlmTarget = (
  target: Pick<LLMTarget, 'service'>
): boolean =>
  target.service === 'openai'
  || target.service === 'groq'
  || target.service === 'gemini'
  || target.service === 'anthropic'
  || target.service === 'minimax'
  || target.service === 'grok'
  || target.service === 'glm'
  || target.service === 'kimi'
  || target.service === 'together'
  || target.service === 'cerebras'

export const runLlmProviderTargetPools = async (
  targets: LLMTarget[],
  concurrency: TargetSchedulerConcurrency,
  worker: (index: number, target: LLMTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets: IndexedLlmTarget[] = targets.map((target, index) => ({ index, target }))
  const scheduled = await runProviderTargetScheduler<IndexedLlmTarget, void>({
    entries: indexedTargets.map((entry) => ({
      index: entry.index,
      target: entry
    })),
    concurrency,
    getPool: (entry) => isLocalLlmTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => {
      if (!isLocalLlmTarget(entry.target) && !isHostedLlmTarget(entry.target)) {
        return
      }
      await worker(entry.index, entry.target)
    }
  })
  if (scheduled.failures.length > 0) {
    throw InfraError(scheduled.failures.map(({ target, message }) =>
      `${target.target.service}/${target.target.model}: ${message}`
    ).join('; '), { stage: 'write:provider-pool' })
  }
}
