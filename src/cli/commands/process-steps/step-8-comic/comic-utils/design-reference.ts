import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import type { DesignReferenceSnapshotManifest, PanelPrimaryReferenceInput, ResolvedDesignReference, SceneDesignReference } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getDesignReferencesDirectory, getSceneAssetsDirectory, getSceneWorkspaceDirectoryForPanelPrompt } from './project-paths'
import { atomicWriteJson } from '~/utils/filesystem'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const DesignReferenceSnapshotItemSchema = v.strictObject({ key: v.string(), usage: v.string(), sourcePath: v.string(), path: v.string(), sha256: v.string() })
export const DesignReferenceSnapshotManifestSchema = v.strictObject({ schemaVersion: v.literal(1), snapshotId: v.string(), createdAt: v.string(), designs: v.array(DesignReferenceSnapshotItemSchema) })

const getDesignReferenceManifestPath = (runDirectory: string): string => join(getSceneAssetsDirectory(runDirectory), 'design-references.json')

const checksum = async (path: string): Promise<string> => createHash('sha256').update(Buffer.from(await Bun.file(path).arrayBuffer())).digest('hex')
const resolveSafeSource = (sourcePath: string): string => {
  if (!sourcePath.startsWith('input/') || sourcePath.includes('\\') || sourcePath.split('/').includes('..')) throw ValidationError(`Unsafe design reference source path "${sourcePath}"`, { stage: 'comic:design-reference' })
  const projectRoot = resolve(process.cwd())
  const absolute = resolve(projectRoot, sourcePath)
  if (!absolute.startsWith(`${projectRoot}${sep}`)) throw ValidationError(`Unsafe design reference source path "${sourcePath}"`, { stage: 'comic:design-reference' })
  return absolute
}

export const createDesignReferenceSnapshot = async (runDirectory: string, references: SceneDesignReference[]): Promise<DesignReferenceSnapshotManifest | undefined> => {
  const byKey = new Map<string, SceneDesignReference>()
  for (const reference of references) {
    const prior = byKey.get(reference.key)
    if (prior && (prior.sourcePath !== reference.sourcePath || prior.usage !== reference.usage)) throw ValidationError(`Design reference key "${reference.key}" has conflicting source paths or usage`, { stage: 'comic:design-reference' })
    byKey.set(reference.key, reference)
  }
  if (byKey.size === 0) return undefined
  const prepared = await Promise.all([...byKey.values()].map(async reference => {
    const source = resolveSafeSource(reference.sourcePath)
    if (!(await Bun.file(source).exists())) throw InfraError(`Design reference source is missing: ${reference.sourcePath}`, { stage: 'comic:design-reference' })
    return { reference, source }
  }))
  const snapshotId = `${Date.now()}-${createHash('sha256').update(`${[...byKey.keys()].join(',')}:${randomUUID()}`).digest('hex').slice(0, 12)}`
  const designs: DesignReferenceSnapshotManifest['designs'] = []
  for (const { reference, source } of prepared) {
    const destination = join(getDesignReferencesDirectory(runDirectory), snapshotId, `${reference.key}${extname(source).toLowerCase()}`)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
    designs.push({ key: reference.key, usage: reference.usage, sourcePath: reference.sourcePath, path: relative(runDirectory, destination).replace(/\\/g, '/'), sha256: await checksum(destination) })
  }
  const manifest: DesignReferenceSnapshotManifest = { schemaVersion: 1, snapshotId, createdAt: new Date().toISOString(), designs }
  await atomicWriteJson(getDesignReferenceManifestPath(runDirectory), manifest)
  return manifest
}

export const resolveDesignReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[]): ResolvedDesignReference[] => {
  const requested = panels.flatMap(input => input.bundleData.panels.flatMap(panel => panel.designReferenceKeys ?? []))
  if (requested.length === 0) return []
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  const snapshotIds = new Set(panels.flatMap(input => input.bundleData.panels.flatMap(panel => panel.designReferenceKeys?.length ? [panel.designSnapshotId] : [])))
  if (runDirectories.size !== 1 || snapshotIds.size !== 1 || snapshotIds.has(undefined)) throw ValidationError('Mixed or missing design reference snapshot IDs are not allowed in one image request', { stage: 'comic:design-reference' })
  const runDirectory = [...runDirectories][0]!
  const path = getDesignReferenceManifestPath(runDirectory)
  if (!existsSync(path)) throw InfraError('Missing design-references.json. Rebuild panel prompts.', { stage: 'comic:design-reference' })
  const manifest = v.parse(DesignReferenceSnapshotManifestSchema, JSON.parse(readFileSync(path, 'utf8')))
  if (manifest.snapshotId !== [...snapshotIds][0]) throw ValidationError('Panel design snapshot does not match design-references.json', { stage: 'comic:design-reference' })
  const byKey = new Map(manifest.designs.map(design => [design.key, design]))
  const ordered: ResolvedDesignReference[] = []
  const seen = new Set<string>()
  for (const key of requested) {
    if (seen.has(key)) continue
    const design = byKey.get(key)
    if (!design || !SHA256_PATTERN.test(design.sha256)) throw ValidationError(`Design reference key "${key}" does not match its manifest entry`, { stage: 'comic:design-reference' })
    const asset = resolve(runDirectory, design.path)
    const rel = relative(resolve(runDirectory), asset)
    if (rel.startsWith('..') || rel === '') throw ValidationError(`Unsafe design snapshot path "${design.path}"`, { stage: 'comic:design-reference' })
    if (!existsSync(asset)) throw InfraError(`Design snapshot asset is missing: ${design.path}`, { stage: 'comic:design-reference' })
    const actual = createHash('sha256').update(readFileSync(asset)).digest('hex')
    if (actual !== design.sha256) throw ValidationError(`Design snapshot asset was modified: ${design.path}`, { stage: 'comic:design-reference' })
    seen.add(key)
    ordered.push({ key, usage: design.usage, path: asset })
  }
  return ordered
}
