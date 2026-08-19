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
  }>
  summary: string
}

export type PageQaEntry = {
  pageNumber: number
  panelNumbers: number[]
  outputFile: string
  judgeModel: string
  hardFailure: boolean
  waivedChecks?: Array<{ panelNumber: number; check: 'shotPlanMatch'; reason: string }>
  repairPolicy?: {
    action: 'restart' | 'stop'
    repeatedHardFailures: string[]
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
