export type RunnerArgs = {
  priceMode: boolean
  budgetHundredthCents: number | undefined
  preserveTestOutput: boolean
  adaptiveConcurrency: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}
