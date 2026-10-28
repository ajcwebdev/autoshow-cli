import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogEntry, CharacterCatalogService, CharacterKey, CharacterReferenceManifest } from '~/types'
import { requireCurrentCharacterSketchSync } from '../comic-commands/process-scenes/character-utils'
import { ValidationError } from '~/utils/error-handler'
import { resolveCharacterIdentityReferences } from './character-identity-card'
import { loadCharacterCatalog } from './character-reference-config'

const SnapshotAssetSchema = v.strictObject({
  role: v.picklist(['sketch-sheet', 'source-image']),
  path: v.string(),
  sha256: v.string(),
})
const SnapshotCharacterSchema = v.strictObject({
  key: v.string(), name: v.string(), description: v.string(), sourceSketchVersion: v.string(), assets: v.array(SnapshotAssetSchema),
  distinguishFrom: v.optional(v.array(v.strictObject({ characterKey: v.string(), cue: v.string() }))),
})
export const CharacterReferenceManifestSchema = v.strictObject({
  schemaVersion: v.literal(2), snapshotId: v.string(), catalogHash: v.string(), createdAt: v.string(), characters: v.array(SnapshotCharacterSchema),
})

const describeCurrentCharacter = (character: CharacterCatalogEntry): string => {
  if (!character.wardrobe) return character.description
  return [
    character.description,
    `Current canonical wardrobe: ${JSON.stringify(character.wardrobe)}.`,
    'Use a named deviation state only when the reviewed panel explicitly declares that allowed state; otherwise use the current default color tokens. Prohibited wardrobe remains prohibited. Current canonical wardrobe takes precedence over older generic costume or color text in the scene or blocking ledger.',
  ].join('\n')
}

const currentCharacterReferences = (
  runDirectory: string,
  keys: readonly string[],
  catalog: CharacterCatalogService,
): CharacterReferenceManifest => {
  const characters: CharacterReferenceManifest['characters'] = []
  const blockers: string[] = []
  for (const rawKey of new Set(keys)) {
    try {
      const key = catalog.requireKey(rawKey)
      const character = catalog.get(key)
      const registration = requireCurrentCharacterSketchSync(key, character, catalog.root)
      characters.push({
        key, name: character.name, description: describeCurrentCharacter(character),
        distinguishFrom: (character.distinguishFrom ?? []).map(cue => ({ ...cue })),
        sourceSketchVersion: registration.generationId,
        assets: [
          { role: 'sketch-sheet', path: relative(resolve(runDirectory), character.outlineSheetPath).replace(/\\/g, '/'), sha256: registration.sheetSha256 },
          { role: 'source-image', path: relative(resolve(runDirectory), character.sourcePath).replace(/\\/g, '/'), sha256: registration.sourceSha256 },
        ],
      })
    } catch (error) {
      blockers.push(`${rawKey}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (blockers.length > 0) {
    throw ValidationError(`Current character references are unavailable. Missing or stale visible characters:\n- ${blockers.join('\n- ')}`, { stage: 'comic:reference-snapshot' })
  }
  return { schemaVersion: 2, snapshotId: 'live', catalogHash: catalog.hash, createdAt: new Date().toISOString(), characters }
}

/** Compatibility name: returns current canonical references without copying or writing assets. */
export const createCharacterReferenceSnapshot = async (
  runDirectory: string,
  visibleKeys: readonly CharacterKey[],
  catalog: CharacterCatalogService,
): Promise<CharacterReferenceManifest> => currentCharacterReferences(runDirectory, visibleKeys, loadCharacterCatalog(catalog.root, { fresh: true }))

const sceneRosterKeys = (runDirectory: string, catalog: CharacterCatalogService): string[] => {
  const keys: string[] = []
  const scenePath = join(runDirectory, 'metadata', 'scene.json')
  if (existsSync(scenePath)) {
    const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as { panels?: Array<{ characterKeys?: unknown }> }
    for (const panel of scene.panels ?? []) {
      if (!Array.isArray(panel.characterKeys) || panel.characterKeys.some(key => typeof key !== 'string')) {
        throw ValidationError(`Scene panel has invalid character keys at ${scenePath}`, { stage: 'comic:reference-snapshot' })
      }
      keys.push(...panel.characterKeys)
    }
  }
  const planPath = join(runDirectory, 'metadata', 'blocking-plan.json')
  if (existsSync(planPath)) {
    const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { stageStates?: Array<{ characters?: Array<{ characterKey?: string }>; extras?: Array<{ ensembleKey?: string }> }> }
    const catalogKeys = new Set<string>(catalog.characterKeys)
    for (const state of plan.stageStates ?? []) {
      for (const key of [...(state.characters ?? []).map(mark => mark.characterKey), ...(state.extras ?? []).map(extras => extras.ensembleKey)]) {
        if (key && catalogKeys.has(key)) keys.push(key)
      }
    }
  }
  return [...new Set(keys)]
}

/** Old bundle IDs and manifests never pin future generation to historical assets. */
export const loadAndVerifyCharacterReferenceSnapshot = (
  runDirectory: string,
  _expectedSnapshotId?: string,
  explicitKeys: readonly string[] = [],
): CharacterReferenceManifest => {
  const catalog = loadCharacterCatalog(undefined, { fresh: true })
  return currentCharacterReferences(runDirectory, [...sceneRosterKeys(runDirectory, catalog), ...explicitKeys], catalog)
}

export const compileCharacterReferences = (
  runDirectory: string,
  manifest: CharacterReferenceManifest,
  characterKeys: readonly string[],
  options: { composeDerived?: boolean } = {},
): string[] => {
  const current = loadAndVerifyCharacterReferenceSnapshot(runDirectory, undefined, [...manifest.characters.map(character => character.key), ...characterKeys])
  return resolveCharacterIdentityReferences(runDirectory, current, characterKeys, { compose: options.composeDerived !== false }).map(reference => reference.path)
}
