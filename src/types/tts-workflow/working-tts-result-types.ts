import type { CurrentTtsRenderArtifacts, CurrentTtsRenderAttempt, TtsTarget, WorkingTtsMetadata } from '~/types'

type GenerationCheckpoint = Awaited<ReturnType<CurrentTtsRenderAttempt['finalizeCheckpoint']>>

export type WorkingTtsResultInput =
  | {
      mode: 'local-finalize'
      target: TtsTarget
      reportedOutput: { path: string, fileName: string }
      startedAt: number
      chunkCount: number
      renderArtifacts: CurrentTtsRenderArtifacts
    }
  | {
      mode: 'provider-render'
      metadata: WorkingTtsMetadata
      reportedOutput: { path: string, fileName: string }
      renderArtifacts: CurrentTtsRenderArtifacts
    }
  | {
      mode: 'generation-checkpoint'
      metadata: WorkingTtsMetadata
      audioPath: string
      audioFileName: string
      checkpoint: GenerationCheckpoint
    }
