import type { SoundEffectSynthesisTask, SoundEffectTarget, SoundscapeCueRoutingDecision } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const routeSoundscapeSynthesisTasks = (input: {
  tasks: readonly SoundEffectSynthesisTask[]
  target: SoundEffectTarget
}): { decisions: SoundscapeCueRoutingDecision[], sfxTasks: SoundEffectSynthesisTask[] } => {
  if (input.target.provider !== 'elevenlabs') throw UsageError(`Unsupported sound-effect provider ${input.target.provider}; expected elevenlabs.`)
  const decisions: SoundscapeCueRoutingDecision[] = input.tasks.map(task => ({
    cueId: task.cueId, kind: task.kind, required: task.required, route: 'dedicated-sfx', targetKey: input.target.targetKey,
  }))
  return {
    decisions,
    sfxTasks: [...input.tasks],
  }
}
