import type {
  ComicTtsRenderContext,
  CurrentTtsObservedTurn,
  CurrentTtsRenderArtifacts,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  PipelineProviderState,
  Step4Metadata,
  TtsExecutionReadinessObservation,
  TtsTarget,
} from '~/types'

export type WorkingTtsMetadata = Step4Metadata & {
  _ttsObservedTurns?: CurrentTtsObservedTurn[] | undefined
  _ttsRenderStrategy?: 'native-dialogue' | 'native-utterances' | 'segmented' | undefined
}

export type WorkingTtsResult = Step4Metadata & {
  _renderArtifacts?: CurrentTtsRenderArtifacts | undefined
}

export type TtsRunSourceContext = {
  sourceIdentity?: GenericTtsSourceIdentity | undefined
  dialoguePlan?: GenericTtsDialoguePlan | undefined
  comicContext?: ComicTtsRenderContext | undefined
  artifactOutputDir?: string | undefined
  artifactRoot?: string | undefined
  retainedProviderStates?: PipelineProviderState[] | undefined
  recoveryRootDir?: string | undefined
  executionReadiness?: readonly TtsExecutionReadinessObservation[] | undefined
  resolveReportedOutput?: ((target: TtsTarget, defaultFileName: string) => { path: string, fileName: string }) | undefined
  beforeDispatch?: ((preparedStates: PipelineProviderState[]) => Promise<void>) | undefined
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
}
