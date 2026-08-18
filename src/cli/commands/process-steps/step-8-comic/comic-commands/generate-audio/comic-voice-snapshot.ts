import type { VoiceReferenceManifest } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { resolveCharacterVoiceRegistryPaths } from '../../../step-4-tts/voice-management/character-voice-registry'
import { buildVoiceReferenceManifest, loadVoiceReferenceManifest, type ComicVoiceSnapshotTarget } from '../../comic-utils/voice-reference-snapshot'
import type { createComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import type { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { flattenTurns } from './comic-audio-invocation'

export const assertVoiceSnapshotCoversSelectedTargets = (input: {
  snapshot: VoiceReferenceManifest
  targets: ReadonlyArray<{ service: string, model: string }>
  subjectKeys: readonly string[]
  profileKey: string
}): void => {
  const selectedTargets = new Set(input.targets.map(target => `${target.service}\0${target.model}`))
  const snapshotTargets = new Set(input.snapshot.entries.map((entry: { provider: string, providerModel: string }) => `${entry.provider}\0${entry.providerModel}`))
  const selectedBindings = new Set(input.targets.flatMap(target => input.subjectKeys.map(subjectKey => `${target.service}\0${target.model}\0${input.profileKey}\0${subjectKey}`)))
  const completeSnapshotBindings = new Set([...snapshotTargets].flatMap(target => {
    const [provider, model] = (target as string).split('\0')
    return input.subjectKeys.map(subjectKey => `${provider}\0${model}\0${input.profileKey}\0${subjectKey}`)
  }))
  const snapshotBindings = new Set(input.snapshot.entries.map((entry: { provider: string, providerModel: string, profileKey: string, subjectKey: string }) => `${entry.provider}\0${entry.providerModel}\0${entry.profileKey}\0${entry.subjectKey}`))
  if ([...selectedTargets].some(key => !snapshotTargets.has(key)) || completeSnapshotBindings.size !== input.snapshot.entries.length || snapshotBindings.size !== input.snapshot.entries.length || [...completeSnapshotBindings].some(key => !snapshotBindings.has(key)) || [...selectedBindings].some(key => !snapshotBindings.has(key))) throw CLIUsageError('Retained scene snapshot is not a complete immutable superset of the selected provider/model/profile/subject bindings; start a new canonical scene run for a recast.')
}

export interface ResolvedVoiceSnapshot {
  snapshot: VoiceReferenceManifest
  retainedSnapshot: Awaited<ReturnType<typeof loadVoiceReferenceManifest>> | undefined
}

export const resolveComicVoiceSnapshot = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  targets: ReadonlyArray<{ service: string, model: string }>
  profileKey: string
}): Promise<ResolvedVoiceSnapshot> => {
  const { compatible, dialoguePlan, targets, profileKey } = input
  const turns = flattenTurns(dialoguePlan)
  const selectedSnapshotId = typeof compatible.comicMetadata.audio.snapshotId === 'string'
    ? compatible.comicMetadata.audio.snapshotId
    : undefined
  const selectedRetainedSnapshot = await loadVoiceReferenceManifest({
    sceneRunDir: compatible.sceneRunDir,
    sceneRunIdentity: dialoguePlan.sceneRunIdentity,
    dialoguePlanId: dialoguePlan.dialoguePlanId,
    ...(selectedSnapshotId ? { snapshotId: selectedSnapshotId } : {})
  })
  const charactersRoot = getCharactersRoot()
  const registryPaths = resolveCharacterVoiceRegistryPaths(charactersRoot)
  const registryPresence = await Promise.all([registryPaths.briefs, registryPaths.registrations, registryPaths.current].map(async path => await Bun.file(path).exists()))
  if (registryPresence.some(Boolean) && !registryPresence.every(Boolean)) throw CLIUsageError('Character voice registry is incomplete; briefs, registrations, and current selections must be present together.')
  const currentSnapshot = registryPresence.every(Boolean) || !selectedRetainedSnapshot
    ? await buildVoiceReferenceManifest({
        charactersRoot,
        dialoguePlan,
        targets: targets.map(target => ({ provider: target.service as ComicVoiceSnapshotTarget['provider'], model: target.model })),
        profileKey,
        createdAt: compatible.manifest.createdAt,
      })
    : undefined
  const retainedSnapshot = currentSnapshot
    ? await loadVoiceReferenceManifest({
        sceneRunDir: compatible.sceneRunDir,
        sceneRunIdentity: dialoguePlan.sceneRunIdentity,
        dialoguePlanId: dialoguePlan.dialoguePlanId,
        snapshotId: currentSnapshot.snapshotId
      })
    : selectedRetainedSnapshot
  const snapshot = retainedSnapshot?.manifest ?? currentSnapshot
  if (!snapshot) throw CLIUsageError('Comic audio requires a retained voice snapshot or a complete character voice registry.')
  const snapshotSubjects = [...new Set(turns.map(turn => turn.subjectKey))]
  assertVoiceSnapshotCoversSelectedTargets({ snapshot, targets, subjectKeys: snapshotSubjects, profileKey })

  return { snapshot, retainedSnapshot }
}
