import type { CurrentTtsRenderArtifacts, CurrentTtsRenderAttempt, TtsTarget, WorkingTtsMetadata } from '~/types'

type GenerationCheckpoint = Awaited<ReturnType<CurrentTtsRenderAttempt['finalizeCheckpoint']>>

/**
 * The three shapes a TTS target can resolve to. Each mode names exactly what it needs:
 * a locally finalized render has no provider metadata and reports its own timing, a
 * provider render carries the provider's metadata, and a checkpoint is not terminal so it
 * has no result identity, audio run ID, or render artifacts to attach.
 */
export type WorkingTtsResultInput =
  | {
      /** Recovered or admitted-without-dispatch: audio already exists on disk. */
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
      /** A bounded execution stopped at a slot boundary and will resume from here. */
      mode: 'generation-checkpoint'
      metadata: WorkingTtsMetadata
      audioPath: string
      audioFileName: string
      checkpoint: GenerationCheckpoint
    }
