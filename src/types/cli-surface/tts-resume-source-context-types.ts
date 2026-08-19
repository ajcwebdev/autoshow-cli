import type {
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  TtsDialoguePlanArtifactRef,
  TtsRunSourceContext
} from '~/types'

export type ResolvedTtsResumeSourceContext = TtsRunSourceContext & {
  retainedPlanIdentities: ReadonlyMap<string,
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
  >
  dialoguePlanArtifact: TtsDialoguePlanArtifactRef
}

export type ProviderTtsResumeSourceContext = {
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  targetKey: string
  planIdentity:
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
}
