import type * as v from 'valibot'
import type { PageQaEntry, PanelBundleData, ResolvedReferenceImages } from '~/types'

export type ContinuityHardKey = 'side-flip' | 'seat-swap' | 'furniture-spin' | 'intruder' | 'vanishing-crowd' | 'wardrobe-swap'

export type ContinuityBlooperCategory = ContinuityHardKey | 'none'

export type ContinuityAxisStatus = 'consistent' | 'crossed' | 'not-assessable'

export type ContinuityCastStatus = 'present' | 'intruding' | 'vanished' | 'not-assessable'

export type ContinuityFurnitureStatus = 'same' | 'rotated' | 'mirrored' | 'redesigned' | 'not-assessable'

export type ContinuityRepairRoute = 'none' | 'edit' | 'restart' | 'redraft'

export type ContinuityJudgeResult = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/continuity-qa').ContinuityJudgeResultSchema>

export type ContinuityJudgeResultExpectation = {
  panelNumber: number
  anchorPanel: number
  predecessorPanel: number | null
}

export type ContinuityJudgeImageRole = 'candidate' | 'anchor' | 'predecessor' | 'cast-card' | 'absent-card'

export type ContinuityJudgeImagePlan = {
  role: ContinuityJudgeImageRole
  label: string
  characterKey: string | null
  sourcePath: string
  detail: 'low' | 'high'
}

export type ContinuityJudgeImage = ContinuityJudgeImagePlan & {
  mimeType: string
  base64: string
  width: number
  height: number
  downscaled: boolean
}

export type ContinuityJudgeImageSummary = Omit<ContinuityJudgeImage, 'base64'>

export type ContinuityJudgeCard = {
  key: string
  path: string
}

export type ContinuityJudgeRequest = {
  sceneSlug: string
  panelNumber: number
  panelPath: string
  anchorPanel: number
  anchorPath: string
  predecessorPanel: number | null
  predecessorPath: string | null
  trustedAnchorPanel: number | null
  panelData: PanelBundleData
  roster: string[]
  absentKeys: string[]
  castCards: ContinuityJudgeCard[]
  absentCards: ContinuityJudgeCard[]
  characterReferences: Array<{ key: string; description: string }>
  locationReferences: Array<{ key: string; specification: string }>
  model: string
}

export type ContinuityJudgeUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

export type ContinuityJudgeEntry = {
  schemaVersion: 1
  panelNumber: number
  outputFile: string
  judgeModel: string
  anchorPanel: number
  predecessorPanel: number | null
  hardKeys: ContinuityHardKey[]
  hardFailure: boolean
  result: ContinuityJudgeResult
  images: ContinuityJudgeImageSummary[]
  usage: ContinuityJudgeUsage
}

export type ContinuityJudgeDependencies = {
  judgeContinuity?: ((request: ContinuityJudgeRequest) => Promise<ContinuityJudgeEntry>) | undefined
}

export type ContinuityDownscaledImage = {
  bytes: Uint8Array
  base64: string
  mimeType: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}

export type ContinuityAuditPlanBundle = {
  panelNumber: number
  bundleData: PanelBundleData
}

export type ContinuityAuditPlanSegment = {
  index: number
  locationKey: string
  panelNumbers: number[]
  anchorPanel: number
}

export type ContinuityAuditPlanPanel = {
  panelNumber: number
  segmentIndex: number
  locationKey: string
  characterKeys: string[]
  absentKeys: string[]
  sourceSegmentIds: string[]
  entered: string[]
  exited: string[]
  anchorPanel: number
  predecessorPanel: number | null
}

export type ContinuityAuditPlan = {
  schemaVersion: 1
  trustedAnchorPanel: number | null
  anchorPanel: number
  roster: string[]
  segments: ContinuityAuditPlanSegment[]
  panels: ContinuityAuditPlanPanel[]
}

export type ContinuityLedger = {
  judged: number
  hardFailures: number
  byKey: Record<ContinuityHardKey, number>
  byCategory: Record<ContinuityBlooperCategory, number>
  axisCrossed: number
  furnitureVersusAnchor: Record<ContinuityFurnitureStatus, number>
  usage: ContinuityJudgeUsage
}

export type ContinuityPanelOutcome = {
  panelNumber: number
  segmentIndex: number
  anchorPanel: number
  predecessorPanel: number | null
  judged: boolean
  hardKeys: ContinuityHardKey[]
  blooperCategory: ContinuityBlooperCategory | null
  axisStatus: ContinuityAxisStatus | null
  furnitureVersusAnchor: ContinuityFurnitureStatus | null
  repairRoute: ContinuityRepairRoute | null
  observedStageState: string | null
  notes: string | null
  error: string | null
}

export type ContinuityAuditInput = {
  panelNumber: number
  panelPath: string
  bundleData: PanelBundleData
  references: ResolvedReferenceImages
}

export type ContinuityAuditContext = {
  plan: ContinuityAuditPlan
  labels: ContinuityLabelsFile | null
  requests: ContinuityJudgeRequest[]
  runDirectory: string
}

export type ContinuityStageState = {
  schemaVersion: 1
  sceneSlug: string
  anchorPanel: number
  trustedAnchorPanel: number | null
  roster: string[]
  segments: ContinuityAuditPlanSegment[]
  panels: Array<ContinuityAuditPlanPanel & { observedStageState: string | null }>
}

export type ContinuityLabelsFile = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/continuity-labels').ContinuityLabelsSchema>

export type ContinuityLabelKeyMetrics = {
  key: ContinuityHardKey
  truePositives: number
  falsePositives: number
  falseNegatives: number
  trueNegatives: number
  precision: number | null
  recall: number | null
}

export type ContinuityLabelsJoin = {
  labeler: string
  date: string
  trustedAnchorPanel: number | null
  labeledPairs: number
  matchedPairs: number
  unmatchedPairs: Array<{ panels: [number, number]; reason: string }>
  byKey: ContinuityLabelKeyMetrics[]
}

export type ContinuityAuditReport = {
  schemaVersion: 1
  sceneSlug: string
  runId: string
  judgeModel: string
  anchorPanel: number
  trustedAnchorPanel: number | null
  roster: string[]
  segments: ContinuityAuditPlanSegment[]
  ledger: ContinuityLedger
  panels: ContinuityPanelOutcome[]
  labels: ContinuityLabelsJoin | null
}

export type QaOnlyContinuityAudit = {
  judged: number
  hardFailures: number
  byKey: Record<ContinuityHardKey, number>
  anchorPanel: number
  trustedAnchorPanel: number | null
  reportDirectory: string
}

export type ContinuityPageQaEntryExtension = {
  schemaVersion: 1
  judgeModel: string
  anchorPanel: number
  predecessorPanel: number | null
  hardKeys: ContinuityHardKey[]
  blooperCategory: ContinuityBlooperCategory
}

export type ContinuityPageQaEntry = PageQaEntry & { continuity?: ContinuityPageQaEntryExtension | undefined }
