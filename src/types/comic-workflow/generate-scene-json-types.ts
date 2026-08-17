import type { HostedConcurrencyRuntimeOptions, LlmModel } from '~/types'

export type GenerateSceneJsonOptions = HostedConcurrencyRuntimeOptions & {
  model: LlmModel
  concurrency?: number | undefined
}
