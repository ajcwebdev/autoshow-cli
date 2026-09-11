import type { ComicImageRequestInput, GeneratedImageResponse, ImageRunStats, PanelBundleData, ResolvedReferenceImages } from '~/types'
import type { recordComicImageRevision } from '../../comic-utils/comic-manifest'
import type { DEFECT_CATEGORY_VALUES, IMPORTANCE_VALUES } from './revision-evaluation-config'

export type RevisionImportance = typeof IMPORTANCE_VALUES[number]

export type RevisionDefectCategory = typeof DEFECT_CATEGORY_VALUES[number]

export type RevisionBoundFile = { path: string; sha256: string }

export type RevisionPlanEntry = {
  panelNumber: number
  importance: RevisionImportance
  defectCategory: RevisionDefectCategory
  originalFinding: string
  correctionNote: string
  originalProvider: string
  original: RevisionBoundFile
  contract: RevisionBoundFile
  references: RevisionBoundFile[]
}

export type RevisionPlan = {
  schemaVersion: 1
  experimentId: string
  createdAt: string
  sceneSlug: string
  script: RevisionBoundFile
  priorQa: RevisionBoundFile
  entries: RevisionPlanEntry[]
  planFingerprint: string
}

export type RevisionComparisonRaw = {
  targetedDefectStatusImageA: 'visible' | 'partly-visible' | 'not-visible' | 'not-assessable'
  targetedDefectStatusImageB: 'visible' | 'partly-visible' | 'not-visible' | 'not-assessable'
  targetedDefectLowerIn: 'image-a' | 'image-b' | 'neither'
  differenceMeaningful: boolean
  majorRegressionImageA: boolean
  majorRegressionImageB: boolean
  nonTargetDifferenceLevel: 'none' | 'minor' | 'major'
  preservationRequirementsSatisfiedImageA: boolean
  preservationRequirementsSatisfiedImageB: boolean
  nonTargetDifferences: string[]
  fullContractPreference: 'image-a' | 'image-b' | 'tie'
  confidence: 'low' | 'medium' | 'high'
  regressionsImageA: string[]
  regressionsImageB: string[]
  rationale: string
}

export type RevisionComparisonNormalized = {
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

export type ComparisonResponse = { text: string; inputTokens: number; outputTokens: number }

export type SimilarityMeasurements = { ssim: number; normalizedRmse: number }

type SlotStatus = 'in-flight' | 'completed' | 'failed' | 'malformed' | 'ambiguous'

export type PanelLedger = {
  schemaVersion: 1
  planFingerprint: string
  panelNumber: number
  originalSha256: string
  imageSlot?: { status: SlotStatus; attempts: number; startedAt: string; completedAt?: string; error?: string; estimatedCostUsd?: number; usage?: { imageInputUnits: number; textInputUnits: number; outputUnits: number } }
  candidateSha256?: string
  comparisonSlots: Array<{ pass: 1 | 2; status: SlotStatus; attempts: number; startedAt: string; completedAt?: string; error?: string; usage?: { inputTokens: number; outputTokens: number; costUsd: number }; normalized?: RevisionComparisonNormalized }>
  similarity?: SimilarityMeasurements
  decision?: 'clear-winner' | 'retain-original' | 'incomplete'
  decisionReason?: string
  promoted?: boolean
  canonicalSha256After?: string
}

export type RevisionEvaluationDependencies = {
  requestImage?: (input: ComicImageRequestInput) => Promise<GeneratedImageResponse>
  requestComparison?: (input: { prompt: string; imagePaths: string[]; model: string }) => Promise<ComparisonResponse>
  writeImage?: (path: string, imageBase64: string, mimeType?: string) => Promise<void>
  measureSimilarity?: (originalPath: string, candidatePath: string) => Promise<SimilarityMeasurements>
  recordManifest?: (input: Parameters<typeof recordComicImageRevision>[0]) => Promise<unknown>
  now?: () => string
}

export type RevisionEvaluationResult = {
  evidenceDirectory: string
  planFingerprint: string
  ledgers: PanelLedger[]
  stats: ImageRunStats
  promotedPanels: number[]
}

export type LoadedRevisionEntry = RevisionPlanEntry & { originalPath: string; contractPath: string; bundleData: PanelBundleData; referencesResolved: ResolvedReferenceImages }

export type LoadedRevisionPlan = { plan: RevisionPlan; planPath: string; entries: LoadedRevisionEntry[]; evidenceDirectory: string }

export type RevisionPriceInventory = {
  loaded: LoadedRevisionPlan
  imageCalls: number
  comparisonCalls: number
  completedImageSlots: number
  terminalImageSlots: number
  reusedComparisonSlots: number
}
