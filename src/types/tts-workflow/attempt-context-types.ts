import type {
  AccountCapabilityObservation,
  AttemptSlot,
  CanonicalAudioProviderProjection,
  CreateCurrentTtsRenderAttemptOptions,
  CurrentTtsRecoveredGenerationSlot,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchResult,
  ProviderReadinessResult,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderResult,
  PureCurrentTtsRenderPlan,
  RecordedOutput,
  RenderAdmissionJournalSnapshot,
  RuntimeRequest,
  TtsOutputLayout,
  WrittenJson,
} from '~/types'

export type ClosedProviderAttempt = {
  resultFile?: WrittenJson<ProviderRenderResult> | undefined
  batchResultFiles: Array<WrittenJson<ProviderBatchResult>>
}

export type ReadinessAuthorization = {
  readinessAttemptSequence: number
  branchPlanId: string
  branchCandidateId: string
  readinessResultRef: string
  readinessResultHash: string
  accountObservationHashes: string[]
}

export type AttemptContext = {
  options: CreateCurrentTtsRenderAttemptOptions
  purePlan: PureCurrentTtsRenderPlan
  now: () => string
  artifactRoot: string
  compactArchive: boolean
  layout: TtsOutputLayout
  targetRelativeDir: string
  archiveRelativeDir: string
  targetDir: string
  renderRoot: string
  branchRoot: string
  attemptsRoot: string
  attemptRoot: string
  journalRelativePath: string
  paidSpeechSlotHash: (slot: AttemptSlot) => string
  recoveredBySlot: Map<string, CurrentTtsRecoveredGenerationSlot>
  unresolvedSlots: AttemptSlot[]
  localCompositionOnly: boolean
  requestedSlotLimit: number | undefined
  attemptSlots: AttemptSlot[]
  attemptSlotIds: Set<string>
  unresolvedBatchIds: string[]
  unresolvedPlannedCost: PlannedCost
  cumulativePlannedCost: PlannedCost
  priorAttemptCount: number
  attemptNumber: number
  invocationId: string
  branchFile: WrittenJson<ProviderRenderBranchPlan>
  renderPlanFile: WrittenJson<ProviderRenderPlan>
  capabilityObservation: AccountCapabilityObservation
  readinessResult: ProviderReadinessResult
  readinessFile: WrittenJson<ProviderReadinessResult>
  readinessAuthorization: ReadinessAuthorization
  journalId: string
  journal: RenderAdmissionJournalSnapshot
  journalSequence: number
  journalFile: WrittenJson<RenderAdmissionJournalSnapshot> | undefined
  attemptReservation: Awaited<ReturnType<typeof import('~/cli/commands/process-steps/step-4-tts/script-to-audio/safe-artifact-store').reserveInvocationAttemptDirectory>> | undefined
  events: CanonicalAudioProviderProjection['renderHistory'][number]['events']
  pointerEvents: CanonicalAudioProviderProjection['pointerEvents']
  currentProjection: CanonicalAudioProviderProjection
  preparedState: PipelineProviderState
  mutation: Promise<void>
  runtimeRequests: RuntimeRequest[]
  outputsBySlot: Map<string, RecordedOutput[]>
  recoveredBatchFiles: Array<WrittenJson<ProviderBatchResult>>
  promotedBatchFiles: Map<string, WrittenJson<ProviderBatchResult>>
  closedProviderAttempt: ClosedProviderAttempt | undefined
  terminalState: PipelineProviderState | undefined
  executionSelection?: readonly {
    generationSlotId: string
    turnId: string
    providerSegmentIndex: number
  }[] | undefined
}
