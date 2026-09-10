export type ComicAudioFinalizeResult = {
  checkpoints: Array<{
    entry: NonNullable<Awaited<ReturnType<typeof import('~/cli/commands/audio/tts/run-tts').runTtsForTargets>>['metadata'][number]>
    checkpoint: NonNullable<NonNullable<Awaited<ReturnType<typeof import('~/cli/commands/audio/tts/run-tts').runTtsForTargets>>['metadata'][number]>['generationCheckpoint']>
  }>
  finalStageStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  soundscapeRequiredFailure: boolean
}
