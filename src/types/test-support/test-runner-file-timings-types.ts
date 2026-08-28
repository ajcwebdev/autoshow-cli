export type FileTimingsCacheFile = {
  version: number
  files: Record<string, number[]>
  tests: Record<string, number>
}

export type FileTimingsLookup = {
  fileP50: Map<string, number>
  testDurations: Map<string, number>
}
