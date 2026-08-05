import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, rename } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogService, CharacterKey } from '~/types'
import { checksumFile, requireCurrentCharacterSketch } from '../comic-commands/process-scenes/character-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { resolveCharacterIdentityReferences } from './character-identity-card'
import { getCharacterReferencesDirectory, getSceneAssetsDirectory } from './project-paths'

const SnapshotAssetSchema = v.strictObject({
  role: v.picklist(['sketch-sheet', 'source-image']),
  path: v.string(),
  sha256: v.string(),
})
const SnapshotCharacterSchema = v.strictObject({
  key: v.string(), name: v.string(), description: v.string(), sourceSketchVersion: v.string(), assets: v.array(SnapshotAssetSchema),
})
export const CharacterReferenceManifestSchema = v.strictObject({
  schemaVersion: v.literal(2), snapshotId: v.string(), catalogHash: v.string(), createdAt: v.string(), characters: v.array(SnapshotCharacterSchema),
})
export type CharacterReferenceManifest = v.InferOutput<typeof CharacterReferenceManifestSchema>

export const getCharacterReferenceManifestPath = (runDirectory: string): string => join(getSceneAssetsDirectory(runDirectory), 'character-references.json')

const atomicWriteJson = async (path: string, value: unknown): Promise<void> => {
  const temp = `${path}.tmp-${randomUUID()}`
  await Bun.write(temp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temp, path)
}

export const createCharacterReferenceSnapshot = async (
  runDirectory: string,
  visibleKeys: readonly CharacterKey[],
  catalog: CharacterCatalogService,
): Promise<CharacterReferenceManifest> => {
  const uniqueKeys = Array.from(new Set(visibleKeys))
  const preparedResults = await Promise.allSettled(uniqueKeys.map(async key => {
    const character = catalog.get(key)
    const registration = await requireCurrentCharacterSketch(key, character)
    return { character, registration }
  }))
  const blockers = preparedResults.flatMap((result, index) => result.status === 'rejected'
    ? [`${uniqueKeys[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
    : [])
  if (blockers.length > 0) {
    throw ValidationError(
      `Character reference snapshot cannot be created. Missing or stale visible characters:\n- ${blockers.join('\n- ')}`,
      { stage: 'comic:reference-snapshot' }
    )
  }
  const prepared = preparedResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])

  const snapshotId = `${Date.now()}-${createHash('sha256').update(`${catalog.hash}:${uniqueKeys.join(',')}:${randomUUID()}`).digest('hex').slice(0, 12)}`
  const snapshotRoot = join(getCharacterReferencesDirectory(runDirectory), snapshotId)
  const characters: CharacterReferenceManifest['characters'] = []

  for (const { character, registration } of prepared) {
    const characterDirectory = join(snapshotRoot, character.key)
    await mkdir(characterDirectory, { recursive: true })
    const usesSingleReference = resolve(character.sourcePath) === resolve(character.outlineSheetPath)
    const sheetDestination = usesSingleReference
      ? join(characterDirectory, `reference${extname(character.sourcePath).toLowerCase()}`)
      : join(characterDirectory, 'sketch-sheet.png')
    const sourceDestination = usesSingleReference
      ? sheetDestination
      : join(characterDirectory, `source${extname(character.sourcePath).toLowerCase()}`)
    await copyFile(character.outlineSheetPath, sheetDestination)
    if (!usesSingleReference) await copyFile(character.sourcePath, sourceDestination)
    const sheetSha256 = await checksumFile(sheetDestination)
    const sourceSha256 = usesSingleReference ? sheetSha256 : await checksumFile(sourceDestination)
    characters.push({
      key: character.key,
      name: character.name,
      description: character.description,
      sourceSketchVersion: registration.generationId,
      assets: [
        { role: 'sketch-sheet', path: relative(runDirectory, sheetDestination).replace(/\\/g, '/'), sha256: sheetSha256 },
        { role: 'source-image', path: relative(runDirectory, sourceDestination).replace(/\\/g, '/'), sha256: sourceSha256 },
      ],
    })
  }

  const manifest: CharacterReferenceManifest = {
    schemaVersion: 2, snapshotId, catalogHash: catalog.hash, createdAt: new Date().toISOString(), characters,
  }
  await mkdir(dirname(getCharacterReferenceManifestPath(runDirectory)), { recursive: true })
  await atomicWriteJson(getCharacterReferenceManifestPath(runDirectory), manifest)
  return manifest
}

export const loadAndVerifyCharacterReferenceSnapshot = async (
  runDirectory: string,
  expectedSnapshotId?: string,
): Promise<CharacterReferenceManifest> => {
  const path = getCharacterReferenceManifestPath(runDirectory)
  if (!(await Bun.file(path).exists())) {
    throw InfraError(`Missing ${basename(path)}. Rebuild panel prompts; legacy panel bundles are not supported.`, { stage: 'comic:reference-snapshot' })
  }
  let manifest: CharacterReferenceManifest
  try {
    manifest = v.parse(CharacterReferenceManifestSchema, JSON.parse(await Bun.file(path).text()))
  } catch (error) {
    throw ValidationError(`Invalid character reference manifest at ${path}. Rebuild panel prompts with schemaVersion 2.`, { stage: 'comic:reference-snapshot', cause: error instanceof Error ? error : undefined })
  }
  if (expectedSnapshotId && manifest.snapshotId !== expectedSnapshotId) {
    throw ValidationError(`Panel bundle snapshot ${expectedSnapshotId} does not match manifest snapshot ${manifest.snapshotId}. Rebuild the mixed/stale panel prompts.`, { stage: 'comic:reference-snapshot' })
  }
  for (const character of manifest.characters) {
    for (const asset of character.assets) {
      const assetPath = resolve(runDirectory, asset.path)
      const rel = relative(resolve(runDirectory), assetPath)
      if (rel.startsWith('..') || rel === '') throw ValidationError(`Unsafe snapshot asset path "${asset.path}"`, { stage: 'comic:reference-snapshot' })
      if (!(await Bun.file(assetPath).exists())) throw InfraError(`Snapshot asset is missing: ${asset.path}`, { stage: 'comic:reference-snapshot' })
      const checksum = await checksumFile(assetPath)
      if (checksum !== asset.sha256) throw ValidationError(`Snapshot asset was modified or corrupted: ${asset.path}`, { stage: 'comic:reference-snapshot' })
    }
  }
  return manifest
}

export const compileCharacterReferences = (
  runDirectory: string,
  manifest: CharacterReferenceManifest,
  characterKeys: readonly string[],
  options: { composeDerived?: boolean } = {},
): string[] => {
  return resolveCharacterIdentityReferences(runDirectory, manifest, characterKeys, {
    compose: options.composeDerived !== false,
  }).map(reference => reference.path)
}
