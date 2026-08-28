import type { BatchRuntimeOptions, HostedConcurrencyRuntimeOptions, SingleTargetCommandOptions } from '~/types'

export type BatchCommandOptions = SingleTargetCommandOptions & Pick<BatchRuntimeOptions, 'batchConcurrency'> & HostedConcurrencyRuntimeOptions
