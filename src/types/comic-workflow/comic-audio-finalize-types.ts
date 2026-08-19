export type ComicAudioFinalizeResult = {
  checkpoints: Array<{
    entry: NonNullable<Awaited<ReturnType<typeof import('~/cli/commands/process-steps/step-4-tts/run-tts').runTtsForTargets>>['metadata'][number]>
    checkpoint: NonNullable<NonNullable<Awaited<ReturnType<typeof import('~/cli/commands/process-steps/step-4-tts/run-tts').runTtsForTargets>>['metadata'][number]>['generationCheckpoint']>
  }>
  finalStageStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  soundscapeRequiredFailure: boolean
}
