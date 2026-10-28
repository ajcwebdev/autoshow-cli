import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import type { DesignReferenceSnapshotManifest, PanelPrimaryReferenceInput, ResolvedDesignReference, SceneDesignReference } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getSceneWorkspaceDirectoryForPanelPrompt } from './project-paths'

const DesignReferenceSnapshotItemSchema = v.strictObject({ key: v.string(), usage: v.string(), sourcePath: v.string(), path: v.string(), sha256: v.string() })
export const DesignReferenceSnapshotManifestSchema = v.strictObject({ schemaVersion: v.literal(1), snapshotId: v.string(), createdAt: v.string(), designs: v.array(DesignReferenceSnapshotItemSchema) })

const checksum = (path: string): string => new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex')

const isWithin = (root: string, path: string): boolean => {
  const rel = relative(root, path)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

// Design mappings are authored project paths, never run-local materializations.
const resolveSafeSource = (sourcePath: string): string => {
  if (!sourcePath.startsWith('input/') || sourcePath.includes('\\') || sourcePath.split('/').some(part => part === '..' || part === '.' || part === '') || !['.png', '.webp', '.jpg', '.jpeg'].includes(extname(sourcePath).toLowerCase())) throw ValidationError(`Unsafe design reference source path "${sourcePath}"`, { stage: 'comic:design-reference' })
  const projectRoot = resolve(process.cwd())
  const inputRoot = resolve(projectRoot, 'input')
  const absolute = resolve(projectRoot, sourcePath)
  if (!isWithin(inputRoot, absolute)) throw ValidationError(`Unsafe design reference source path "${sourcePath}"`, { stage: 'comic:design-reference' })
  if (!existsSync(absolute)) throw InfraError(`Design reference source is missing: ${sourcePath}`, { stage: 'comic:design-reference' })
  const realInputRoot = realpathSync(inputRoot)
  const realSource = realpathSync(absolute)
  if (!isWithin(projectRoot, realInputRoot) || !isWithin(realInputRoot, realSource) || !statSync(realSource).isFile()) throw ValidationError(`Unsafe design reference source path "${sourcePath}"`, { stage: 'comic:design-reference' })
  return absolute
}

const uniqueDesignReferences = (references: SceneDesignReference[]): SceneDesignReference[] => {
  const byKey = new Map<string, SceneDesignReference>()
  for (const reference of references) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reference.key) || !reference.usage.trim()) throw ValidationError(`Invalid design reference key or usage for "${reference.key}"`, { stage: 'comic:design-reference' })
    const prior = byKey.get(reference.key)
    if (prior && (prior.sourcePath !== reference.sourcePath || prior.usage !== reference.usage)) throw ValidationError(`Design reference key "${reference.key}" has conflicting source paths or usage`, { stage: 'comic:design-reference' })
    byKey.set(reference.key, reference)
  }
  return [...byKey.values()]
}

// Kept as an API-compatible descriptor builder; no snapshot files are created.
export const createDesignReferenceSnapshot = async (runDirectory: string, references: SceneDesignReference[]): Promise<DesignReferenceSnapshotManifest | undefined> => {
  const unique = uniqueDesignReferences(references)
  if (unique.length === 0) return undefined
  const designs = unique.map(reference => {
    const source = resolveSafeSource(reference.sourcePath)
    return { ...reference, path: relative(runDirectory, source).replace(/\\/g, '/'), sha256: checksum(source) }
  })
  return { schemaVersion: 1, snapshotId: 'live', createdAt: new Date().toISOString(), designs }
}

export const resolveDesignReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[]): ResolvedDesignReference[] => {
  const authored = panels.flatMap(input => input.bundleData.panels.flatMap(panel => {
    if (!panel.designReferences?.length && panel.designReferenceKeys?.length) throw ValidationError('Panel design references need canonical source mappings in designReferences. Rebuild panel prompts.', { stage: 'comic:design-reference' })
    return panel.designReferences ?? []
  }))
  if (authored.length === 0) return []
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  if (runDirectories.size !== 1) throw ValidationError('Mixed run directories are not allowed in one image request', { stage: 'comic:design-reference' })
  return uniqueDesignReferences(authored).map(reference => {
    const path = resolveSafeSource(reference.sourcePath)
    return { key: reference.key, usage: reference.usage, path, sha256: checksum(path) }
  })
}
