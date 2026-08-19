import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v from 'valibot'
import type { ComicPanelSource, ImageGenerationModel, LocationReferenceSnapshotManifest, PanelBundleData, PanelPrimaryReferenceInput, PrimaryCharacterReferenceState, ResolvedLocationReference, ResolvedReferenceImages } from '~/types'
import { PanelBundleDataSchema } from '../schemas/schemas'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { resolveCharacterIdentityReferences } from './character-identity-card'
import { getLocationReferenceSnapshotsPath, LOCATION_SNAPSHOTS_FILENAME, LOCATION_VIEWS } from './location-reference'
import { resolveDesignReferencesAcrossPanels } from './design-reference'
export { resolveDesignReferencesAcrossPanels } from './design-reference'
import { trimOptionalContinuityReferences } from './reference-capabilities'
import { l } from './comic-logger'
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
    if (value.panels.length !== 1) throw new Error(`expected one panel, found ${value.panels.length}`)
    return value
  } catch (error) {
    throw ValidationError(`Prompt bundle JSON is not a reviewed schemaVersion 4 panel bundle: ${error instanceof Error ? error.message : String(error)}. Run draft-scenes explicitly to rebuild it.`, { stage: 'comic:panel-prompt' })
  }
}

export const getPromptBundleFilename = (panelDirectory: string, entries: Dirent[]): string => {
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
  return {
    primaryCharacterRefs,
    missingPrimaryCharacterRefs: [],
    characterReferences,
  }
}

export const resolvePrimaryCharacterReferences = (panelDirectory: string, entries: Dirent[], bundleData: PanelBundleData): PrimaryCharacterReferenceState =>
  resolvePrimaryCharacterReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])

export const resolveLocationReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[]): ResolvedLocationReference[] => {
  if (panels.length === 0) throw ValidationError('A location reference requires at least one panel', { stage: 'comic:location-reference' })
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  if (runDirectories.size !== 1) throw ValidationError('Mixed run directories are not allowed in one image request', { stage: 'comic:location-reference' })
  const runDirectory = [...runDirectories][0]!
  const pluralPath = getLocationReferenceSnapshotsPath(runDirectory)
  if (!existsSync(pluralPath)) throw InfraError(`Missing ${LOCATION_SNAPSHOTS_FILENAME}. Run draft-scenes explicitly.`, { stage: 'comic:location-reference' })
  const manifest = JSON.parse(readFileSync(pluralPath, 'utf8')) as LocationReferenceSnapshotManifest
  if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.snapshots)) throw ValidationError(`Invalid location snapshot manifest: ${pluralPath}`, { stage: 'comic:location-reference' })
  const snapshots = manifest.snapshots
  const byId = new Map(snapshots.map(snapshot => [snapshot.snapshotId, snapshot]))
  const ordered: ResolvedLocationReference[] = []
  const seen = new Set<string>()
  for (const input of panels) {
    const panel = input.bundleData.panels[0]
    if (!panel) throw ValidationError('Panel bundle is missing its panel payload', { stage: 'comic:location-reference' })
    const snapshotId = panel.locationSnapshotId
    const expectedKey = panel.locationKey
    if (!snapshotId) throw ValidationError('Panel bundle omits its location snapshot ID', { stage: 'comic:location-reference' })
    const snapshot = byId.get(snapshotId)
    const sourceViewIndices = snapshot?.sourceViews?.map(view => LOCATION_VIEWS.indexOf(view.view)) ?? []
    const invalidProvenance = !!snapshot && (!Array.isArray(snapshot.sourceViews) || snapshot.sourceViews.length === 0 || snapshot.sourceViews[0]?.view !== 'establishing' || !snapshot.sourceViews.every(view => LOCATION_VIEWS.includes(view.view) && !!view.generationId && /^[a-f0-9]{64}$/.test(view.imageSha256)) || new Set(sourceViewIndices).size !== sourceViewIndices.length || sourceViewIndices.some((index, position) => position > 0 && index <= sourceViewIndices[position - 1]!))
    if (!snapshot || snapshot.schemaVersion !== 2 || !snapshot.sheet?.path || invalidProvenance || (expectedKey && snapshot.locationKey !== expectedKey)) {
      throw ValidationError(`Panel location snapshot ${snapshotId} does not match its manifest entry`, { stage: 'comic:location-reference' })
    }
    if (seen.has(snapshotId)) continue
    const sheetPath = resolve(runDirectory, snapshot.sheet.path)
    if (!existsSync(sheetPath)) throw InfraError(`Location snapshot asset is missing: ${snapshot.sheet.path}`, { stage: 'comic:location-reference' })
    const actual = createHash('sha256').update(readFileSync(sheetPath)).digest('hex')
    if (actual !== snapshot.sheet.sha256) throw ValidationError(`Location snapshot asset was modified: ${snapshot.sheet.path}`, { stage: 'comic:location-reference' })
    seen.add(snapshotId)
    ordered.push({ key: snapshot.locationKey, snapshotId, specification: snapshot.specification, path: sheetPath })
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
  if (limited.trimmed.length > 0) l.dim(`  Trimmed ${limited.trimmed.length} optional continuity reference(s) for ${model}`)
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
      ...reference,
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
  panelDirectory: string, entries: Dirent[], bundleData: PanelBundleData, model: ImageGenerationModel
): ResolvedReferenceImages => {
  const primary = resolvePrimaryCharacterReferences(panelDirectory, entries, bundleData)
  const prior: string[] = []
  // Arbitrary images in panel directories are never promoted into identity refs.
  const locations = resolveLocationReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])
  const designs = resolveDesignReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])
  const required = [...primary.primaryCharacterRefs, ...locations.map(location => location.path), ...designs.map(design => design.path)]
  const limited = trimOptionalContinuityReferences(model, required, prior)
  return {
    ...buildResolved(limited.references, primary.primaryCharacterRefs, prior, locations.map(location => location.path), primary.missingPrimaryCharacterRefs),
    ...(primary.characterReferences ? { characterReferences: primary.characterReferences } : {}),
    locationReferences: locations.map((location, index) => ({ ...location, referenceIndex: primary.primaryCharacterRefs.length + index + 1 })),
    designReferences: designs.map((design, index) => ({ ...design, referenceIndex: primary.primaryCharacterRefs.length + locations.length + index + 1 })),
  }
}

export const resolveScenePanelDirectories = (entries: Dirent[], sceneDirectory: string, requested?: number): Dirent[] => {
  const panels = entries.filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name)).sort((a, b) => (getPanelNumberFromName(a.name) ?? 0) - (getPanelNumberFromName(b.name) ?? 0))
  if (panels.length === 0) throw ValidationError(`No panel directories were found in ${sceneDirectory}`, { stage: 'comic:panel-prompt' })
  if (!requested) return panels
  const name = formatPanelDirectoryName(requested)
  const selected = panels.find(entry => entry.name === name)
  if (!selected) throw ValidationError(`Requested ${name} was not found in ${sceneDirectory}`, { stage: 'comic:panel-prompt' })
  return [selected]
}
