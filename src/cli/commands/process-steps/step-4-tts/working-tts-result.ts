import type {
  CurrentTtsRenderArtifacts,
  CurrentTtsRenderAttempt,
  TtsTarget,
  WorkingTtsMetadata,
  WorkingTtsResult
} from '~/types'

type GenerationCheckpoint = Awaited<ReturnType<CurrentTtsRenderAttempt['finalizeCheckpoint']>>

/** The audio projection lands under the key that matches the operation it was rendered for. */
const projectionEnvelope = (
  artifacts: Pick<CurrentTtsRenderArtifacts, 'operation' | 'projection'>
): Pick<WorkingTtsResult, 'comicAudio' | 'ttsAudio'> =>
  artifacts.operation === 'comic-audio'
    ? { comicAudio: artifacts.projection }
    : { ttsAudio: artifacts.projection }

/**
 * Attaches the render artifacts a terminal result carries. `_renderArtifacts` is internal
 * to this run — the manifest writer strips it before the metadata is serialized.
 */
const terminalRenderFields = (renderArtifacts: CurrentTtsRenderArtifacts) => ({
  operation: renderArtifacts.operation,
  targetKey: renderArtifacts.targetKey,
  transport: renderArtifacts.transport,
  artifactDir: renderArtifacts.artifactDir,
  renderIdentity: renderArtifacts.renderIdentity,
  resultIdentity: renderArtifacts.resultIdentity,
  audioRunId: renderArtifacts.audioRunId,
  renderStrategy: renderArtifacts.strategy,
  ...projectionEnvelope(renderArtifacts),
  _renderArtifacts: renderArtifacts
})

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

export const buildWorkingTtsResult = (input: WorkingTtsResultInput): WorkingTtsResult => {
  if (input.mode === 'local-finalize') {
    return {
      ttsService: input.target.service,
      ttsModel: input.target.model,
      speaker: input.target.voice ?? 'retained-voice-binding',
      processingTime: Date.now() - input.startedAt,
      audioFileName: input.reportedOutput.fileName,
      audioFileSize: Bun.file(input.reportedOutput.path).size,
      chunkCount: input.chunkCount,
      ...terminalRenderFields(input.renderArtifacts)
    } as WorkingTtsResult
  }

  if (input.mode === 'provider-render') {
    return {
      ...input.metadata,
      audioFileName: input.reportedOutput.fileName,
      audioFileSize: Bun.file(input.reportedOutput.path).size,
      ...terminalRenderFields(input.renderArtifacts)
    } as WorkingTtsResult
  }

  return {
    ...input.metadata,
    audioFileName: input.audioFileName,
    audioFileSize: Bun.file(input.audioPath).size,
    operation: input.checkpoint.operation,
    targetKey: input.checkpoint.targetKey,
    transport: input.checkpoint.transport,
    artifactDir: input.checkpoint.artifactDir,
    renderIdentity: input.checkpoint.renderIdentity,
    renderStrategy: input.checkpoint.strategy,
    generationCheckpoint: {
      completedGenerationSlotIds: input.checkpoint.completedGenerationSlotIds,
      remainingGenerationSlotCount: input.checkpoint.remainingGenerationSlotCount
    },
    ...projectionEnvelope(input.checkpoint)
  } as WorkingTtsResult
}
