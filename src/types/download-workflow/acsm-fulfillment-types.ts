export type ResolveAcsmFulfillCommandOptions = {
  overrideBinDir?: string | undefined
  exists?: (path: string) => boolean
  which?: (command: string) => string | null
}

export type FulfillAcsmOptions = ResolveAcsmFulfillCommandOptions & {
  now?: () => Date
}

export type FulfilledAcsmDocument = {
  filePath: string
  format: 'epub' | 'pdf'
  tempCleanup: () => Promise<void>
}
