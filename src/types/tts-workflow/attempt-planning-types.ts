import type {
  AttemptSlot,
  AttemptTurn,
  CapabilityFixture,
  ComicDialoguePlan,
  ComicSourceIdentity,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  PlannedCost,
  ProviderRenderBranchCandidate,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderStrategy,
} from '~/types'

export type PlannedInputs = {
  sourceIdentity: GenericTtsSourceIdentity | ComicSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan | ComicDialoguePlan
  turns: AttemptTurn[]
  batches: ProviderRenderPlan['batches']
  slots: AttemptSlot[]
  strategy: ProviderRenderStrategy
  normalizedText: string
}

export type PureCurrentTtsRenderPlan = {
  operation: 'tts-synthesis' | 'comic-audio'
  transport: string
  targetKey: string
  capability: CapabilityFixture
  capabilityFixtureHash: string
  capabilityScopeHash: string
  planned: PlannedInputs
  voiceContextKey: string
  outputProfileHash: string
  synthesisSettingsHash: string
  plannedRenderCost: PlannedCost
  branchCandidate: ProviderRenderBranchCandidate
  branchPlan: ProviderRenderBranchPlan
  strategyArtifacts: {
    sourceIdentity: { identityHash: string, path: string, sha256: string }
    dialoguePlan: { dialoguePlanId: string, path: string, sha256: string }
    normalizedDialogue: { path: string, sha256: string }
    turns: Array<{ turnId: string, path: string, sha256: string }>
    generationSlots: Array<{ generationSlotId: string, path: string, sha256: string }>
  }
  renderPlanId: string
  renderIdentity: string
  renderPlan: ProviderRenderPlan
}
