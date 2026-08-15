import type { SoundEffectSynthesisTask, SoundEffectTarget, SoundscapeCueRoutingDecision } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const soundEffectTargetSupportsKind = (target: SoundEffectTarget, kind: SoundEffectSynthesisTask['kind']): boolean =>
  target.provider !== 'replicate' || kind !== 'vocal-reaction'

const unsupportedReason = (target: SoundEffectTarget, kind: SoundEffectSynthesisTask['kind']): string =>
  kind === 'vocal-reaction'
    ? `${target.provider}/${target.model} cannot render VOCAL SFX; select --sfx-provider elevenlabs=eleven_text_to_sound_v2 or mark the cue OPTIONAL.`
    : `${target.provider}/${target.model} cannot render ${kind}.`

export const routeSoundscapeSynthesisTasks = (input: {
  tasks: readonly SoundEffectSynthesisTask[]
  target: SoundEffectTarget
}): { decisions: SoundscapeCueRoutingDecision[], sfxTasks: SoundEffectSynthesisTask[] } => {
  const decisions: SoundscapeCueRoutingDecision[] = input.tasks.map((task) => {
    if (soundEffectTargetSupportsKind(input.target, task.kind)) {
      return { cueId: task.cueId, kind: task.kind, required: task.required, route: 'dedicated-sfx', targetKey: input.target.targetKey }
    }
    return { cueId: task.cueId, kind: task.kind, required: task.required, route: 'unsupported', reason: unsupportedReason(input.target, task.kind) }
  })
  const requiredUnsupported = decisions.find(decision => decision.route === 'unsupported' && decision.required)
  if (requiredUnsupported?.reason) throw CLIUsageError(requiredUnsupported.reason)
  return {
    decisions,
    sfxTasks: input.tasks.filter((_, index) => decisions[index]?.route === 'dedicated-sfx'),
  }
}
