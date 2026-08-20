import type { CliCommandContext } from '~/types'
import { canonicalTargetKey } from '../../../step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsResumePrice } from '../../../step-4-tts/script-to-audio/current-render-attempt'
import { validateTtsRenderInputsForTargets } from '../../../step-4-tts/run-tts'
import { collectTtsTargets } from '../../../step-4-tts/tts-targets'
import { createResourceGate } from '~/utils/resource-gate'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { generateComicSlideshow } from '../generate-slideshow/generate-slideshow-command'
import { createHostedTtsChunkScheduler } from '../../../step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { createSoundscapePlan, DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '../../../step-4-tts/soundscape/soundscape-planner'
import { planComicSoundscapePrice } from '../../comic-utils/comic-soundscape-workflow'
import {
  flattenTurns,
  resolveComicAudioInvocation,
} from './comic-audio-invocation'
import {
  assertVoiceSnapshotCoversSelectedTargets,
  resolveComicVoiceSnapshot,
} from './comic-voice-snapshot'
import {
  executeZeroTurnsWithoutSoundscape,
  executeZeroTurnsWithSoundscape,
  stageComicAudioArtifacts,
} from './comic-audio-staging'
import {
  buildTargetExecution,
  executeComicAudioTargets,
} from './comic-audio-execution'
import { finalizeComicAudioOutputs } from './comic-audio-finalize'

export { buildTargetExecution, assertVoiceSnapshotCoversSelectedTargets }

export const generateComicAudio = async (ctx: CliCommandContext, scriptPath: string): Promise<void> => {
  const invocation = await resolveComicAudioInvocation(ctx, scriptPath)
  const {
    profileKey,
    mode,
    deliveryPolicy,
    sampleRate,
    channels,
    codec,
    price,
    allowAmbiguousRedispatch,
    maxGenerationSlots,
    sfxSelector,
    sfxLicenseUseClassification,
    sfxConcurrency,
    presentationRequested,
    baseOptions,
    compatible,
    dialoguePlan,
  } = invocation

  const turns = flattenTurns(dialoguePlan)
  const structuredRef = dialoguePlan.structuredScript
  const soundscapePlan = createSoundscapePlan({
    structuredScript: compatible.structuredScript,
    structuredScriptRef: structuredRef,
    dialoguePlan,
    sceneRunIdentity: dialoguePlan.sceneRunIdentity,
    createdAt: compatible.manifest.createdAt,
    mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE,
    timingPolicy: invocation.soundscapeTimingPolicy,
  })
  const retainedSoundEffectPlanRef = compatible.comicMetadata.audio.soundEffectRenderPlanRef
  const soundscapePrice = await planComicSoundscapePrice({
    rootDir: compatible.sceneRunDir,
    plan: soundscapePlan,
    selector: sfxSelector,
    licenseUseClassification: sfxLicenseUseClassification,
    ...(retainedSoundEffectPlanRef ? { retainedPlanRef: retainedSoundEffectPlanRef } : {})
  })
  const soundEffectRenderPlan = soundscapePrice.renderPlan

  if (turns.length === 0 && !soundEffectRenderPlan) {
    if (price) {
      l.write('info', `Comic audio price: 0 speakable turns; no provider work or artifact writes. ${soundscapePrice.summary}`, {
      category: 'pricing',
      metadata: { speakableTurns: 0, soundscapeSummary: soundscapePrice.summary }
    })
      return
    }
    await executeZeroTurnsWithoutSoundscape({ compatible, dialoguePlan, soundscapePlan, structuredRef })
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
    l.write('info', `Comic soundscape complete without dialogue: ${compatible.sceneRunDir}`, {
      category: 'command',
      metadata: { sceneRunDir: compatible.sceneRunDir, dialogue: false }
    })
    return
  }

  const collectedTargets = collectTtsTargets(baseOptions)
  if (collectedTargets.length === 0) throw CLIUsageError('Comic audio requires at least one selected TTS provider target.')
  const targets = collectedTargets.map((target) => {
    const transport = target.transport ?? 'hosted-api'
    return { ...target, operation: 'comic-audio' as const, transport, targetKey: canonicalTargetKey('comic-audio', target.service, target.model, transport) }
  })
  if (new Set(targets.map(target => target.targetKey)).size !== targets.length) throw CLIUsageError('Comic audio provider selection contains duplicate operation-scoped provider/model targets.')

  const { snapshot, retainedSnapshot } = await resolveComicVoiceSnapshot({ compatible, dialoguePlan, targets, profileKey })

  baseOptions.hostedTtsChunkScheduler ??= createHostedTtsChunkScheduler({
    maxConcurrency: baseOptions.ttsChunkConcurrency,
    concurrencyMode: baseOptions.concurrencyMode,
    hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator,
  })
  const hostedResourceGate = createResourceGate({ capacity: baseOptions.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const executions = targets.map(target => buildTargetExecution({ target, baseOptions, snapshot, dialoguePlan, mode, deliveryPolicy, sampleRate, channels, codec, resourceGate: hostedResourceGate }))
  for (const execution of executions) validateTtsRenderInputsForTargets([execution.target], execution.sourceText, execution.options, { comicContext: execution.context })

  if (price) {
    for (const execution of executions) {
      const retainedState = compatible.manifest.items[0]?.providers.find((state) => state.targetKey === execution.target.targetKey)
      const estimate = await planCurrentTtsResumePrice({
        rootDir: compatible.sceneRunDir,
        state: retainedState,
        target: execution.target,
        sourceText: execution.sourceText,
        ttsOptions: execution.options,
        comicContext: execution.context,
      })
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

  if (soundscapeRequiredFailure) throw CLIUsageError('Comic soundscape failed one or more required cues; verified dialogue and sound-effect artifacts were retained for resume, but no master was published.')
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
  if (presentationRequested) {
    await generateComicSlideshow(ctx, scriptPath)
  }
}
