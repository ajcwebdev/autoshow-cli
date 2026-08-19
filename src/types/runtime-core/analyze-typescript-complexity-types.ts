export type AnalysisScope = 'src' | 'test'

export type FileMetric = {
  path: string
  loc: number
}

export type CallableMetric = {
  path: string
  line: number
  endLine: number
  loc: number
  name: string
  cyclomatic: number
  cognitive: number
  cognitiveSeverity: number
  halsteadVolume: number
  maintainabilityIndex: number
}

export type ScopeAnalysis = {
  scope: AnalysisScope
  trackedFiles: number
  textFiles: number
  physicalLines: number
  executableFiles: number
  callables: number
  parseDiagnostics: number
  files: FileMetric[]
  callableMetrics: CallableMetric[]
  rankings: {
    largestFiles: FileMetric[]
    longestCallables: CallableMetric[]
    worstCyclomatic: CallableMetric[]
    worstCognitive: CallableMetric[]
    worstMaintainability: CallableMetric[]
  }
}
