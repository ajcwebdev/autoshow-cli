import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, rename } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { combineCharacterSketchSheet } from '../comic-commands/character-sketch/character-sketch-sheet'
import { checksumFile } from '../comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog } from './character-reference-config'
import { AppValidationError, InfraError, ValidationError } from '~/utils/error-handler'

export const LOCATION_VIEWS = ['establishing', 'reverse', 'side'] as const
export type LocationView = typeof LOCATION_VIEWS[number]

export type LocationReferenceEntry = {
  key: string
  name: string
  aliases?: string[]
  referenceDirectory?: string
  referenceFilename?: string
  specification: string
  sourceScripts: string[]
}

export type LocationReferenceCatalog = {
  schemaVersion: 1
  styleImage: string
  locations: LocationReferenceEntry[]
}

export type LocationSketchViewRegistration = {
  view: LocationView
  generationId: string
  image: string
  imageSha256: string
  model: string
  createdAt: string
  priorGenerationId?: string
}

export type LocationSketchRegistration = {
  locationKey: string
  specificationSha256: string
  views: LocationSketchViewRegistration[]
}

export type LocationSketchManifest = { schemaVersion: 2; sketches: LocationSketchRegistration[] }

type LegacyLocationSketchRegistration = {
  locationKey: string
  generationId: string
  specificationSha256: string
  sheet: string
  sheetSha256: string
  model: string
  createdAt: string
  priorGenerationId?: string
}

export const LOCATION_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
export const LOCATION_REFERENCE_FILENAME = 'locations-reference.json'
export const LOCATION_SKETCH_MANIFEST_FILENAME = 'location-sketches.json'
export const LOCATION_SNAPSHOTS_FILENAME = 'location-references.json'

export const getLocationsRoot = (): string => join(dirname(getCharactersRoot()), 'locations')
export const getLocationReferencePath = (): string => join(getLocationsRoot(), LOCATION_REFERENCE_FILENAME)
export const getLocationSketchManifestPath = (): string => join(getLocationsRoot(), LOCATION_SKETCH_MANIFEST_FILENAME)

const resolveLocationAssetPath = (authoredPath: string, label: string): string => {
  if (!authoredPath.trim() || isAbsolute(authoredPath)) throw ValidationError(`${label} must be a non-empty path relative to the locations root`, { stage: 'comic:location-reference' })
  const root = resolve(getLocationsRoot())
  const absolutePath = resolve(root, authoredPath)
  const relativePath = relative(root, absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) throw ValidationError(`${label} escapes the locations root`, { stage: 'comic:location-reference' })
  return absolutePath
}

const validateReferenceDirectory = (value: string, label: string): void => {
  resolveLocationAssetPath(join(value, '.location-reference-directory'), label)
}

const validateReferenceFilename = (value: string, label: string): void => {
  if (basename(value) !== value || !/^[a-z0-9]+(?:-[a-z0-9]+)*--reference(?:-sheet)?\.png$/.test(value)) {
    throw ValidationError(`${label} must be a lowercase kebab-case PNG filename ending in --reference.png`, { stage: 'comic:location-reference' })
  }
  resolveLocationAssetPath(value, label)
}

const createEmptyLocationCatalog = (): LocationReferenceCatalog => {
  const styleCharacter = loadCharacterCatalog().characters[0]
  if (!styleCharacter) throw ValidationError('A location catalog requires styleImage, or at least one catalog character whose image can supply the initial comic style', { stage: 'comic:location-reference' })
  return { schemaVersion: 1, styleImage: relative(getLocationsRoot(), styleCharacter.sourcePath).replace(/\\/g, '/'), locations: [] }
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
  if (data?.schemaVersion !== 1 || typeof data.styleImage !== 'string' || !Array.isArray(data.locations)) throw ValidationError(`Invalid location catalog at ${path}`, { stage: 'comic:location-reference' })
  for (const entry of data.locations) {
    if (!entry || !LOCATION_KEY_PATTERN.test(entry.key) || !entry.name?.trim() || (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || !entry.aliases.every(alias => typeof alias === 'string' && alias.trim()))) || (entry.referenceDirectory !== undefined && (typeof entry.referenceDirectory !== 'string' || !entry.referenceDirectory.trim())) || (entry.referenceFilename !== undefined && (typeof entry.referenceFilename !== 'string' || !entry.referenceFilename.trim())) || !entry.specification?.trim() || !Array.isArray(entry.sourceScripts) || !entry.sourceScripts.every(item => typeof item === 'string')) throw ValidationError(`Invalid location entry in ${path}`, { stage: 'comic:location-reference' })
    if (entry.referenceDirectory !== undefined) validateReferenceDirectory(entry.referenceDirectory, `Location "${entry.key}" referenceDirectory`)
    if (entry.referenceFilename !== undefined) validateReferenceFilename(entry.referenceFilename, `Location "${entry.key}" referenceFilename`)
  }
  return data as LocationReferenceCatalog
}

export const readLocationReferenceCatalog = async (): Promise<LocationReferenceCatalog> => {
  const path = getLocationReferencePath()
  if (!(await Bun.file(path).exists())) return createEmptyLocationCatalog()
  try { return parseCatalog(JSON.parse(await Bun.file(path).text()), path) }
  catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError(`Invalid location catalog JSON at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

export const readLocationReferenceCatalogSync = (): LocationReferenceCatalog => {
  const path = getLocationReferencePath()
  if (!existsSync(path)) return createEmptyLocationCatalog()
  try { return parseCatalog(JSON.parse(readFileSync(path, 'utf8')), path) }
  catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError(`Invalid location catalog JSON at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

export const resolveLocationCatalogEntry = (rawLocation: string, catalog: LocationReferenceCatalog): LocationReferenceEntry => {
  const normalized = normalizeLocationKey(rawLocation)
  const matches = catalog.locations.filter(entry => [entry.key, entry.name, ...(entry.aliases ?? [])].some(candidate => normalizeLocationKey(candidate) === normalized))
  if (matches.length === 0) throw ValidationError(`Location "${rawLocation}" does not resolve to a canonical location key`, { stage: 'comic:location-reference' })
  if (matches.length > 1) throw ValidationError(`Location "${rawLocation}" is ambiguous across canonical keys: ${matches.map(entry => entry.key).sort().join(', ')}`, { stage: 'comic:location-reference' })
  return matches[0]!
}

const validViewRegistration = (value: unknown): value is LocationSketchViewRegistration => {
  const item = value as Partial<LocationSketchViewRegistration>
  return !!item && LOCATION_VIEWS.includes(item.view as LocationView) && !!item.generationId?.trim() && !!item.image?.trim() && SHA256_PATTERN.test(item.imageSha256 ?? '') && !!item.model?.trim() && !!item.createdAt?.trim() && (item.priorGenerationId === undefined || !!item.priorGenerationId.trim())
}

const parseSketchManifest = (value: unknown, path: string): LocationSketchManifest => {
  const data = value as { schemaVersion?: number; sketches?: unknown[] }
  if (!Array.isArray(data.sketches) || (data.schemaVersion !== 1 && data.schemaVersion !== 2)) throw ValidationError(`Invalid location sketch manifest at ${path}`, { stage: 'comic:location-reference' })
  if (data.schemaVersion === 1) {
    const sketches = data.sketches.map(value => {
      const item = value as Partial<LegacyLocationSketchRegistration>
      if (!item || !LOCATION_KEY_PATTERN.test(item.locationKey ?? '') || !item.generationId?.trim() || !SHA256_PATTERN.test(item.specificationSha256 ?? '') || !item.sheet?.trim() || !SHA256_PATTERN.test(item.sheetSha256 ?? '') || !item.model?.trim() || !item.createdAt?.trim()) throw ValidationError(`Invalid legacy location sketch registration in ${path}`, { stage: 'comic:location-reference' })
      resolveLocationAssetPath(item.sheet, `Location "${item.locationKey}" sheet`)
      return { locationKey: item.locationKey!, specificationSha256: item.specificationSha256!, views: [{ view: 'establishing' as const, generationId: item.generationId!, image: item.sheet!, imageSha256: item.sheetSha256!, model: item.model!, createdAt: item.createdAt!, ...(item.priorGenerationId ? { priorGenerationId: item.priorGenerationId } : {}) }] }
    })
    if (new Set(sketches.map(item => item.locationKey)).size !== sketches.length) throw ValidationError(`Duplicate legacy location registrations in ${path}`, { stage: 'comic:location-reference' })
    return { schemaVersion: 2, sketches }
  }
  const sketches = data.sketches.map(value => {
    const item = value as Partial<LocationSketchRegistration>
    if (!item || !LOCATION_KEY_PATTERN.test(item.locationKey ?? '') || !SHA256_PATTERN.test(item.specificationSha256 ?? '') || !Array.isArray(item.views) || item.views.length === 0 || !item.views.every(validViewRegistration)) throw ValidationError(`Invalid location sketch registration in ${path}`, { stage: 'comic:location-reference' })
    const indices = item.views.map(view => LOCATION_VIEWS.indexOf(view.view))
    if (item.views[0]?.view !== 'establishing' || new Set(indices).size !== indices.length || indices.some((index, position) => position > 0 && index <= indices[position - 1]!)) throw ValidationError(`Location "${item.locationKey}" views must be unique and ordered establishing, reverse, side`, { stage: 'comic:location-reference' })
    for (const view of item.views) resolveLocationAssetPath(view.image, `Location "${item.locationKey}" ${view.view} image`)
    return item as LocationSketchRegistration
  })
  if (new Set(sketches.map(item => item.locationKey)).size !== sketches.length) throw ValidationError(`Duplicate location registrations in ${path}`, { stage: 'comic:location-reference' })
  return { schemaVersion: 2, sketches }
}

export const readLocationSketchManifest = async (): Promise<LocationSketchManifest> => {
  const path = getLocationSketchManifestPath()
  if (!(await Bun.file(path).exists())) return { schemaVersion: 2, sketches: [] }
  try { return parseSketchManifest(JSON.parse(await Bun.file(path).text()), path) }
  catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError(`Invalid location sketch manifest JSON at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

export const atomicWriteJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${randomUUID()}`
  await Bun.write(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, path)
}

const establishingFilename = (key: string, referenceFilename?: string): string => (referenceFilename ?? `${key}--reference.png`).replace(/--reference-sheet\.png$/, '--reference.png')

export const getLocationViewPath = (key: string, view: LocationView, referenceDirectory?: string, referenceFilename?: string): string => {
  if (referenceDirectory !== undefined) validateReferenceDirectory(referenceDirectory, `Location "${key}" referenceDirectory`)
  if (referenceFilename !== undefined) validateReferenceFilename(referenceFilename, `Location "${key}" referenceFilename`)
  const filename = establishingFilename(key, referenceFilename)
  const viewFilename = view === 'establishing' ? filename : filename.replace(/--reference\.png$/, `--reference-${view}.png`)
  return join(getLocationsRoot(), referenceDirectory ?? '', viewFilename)
}

/** @deprecated Legacy sheet path helper retained for schema-version-1 compatibility. */
export const getLocationSheetPath = (key: string, referenceDirectory?: string, referenceFilename?: string): string => getLocationViewPath(key, 'establishing', referenceDirectory, referenceFilename)
export const resolveRegisteredLocationImagePath = (image: string): string => resolveLocationAssetPath(image, 'Registered location image')
/** @deprecated Legacy alias retained for callers that read schema-version-1 registrations. */
export const resolveRegisteredLocationSheetPath = resolveRegisteredLocationImagePath
export const specificationHash = (specification: string): string => createHash('sha256').update(specification).digest('hex')

export type CurrentLocationReference = {
  entry: LocationReferenceEntry
  registration: LocationSketchRegistration
  views: Array<LocationSketchViewRegistration & { imagePath: string }>
  sheetPath: string
}

export const requireCurrentLocationReference = async (rawLocation: string): Promise<CurrentLocationReference> => {
  const catalog = await readLocationReferenceCatalog()
  const entry = resolveLocationCatalogEntry(rawLocation, catalog)
  const manifest = await readLocationSketchManifest()
  const registration = manifest.sketches.find(item => item.locationKey === entry.key)
  if (!registration) throw ValidationError(`Location "${entry.key}" has no registered establishing reference. Run: bun autoshow comic reference-sketch --location ${entry.key}`, { stage: 'comic:location-reference' })
  if (registration.specificationSha256 !== specificationHash(entry.specification)) throw ValidationError(`Registered location reference for "${entry.key}" is stale`, { stage: 'comic:location-reference' })
  const views = []
  for (const view of registration.views) {
    const imagePath = resolveRegisteredLocationImagePath(view.image)
    if (!(await Bun.file(imagePath).exists())) throw InfraError(`Registered location ${view.view} image is missing: ${imagePath}`, { stage: 'comic:location-reference' })
    if (view.imageSha256 !== await checksumFile(imagePath)) throw ValidationError(`Registered location ${view.view} image for "${entry.key}" is modified`, { stage: 'comic:location-reference' })
    views.push({ ...view, imagePath })
  }
  return { entry, registration, views, sheetPath: views[0]!.imagePath }
}

export type LegacyLocationReferenceSnapshot = {
  schemaVersion: 1
  snapshotId: string
  locationKey: string
  specification: string
  sourceScripts: string[]
  sourceGenerationId: string
  sheet: { path: string; sha256: string }
}

export type LocationReferenceSnapshot = {
  schemaVersion: 2
  snapshotId: string
  locationKey: string
  specification: string
  sourceScripts: string[]
  sourceViews: Array<{ view: LocationView; generationId: string; imageSha256: string }>
  sheet: { path: string; sha256: string }
}

export type AnyLocationReferenceSnapshot = LegacyLocationReferenceSnapshot | LocationReferenceSnapshot
export const getLocationReferenceSnapshotPath = (runDirectory: string): string => join(runDirectory, 'location-reference.json')
export const getLocationReferenceSnapshotsPath = (runDirectory: string): string => join(runDirectory, LOCATION_SNAPSHOTS_FILENAME)
export type LocationReferenceSnapshotManifest = { schemaVersion: 2; snapshots: LocationReferenceSnapshot[] }

const snapshotCurrentLocationReference = async (runDirectory: string, current: CurrentLocationReference): Promise<LocationReferenceSnapshot> => {
  const snapshotId = `${Date.now()}-${randomUUID().slice(0, 12)}`
  const destination = join(runDirectory, 'location-references', snapshotId, `${current.entry.key}--reference-sheet.png`)
  await mkdir(dirname(destination), { recursive: true })
  if (current.views.length === 1) await copyFile(current.views[0]!.imagePath, destination)
  else await combineCharacterSketchSheet({ outputPath: destination, sources: current.views.map(view => ({ view: view.view as never, path: view.imagePath })) })
  const snapshot: LocationReferenceSnapshot = {
    schemaVersion: 2,
    snapshotId,
    locationKey: current.entry.key,
    specification: current.entry.specification,
    sourceScripts: [...current.entry.sourceScripts],
    sourceViews: current.views.map(view => ({ view: view.view, generationId: view.generationId, imageSha256: view.imageSha256 })),
    sheet: { path: relative(runDirectory, destination).replace(/\\/g, '/'), sha256: await checksumFile(destination) },
  }
  return snapshot
}

export const createLocationReferenceSnapshot = async (runDirectory: string, location: string): Promise<LocationReferenceSnapshot> => {
  const snapshot = await snapshotCurrentLocationReference(runDirectory, await requireCurrentLocationReference(location))
  await atomicWriteJson(getLocationReferenceSnapshotPath(runDirectory), snapshot)
  return snapshot
}

export const createLocationReferenceSnapshots = async (runDirectory: string, locationKeys: string[]): Promise<LocationReferenceSnapshotManifest> => {
  const snapshots: LocationReferenceSnapshot[] = []
  for (const key of Array.from(new Set(locationKeys))) snapshots.push(await snapshotCurrentLocationReference(runDirectory, await requireCurrentLocationReference(key)))
  const manifest: LocationReferenceSnapshotManifest = { schemaVersion: 2, snapshots }
  await atomicWriteJson(getLocationReferenceSnapshotsPath(runDirectory), manifest)
  return manifest
}

const resolveSnapshotAsset = (runDirectory: string, authoredPath: string, manifestPath: string): string => {
  const root = resolve(runDirectory)
  const asset = resolve(root, authoredPath)
  const fromRoot = relative(root, asset)
  if (!authoredPath || isAbsolute(authoredPath) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw ValidationError(`Invalid location snapshot asset path in ${manifestPath}`, { stage: 'comic:location-reference' })
  return asset
}

const verifySnapshot = async (runDirectory: string, snapshot: AnyLocationReferenceSnapshot, path: string, expectedId?: string): Promise<AnyLocationReferenceSnapshot & { sheetPath: string }> => {
  if ((snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2) || !snapshot.snapshotId || !snapshot.locationKey || !snapshot.sheet?.path || !SHA256_PATTERN.test(snapshot.sheet.sha256) || (expectedId && snapshot.snapshotId !== expectedId)) throw ValidationError(`Invalid or mismatched location snapshot at ${path}. Rebuild panel prompts.`, { stage: 'comic:location-reference' })
  if (snapshot.schemaVersion === 2) {
    const indices = snapshot.sourceViews?.map(view => LOCATION_VIEWS.indexOf(view.view)) ?? []
    if (!Array.isArray(snapshot.sourceViews) || snapshot.sourceViews.length === 0 || !snapshot.sourceViews.every(view => LOCATION_VIEWS.includes(view.view) && !!view.generationId && SHA256_PATTERN.test(view.imageSha256)) || snapshot.sourceViews[0]?.view !== 'establishing' || new Set(indices).size !== indices.length || indices.some((index, position) => position > 0 && index <= indices[position - 1]!)) throw ValidationError(`Invalid source-view provenance in ${path}. Rebuild panel prompts.`, { stage: 'comic:location-reference' })
  }
  const sheetPath = resolveSnapshotAsset(runDirectory, snapshot.sheet.path, path)
  if (!(await Bun.file(sheetPath).exists()) || await checksumFile(sheetPath) !== snapshot.sheet.sha256) throw ValidationError(`Location snapshot asset is missing or modified: ${snapshot.sheet.path}`, { stage: 'comic:location-reference' })
  return { ...snapshot, sheetPath }
}

export const loadAndVerifyLocationReferenceSnapshots = async (runDirectory: string): Promise<Array<AnyLocationReferenceSnapshot & { sheetPath: string }>> => {
  const pluralPath = getLocationReferenceSnapshotsPath(runDirectory)
  if (await Bun.file(pluralPath).exists()) {
    const manifest = JSON.parse(await Bun.file(pluralPath).text()) as { schemaVersion?: number; snapshots?: AnyLocationReferenceSnapshot[] }
    if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.snapshots)) throw ValidationError(`Invalid location snapshot manifest at ${pluralPath}`, { stage: 'comic:location-reference' })
    const verified = await Promise.all(manifest.snapshots.map(snapshot => verifySnapshot(runDirectory, snapshot, pluralPath)))
    if (new Set(verified.map(snapshot => snapshot.snapshotId)).size !== verified.length || new Set(verified.map(snapshot => snapshot.locationKey)).size !== verified.length) throw ValidationError(`Duplicate location key or snapshot ID in ${pluralPath}`, { stage: 'comic:location-reference' })
    return verified
  }
  const legacyPath = getLocationReferenceSnapshotPath(runDirectory)
  if (!(await Bun.file(legacyPath).exists())) throw InfraError(`Missing ${LOCATION_SNAPSHOTS_FILENAME} or ${basename(legacyPath)}. Rebuild panel prompts with draft-scenes.`, { stage: 'comic:location-reference' })
  return [await verifySnapshot(runDirectory, JSON.parse(await Bun.file(legacyPath).text()) as AnyLocationReferenceSnapshot, legacyPath)]
}

export const loadAndVerifyLocationReferenceSnapshot = async (runDirectory: string, expectedId?: string): Promise<AnyLocationReferenceSnapshot & { sheetPath: string }> => {
  const snapshots = await loadAndVerifyLocationReferenceSnapshots(runDirectory)
  const snapshot = expectedId ? snapshots.find(item => item.snapshotId === expectedId) : snapshots[0]
  if (!snapshot || (!expectedId && snapshots.length !== 1)) throw ValidationError(`Location snapshot ${expectedId ?? '(single)'} was not found or was ambiguous.`, { stage: 'comic:location-reference' })
  return snapshot
}
