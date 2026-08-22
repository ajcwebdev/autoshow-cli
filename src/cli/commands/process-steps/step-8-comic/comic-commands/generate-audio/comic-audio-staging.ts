import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  PipelineProviderState,
  StagedComicAudioArtifacts,
  StructuredScriptArtifactRef,
  VoiceReferenceManifest,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import type { createComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import { writeComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import type { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { updateComicAudioManifest } from '../../comic-utils/comic-manifest'
import type { loadVoiceReferenceManifest } from '../../comic-utils/voice-reference-snapshot'
import { writeVoiceReferenceManifest } from '../../comic-utils/voice-reference-snapshot'
import type { createSoundscapePlan } from '../../../step-4-tts/soundscape/soundscape-planner'
import { writeSoundscapePlan } from '../../../step-4-tts/soundscape/soundscape-planner'
import { soundscapeAudioRunLineageRefs } from '../../comic-utils/comic-artifact-lineage-audit'
import {
  assertComicSoundscapeExecutionReady,
  createLocalSilentDialogueRun,
  runComicSoundscape,
} from '../../comic-utils/comic-soundscape-workflow'

export const stageArtifactRefs = (input: {
  structured: { path: string, sha256: string }
  dialogue: { path: string, sha256: string }
  snapshot?: { path: string, sha256: string } | undefined
  extra?: Array<{ path: string, sha256: string }> | undefined
}) => [
  { path: input.structured.path, sha256: input.structured.sha256 },
  { path: input.dialogue.path, sha256: input.dialogue.sha256 },
  ...(input.snapshot ? [{ path: input.snapshot.path, sha256: input.snapshot.sha256 }] : []),
  ...(input.extra ?? []).map(ref => ({ path: ref.path, sha256: ref.sha256 })),
]

export const providerStageStatus = (targetKeys: readonly string[], states: readonly PipelineProviderState[]): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  const owned = targetKeys.map(targetKey => states.find(state => state.targetKey === targetKey))
  if (owned.some(state => !state)) return 'incomplete'
  const selected = owned as PipelineProviderState[]
  if (selected.every(state => state.status === 'skipped')) return 'skipped'
  if (selected.some(state => state.status === 'succeeded') && selected.every(state => state.status === 'succeeded' || state.status === 'skipped')) return 'full'
  if (selected.some(state => state.status === 'failed') && selected.every(state => state.status === 'failed' || state.status === 'skipped')) return 'failed'
  return 'incomplete'
}

export const executeZeroTurnsWithoutSoundscape = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  soundscapePlan: ReturnType<typeof createSoundscapePlan>
  structuredRef: StructuredScriptArtifactRef
}): Promise<void> => {
  const { compatible, dialoguePlan, soundscapePlan, structuredRef } = input
  const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
  const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: {
      requirement: 'required',
      status: 'full',
      execution: { kind: 'local', state: 'succeeded' },
      targetKeys: [],
      artifactRefs: stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, extra: [soundscapePlanRef] }),
    },
    audio: {
      sceneRunIdentity: dialoguePlan.sceneRunIdentity,
      structuredScript: structuredRef,
      dialoguePlanId: dialoguePlan.dialoguePlanId,
      dialoguePlanRef: dialogueRef,
      soundscapePlanId: soundscapePlan.soundscapePlanId,
      soundscapePlanRef,
    },
    providers: [],
  })
}

export const executeZeroTurnsWithSoundscape = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  soundscapePlan: ReturnType<typeof createSoundscapePlan>
  soundEffectRenderPlan: NonNullable<Parameters<typeof assertComicSoundscapeExecutionReady>[1]>
  structuredRef: StructuredScriptArtifactRef
  sfxConcurrency: number
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
}): Promise<void> => {
  const { compatible, dialoguePlan, soundscapePlan, soundEffectRenderPlan, structuredRef, sfxConcurrency, hostedConcurrencyCoordinator } = input
  await assertComicSoundscapeExecutionReady(compatible.sceneRunDir, soundEffectRenderPlan)
  const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
  const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
  const silent = await createLocalSilentDialogueRun({ rootDir: compatible.sceneRunDir, plan: soundscapePlan })
  await mkdir(join(compatible.sceneRunDir, 'audio', 'final'), { recursive: true })
  const soundscape = await runComicSoundscape({
    rootDir: compatible.sceneRunDir,
    plan: soundscapePlan,
    renderPlan: soundEffectRenderPlan,
    dialoguePlan,
    dialogueRuns: [silent.binding],
    concurrency: sfxConcurrency,
    hostedConcurrencyCoordinator,
  })
  const run = soundscape.soundscapeRuns[0]
  const nextArtifacts = stageArtifactRefs({
    structured: structuredRef,
    dialogue: dialogueRef,
    extra: [
      soundscapePlanRef,
      ...silent.refs,
      ...(soundscape.renderPlanRef ? [soundscape.renderPlanRef] : []),
      soundscape.renderResultRef,
      ...(run ? [run.ref, ...soundscapeAudioRunLineageRefs(run.mix)] : [])
    ]
  })
  const artifacts = [...new Map([...compatible.comicMetadata.stages.audio.artifactRefs, ...nextArtifacts].map(ref => [ref.path, ref] as const)).values()]
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: {
      requirement: 'required',
      status: soundscape.providerState.status === 'succeeded' ? 'full' : 'failed',
      execution: { kind: 'provider-targets' },
      targetKeys: [soundEffectRenderPlan.target.targetKey],
      artifactRefs: artifacts
    },
    audio: {
      ...compatible.comicMetadata.audio,
      sceneRunIdentity: dialoguePlan.sceneRunIdentity,
      structuredScript: structuredRef,
      dialoguePlanId: dialoguePlan.dialoguePlanId,
      dialoguePlanRef: dialogueRef,
      soundscapePlanId: soundscapePlan.soundscapePlanId,
      soundscapePlanRef,
      ...(soundscape.renderPlanRef ? { soundEffectRenderPlanRef: soundscape.renderPlanRef } : {}),
      soundEffectRenderResultRef: soundscape.renderResultRef,
      selectedAudioRuns: [{ targetKey: silent.binding.targetKey, renderIdentity: silent.binding.renderIdentity, audioRunId: silent.binding.audioRunId, audioRunRef: silent.binding.audioRunRef, audioRunSha256: silent.binding.audioRunSha256 }],
      ...(run ? { selectedSoundscapeRuns: [{ targetKey: silent.binding.targetKey, dialogueAudioRunId: silent.binding.audioRunId, soundscapeAudioRunId: run.mix.mixId, audioRunRef: run.ref.path, audioRunSha256: run.ref.sha256, masterRef: { path: run.mix.master.path, sha256: run.mix.master.sha256 } }], publishedAudioRunId: run.mix.mixId, finalOutputRefs: [{ path: silent.binding.reportedOutputPath, sha256: run.mix.master.sha256 }] } : {}),
    },
    providers: [soundscape.providerState],
  })
  if (soundscape.providerState.status !== 'succeeded') throw UsageError('Comic soundscape failed one or more required cues; generated artifacts were retained but no master was published.')
}

export const stageComicAudioArtifacts = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  soundscapePlan: ReturnType<typeof createSoundscapePlan>
  soundEffectRenderPlan?: Parameters<typeof assertComicSoundscapeExecutionReady>[1] | undefined
  snapshot: VoiceReferenceManifest
  retainedSnapshot?: Awaited<ReturnType<typeof loadVoiceReferenceManifest>> | undefined
  structuredRef: StructuredScriptArtifactRef
}): Promise<StagedComicAudioArtifacts> => {
  const { compatible, dialoguePlan, soundscapePlan, soundEffectRenderPlan, snapshot, retainedSnapshot, structuredRef } = input
  if (soundEffectRenderPlan) await assertComicSoundscapeExecutionReady(compatible.sceneRunDir, soundEffectRenderPlan)

  const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
  const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
  const snapshotRef = retainedSnapshot?.ref ?? await writeVoiceReferenceManifest(compatible.sceneRunDir, snapshot)
  const baseArtifacts = stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [soundscapePlanRef] })
  const audioMetadata = {
    ...compatible.comicMetadata.audio,
    dialoguePlanId: dialoguePlan.dialoguePlanId,
    dialoguePlanRef: dialogueRef,
    snapshotId: snapshot.snapshotId,
    snapshotRef,
    soundscapePlanId: soundscapePlan.soundscapePlanId,
    soundscapePlanRef,
  }
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: compatible.comicMetadata.stages.audio,
    audio: audioMetadata,
  })
  await mkdir(join(compatible.sceneRunDir, 'audio', 'final'), { recursive: true })

  return {
    dialogueRef,
    soundscapePlanRef,
    snapshotRef,
    baseArtifacts,
    audioMetadata,
  }
}
