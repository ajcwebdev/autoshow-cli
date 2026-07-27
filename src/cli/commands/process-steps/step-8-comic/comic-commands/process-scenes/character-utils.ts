import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogEntry, CharacterKey, CharacterSketchView } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { InfraError, ValidationError } from '~/utils/error-handler'

export const CHARACTER_SKETCH_VIEWS = ['front', 'three-quarter', 'profile'] as const
export const CHARACTER_SKETCH_MANIFEST_FILENAME = 'character-sketches.json'

const CharacterSketchRegistrationSchema = v.strictObject({
  characterKey: v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  generationId: v.pipe(v.string(), v.minLength(1)),
  origin: v.picklist(['generated', 'revision', 'legacy-import']),
  sourceImage: v.string(),
  outlineSheet: v.string(),
  sourceSha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  sheetSha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  model: v.nullable(v.string()),
  createdAt: v.string(),
  priorGenerationId: v.optional(v.string()),
})

const CharacterSketchManifestSchema = v.strictObject({
  schemaVersion: v.literal(1),
  sketches: v.array(CharacterSketchRegistrationSchema),
})

export type CharacterSketchRegistration = v.InferOutput<typeof CharacterSketchRegistrationSchema>
export type CharacterSketchManifest = v.InferOutput<typeof CharacterSketchManifestSchema>

export const checksumFile = async (path: string): Promise<string> => {
  const hash = createHash('sha256')
  hash.update(Buffer.from(await Bun.file(path).arrayBuffer()))
  return hash.digest('hex')
}

export const getCharacterSketchManifestPath = (charactersRoot = getCharactersRoot()): string =>
  join(charactersRoot, CHARACTER_SKETCH_MANIFEST_FILENAME)

export const getCharacterSketchImagePathForDirectory = (directory: string, view: CharacterSketchView): string =>
  join(directory, `${view}.png`)

export const getCharacterSketchSheetImagePathForDirectory = (directory: string): string => join(directory, 'outline-sheet.png')

export const createCharacterSketchGenerationId = (): string => {
  const iso = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `${iso}-${crypto.randomUUID().slice(0, 8)}`
}

const assertSafeManifestPath = (root: string, path: string, label: string): void => {
  const absolute = resolve(root, path)
  const rel = relative(resolve(root), absolute)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`${label} has unsafe path "${path}"`)
  }
}

export const readCharacterSketchManifest = async (charactersRoot = getCharactersRoot()): Promise<CharacterSketchManifest> => {
  const path = getCharacterSketchManifestPath(charactersRoot)
  if (!existsSync(path)) return { schemaVersion: 1, sketches: [] }
  try {
    const manifest = v.parse(CharacterSketchManifestSchema, JSON.parse(await Bun.file(path).text()))
    const keys = new Set<string>()
    const generationIds = new Set<string>()
    for (const sketch of manifest.sketches) {
      if (keys.has(sketch.characterKey)) throw new Error(`duplicate character key "${sketch.characterKey}"`)
      if (generationIds.has(sketch.generationId)) throw new Error(`duplicate generation ID "${sketch.generationId}"`)
      assertSafeManifestPath(charactersRoot, sketch.sourceImage, 'source image')
      assertSafeManifestPath(charactersRoot, sketch.outlineSheet, 'outline sheet')
      keys.add(sketch.characterKey)
      generationIds.add(sketch.generationId)
    }
    return manifest
  } catch (error) {
    throw ValidationError(
      `Invalid character sketch manifest ${path}: ${error instanceof Error ? error.message : String(error)}`,
      { stage: 'comic:character-sketch' }
    )
  }
}

export const readRegisteredCharacterSketch = async (
  key: CharacterKey,
  character?: CharacterCatalogEntry,
): Promise<CharacterSketchRegistration | null> => {
  const catalogCharacter = character ?? loadCharacterCatalog().get(key)
  const manifest = await readCharacterSketchManifest()
  const registration = manifest.sketches.find(sketch => sketch.characterKey === key)
  if (!registration) return null
  if (registration.sourceImage !== catalogCharacter.image || registration.outlineSheet !== catalogCharacter.outlineSheet) {
    throw ValidationError(
      `Registered sketch paths for "${key}" do not match characters-reference.json. Regenerate the character sketch.`,
      { stage: 'comic:character-sketch' }
    )
  }
  if (!existsSync(catalogCharacter.outlineSheetPath)) {
    throw InfraError(`Registered outline sheet for "${key}" is missing at ${catalogCharacter.outlineSheetPath}`, { stage: 'comic:character-sketch' })
  }
  const [sourceSha256, sheetSha256] = await Promise.all([
    checksumFile(catalogCharacter.sourcePath),
    checksumFile(catalogCharacter.outlineSheetPath),
  ])
  if (sourceSha256 !== registration.sourceSha256 || sheetSha256 !== registration.sheetSha256) {
    throw ValidationError(
      `Registered sketch for "${key}" is stale or tampered: the source or outline-sheet checksum does not match character-sketches.json.`,
      { stage: 'comic:character-sketch' }
    )
  }
  return registration
}

export const requireCurrentCharacterSketch = async (
  key: CharacterKey,
  character?: CharacterCatalogEntry,
): Promise<CharacterSketchRegistration> => {
  const registration = await readRegisteredCharacterSketch(key, character)
  if (!registration) {
    throw InfraError(
      `Character "${key}" has no registered outline sheet. Run: bun autoshow comic character-sketch --character ${key}`,
      { stage: 'comic:character-sketch' }
    )
  }
  return registration
}

let manifestUpdateTail: Promise<void> = Promise.resolve()

export const withCharacterSketchManifestLock = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = manifestUpdateTail
  let release!: () => void
  manifestUpdateTail = new Promise<void>(resolveLock => { release = resolveLock })
  await previous
  try {
    return await run()
  } finally {
    release()
  }
}

export const getCharacters = async (keys: readonly string[]): Promise<CharacterCatalogEntry[]> => {
  const catalog = loadCharacterCatalog()
  return keys.map(value => catalog.get(catalog.requireKey(value)))
}

export const findCharacterReferenceNamesInText = (text: string): CharacterKey[] => loadCharacterCatalog().detect(text)
export const resolveCharacterReferenceName = (value: string): string => loadCharacterCatalog().resolve(value)?.[0] ?? value
export const stripVoiceOverSuffix = (value: string): string => value.replace(/\s*\((?:V\.?O\.?|O\.?S\.?)\)\s*$/i, '')
export const isCharacterEntry = (value: string): boolean => Boolean(loadCharacterCatalog().resolve(value))
