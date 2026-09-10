import { readdir } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { CanonicalComicItemMetadata, ComicRecoveryFlags, ComicRecoveryInput, ComicRecoveryIntent, ComicRecoveryStage, ComicSourceIdentity } from '~/types'
import { getCharactersRoot } from '../../characters-root'
import { readManifest, updateManifest } from '../../pipeline-manifest'
import { aggregateComicStageStatus } from '../../pipeline-manifest/comic-stage-status'
import { canonicalTtsJson, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { readContainedArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { UsageError } from '~/utils/error-handler'

export const captureComicRecoveryInputs = async (rootDir: string, paths: readonly string[]): Promise<ComicRecoveryInput[]> => {
  const refs: ComicRecoveryInput[] = []
  const visit = async (path: string): Promise<void> => {
    const entries = await readdir(path, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOTDIR') return undefined
      throw error
    })
    if (entries) {
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) throw UsageError(`Comic recovery inputs cannot contain symbolic links: ${join(path, entry.name)}`)
        await visit(join(path, entry.name))
      }
      return
    }
    const rel = relative(rootDir, path)
    refs.push({ path: rel.startsWith('..') || isAbsolute(rel) ? resolve(path) : rel.replace(/\\/gu, '/'), sha256: sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer())) })
  }
  for (const path of paths) await visit(isAbsolute(path) ? path : join(rootDir, path))
  return [...new Map(refs.map(ref => [ref.path, ref])).values()].sort((a, b) => a.path.localeCompare(b.path))
}

export const validateComicRecoveryInputs = async (rootDir: string, intent: ComicRecoveryIntent): Promise<void> => {
  for (const ref of intent.inputs) {
    const observed = isAbsolute(ref.path)
      ? sha256Bytes(new Uint8Array(await Bun.file(ref.path).arrayBuffer()))
      : (await readContainedArtifactFile(rootDir, ref.path)).sha256
    if (observed !== ref.sha256) throw UsageError(`Comic recovery input changed: ${ref.path}. Use the explicit comic stage command to review the changed inputs; retained outputs were preserved.`)
  }
}

export const recordComicRecoveryIntent = async (input: {
  rootDir: string
  sourceIdentity: ComicSourceIdentity
  stage: ComicRecoveryStage
  flags: ComicRecoveryFlags
  inputs: ComicRecoveryInput[]
  planHash: string
  afterAudio?: string | undefined
  imageRunId?: string | undefined
}, additional: Array<Omit<typeof input, 'rootDir' | 'sourceIdentity'>> = []): Promise<void> => {
  await updateManifest(input.rootDir, manifest => {
    if (manifest.command !== 'comic' || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw UsageError('Comic recovery intent requires the exact canonical scene source.')
    const item = manifest.items[0]!
    const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
    const stages = { ...comic.stages }
    const recovery = { ...comic.recovery }
    for (const request of [input, ...additional]) {
      const intent: ComicRecoveryIntent = { schemaVersion: 1, flags: request.flags, inputs: request.inputs, planHash: request.planHash, charactersRoot: resolve(getCharactersRoot()), ...(request.afterAudio ? { afterAudio: request.afterAudio } : {}), ...(request.imageRunId ? { imageRunId: request.imageRunId } : {}), completed: false }
      recovery[request.stage] = intent
      if (stages[request.stage].requirement === 'not-requested') {
        stages[request.stage] = { requirement: request.stage === 'presentation' ? 'optional' : 'required', status: 'incomplete', execution: { kind: 'local', state: 'missing' }, targetKeys: [], artifactRefs: [] }
      }
    }
    const required = Object.values(stages).filter(stage => stage.requirement === 'required')
    const status = aggregateComicStageStatus(required)
    return { ...manifest, items: [{ ...item, status, metadata: { ...item.metadata, comic: { ...comic, stages, recovery } } as never }] }
  })
}

export const completeComicRecoveryIntent = async (rootDir: string, stage: ComicRecoveryStage, planHash: string): Promise<void> => {
  const current = await readManifest(rootDir)
  const currentComic = current?.items[0]?.metadata['comic'] as CanonicalComicItemMetadata | undefined
  if (!currentComic?.recovery?.[stage] || currentComic.recovery[stage]?.completed || !['full', 'skipped'].includes(currentComic.stages[stage].status)) return
  if (currentComic.recovery[stage]?.planHash !== planHash) throw UsageError(`Comic ${stage} recovery intent changed during execution; inspect the retained run before continuing.`)
  await updateManifest(rootDir, manifest => {
    const item = manifest.items[0]!
    const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
    const intent = comic.recovery?.[stage]
    if (!intent || intent.completed || !['full', 'skipped'].includes(comic.stages[stage].status)) return manifest
    if (intent.planHash !== planHash) throw UsageError(`Comic ${stage} recovery intent changed during execution; inspect the retained run before continuing.`)
    return { ...manifest, items: [{ ...item, metadata: { ...item.metadata, comic: { ...comic, recovery: { ...comic.recovery, [stage]: { ...intent, completed: true } } } } as never }] }
  })
}
