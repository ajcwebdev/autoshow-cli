import type { CliCommandContext } from '~/types'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { generateComicSlideshow, planPendingComicSlideshow } from '../generate-slideshow/generate-slideshow-command'
import { recordComicRecoveryIntent, completeComicRecoveryIntent } from '../../comic-utils/comic-recovery-intent'
import { planComicAudio } from './comic-audio-planning'
import { assertVoiceSnapshotCoversSelectedTargets } from './comic-voice-snapshot'
import { executeZeroTurnsWithoutSoundscape, executeZeroTurnsWithSoundscape, stageComicAudioArtifacts } from './comic-audio-staging'
import { buildTargetExecution, executeComicAudioTargets } from './comic-audio-execution'
import { finalizeComicAudioOutputs } from './comic-audio-finalize'

export { buildTargetExecution, assertVoiceSnapshotCoversSelectedTargets }

export const generateComicAudio = async (ctx: CliCommandContext, scriptPath: string): Promise<void> => {
  const planned = await planComicAudio(ctx, scriptPath)
  const { invocation, turns, soundscapePlan, soundscapePrice, soundEffectRenderPlan, executions, snapshot, retainedSnapshot } = planned
  const { price, allowAmbiguousRedispatch, maxGenerationSlots, sfxConcurrency, presentationRequested, baseOptions, compatible, dialoguePlan } = invocation
  const structuredRef = dialoguePlan.structuredScript
  if (!price) {
    const presentation = presentationRequested ? await planPendingComicSlideshow(ctx, compatible, planned.planHash) : undefined
    await recordComicRecoveryIntent({ rootDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, stage: 'audio', flags: planned.flags, inputs: [{ path: structuredRef.path, sha256: structuredRef.sha256 }], planHash: planned.planHash }, presentation ? [presentation] : [])
  }

  if (turns.length === 0 && !soundEffectRenderPlan) {
    if (price) {
      l.write('info', `Comic audio price: 0 speakable turns; no provider work or artifact writes. ${soundscapePrice.summary}`, {
      category: 'pricing',
      metadata: { speakableTurns: 0, soundscapeSummary: soundscapePrice.summary }
    })
      return
    }
    await executeZeroTurnsWithoutSoundscape({ compatible, dialoguePlan, soundscapePlan, structuredRef })
    await completeComicRecoveryIntent(compatible.sceneRunDir, 'audio', planned.planHash)
    l.write('info', `Comic audio completed locally with no speakable turns: ${compatible.sceneRunDir}`, {
      category: 'command',
      metadata: { sceneRunDir: compatible.sceneRunDir, speakableTurns: 0 }
    })
    return
  }

  if (turns.length === 0 && soundEffectRenderPlan) {
    if (price) {
      l.write('info', `Comic audio price: 0 speakable turns. ${soundscapePrice.summary}`, {
      category: 'pricing',
      metadata: { speakableTurns: 0, soundscapeSummary: soundscapePrice.summary }
    })
      return
    }
    await executeZeroTurnsWithSoundscape({
      compatible,
      dialoguePlan,
      soundscapePlan,
      soundEffectRenderPlan,
      structuredRef,
      sfxConcurrency,
      hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator,
    })
    await completeComicRecoveryIntent(compatible.sceneRunDir, 'audio', planned.planHash)
    l.write('info', `Comic soundscape complete without dialogue: ${compatible.sceneRunDir}`, {
      category: 'command',
      metadata: { sceneRunDir: compatible.sceneRunDir, dialogue: false }
    })
    return
  }

  if (price) {
    for (const execution of executions) {
      const estimate = planned.estimates[executions.indexOf(execution)]!
      const cost = estimate.plannedCost.amounts.map(amount => `${amount.amount.toFixed(4)} ${amount.currency}`).join(', ') || '0'
      const resumeDetail = maxGenerationSlots !== undefined
        ? `, ${estimate.plannedSlotCount} unresolved slot checkpoint`
        : estimate.recoveredSlotCount === 0
          ? ''
          : estimate.unresolvedSlotCount === 0
            ? ', 0 unresolved slots, local finalization only'
            : `, ${estimate.unresolvedSlotCount} unresolved slots remaining`
      const blockedSlotCount = new Set(estimate.reconciliationBlockers.map((blocker) => blocker.generationSlotId)).size
      const reconciliationDetail = blockedSlotCount === 0
        ? ''
        : allowAmbiguousRedispatch
          ? `, ${blockedSlotCount} ambiguous slot redispatch authorized`
          : `, blocked: ${blockedSlotCount} unresolved ${blockedSlotCount === 1 ? 'slot requires' : 'slots require'} reconciliation`
      l.write('info', `${execution.target.service}/${execution.target.model}: ${estimate.readiness.strategy}, ${cost}${resumeDetail}${reconciliationDetail}`, {
      category: 'pricing',
      metadata: { service: execution.target.service, model: execution.target.model, strategy: estimate.readiness.strategy }
    })
    }
    l.write('info', soundscapePrice.summary, { category: 'pricing' })
    return
  }

  if (!snapshot) throw UsageError('Comic dialogue requires an approved voice snapshot.')
  const {
    dialogueRef,
    snapshotRef,
    baseArtifacts,
    audioMetadata,
  } = await stageComicAudioArtifacts({
    compatible,
    dialoguePlan,
    soundscapePlan,
    soundEffectRenderPlan,
    snapshot,
    retainedSnapshot,
    structuredRef,
  })

  const targetKeys = executions.map(execution => execution.target.targetKey as string)
  const soundTargetKeys = soundEffectRenderPlan ? [soundEffectRenderPlan.target.targetKey] : []
  const retainedSoundTargetKeys = soundTargetKeys.filter(targetKey => compatible.manifest.items[0]?.providers.some(provider => provider.targetKey === targetKey))
  const dialogueStageTargetKeys = [...new Set([...compatible.comicMetadata.stages.audio.targetKeys.filter(targetKey => !soundTargetKeys.includes(targetKey) || retainedSoundTargetKeys.includes(targetKey)), ...targetKeys])]
  const stageTargetKeys = [...new Set([...dialogueStageTargetKeys, ...soundTargetKeys])]

  const settled = await executeComicAudioTargets({
    compatible,
    executions,
    dialogueStageTargetKeys,
    baseArtifacts,
    audioMetadata,
  })

  const { checkpoints, finalStageStatus, soundscapeRequiredFailure } = await finalizeComicAudioOutputs({
    compatible,
    dialoguePlan,
    soundscapePlan,
    soundEffectRenderPlan,
    sfxConcurrency,
    baseOptions,
    snapshot,
    settled,
    baseArtifacts,
    audioMetadata,
    dialogueRef,
    structuredRef,
    snapshotRef,
    stageTargetKeys,
  })

  if (soundscapeRequiredFailure) throw UsageError('Comic soundscape failed one or more required cues; verified dialogue and sound-effect artifacts were retained for resume, but no master was published.')
  if (checkpoints.length > 0) {
    for (const { entry, checkpoint } of checkpoints) {
      l.write('info', `${entry.ttsService}/${entry.ttsModel} generation checkpoint complete: ${checkpoint.completedGenerationSlotIds.length} retained, ${checkpoint.remainingGenerationSlotCount} remaining.`, {
        category: 'command',
        metadata: {
          service: entry.ttsService,
          model: entry.ttsModel,
          retainedSlots: checkpoint.completedGenerationSlotIds.length,
          remainingSlots: checkpoint.remainingGenerationSlotCount
        }
      })
    }
    l.write('info', `Comic audio generation checkpoint saved; no final WAV was published: ${compatible.sceneRunDir}`, {
      category: 'command',
      metadata: { sceneRunDir: compatible.sceneRunDir, published: false }
    })
    return
  }
  l.write('info', finalStageStatus === 'full' ? `Comic audio complete: ${compatible.sceneRunDir}` : `Comic audio target update complete; aggregate stage remains ${finalStageStatus}: ${compatible.sceneRunDir}`, {
    category: 'command',
    metadata: { sceneRunDir: compatible.sceneRunDir, stageStatus: finalStageStatus }
  })
  await completeComicRecoveryIntent(compatible.sceneRunDir, 'audio', planned.planHash)
  if (presentationRequested) {
    await generateComicSlideshow(ctx, scriptPath)
  }
}
