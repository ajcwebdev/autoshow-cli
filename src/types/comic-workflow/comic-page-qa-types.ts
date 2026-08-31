import type { PanelBundleData } from '~/types'

export type PageQaResult = {
  panelStructure: { pass: boolean; observedPanelCount: number; observedPanelOrder: number[]; issues: string[] }
  panels: Array<{
    panelNumber: number
    requiredCastPresent: boolean
    unexpectedCastAbsent: boolean
    identityMatch: boolean
    identityIssueKind: 'none' | 'minor-variance' | 'unmistakable-mismatch'
    locationMatch: boolean
    setContinuityMatch: boolean
    setContinuityAudit: Array<{
      anchor: string
      status: 'present-correctly' | 'outside-crop' | 'missing' | 'relocated' | 'duplicated' | 'mirrored' | 'redesigned'
      evidence: string
    }>
    sourcePrecedence: boolean
    shotPlanMatch: boolean
    dialogueAccuracy: boolean
    dialogueIssueKind: 'none' | 'typography-only' | 'content'
    speakerAttribution: boolean
    artifacts: string[]
    visualQualityScore: number
    compositionScore: number
    issues: string[]
    editInstructions: string
    repairAssessment?: {
      issueVisibility: 'directly-visible' | 'ambiguous' | 'not-visible' | 'not-assessable'
      expectedBenefit: 'meaningful' | 'marginal' | 'none'
      editScope: 'bounded' | 'diffuse'
      editIsolation: 'isolated-single-region' | 'shared-attribute' | 'multi-region' | 'generative-redraw'
      collateralRisk: 'low' | 'medium' | 'high'
      confidence: 'low' | 'medium' | 'high'
      recommendation: 'targeted-edit' | 'retain-current'
      preservationRequirements: string[]
      rationale: string
    }
  }>
  summary: string
}

export type RepairCandidateComparisonRequest = {
  pass: 1 | 2
  prompt: string
  imagePaths: string[]
  model: string
}

export type RepairCandidateComparisonResponse = {
  text: string
  inputTokens: number
  outputTokens: number
}

export type RepairCandidateComparisonJudgment = {
  comparisonContractVersion?: 3 | 4
  pass: 1 | 2
  order: { imageA: 'original' | 'candidate'; imageB: 'original' | 'candidate' }
  originalIssueVisible: boolean
  candidateIssueFixed: boolean
  targetedIssueMateriallyImproved: boolean
  differenceMeaningful: boolean
  candidateHasMajorRegression: boolean
  nonTargetDifferenceLevel?: 'none' | 'minor' | 'major'
  originalPreservationRequirementsSatisfied?: boolean
  candidatePreservationRequirementsSatisfied?: boolean
  candidateIntroducesPreservationRegression?: boolean
  nonTargetDifferences?: string[]
  preference: 'original' | 'candidate' | 'tie'
  confidence: 'low' | 'medium' | 'high'
  candidateRegressions: string[]
  originalRegressions?: string[]
  rationale: string
}

export type PageQaEntry = {
  pageNumber: number
  panelNumbers: number[]
  outputFile: string
  judgeModel: string
  hardFailure: boolean
  waivedChecks?: Array<{ panelNumber: number; check: 'shotPlanMatch'; reason: string }>
  repairPolicy?: {
    action: 'restart' | 'stop' | 'skip' | 'retain-original'
    repeatedHardFailures: string[]
    reason?: string
  }
  repairComparison?: {
    decision: 'clear-winner' | 'retain-original' | 'incomplete'
    reason: string
    judgments: RepairCandidateComparisonJudgment[]
    invalidPasses: Array<{ pass: 1 | 2; error: string }>
  }
  result: PageQaResult
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number }
}

export type PageQaRepairStagnationState = {
  consecutiveFailures: Record<string, number>
  restartedFromCanonicalReferences: boolean
}

export type PageQaRepairDecision = {
  action: 'accept' | 'edit' | 'restart' | 'stop'
  repeatedHardFailures: string[]
  state: PageQaRepairStagnationState
}

export type PageQaRequest = {
  pageNumber: number
  pagePath: string
  panelData: PanelBundleData
  identityCards: string[]
  locationSheets: string[]
  designSheets?: string[] | undefined
  characterReferences?: Array<{ key: string; description: string }> | undefined
  locationReferences?: Array<{ key: string; specification: string }> | undefined
  designReferences?: Array<{ key: string; usage: string }> | undefined
  model: string
}
