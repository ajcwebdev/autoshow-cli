import { join } from 'node:path'
import type {
  CompactMix,
  Step4Metadata,
  TtsOptions,
  VoiceReferenceManifest,
} from '~/types'
import { sha256Bytes } from '../../../step-4-tts/script-to-audio/contract-identity'
import { readContainedArtifactFile } from '../../../step-4-tts/script-to-audio/safe-artifact-store'
import { CLIUsageError } from '~/utils/error-handler'
import type { createComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import type { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { appendComicAudioProviderState, updateComicAudioManifest } from '../../comic-utils/comic-manifest'
import { readManifest } from '../../../pipeline-manifest'
import { bindSnapshotRenderIdentities } from '../../comic-utils/voice-reference-snapshot'
import type { createSoundscapePlan } from '../../../step-4-tts/soundscape/soundscape-planner'
import { soundscapeAudioRunLineageRefs } from '../../comic-utils/comic-artifact-lineage-audit'
import {
  assertComicSoundscapeExecutionReady,
  runComicSoundscape,
  soundscapeReportedOutputPath,
} from '../../comic-utils/comic-soundscape-workflow'
import type { runTtsForTargets } from '../../../step-4-tts/run-tts'
import { providerStageStatus, stageArtifactRefs } from './comic-audio-staging'

export interface ComicAudioFinalizeResult {
  checkpoints: Array<{
    entry: NonNullable<Awaited<ReturnType<typeof runTtsForTargets>>['metadata'][number]>
    checkpoint: NonNullable<NonNullable<Awaited<ReturnType<typeof runTtsForTargets>>['metadata'][number]>['generationCheckpoint']>
  }>
  finalStageStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  soundscapeRequiredFailure: boolean
}

export const finalizeComicAudioOutputs = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  soundscapePlan: ReturnType<typeof createSoundscapePlan>
  soundEffectRenderPlan?: Parameters<typeof assertComicSoundscapeExecutionReady>[1] | undefined
  sfxConcurrency: number
  baseOptions: TtsOptions
  snapshot: VoiceReferenceManifest
  settled: PromiseSettledResult<Awaited<ReturnType<typeof runTtsForTargets>>>[]
  baseArtifacts: Array<{ path: string, sha256: string }>
  audioMetadata: Record<string, unknown>
  dialogueRef: { path: string, sha256: string }
  structuredRef: { path: string, sha256: string }
  snapshotRef: { path: string, sha256: string }
  stageTargetKeys: string[]
}): Promise<ComicAudioFinalizeResult> => {
  const {
    compatible,
    dialoguePlan,
    soundscapePlan,
    soundEffectRenderPlan,
    sfxConcurrency,
    baseOptions,
    snapshot,
    settled,
    audioMetadata,
    dialogueRef,
    structuredRef,
    snapshotRef,
    stageTargetKeys,
  } = input

  const metadata = settled.flatMap(result => result.status === 'fulfilled' ? result.value.metadata : [])
  const completedMetadata = metadata.filter((entry) => !entry.generationCheckpoint)
  const checkpoints = metadata.flatMap((entry) => entry.generationCheckpoint ? [{ entry, checkpoint: entry.generationCheckpoint }] : [])
  const selectedAudioRuns = completedMetadata.map((entry) => {
    if (!entry.targetKey || !entry.renderIdentity || !entry.audioRunId || !entry.comicAudio?.selectedSuccess) throw CLIUsageError('Completed comic target is missing selected audio-run evidence.')
    const archive = entry.comicAudio.archive
    if (archive) {
      return { targetKey: entry.targetKey, renderIdentity: entry.renderIdentity, audioRunId: entry.audioRunId, audioRunRef: archive.renderRef.path, audioRunSha256: archive.renderRef.sha256 }
    }
    const selected = entry.comicAudio.selectedSuccess
    const render = entry.comicAudio.renderHistory.find(candidate => candidate.renderIdentity === selected.renderIdentity)
    const event = render?.events.find(candidate => candidate.sequence === selected.eventSequence)
    if (!event?.audioRunRef || !event.audioRunSha256 || !entry.artifactDir) throw CLIUsageError('Completed comic target audio run is not checksum-bound.')
    return { targetKey: entry.targetKey, renderIdentity: entry.renderIdentity, audioRunId: entry.audioRunId, audioRunRef: `${entry.artifactDir}/${event.audioRunRef}`, audioRunSha256: event.audioRunSha256 }
  })
  let finalOutputRefs = await Promise.all(completedMetadata.map(async entry => {
    const path = entry.audioFileName
    return { path, sha256: sha256Bytes(new Uint8Array(await Bun.file(join(compatible.sceneRunDir, path)).arrayBuffer())) }
  }))
  let selectedSoundscapeRuns = compatible.comicMetadata.audio.selectedSoundscapeRuns ?? []
  let soundscapeArtifactRefs: Array<{ path: string, sha256: string }> = []
  let soundscapeMetadata: Pick<NonNullable<typeof compatible.comicMetadata.audio>, 'soundEffectRenderPlanRef' | 'soundEffectRenderResultRef'> = {}
  let soundscapeRequiredFailure = false
  if (soundEffectRenderPlan && completedMetadata.length > 0) {
    const dialogueRuns = selectedAudioRuns.map((run) => {
      const entry = completedMetadata.find(candidate => candidate.targetKey === run.targetKey)
      if (!entry) throw CLIUsageError(`Selected dialogue AudioRun ${run.audioRunId} has no completed target metadata.`)
      return { targetKey: run.targetKey, renderIdentity: run.renderIdentity, audioRunId: run.audioRunId, audioRunRef: run.audioRunRef, audioRunSha256: run.audioRunSha256, reportedOutputPath: soundscapeReportedOutputPath(run.targetKey) }
    })
    const soundscape = await runComicSoundscape({
      rootDir: compatible.sceneRunDir,
      plan: soundscapePlan,
      renderPlan: soundEffectRenderPlan,
      dialoguePlan,
      dialogueRuns,
      concurrency: sfxConcurrency,
      hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator,
    })
    await appendComicAudioProviderState({ sceneRunDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, targetKeys: stageTargetKeys, state: soundscape.providerState })
    soundscapeMetadata = { ...(soundscape.renderPlanRef ? { soundEffectRenderPlanRef: soundscape.renderPlanRef } : {}), soundEffectRenderResultRef: soundscape.renderResultRef }
    soundscapeRequiredFailure = soundscape.providerState.status !== 'succeeded'
    if (!soundscapeRequiredFailure) {
      const runByTarget = new Map(selectedSoundscapeRuns.map(run => [run.targetKey, run] as const))
      for (const run of soundscape.soundscapeRuns) runByTarget.set(run.binding.targetKey, {
        targetKey: run.binding.targetKey,
        dialogueAudioRunId: run.binding.audioRunId,
        soundscapeAudioRunId: run.mix.mixId,
        audioRunRef: run.ref.path,
        audioRunSha256: run.ref.sha256,
        masterRef: { path: run.mix.master.path, sha256: run.mix.master.sha256 },
      })
      selectedSoundscapeRuns = [...runByTarget.values()].sort((left, right) => left.targetKey.localeCompare(right.targetKey))
      const masterByTarget = new Map(soundscape.soundscapeRuns.map(run => [run.binding.targetKey, { master: run.mix.master, path: run.binding.reportedOutputPath }] as const))
      finalOutputRefs = completedMetadata.map((entry) => {
        const soundscapeOutput = entry.targetKey ? masterByTarget.get(entry.targetKey) : undefined
        return soundscapeOutput ? { path: soundscapeOutput.path, sha256: soundscapeOutput.master.sha256 } : { path: entry.audioFileName, sha256: finalOutputRefs.find(ref => ref.path === entry.audioFileName)?.sha256 ?? '' }
      })
    }
    const runByMixedTarget = new Map(soundscape.soundscapeRuns.map(run => [run.binding.targetKey, run] as const))
    const retainedSoundscapeRefs: Array<{ path: string, sha256: string }> = []
    for (const binding of selectedSoundscapeRuns) {
      retainedSoundscapeRefs.push({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, binding.masterRef)
      const mixed = runByMixedTarget.get(binding.targetKey)
      if (mixed) {
        retainedSoundscapeRefs.push(...soundscapeAudioRunLineageRefs(mixed.mix))
        continue
      }
      const stored = await readContainedArtifactFile(compatible.sceneRunDir, binding.audioRunRef)
      if (stored.sha256 !== binding.audioRunSha256) throw CLIUsageError(`Retained soundscape mix checksum is stale: ${binding.audioRunRef}`)
      retainedSoundscapeRefs.push(...soundscapeAudioRunLineageRefs(JSON.parse(stored.bytes.toString('utf8')) as CompactMix))
    }
    soundscapeArtifactRefs = [soundscape.planRef, ...(soundscape.renderPlanRef ? [soundscape.renderPlanRef] : []), soundscape.renderResultRef, ...retainedSoundscapeRefs]
  }
  const selectedRunByTarget = new Map((compatible.comicMetadata.audio.selectedAudioRuns ?? []).map(run => [run.targetKey, run] as const))
  for (const run of selectedAudioRuns) selectedRunByTarget.set(run.targetKey, run)
  const mergedSelectedAudioRuns = [...selectedRunByTarget.values()].sort((left, right) => left.targetKey.localeCompare(right.targetKey))
  const finalOutputByPath = new Map((compatible.comicMetadata.audio.finalOutputRefs ?? []).map(ref => [ref.path, ref] as const))
  for (const ref of finalOutputRefs) finalOutputByPath.set(ref.path, ref)
  const mergedFinalOutputRefs = [...finalOutputByPath.values()].sort((left, right) => left.path.localeCompare(right.path))
  const nextEvaluation = completedMetadata.map(entry => ({
    ttsService: entry.ttsService,
    ttsModel: entry.ttsModel,
    ...(entry.speaker ? { speaker: entry.speaker } : {}),
    ...(entry.language ? { language: entry.language } : {}),
    processingTime: entry.processingTime,
    audioFileName: entry.audioFileName,
    audioFileSize: entry.audioFileSize,
    chunkCount: entry.chunkCount,
  }))
  const evaluationByTarget = new Map<string, Step4Metadata>()
  const priorEvaluation = compatible.manifest.items[0]?.metadata['tts']
  if (Array.isArray(priorEvaluation)) for (const entry of priorEvaluation as Step4Metadata[]) evaluationByTarget.set(`${entry.ttsService}\0${entry.ttsModel}`, entry)
  for (const entry of nextEvaluation) evaluationByTarget.set(`${entry.ttsService}\0${entry.ttsModel}`, entry)
  const currentManifest = await readManifest(compatible.sceneRunDir)
  const currentProviders = currentManifest?.items[0]?.providers ?? []
  const finalStageStatus = providerStageStatus(stageTargetKeys, currentProviders)
  const completeEvaluation = [...evaluationByTarget.values()].filter(entry => currentProviders.some(provider => provider.targetKey && stageTargetKeys.includes(provider.targetKey) && provider.service === entry.ttsService && provider.model === entry.ttsModel && provider.status === 'succeeded'))
  const artifactRefByPath = new Map([...compatible.comicMetadata.stages.audio.artifactRefs, ...stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [...mergedSelectedAudioRuns.map(run => ({ path: run.audioRunRef, sha256: run.audioRunSha256 })), ...mergedFinalOutputRefs, ...soundscapeArtifactRefs] })].map(ref => [ref.path, ref] as const))
  await bindSnapshotRenderIdentities(compatible.sceneRunDir, snapshot.snapshotId, metadata.flatMap(entry => entry.renderIdentity ? [entry.renderIdentity] : []))
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: { requirement: 'required', status: finalStageStatus, execution: { kind: 'provider-targets' }, targetKeys: stageTargetKeys as [string, ...string[]], artifactRefs: [...artifactRefByPath.values()] },
    audio: { ...audioMetadata, ...soundscapeMetadata, selectedAudioRuns: mergedSelectedAudioRuns, selectedSoundscapeRuns, publishedAudioRunId: stageTargetKeys.length === 1 && mergedSelectedAudioRuns.length === 1 ? mergedSelectedAudioRuns[0]?.audioRunId : undefined, finalOutputRefs: mergedFinalOutputRefs },
    ttsEvaluation: completeEvaluation,
  })

  return {
    checkpoints,
    finalStageStatus,
    soundscapeRequiredFailure,
  }
}
