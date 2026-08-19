export type RunnerArgs = {
  priceMode: boolean
  budgetHundredthCents: number | undefined
  preserveTestOutput: boolean
  adaptiveConcurrency: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}

export type RunnerParseState = {
  priceMode: boolean
  budgetHundredthCents: number | undefined
  preserveTestOutput: boolean
  adaptiveConcurrency: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}

export type RunnerControlResult =
  | { kind: 'consumed'; nextIndex: number }
  | { kind: 'unhandled' }

export type RunnerArgDestination = 'pathFilters' | 'passthroughArgs'
