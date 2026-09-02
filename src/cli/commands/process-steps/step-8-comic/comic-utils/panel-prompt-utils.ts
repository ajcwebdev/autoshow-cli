import type { DirectoryEntry } from '~/types'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v from 'valibot'
import type { ComicPanelSource, ImageGenerationModel, LocationReferenceSnapshot, LocationReferenceSnapshotManifest, LocationView, PanelBundleData, PanelPrimaryReferenceInput, PrimaryCharacterReferenceState, ResolvedLocationReference, ResolvedLocationReferenceView, ResolveLocationReferenceOptions, ResolvedReferenceImages } from '~/types'
import { PanelBundleDataSchema } from '../schemas/schemas'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { resolveCharacterIdentityReferences, resolveRosterCharacterReferences } from './character-identity-card'
import { describeLocationSnapshotView, getLocationReferenceSnapshotsPath, LOCATION_SNAPSHOT_READABLE_VERSIONS, LOCATION_SNAPSHOTS_FILENAME, LOCATION_VIEWS } from './location-reference'
import { resolveDesignReferencesAcrossPanels } from './design-reference'
export { resolveDesignReferencesAcrossPanels } from './design-reference'
import { trimOptionalContinuityReferences } from './reference-capabilities'
import { comicLog } from './comic-logger'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getSceneWorkspaceDirectoryForPanelPrompt } from './project-paths'

export const PANEL_DIRECTORY_PATTERN = /^panel-(\d+)$/

export const formatPanelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`
export const getPanelNumberFromName = (value: string, pattern: RegExp = PANEL_DIRECTORY_PATTERN): number | null => {
  const match = value.match(pattern)
  return match?.[1] ? Number(match[1]) : null
}
export const normalizePromptBundle = (content: string): string => content.replace(/\r\n/g, '\n').replace(/^!\[[^\]]*\]\([^)]+\)\n?/gm, '').replace(/\n{3,}/g, '\n\n').trim()

export const extractPanelBundleData = (content: string): PanelBundleData => {
  const json = Array.from(content.matchAll(/```json\s*([\s\S]*?)\s*```/g)).at(-1)?.[1]
  if (!json) throw ValidationError('Prompt bundle is missing a JSON block. Unversioned bundles must be regenerated.', { stage: 'comic:panel-prompt' })
  try {
    const value = v.parse(PanelBundleDataSchema, JSON.parse(json))
    if (value.panels.length !== 1) throw ValidationError(`expected one panel, found ${value.panels.length}`, { stage: 'comic:panel-prompt', retryable: false })
    return value
  } catch (error) {
    throw ValidationError(`Prompt bundle JSON is not a reviewed schemaVersion 4 panel bundle: ${error instanceof Error ? error.message : String(error)}. Run draft-scenes explicitly to rebuild it.`, { stage: 'comic:panel-prompt', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

export const getPromptBundleFilename = (panelDirectory: string, entries: DirectoryEntry[]): string => {
  const files = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => entry.name).sort()
  if (files.length !== 1 || !files[0]) throw ValidationError(`Expected exactly 1 markdown prompt bundle in ${panelDirectory}, found ${files.length}`, { stage: 'comic:panel-prompt' })
  return files[0]
}

const orderedKeys = (panels: PanelPrimaryReferenceInput[]): string[] => {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const input of panels) for (const panel of input.bundleData.panels) for (const key of panel.characterKeys) {
    if (!seen.has(key)) { seen.add(key); keys.push(key) }
  }
  return keys
}

export const resolvePrimaryCharacterReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[], options: { composeDerived?: boolean } = {}): PrimaryCharacterReferenceState => {
  if (panels.length === 0) return { primaryCharacterRefs: [], missingPrimaryCharacterRefs: [] }
  const snapshotIds = new Set(panels.map(panel => panel.bundleData.snapshotId))
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  if (snapshotIds.size !== 1 || runDirectories.size !== 1) throw ValidationError('Mixed snapshot IDs or run directories are not allowed in one image request', { stage: 'comic:reference-snapshot' })
  const runDirectory = [...runDirectories][0]!
  const snapshotId = [...snapshotIds][0]!
  const manifest = loadAndVerifyCharacterReferenceSnapshot(runDirectory, snapshotId)
  const keys = orderedKeys(panels)
  const characterReferences = resolveCharacterIdentityReferences(runDirectory, manifest, keys, { compose: options.composeDerived !== false })
  const primaryCharacterRefs = characterReferences.map(reference => reference.path)
  const rosterCharacterReferences = resolveRosterCharacterReferences(runDirectory, manifest, keys)
  return {
    primaryCharacterRefs,
    missingPrimaryCharacterRefs: [],
    characterReferences,
    ...(rosterCharacterReferences.length > 0 ? { rosterCharacterReferences } : {}),
  }
}

export const resolvePrimaryCharacterReferences = (panelDirectory: string, entries: DirectoryEntry[], bundleData: PanelBundleData): PrimaryCharacterReferenceState =>
  resolvePrimaryCharacterReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

const hasOrderedViewProvenance = (views: ReadonlyArray<{ view: LocationView; generationId: string; imageSha256: string }> | undefined): boolean => {
  if (!Array.isArray(views) || views.length === 0 || views[0]?.view !== 'establishing') return false
  if (!views.every(view => LOCATION_VIEWS.includes(view.view) && !!view.generationId && SHA256_HEX_PATTERN.test(view.imageSha256))) return false
  const indices = views.map(view => LOCATION_VIEWS.indexOf(view.view))
  return new Set(indices).size === indices.length && !indices.some((index, position) => position > 0 && index <= indices[position - 1]!)
}

const verifySnapshotAsset = (runDirectory: string, relativePath: string, expectedSha256: string): string => {
  const assetPath = resolve(runDirectory, relativePath)
  if (!existsSync(assetPath)) throw InfraError(`Location snapshot asset is missing: ${relativePath}`, { stage: 'comic:location-reference' })
  const actual = new Bun.CryptoHasher('sha256').update(readFileSync(assetPath)).digest('hex')
  if (actual !== expectedSha256) throw ValidationError(`Location snapshot asset was modified: ${relativePath}`, { stage: 'comic:location-reference' })
  return assetPath
}

const snapshotMatchesPanel = (snapshot: LocationReferenceSnapshot | undefined, expectedKey: string | undefined): snapshot is LocationReferenceSnapshot => {
  if (!snapshot || (expectedKey && snapshot.locationKey !== expectedKey)) return false
  if (snapshot.schemaVersion === 2) return !!snapshot.sheet?.path && hasOrderedViewProvenance(snapshot.sourceViews)
  if (snapshot.schemaVersion === 3) return hasOrderedViewProvenance(snapshot.views) && snapshot.views.every(view => !!view.path && typeof view.label === 'string')
  return false
}

const resolveSnapshotViews = (runDirectory: string, snapshot: LocationReferenceSnapshot): ResolvedLocationReferenceView[] => {
  if (snapshot.schemaVersion === 2) {
    const path = verifySnapshotAsset(runDirectory, snapshot.sheet.path, snapshot.sheet.sha256)
    const label = snapshot.sourceViews.length === 1
      ? describeLocationSnapshotView(snapshot.locationKey, 'establishing')
      : `composed reference sheet of ${snapshot.locationKey} (${snapshot.sourceViews.map(view => view.view).join(', ')} views left to right)`
    return [{ view: 'establishing', path, label }]
  }
  return snapshot.views.map(view => ({ view: view.view, path: verifySnapshotAsset(runDirectory, view.path, view.imageSha256), label: view.label }))
}

export const selectLocationSnapshotView = (views: readonly ResolvedLocationReferenceView[], preferred?: LocationView | undefined): ResolvedLocationReferenceView => {
  const selected = (preferred ? views.find(view => view.view === preferred) : undefined) ?? views[0]
  if (!selected) throw ValidationError('Location snapshot has no registered views', { stage: 'comic:location-reference' })
  return selected
}

export const readLocationSnapshotManifest = (runDirectory: string): LocationReferenceSnapshotManifest => {
  const pluralPath = getLocationReferenceSnapshotsPath(runDirectory)
  if (!existsSync(pluralPath)) throw InfraError(`Missing ${LOCATION_SNAPSHOTS_FILENAME}. Run draft-scenes explicitly.`, { stage: 'comic:location-reference' })
  const manifest = JSON.parse(readFileSync(pluralPath, 'utf8')) as LocationReferenceSnapshotManifest
  if (!(LOCATION_SNAPSHOT_READABLE_VERSIONS as readonly number[]).includes(manifest.schemaVersion) || !Array.isArray(manifest.snapshots)) throw ValidationError(`Invalid location snapshot manifest: ${pluralPath}`, { stage: 'comic:location-reference' })
  return manifest
}

const preferredViewForPanels = (panels: PanelPrimaryReferenceInput[], options: ResolveLocationReferenceOptions): LocationView | undefined => {
  if (!options.cameraMatched || panels.length !== 1) return undefined
  const nearestView = panels[0]?.bundleData.blocking?.camera.nearestView
  return nearestView && (LOCATION_VIEWS as readonly string[]).includes(nearestView) ? nearestView : undefined
}

export const resolveLocationReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[], options: ResolveLocationReferenceOptions = {}): ResolvedLocationReference[] => {
  if (panels.length === 0) throw ValidationError('A location reference requires at least one panel', { stage: 'comic:location-reference' })
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  if (runDirectories.size !== 1) throw ValidationError('Mixed run directories are not allowed in one image request', { stage: 'comic:location-reference' })
  const runDirectory = [...runDirectories][0]!
  const manifest = readLocationSnapshotManifest(runDirectory)
  const byId = new Map(manifest.snapshots.map(snapshot => [snapshot.snapshotId, snapshot]))
  const preferredView = preferredViewForPanels(panels, options)
  const ordered: ResolvedLocationReference[] = []
  const seen = new Set<string>()
  for (const input of panels) {
    const panel = input.bundleData.panels[0]
    if (!panel) throw ValidationError('Panel bundle is missing its panel payload', { stage: 'comic:location-reference' })
    const snapshotId = panel.locationSnapshotId
    const expectedKey = panel.locationKey
    if (!snapshotId) throw ValidationError('Panel bundle omits its location snapshot ID', { stage: 'comic:location-reference' })
    const snapshot = byId.get(snapshotId)
    if (!snapshotMatchesPanel(snapshot, expectedKey)) {
      throw ValidationError(`Panel location snapshot ${snapshotId} does not match its manifest entry`, { stage: 'comic:location-reference' })
    }
    if (seen.has(snapshotId)) continue
    const views = resolveSnapshotViews(runDirectory, snapshot)
    const selected = selectLocationSnapshotView(views, preferredView)
    seen.add(snapshotId)
    ordered.push({ key: snapshot.locationKey, snapshotId, specification: snapshot.specification, path: selected.path, view: selected.view, views })
  }
  return ordered
}

const buildResolved = (references: string[], primary: string[], prior: string[], secondary: string[], missing: string[]): ResolvedReferenceImages => ({
  all: references,
  primaryCharacterRefs: primary,
  priorPanelRefs: prior.filter(path => references.includes(path)),
  secondaryRefs: secondary.filter(path => references.includes(path)),
  missingPrimaryCharacterRefs: missing,
})

export const applyReferenceImageLimits = (
  primary: string[], prior: string[], secondary: string[], missing: string[], model: ImageGenerationModel
): ResolvedReferenceImages => {
  const optional = [...prior, ...secondary].filter(path => !primary.includes(path))
  const limited = trimOptionalContinuityReferences(model, primary, optional)
  if (limited.trimmed.length > 0) comicLog.line(`  Trimmed ${limited.trimmed.length} optional continuity reference(s) for ${model}`)
  return buildResolved(limited.references, primary, prior, secondary, missing)
}

export const resolveGroupedReferenceImages = (
  panels: Array<Pick<ComicPanelSource, 'panelDirectory' | 'panelEntries' | 'bundleData'>>,
  model: ImageGenerationModel,
  priorRefs: string[] = []
): ResolvedReferenceImages => {
  const referenceInputs = panels.map(panel => ({
    panelDirectory: panel.panelDirectory,
    entries: panel.panelEntries,
    bundleData: panel.bundleData,
  }))
  const primaryState = resolvePrimaryCharacterReferencesAcrossPanels(referenceInputs)
  const primaryCharacterRefs = primaryState.primaryCharacterRefs
  const locationReferences = resolveLocationReferencesAcrossPanels(referenceInputs)
  const locationPaths = locationReferences.map(reference => reference.path)
  const designReferences = resolveDesignReferencesAcrossPanels(referenceInputs)
  const designPaths = designReferences.map(reference => reference.path)

  const resolved = applyReferenceImageLimits(
    [...primaryCharacterRefs, ...locationPaths, ...designPaths],
    priorRefs,
    [...locationPaths, ...designPaths],
    primaryState.missingPrimaryCharacterRefs,
    model,
  )
  return {
    ...resolved,
    primaryCharacterRefs,
    secondaryRefs: locationPaths,
    ...(primaryState.characterReferences ? { characterReferences: primaryState.characterReferences } : {}),
    locationReferences: locationReferences.map((reference, index) => ({
      key: reference.key,
      snapshotId: reference.snapshotId,
      specification: reference.specification,
      path: reference.path,
      view: reference.view,
      referenceIndex: primaryCharacterRefs.length + index + 1,
    })),
    designReferences: designReferences.map((reference, index) => ({
      ...reference,
      referenceIndex: primaryCharacterRefs.length + locationReferences.length + index + 1,
    })),
  }
}

export const findMissingReferenceImageFiles = async (paths: string[]): Promise<string[]> => {
  const results = await Promise.all(paths.map(async path => ({ path, exists: await Bun.file(path).exists() })))
  return results.filter(result => !result.exists).map(result => result.path)
}

export const resolveReferenceImages = (
  panelDirectory: string, entries: DirectoryEntry[], bundleData: PanelBundleData, model: ImageGenerationModel, options: { reserveSlots?: number | undefined } = {}
): ResolvedReferenceImages => {
  const primary = resolvePrimaryCharacterReferences(panelDirectory, entries, bundleData)
  const prior: string[] = []
  const locations = resolveLocationReferencesAcrossPanels([{ panelDirectory, entries, bundleData }], { cameraMatched: true })
  const designs = resolveDesignReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])
  const required = [...primary.primaryCharacterRefs, ...locations.map(location => location.path), ...designs.map(design => design.path)]
  const supplementalViews = locations.flatMap(location => location.view === 'establishing'
    ? []
    : location.views.filter(view => view.view === 'establishing' && view.path !== location.path).map(view => ({ key: location.key, ...view })))
  const reserveSlots = supplementalViews.length > 0 ? Math.max(1, options.reserveSlots ?? 0) : options.reserveSlots
  const limited = trimOptionalContinuityReferences(model, required, [...prior, ...supplementalViews.map(view => view.path)], { reserveSlots })
  if (limited.trimmed.length > 0) comicLog.line(`  Trimmed ${limited.trimmed.length} optional continuity reference(s) for ${model}`)
  return {
    ...buildResolved(limited.references, primary.primaryCharacterRefs, prior, locations.map(location => location.path), primary.missingPrimaryCharacterRefs),
    ...(primary.characterReferences ? { characterReferences: primary.characterReferences } : {}),
    ...(primary.rosterCharacterReferences ? { rosterCharacterReferences: primary.rosterCharacterReferences } : {}),
    locationReferences: locations.map((location, index) => ({
      key: location.key,
      snapshotId: location.snapshotId,
      specification: location.specification,
      path: location.path,
      view: location.view,
      referenceIndex: primary.primaryCharacterRefs.length + index + 1,
      supplementalViews: supplementalViews
        .filter(view => view.key === location.key && limited.references.includes(view.path))
        .map(view => ({ view: view.view, referenceIndex: limited.references.indexOf(view.path) + 1, path: view.path, label: view.label })),
    })),
    designReferences: designs.map((design, index) => ({ ...design, referenceIndex: primary.primaryCharacterRefs.length + locations.length + index + 1 })),
  }
}

export const resolveScenePanelDirectories = (entries: DirectoryEntry[], sceneDirectory: string, requested?: number): DirectoryEntry[] => {
  const panels = entries.filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name)).sort((a, b) => (getPanelNumberFromName(a.name) ?? 0) - (getPanelNumberFromName(b.name) ?? 0))
  if (panels.length === 0) throw ValidationError(`No panel directories were found in ${sceneDirectory}`, { stage: 'comic:panel-prompt' })
  if (!requested) return panels
  const name = formatPanelDirectoryName(requested)
  const selected = panels.find(entry => entry.name === name)
  if (!selected) throw ValidationError(`Requested ${name} was not found in ${sceneDirectory}`, { stage: 'comic:panel-prompt' })
  return [selected]
}
