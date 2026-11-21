import type { StepEstimate } from '~/types'

export type ComicRecoveryStage = 'image' | 'audio' | 'presentation'
export type ComicRecoveryFlags = Record<string, string | boolean | string[]>
export type ComicRecoveryInput = { path: string; sha256: string; base?: 'project' }
export type ComicRecoveryIntent = {
  schemaVersion: 1
  flags: ComicRecoveryFlags
  inputs: ComicRecoveryInput[]
  charactersRoot: string
  planHash: string
  afterAudio?: string | undefined
  imageRunId?: string | undefined
  completed: boolean
}
export type ComicRecoveryState = Partial<Record<ComicRecoveryStage, ComicRecoveryIntent>>

/** How recorded image flags map onto the current single-model generation contract. */
export type ComicImageRecoveryResolution =
  | { status: 'current'; flags: ComicRecoveryFlags }
  /** Historical generation-only intent whose remaining work is equivalent to a current single-model run. */
  | { status: 'legacy-equivalent'; flags: ComicRecoveryFlags; model: string; explicitCanonicalVariation: boolean }
  /** Historical intent that depended on judging, repairs, blocking, several models or a named variation. */
  | { status: 'incompatible'; reasons: string[]; models: string[]; variations: string[] }

export type ComicLegacyImageOutput = {
  kind: 'panel' | 'page' | 'sketch'
  label: string
  model: string
  variation?: string
  path: string
}

export type ComicLegacyImageIntentReport = {
  runId: string
  reasons: string[]
  models: string[]
  variations: string[]
  completedOutputs: ComicLegacyImageOutput[]
}

export type ComicRecoveryStagePlan = {
  stage: ComicRecoveryStage
  action: 'reuse' | 'resume' | 'not-requested' | 'blocked' | 'after-audio'
  detail: string
  steps: StepEstimate[]
  /** Present when a historical image intent cannot continue without an explicit new single-model selection. */
  legacyImageIntent?: ComicLegacyImageIntentReport
}
