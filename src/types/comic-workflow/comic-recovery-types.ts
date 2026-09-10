import type { StepEstimate } from '~/types'

export type ComicRecoveryStage = 'image' | 'audio' | 'presentation'
export type ComicRecoveryFlags = Record<string, string | boolean | string[]>
export type ComicRecoveryInput = { path: string; sha256: string }
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
export type ComicRecoveryStagePlan = {
  stage: ComicRecoveryStage
  action: 'reuse' | 'resume' | 'not-requested' | 'blocked' | 'after-audio'
  detail: string
  steps: StepEstimate[]
}
