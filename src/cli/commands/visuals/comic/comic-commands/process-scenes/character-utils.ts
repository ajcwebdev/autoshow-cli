import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogEntry, CharacterKey, CharacterSketchManifest, CharacterSketchRegistration, CharacterSketchView } from '~/types'
import { getCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { InfraError, ValidationError } from '~/utils/error-handler'

export const CHARACTER_SKETCH_VIEWS = ['front', 'three-quarter', 'profile'] as const
const CHARACTER_SKETCH_MANIFEST_FILENAME = 'character-sketches.json'

export const CharacterSketchRegistrationSchema = v.strictObject({
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

export const CharacterSketchManifestSchema = v.strictObject({
  schemaVersion: v.literal(1),
  sketches: v.array(CharacterSketchRegistrationSchema),
})

export const checksumFile = async (path: string): Promise<string> => {
  const hash = new Bun.CryptoHasher('sha256')
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
    throw ValidationError(`${label} has unsafe path "${path}"`, { stage: 'comic:characters', retryable: false })
  }
}

export const readCharacterSketchManifestSync = (charactersRoot = getCharactersRoot()): CharacterSketchManifest => {
  const path = getCharacterSketchManifestPath(charactersRoot)
  if (!existsSync(path)) return { schemaVersion: 1, sketches: [] }
  try {
    const manifest = v.parse(CharacterSketchManifestSchema, JSON.parse(readFileSync(path, 'utf8')))
    const keys = new Set<string>()
    const generationIds = new Set<string>()
    for (const sketch of manifest.sketches) {
      if (keys.has(sketch.characterKey)) throw ValidationError(`duplicate character key "${sketch.characterKey}"`, { stage: 'comic:characters', retryable: false })
      if (generationIds.has(sketch.generationId)) throw ValidationError(`duplicate generation ID "${sketch.generationId}"`, { stage: 'comic:characters', retryable: false })
      assertSafeManifestPath(charactersRoot, sketch.sourceImage, 'source image')
      assertSafeManifestPath(charactersRoot, sketch.outlineSheet, 'outline sheet')
      keys.add(sketch.characterKey)
      generationIds.add(sketch.generationId)
    }
    return manifest
  } catch (error) {
    throw ValidationError(
      `Invalid character sketch manifest ${path}: ${error instanceof Error ? error.message : String(error)}`,
      {
        stage: 'comic:character-sketch',
        ...(error instanceof Error ? { cause: error } : {})
      }
    )
  }
}

export const readCharacterSketchManifest = async (charactersRoot = getCharactersRoot()): Promise<CharacterSketchManifest> => readCharacterSketchManifestSync(charactersRoot)

const readRegisteredCharacterSketch = (
  key: CharacterKey,
  character?: CharacterCatalogEntry,
  charactersRoot = getCharactersRoot(),
): CharacterSketchRegistration | null => {
  const catalogCharacter = character ?? loadCharacterCatalog().get(key)
  const manifest = readCharacterSketchManifestSync(charactersRoot)
  const registration = manifest.sketches.find(sketch => sketch.characterKey === key)
  if (!registration) return null
  if (registration.sourceImage !== catalogCharacter.image || registration.outlineSheet !== catalogCharacter.outlineSheet) {
    throw ValidationError(
      `Registered sketch paths for "${key}" do not match characters-reference.json. Regenerate the character sketch.`,
      { stage: 'comic:character-sketch' }
    )
  }
  for (const assetPath of [catalogCharacter.sourcePath, catalogCharacter.outlineSheetPath]) {
    if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
      throw InfraError(`Registered character reference for "${key}" is missing at ${assetPath}`, { stage: 'comic:character-sketch' })
    }
    const actualRelative = relative(realpathSync(charactersRoot), realpathSync(assetPath))
    if (!actualRelative || actualRelative === '..' || actualRelative.startsWith(`..${sep}`) || isAbsolute(actualRelative)) {
      throw ValidationError(`Registered character reference for "${key}" escapes the characters root`, { stage: 'comic:character-sketch' })
    }
  }
  const sourceSha256 = new Bun.CryptoHasher('sha256').update(readFileSync(catalogCharacter.sourcePath)).digest('hex')
  const sheetSha256 = new Bun.CryptoHasher('sha256').update(readFileSync(catalogCharacter.outlineSheetPath)).digest('hex')
  if (sourceSha256 !== registration.sourceSha256 || sheetSha256 !== registration.sheetSha256) {
    throw ValidationError(
      `Registered sketch for "${key}" is stale or tampered: the source or outline-sheet checksum does not match character-sketches.json.`,
      { stage: 'comic:character-sketch' }
    )
  }
  return registration
}

export const requireCurrentCharacterSketchSync = (
  key: CharacterKey,
  character?: CharacterCatalogEntry,
  charactersRoot = getCharactersRoot(),
): CharacterSketchRegistration => {
  const registration = readRegisteredCharacterSketch(key, character, charactersRoot)
  if (!registration) {
    throw InfraError(
      `Character "${key}" has no registered outline sheet. Run: bun autoshow comic reference-sketch --character ${key}`,
      { stage: 'comic:character-sketch' }
    )
  }
  return registration
}

export const requireCurrentCharacterSketch = async (
  key: CharacterKey,
  character?: CharacterCatalogEntry,
): Promise<CharacterSketchRegistration> => requireCurrentCharacterSketchSync(key, character)

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
