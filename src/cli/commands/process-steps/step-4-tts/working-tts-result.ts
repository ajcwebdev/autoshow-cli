import type {
  CurrentTtsRenderArtifacts,
  WorkingTtsResult,
  WorkingTtsResultInput
} from '~/types'

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
