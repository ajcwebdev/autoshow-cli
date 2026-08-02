import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, rename } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { loadCharacterCatalog } from './character-reference-config'
import { checksumFile } from '../comic-commands/process-scenes/character-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'

export type LocationReferenceEntry = {
  key: string
  name: string
  aliases?: string[]
  specification: string
  sourceScripts: string[]
}

export type LocationReferenceCatalog = {
  schemaVersion: 1
  styleImage: string
  locations: LocationReferenceEntry[]
}

export type LocationSketchRegistration = {
  locationKey: string
  generationId: string
  specificationSha256: string
  sheet: string
  sheetSha256: string
  model: string
  createdAt: string
  priorGenerationId?: string
}

export type LocationSketchManifest = { schemaVersion: 1; sketches: LocationSketchRegistration[] }

export const LOCATION_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const LOCATION_REFERENCE_FILENAME = 'locations-reference.json'
export const LOCATION_SKETCH_MANIFEST_FILENAME = 'location-sketches.json'
export const LOCATION_SNAPSHOTS_FILENAME = 'location-references.json'

export const getLocationsRoot = (): string => join(dirname(getCharactersRoot()), 'locations')
export const getLocationReferencePath = (): string => join(getLocationsRoot(), LOCATION_REFERENCE_FILENAME)
export const getLocationSketchManifestPath = (): string => join(getLocationsRoot(), LOCATION_SKETCH_MANIFEST_FILENAME)

const createEmptyLocationCatalog = (): LocationReferenceCatalog => {
  const styleCharacter = loadCharacterCatalog().characters[0]
  if (!styleCharacter) {
    throw ValidationError('A location catalog requires styleImage, or at least one catalog character whose image can supply the initial comic style', { stage: 'comic:location-reference' })
  }
  return {
    schemaVersion: 1,
    styleImage: relative(getLocationsRoot(), styleCharacter.sourcePath).replace(/\\/g, '/'),
    locations: [],
  }
}

export const normalizeLocationKey = (value: string): string => value
  .normalize('NFKC').toLowerCase()
  .replace(/^\s*(?:(?:cut|smash cut|match cut|dissolve|fade)\s+to|later|moments later)\s*:\s*/i, '')
  .replace(/^\s*(?:int\.?|ext\.?|int\.?\/ext\.?)\s*/i, '')
  .replace(/\s*[–—-]\s*(?:(?:early|late)\s+)?(?:day|night|morning|afternoon|evening|continuous|later|moments later|seconds later|minutes later|same time|dawn|dusk|in flight)\s*$/i, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseCatalog = (value: unknown, path: string): LocationReferenceCatalog => {
  const data = value as Partial<LocationReferenceCatalog>
  if (data?.schemaVersion !== 1 || typeof data.styleImage !== 'string' || !Array.isArray(data.locations)) {
    throw ValidationError(`Invalid location catalog at ${path}`, { stage: 'comic:location-reference' })
  }
  for (const entry of data.locations) {
    if (!entry || !LOCATION_KEY_PATTERN.test(entry.key) || !entry.name?.trim() || (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || !entry.aliases.every(alias => typeof alias === 'string' && alias.trim()))) || !entry.specification?.trim() || !Array.isArray(entry.sourceScripts) || !entry.sourceScripts.every(item => typeof item === 'string')) {
      throw ValidationError(`Invalid location entry in ${path}`, { stage: 'comic:location-reference' })
    }
  }
  return data as LocationReferenceCatalog
}

export const readLocationReferenceCatalog = async (): Promise<LocationReferenceCatalog> => {
  const path = getLocationReferencePath()
  if (!(await Bun.file(path).exists())) {
    return createEmptyLocationCatalog()
  }
  try { return parseCatalog(JSON.parse(await Bun.file(path).text()), path) }
  catch (error) {
    if (error instanceof ValidationError) throw error
    throw ValidationError(`Invalid location catalog JSON at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

export const readLocationReferenceCatalogSync = (): LocationReferenceCatalog => {
  const path = getLocationReferencePath()
  if (!existsSync(path)) return createEmptyLocationCatalog()
  try { return parseCatalog(JSON.parse(readFileSync(path, 'utf8')), path) }
  catch (error) {
    if (error instanceof ValidationError) throw error
    throw ValidationError(`Invalid location catalog JSON at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

export const resolveLocationCatalogEntry = (
  rawLocation: string,
  catalog: LocationReferenceCatalog,
): LocationReferenceEntry => {
  const normalized = normalizeLocationKey(rawLocation)
  const matches = catalog.locations.filter(entry => {
    const candidates = [entry.key, entry.name, ...(entry.aliases ?? [])]
    return candidates.some(candidate => normalizeLocationKey(candidate) === normalized)
  })
  if (matches.length === 0) {
    throw ValidationError(`Location "${rawLocation}" does not resolve to a canonical location key`, { stage: 'comic:location-reference' })
  }
  if (matches.length > 1) {
    throw ValidationError(`Location "${rawLocation}" is ambiguous across canonical keys: ${matches.map(entry => entry.key).sort().join(', ')}`, { stage: 'comic:location-reference' })
  }
  return matches[0]!
}

export const readLocationSketchManifest = async (): Promise<LocationSketchManifest> => {
  const path = getLocationSketchManifestPath()
  if (!(await Bun.file(path).exists())) return { schemaVersion: 1, sketches: [] }
  const data = JSON.parse(await Bun.file(path).text()) as Partial<LocationSketchManifest>
  if (data.schemaVersion !== 1 || !Array.isArray(data.sketches)) throw ValidationError(`Invalid location sketch manifest at ${path}`, { stage: 'comic:location-reference' })
  return data as LocationSketchManifest
}

export const atomicWriteJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${randomUUID()}`
  await Bun.write(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, path)
}

export const getLocationSheetPath = (key: string): string => join(getLocationsRoot(), `${key}--reference-sheet.png`)
export const specificationHash = (specification: string): string => createHash('sha256').update(specification).digest('hex')

export const requireCurrentLocationReference = async (rawLocation: string): Promise<{ entry: LocationReferenceEntry; registration: LocationSketchRegistration; sheetPath: string }> => {
  const catalog = await readLocationReferenceCatalog()
  const entry = resolveLocationCatalogEntry(rawLocation, catalog)
  const key = entry.key
  const manifest = await readLocationSketchManifest()
  const registration = manifest.sketches.find(item => item.locationKey === key)
  if (!registration) throw ValidationError(`Location "${key}" has no registered reference sheet. Run: bun autoshow comic reference-sketch --location ${key}`, { stage: 'comic:location-reference' })
  const sheetPath = resolve(getLocationsRoot(), registration.sheet)
  if (!(await Bun.file(sheetPath).exists())) throw InfraError(`Registered location sheet is missing: ${sheetPath}`, { stage: 'comic:location-reference' })
  if (registration.specificationSha256 !== specificationHash(entry.specification) || registration.sheetSha256 !== await checksumFile(sheetPath)) {
    throw ValidationError(`Registered location reference for "${key}" is stale or modified`, { stage: 'comic:location-reference' })
  }
  return { entry, registration, sheetPath }
}

export type LocationReferenceSnapshot = {
  schemaVersion: 1
  snapshotId: string
  locationKey: string
  specification: string
  sourceScripts: string[]
  sourceGenerationId: string
  sheet: { path: string; sha256: string }
}

export const getLocationReferenceSnapshotPath = (runDirectory: string): string => join(runDirectory, 'location-reference.json')
export const getLocationReferenceSnapshotsPath = (runDirectory: string): string => join(runDirectory, LOCATION_SNAPSHOTS_FILENAME)

export type LocationReferenceSnapshotManifest = {
  schemaVersion: 2
  snapshots: LocationReferenceSnapshot[]
}

const snapshotCurrentLocationReference = async (runDirectory: string, current: Awaited<ReturnType<typeof requireCurrentLocationReference>>): Promise<LocationReferenceSnapshot> => {
  const snapshotId = `${Date.now()}-${randomUUID().slice(0, 12)}`
  const destination = join(runDirectory, 'location-references', snapshotId, basename(current.sheetPath))
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(current.sheetPath, destination)
  const snapshot: LocationReferenceSnapshot = {
    schemaVersion: 1, snapshotId, locationKey: current.entry.key,
    specification: current.entry.specification, sourceScripts: [...current.entry.sourceScripts],
    sourceGenerationId: current.registration.generationId,
    sheet: { path: relative(runDirectory, destination).replace(/\\/g, '/'), sha256: await checksumFile(destination) },
  }
  return snapshot
}

export const createLocationReferenceSnapshot = async (runDirectory: string, location: string): Promise<LocationReferenceSnapshot> => {
  const snapshot = await snapshotCurrentLocationReference(runDirectory, await requireCurrentLocationReference(location))
  await atomicWriteJson(getLocationReferenceSnapshotPath(runDirectory), snapshot)
  return snapshot
}

export const createLocationReferenceSnapshots = async (
  runDirectory: string,
  locationKeys: string[],
): Promise<LocationReferenceSnapshotManifest> => {
  const snapshots: LocationReferenceSnapshot[] = []
  for (const key of Array.from(new Set(locationKeys))) {
    snapshots.push(await snapshotCurrentLocationReference(runDirectory, await requireCurrentLocationReference(key)))
  }
  const manifest: LocationReferenceSnapshotManifest = { schemaVersion: 2, snapshots }
  await atomicWriteJson(getLocationReferenceSnapshotsPath(runDirectory), manifest)
  return manifest
}

const verifySnapshot = async (runDirectory: string, snapshot: LocationReferenceSnapshot, path: string, expectedId?: string): Promise<LocationReferenceSnapshot & { sheetPath: string }> => {
  if (snapshot.schemaVersion !== 1 || !snapshot.snapshotId || !snapshot.sheet?.path || (expectedId && snapshot.snapshotId !== expectedId)) {
    throw ValidationError(`Invalid or mismatched location snapshot at ${path}. Rebuild panel prompts.`, { stage: 'comic:location-reference' })
  }
  const sheetPath = resolve(runDirectory, snapshot.sheet.path)
  if (!(await Bun.file(sheetPath).exists()) || await checksumFile(sheetPath) !== snapshot.sheet.sha256) throw ValidationError(`Location snapshot asset is missing or modified: ${snapshot.sheet.path}`, { stage: 'comic:location-reference' })
  return { ...snapshot, sheetPath }
}

export const loadAndVerifyLocationReferenceSnapshots = async (runDirectory: string): Promise<Array<LocationReferenceSnapshot & { sheetPath: string }>> => {
  const pluralPath = getLocationReferenceSnapshotsPath(runDirectory)
  if (await Bun.file(pluralPath).exists()) {
    const manifest = JSON.parse(await Bun.file(pluralPath).text()) as LocationReferenceSnapshotManifest
    if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.snapshots)) throw ValidationError(`Invalid location snapshot manifest at ${pluralPath}`, { stage: 'comic:location-reference' })
    const verified = await Promise.all(manifest.snapshots.map(snapshot => verifySnapshot(runDirectory, snapshot, pluralPath)))
    if (new Set(verified.map(snapshot => snapshot.snapshotId)).size !== verified.length || new Set(verified.map(snapshot => snapshot.locationKey)).size !== verified.length) {
      throw ValidationError(`Duplicate location key or snapshot ID in ${pluralPath}`, { stage: 'comic:location-reference' })
    }
    return verified
  }
  const legacyPath = getLocationReferenceSnapshotPath(runDirectory)
  if (!(await Bun.file(legacyPath).exists())) throw InfraError(`Missing ${LOCATION_SNAPSHOTS_FILENAME} or ${basename(legacyPath)}. Rebuild panel prompts with draft-scenes.`, { stage: 'comic:location-reference' })
  return [await verifySnapshot(runDirectory, JSON.parse(await Bun.file(legacyPath).text()) as LocationReferenceSnapshot, legacyPath)]
}

export const loadAndVerifyLocationReferenceSnapshot = async (runDirectory: string, expectedId?: string): Promise<LocationReferenceSnapshot & { sheetPath: string }> => {
  const snapshots = await loadAndVerifyLocationReferenceSnapshots(runDirectory)
  const snapshot = expectedId ? snapshots.find(item => item.snapshotId === expectedId) : snapshots[0]
  if (!snapshot || (!expectedId && snapshots.length !== 1)) throw ValidationError(`Location snapshot ${expectedId ?? '(single)'} was not found or was ambiguous.`, { stage: 'comic:location-reference' })
  return snapshot
}
