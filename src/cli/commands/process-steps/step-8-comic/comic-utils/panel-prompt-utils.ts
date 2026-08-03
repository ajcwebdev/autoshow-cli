import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import * as v from 'valibot'
import type { PanelBundleData, ImageGenerationModel, PanelPrimaryReferenceInput, PrimaryCharacterReferenceState, ResolvedReferenceImages } from '~/types'
import { ReadablePanelBundleDataSchema } from '../schemas/schemas'
import { CharacterReferenceManifestSchema, getCharacterReferenceManifestPath } from './character-reference-snapshot'
import { resolveCharacterIdentityReferences } from './character-identity-card'
import { getLocationReferenceSnapshotPath, getLocationReferenceSnapshotsPath, LOCATION_VIEWS, type AnyLocationReferenceSnapshot, type LocationReferenceSnapshotManifest } from './location-reference'
import { trimOptionalContinuityReferences } from './reference-capabilities'
import { l } from './comic-logger'
import { InfraError, ValidationError } from '~/utils/error-handler'

export const PANEL_DIRECTORY_PATTERN = /^panel-(\d+)$/
const PRIOR_PANEL_REFERENCE_PATTERN = /^panel-(\d+)(?:--(.+))?\.png$/
const SUPPORTED_REFERENCE_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg'])

export const formatPanelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`
export const getPanelNumberFromName = (value: string, pattern: RegExp = PANEL_DIRECTORY_PATTERN): number | null => {
  const match = value.match(pattern)
  return match?.[1] ? Number(match[1]) : null
}
export const normalizePromptBundle = (content: string): string => content.replace(/\r\n/g, '\n').replace(/^!\[[^\]]*\]\([^)]+\)\n?/gm, '').replace(/\n{3,}/g, '\n\n').trim()

export const extractPanelBundleData = (content: string): PanelBundleData => {
  const json = Array.from(content.matchAll(/```json\s*([\s\S]*?)\s*```/g)).at(-1)?.[1]
  if (!json) throw ValidationError('Prompt bundle is missing a JSON block. Legacy/unversioned bundles must be regenerated.', { stage: 'comic:panel-prompt' })
  try {
    const value = v.parse(ReadablePanelBundleDataSchema, JSON.parse(json))
    if (value.panels.length !== 1) throw new Error(`expected one panel, found ${value.panels.length}`)
    if (value.schemaVersion === 2) throw new Error('schemaVersion 2 bundles are not generation-safe')
    return value as PanelBundleData
  } catch (error) {
    throw ValidationError(`Prompt bundle JSON is not a reviewed schemaVersion 3 or 4 panel bundle: ${error instanceof Error ? error.message : String(error)}. Run draft-scenes explicitly to rebuild it.`, { stage: 'comic:panel-prompt' })
  }
}

export const getPromptBundleFilename = (panelDirectory: string, entries: Dirent[]): string => {
  const files = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => entry.name).sort()
  if (files.length !== 1 || !files[0]) throw ValidationError(`Expected exactly 1 markdown prompt bundle in ${panelDirectory}, found ${files.length}`, { stage: 'comic:panel-prompt' })
  return files[0]
}

const runDirectoryForPanel = (panelDirectory: string): string => dirname(dirname(panelDirectory))
const loadVerifiedManifestSync = (runDirectory: string, snapshotId: string) => {
  const path = getCharacterReferenceManifestPath(runDirectory)
  if (!existsSync(path)) throw InfraError(`Missing character-references.json. Rebuild panel prompts.`, { stage: 'comic:reference-snapshot' })
  const manifest = v.parse(CharacterReferenceManifestSchema, JSON.parse(readFileSync(path, 'utf8')))
  if (manifest.snapshotId !== snapshotId) throw ValidationError(`Panel bundle snapshot ${snapshotId} does not match manifest snapshot ${manifest.snapshotId}`, { stage: 'comic:reference-snapshot' })
  for (const character of manifest.characters) for (const asset of character.assets) {
    const assetPath = resolve(runDirectory, asset.path)
    if (!existsSync(assetPath)) throw InfraError(`Snapshot asset is missing: ${asset.path}`, { stage: 'comic:reference-snapshot' })
    const actual = createHash('sha256').update(readFileSync(assetPath)).digest('hex')
    if (actual !== asset.sha256) throw ValidationError(`Snapshot asset was modified or corrupted: ${asset.path}`, { stage: 'comic:reference-snapshot' })
  }
  return manifest
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
  if (panels.length === 0) return { primaryCharacterRefs: [], sketchCharacterRefs: [], canonicalCharacterRefs: [], missingPrimaryCharacterRefs: [] }
  const snapshotIds = new Set(panels.map(panel => panel.bundleData.snapshotId))
  const runDirectories = new Set(panels.map(panel => runDirectoryForPanel(panel.panelDirectory)))
  if (snapshotIds.size !== 1 || runDirectories.size !== 1) throw ValidationError('Mixed snapshot IDs or run directories are not allowed in one image request', { stage: 'comic:reference-snapshot' })
  const runDirectory = [...runDirectories][0]!
  const snapshotId = [...snapshotIds][0]!
  const manifest = loadVerifiedManifestSync(runDirectory, snapshotId)
  const keys = orderedKeys(panels)
  const characterReferences = resolveCharacterIdentityReferences(runDirectory, manifest, keys, { compose: options.composeDerived !== false })
  const primaryCharacterRefs = characterReferences.map(reference => reference.path)
  return {
    primaryCharacterRefs,
    sketchCharacterRefs: [],
    canonicalCharacterRefs: [],
    missingPrimaryCharacterRefs: [],
    characterReferences,
  }
}

export const resolvePrimaryCharacterReferences = (panelDirectory: string, entries: Dirent[], bundleData: PanelBundleData): PrimaryCharacterReferenceState =>
  resolvePrimaryCharacterReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])

export type ResolvedLocationReference = {
  key: string
  snapshotId: string
  specification: string
  path: string
}

export const resolveLocationReferencesAcrossPanels = (panels: PanelPrimaryReferenceInput[]): ResolvedLocationReference[] => {
  if (panels.length === 0) throw ValidationError('A location reference requires at least one panel', { stage: 'comic:location-reference' })
  const runDirectories = new Set(panels.map(panel => runDirectoryForPanel(panel.panelDirectory)))
  if (panels.some(panel => panel.bundleData.schemaVersion === 2)) throw ValidationError('Legacy v2 panel bundles cannot enter image generation. Run draft-scenes explicitly to rebuild reviewed artifacts.', { stage: 'comic:location-reference' })
  if (runDirectories.size !== 1) throw ValidationError('Mixed run directories are not allowed in one image request', { stage: 'comic:location-reference' })
  const runDirectory = [...runDirectories][0]!
  const pluralPath = getLocationReferenceSnapshotsPath(runDirectory)
  const legacyPath = getLocationReferenceSnapshotPath(runDirectory)
  let snapshots: AnyLocationReferenceSnapshot[]
  if (existsSync(pluralPath)) {
    const manifest = JSON.parse(readFileSync(pluralPath, 'utf8')) as LocationReferenceSnapshotManifest
    if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.snapshots)) throw ValidationError(`Invalid location snapshot manifest: ${pluralPath}`, { stage: 'comic:location-reference' })
    snapshots = manifest.snapshots
  } else if (existsSync(legacyPath)) {
    snapshots = [JSON.parse(readFileSync(legacyPath, 'utf8')) as AnyLocationReferenceSnapshot]
  } else {
    throw InfraError('Missing location-references.json or legacy location-reference.json. Run draft-scenes explicitly.', { stage: 'comic:location-reference' })
  }
  const byId = new Map(snapshots.map(snapshot => [snapshot.snapshotId, snapshot]))
  const ordered: ResolvedLocationReference[] = []
  const seen = new Set<string>()
  for (const input of panels) {
    const panel = input.bundleData.panels[0]
    if (!panel) throw ValidationError('Panel bundle is missing its panel payload', { stage: 'comic:location-reference' })
    const snapshotId = input.bundleData.schemaVersion === 3 ? input.bundleData.locationSnapshotId : panel.locationSnapshotId
    const expectedKey = input.bundleData.schemaVersion === 3 ? undefined : panel.locationKey
    if (!snapshotId) throw ValidationError('Panel bundle omits its location snapshot ID', { stage: 'comic:location-reference' })
    const snapshot = byId.get(snapshotId)
    const sourceViewIndices = snapshot?.schemaVersion === 2 ? snapshot.sourceViews?.map(view => LOCATION_VIEWS.indexOf(view.view)) ?? [] : []
    const invalidV2Provenance = snapshot?.schemaVersion === 2 && (!Array.isArray(snapshot.sourceViews) || snapshot.sourceViews.length === 0 || snapshot.sourceViews[0]?.view !== 'establishing' || !snapshot.sourceViews.every(view => LOCATION_VIEWS.includes(view.view) && !!view.generationId && /^[a-f0-9]{64}$/.test(view.imageSha256)) || new Set(sourceViewIndices).size !== sourceViewIndices.length || sourceViewIndices.some((index, position) => position > 0 && index <= sourceViewIndices[position - 1]!))
    if (!snapshot || (snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2) || !snapshot.sheet?.path || invalidV2Provenance || (expectedKey && snapshot.locationKey !== expectedKey)) {
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

export const resolveLocationReferenceAcrossPanels = (panels: PanelPrimaryReferenceInput[]): string => {
  const references = resolveLocationReferencesAcrossPanels(panels)
  if (references.length !== 1) throw ValidationError(`Expected one location reference, found ${references.length}`, { stage: 'comic:location-reference' })
  return references[0]!.path
}

const buildResolved = (references: string[], primary: string[], prior: string[], secondary: string[], missing: string[]): ResolvedReferenceImages => ({
  all: references,
  primaryCharacterRefs: primary,
  sketchCharacterRefs: primary.filter(path => basename(path) === 'sketch-sheet.png'),
  canonicalCharacterRefs: primary.filter(path => basename(path).startsWith('source.')),
  priorPanelRefs: prior.filter(path => references.includes(path)),
  secondaryRefs: secondary.filter(path => references.includes(path)),
  missingPrimaryCharacterRefs: missing,
})

export const applyReferenceImageLimits = (
  _ordered: string[], primary: string[], _sketch: string[], _canonical: string[], prior: string[], secondary: string[], missing: string[], model: ImageGenerationModel
): ResolvedReferenceImages => {
  const optional = [...prior, ...secondary].filter(path => !primary.includes(path))
  const limited = trimOptionalContinuityReferences(model, primary, optional)
  if (limited.trimmed.length > 0) l.dim(`  Trimmed ${limited.trimmed.length} optional continuity reference(s) for ${model}`)
  return buildResolved(limited.references, primary, prior, secondary, missing)
}

export const findMissingReferenceImageFiles = async (paths: string[]): Promise<string[]> => {
  const results = await Promise.all(paths.map(async path => ({ path, exists: await Bun.file(path).exists() })))
  return results.filter(result => !result.exists).map(result => result.path)
}

export const resolveReferenceImages = (
  panelDirectory: string, entries: Dirent[], bundleData: PanelBundleData, model: ImageGenerationModel,
  options: { includePriorPanelRefs?: boolean; includeSecondaryRefs?: boolean } = {}
): ResolvedReferenceImages => {
  const primary = resolvePrimaryCharacterReferences(panelDirectory, entries, bundleData)
  const prior = (options.includePriorPanelRefs ?? false)
    ? entries.filter(entry => entry.isFile() && SUPPORTED_REFERENCE_EXTENSIONS.has(extname(entry.name).toLowerCase()) && PRIOR_PANEL_REFERENCE_PATTERN.test(entry.name))
      .map(entry => join(panelDirectory, entry.name)).sort()
    : []
  // Arbitrary images in panel directories are never promoted into identity refs.
  const locations = resolveLocationReferencesAcrossPanels([{ panelDirectory, entries, bundleData }])
  const required = [...primary.primaryCharacterRefs, ...locations.map(location => location.path)]
  const limited = trimOptionalContinuityReferences(model, required, prior)
  return {
    ...buildResolved(limited.references, primary.primaryCharacterRefs, prior, locations.map(location => location.path), primary.missingPrimaryCharacterRefs),
    ...(primary.characterReferences ? { characterReferences: primary.characterReferences } : {}),
    locationReferences: locations.map((location, index) => ({ ...location, referenceIndex: primary.primaryCharacterRefs.length + index + 1 })),
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
