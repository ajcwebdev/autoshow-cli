import type { DirectoryEntry } from '~/types'
import * as v from 'valibot'
import type { ComicPanelSource, ImageGenerationModel, LocationView, PanelBundleData, PanelPrimaryReferenceInput, PrimaryCharacterReferenceState, ResolvedLocationReference, ResolvedLocationReferenceView, ResolveLocationReferenceOptions, ResolvedReferenceImages } from '~/types'
import { PanelBundleDataSchema } from '../schemas/schemas'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { loadCharacterCatalog } from './character-reference-config'
import { resolveCharacterIdentityReferences, resolveRosterCharacterReferences } from './character-identity-card'
import { describeLocationSnapshotView, requireCurrentLocationReferenceSync, LOCATION_VIEWS } from './location-reference'
import { resolveDesignReferencesAcrossPanels } from './design-reference'
export { resolveDesignReferencesAcrossPanels } from './design-reference'
import { trimOptionalContinuityReferences } from './reference-capabilities'
import { comicLog } from './comic-logger'
import { ValidationError } from '~/utils/error-handler'
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
  const runDirectories = new Set(panels.map(panel => getSceneWorkspaceDirectoryForPanelPrompt(panel.panelDirectory)))
  if (runDirectories.size !== 1) throw ValidationError('Mixed run directories are not allowed in one image request', { stage: 'comic:reference-snapshot' })
  const runDirectory = [...runDirectories][0]!
  const keys = orderedKeys(panels)
  const blockingKeys = panels.flatMap(({ bundleData: { blocking } }) => blocking ? [
    ...blocking.ledger.map(entry => entry.characterKey),
    ...blocking.offFrameRoster.map(entry => entry.characterKey),
    ...blocking.croppedOnStage.map(entry => entry.characterKey),
    ...blocking.extrasInFrame.map(entry => entry.ensembleKey),
  ] : [])
  const catalogKeys = blockingKeys.length > 0 ? new Set<string>(loadCharacterCatalog(undefined, { fresh: true }).characterKeys) : undefined
  const rosterKeys = blockingKeys.filter(key => catalogKeys?.has(key))
  const manifest = loadAndVerifyCharacterReferenceSnapshot(runDirectory, undefined, [...keys, ...rosterKeys])
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

export const selectLocationSnapshotView = (views: readonly ResolvedLocationReferenceView[], preferred?: LocationView | undefined): ResolvedLocationReferenceView => {
  const selected = (preferred ? views.find(view => view.view === preferred) : undefined) ?? views[0]
  if (!selected) throw ValidationError('Location reference has no registered views', { stage: 'comic:location-reference' })
  return selected
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
  const preferredView = preferredViewForPanels(panels, options)
  const ordered: ResolvedLocationReference[] = []
  const seen = new Set<string>()
  for (const input of panels) {
    const panel = input.bundleData.panels[0]
    if (!panel) throw ValidationError('Panel bundle is missing its panel payload', { stage: 'comic:location-reference' })
    const key = panel.locationKey
    if (seen.has(key)) continue
    const current = requireCurrentLocationReferenceSync(key, { requireCurrentSpecification: false })
    const views = current.views.map(view => ({ view: view.view, path: view.imagePath, label: describeLocationSnapshotView(current.entry.key, view.view) }))
    const selected = selectLocationSnapshotView(views, preferredView)
    seen.add(key)
    ordered.push({ key: current.entry.key, snapshotId: `live:${current.entry.key}`, specification: current.entry.specification, path: selected.path, view: selected.view, views })
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
