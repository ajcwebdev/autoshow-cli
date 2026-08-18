import type {
  CreateCurrentTtsRenderAttemptOptions,
  CurrentTtsRenderAttempt,
} from './attempt-shared'
import { createAttemptContext } from './attempt-context'
import { scopeFor } from './attempt-evidence'
import {
  finalizeCheckpoint,
  finalizeFailure,
  finalizeSuccess,
} from './attempt-finalize'

export const createCurrentTtsRenderAttempt = async (
  options: CreateCurrentTtsRenderAttemptOptions
): Promise<CurrentTtsRenderAttempt> => {
  const ctx = await createAttemptContext(options)

  return {
    requestEvidence: scopeFor(ctx),
    preparedState: ctx.preparedState,
    providerDispatchRequired: !ctx.localCompositionOnly,
    plannedChunkCount: ctx.purePlan.planned.slots.length,
    executionSelection: ctx.executionSelection,
    finalizeSuccess: (audioPath: string, reportedOutputPath: string) =>
      finalizeSuccess(ctx, audioPath, reportedOutputPath),
    finalizeCheckpoint: () => finalizeCheckpoint(ctx),
    finalizeFailure: (error: unknown, phase) => finalizeFailure(ctx, error, phase),
  }
}
