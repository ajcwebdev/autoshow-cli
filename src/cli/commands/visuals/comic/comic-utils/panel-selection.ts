import { existsSync, lstatSync } from 'node:fs'
import { link, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type {
  AdoptRunCandidatesInput,
  ComicImageRunCandidate,
  ComicImageRunRecord,
  ComicPanelImageEvidence,
  ComicPanelSelectionHistoryEntry,
  ComicPanelSelectionRecord,
  ComicPanelSelectionStore,
  ComicPanelSelectionTransaction,
  ComicSelectionPresentationSnapshot,
  PipelineProviderState,
  PublishFirstPanelSelectionInput,
  PublishFirstPanelSelectionResult,
} from '~/types'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import * as appLog from '~/utils/app-logger/app-logger'
import { readFileBytes, writeFileExact } from '~/utils/bun-file-io'
import { hasErrorCode, ValidationError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { pathIsPhysicallyWithinRoot, pathIsWithinRoot } from '~/utils/runtime-containment'
import { listComicImageProviderStates, updateComicImageSelectionRefs } from './comic-manifest'
import { getSceneJsonPath, getSceneMetadataDirectoryForWorkspace, getSceneOutputDirectory, normalizeProjectPath } from './project-paths'
import { getPageComicImageFilename, PANEL_FILENAME_PADDING } from './scene-utils'
import { verifyStrictPngIntegrity } from './png-integrity'

/*
 * Persistence layout (all paths are scene-workspace relative):
 * - `panels/panel-NN.png`: the selected (canonical) panel that review and the slideshow read.
 * - `panels/<run-id>/panel-NN.png`, `pages/<run-id>/page-…png`: run-scoped candidates (never moved or deleted).
 * - `metadata/panel-selections.json`: `ComicPanelSelectionStore` with per-run evidence (`runs`), the current
 *   selection records (`selections`) and superseded selections (`history`).
 * - `metadata/panel-selection-history/panel-NN-<sha256>.png`: preserved bytes of every superseded selection.
 * - `metadata/panel-selection-transaction.json`: journal present only while an explicit replacement is in flight;
 *   the next selection operation rolls an interrupted replacement back before doing anything else.
 * - `metadata/.locks/comic-panel-selection`: cross-process lock serializing every selection write for the scene.
 */

const STAGE = 'comic:panel-selection'
const STORE_FILENAME = 'panel-selections.json'
const TRANSACTION_FILENAME = 'panel-selection-transaction.json'
const HISTORY_DIRECTORY = 'panel-selection-history'
const LOCK_NAME = 'comic-panel-selection'
const LEGACY_RUN_ID = 'legacy'
const UNRECORDED = 'unrecorded'
const RUN_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const PANEL_FILE_PATTERN = /^panel-(\d+)\.png$/u
const PAGE_FILE_PATTERN = /^page-(\d+)-panels-([\d_-]+)\.png$/u

type RunLayout = {
  selector: string
  runId: string
  model?: string | undefined
  variation?: string | undefined
  panelDirectory: string
  pageDirectory: string
}

type StoreSnapshot = { store: ComicPanelSelectionStore, text: string | null }

const getPanelComicImageFilename = (panelNumber: number): string => `panel-${String(panelNumber).padStart(PANEL_FILENAME_PADDING, '0')}.png`

const sha256Hex = (bytes: Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

const workspaceDirectory = (sceneSlug: string): string => getSceneOutputDirectory(sceneSlug)
const metadataDirectory = (sceneDirectory: string): string => getSceneMetadataDirectoryForWorkspace(sceneDirectory)
const storePath = (sceneDirectory: string): string => join(metadataDirectory(sceneDirectory), STORE_FILENAME)
const transactionPath = (sceneDirectory: string): string => join(metadataDirectory(sceneDirectory), TRANSACTION_FILENAME)
const canonicalPanelPath = (panelNumber: number): string => `panels/${getPanelComicImageFilename(panelNumber)}`
const historyPanelPath = (panelNumber: number, sha256: string): string =>
  `metadata/${HISTORY_DIRECTORY}/panel-${String(panelNumber).padStart(2, '0')}-${sha256}.png`

const emptyStore = (): ComicPanelSelectionStore => ({ schemaVersion: 1, runs: [], selections: [], history: [] })

const assertPanelNumber = (panelNumber: number): void => {
  if (!Number.isInteger(panelNumber) || panelNumber < 1) throw ValidationError(`Panel number must be a positive integer, received ${String(panelNumber)}.`, { stage: STAGE })
}

const parseRunSelector = (runId: string): string[] => {
  const segments = runId.split('/')
  if (runId.length === 0 || segments.length > 3 || segments.some(segment => !RUN_SEGMENT_PATTERN.test(segment))) {
    throw ValidationError(`Invalid image run ID "${runId}". Use the run ID reported by generate-images, or <run-id>/<model> or <run-id>/<variation>/<model> for a historical multi-model run.`, { stage: STAGE })
  }
  return segments
}

/** Resolve a caller-supplied path to a scene-workspace-relative POSIX path, rejecting anything outside the workspace. */
const toWorkspaceRelative = (sceneDirectory: string, path: string): string => {
  const candidates = isAbsolute(path) ? [path] : [resolve(path), resolve(sceneDirectory, path)]
  const inside = candidates.find(candidate => pathIsWithinRoot(sceneDirectory, candidate))
  if (!inside) throw ValidationError(`Image path is outside the scene workspace: ${normalizeProjectPath(path)}`, { stage: STAGE })
  const relativePath = normalizeProjectPath(relative(resolve(sceneDirectory), inside))
  if (relativePath === '' || relativePath.startsWith('../')) throw ValidationError(`Image path is outside the scene workspace: ${normalizeProjectPath(path)}`, { stage: STAGE })
  return relativePath
}

const assertContainedPath = (sceneDirectory: string, path: string): void => {
  if (!pathIsPhysicallyWithinRoot(sceneDirectory, path)) throw ValidationError(`Path resolves outside the scene workspace: ${path}`, { stage: STAGE })
}

const assertCanonicalSlot = (sceneDirectory: string, panelNumber: number): void => {
  assertPanelNumber(panelNumber)
  const path = join(sceneDirectory, canonicalPanelPath(panelNumber))
  assertContainedPath(sceneDirectory, resolve(path, '..'))
  const entry = lstatSync(path, { throwIfNoEntry: false })
  if (entry && !entry.isFile()) throw ValidationError(`Canonical panel ${panelNumber} must be a regular file; linked selections cannot be replaced.`, { stage: STAGE })
}

const readContainedBytes = async (sceneDirectory: string, relativePath: string): Promise<Buffer> => {
  const absolute = join(sceneDirectory, relativePath)
  if (!pathIsPhysicallyWithinRoot(sceneDirectory, absolute)) throw ValidationError(`Image path resolves outside the scene workspace: ${relativePath}`, { stage: STAGE })
  try {
    return await readFileBytes(absolute)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) throw ValidationError(`Image file is missing: ${relativePath}`, { stage: STAGE })
    throw error
  }
}

const readOptionalBytes = async (path: string): Promise<Buffer | undefined> => {
  try {
    return await readFileBytes(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) return undefined
    throw error
  }
}

/** Verify PNG framing and checksums, inflate the full image data, and return the hash and decoded dimensions. */
export const inspectComicPanelImage = (bytes: Uint8Array, label: string): ComicPanelImageEvidence => {
  try {
    return verifyStrictPngIntegrity(bytes)
  } catch (error) {
    throw ValidationError(`${label} is not a decodable PNG (${error instanceof Error ? error.message : String(error)}).`, { stage: STAGE })
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const parseStore = (text: string, path: string): ComicPanelSelectionStore => {
  let value: unknown
  try { value = JSON.parse(text) } catch { value = undefined }
  if (!isRecord(value) || value['schemaVersion'] !== 1 || !Array.isArray(value['runs']) || !Array.isArray(value['selections']) || !Array.isArray(value['history'])) {
    throw ValidationError(`Panel selection record is unreadable: ${normalizeProjectPath(path)}. Restore it from the scene history before selecting panels.`, { stage: STAGE })
  }
  return value as unknown as ComicPanelSelectionStore
}

const readStoreSnapshot = async (sceneDirectory: string): Promise<StoreSnapshot> => {
  const path = storePath(sceneDirectory)
  const bytes = await readOptionalBytes(path)
  if (!bytes) return { store: emptyStore(), text: null }
  const text = bytes.toString('utf8')
  return { store: parseStore(text, path), text }
}

/** Recorded SHA-256 for individual panels and paths of larger, locally composed pages. */
export const readRecordedComicImageEvidence = async (sceneDirectory: string) => {
  const { store } = await readStoreSnapshot(sceneDirectory)
  const panelHashes = new Map<string, string>()
  const localGrids = new Set<string>()
  for (const run of store.runs) {
    for (const panel of run.panels) panelHashes.set(panel.candidatePath, panel.sha256)
    for (const page of run.pages ?? []) {
      if (page.kind === 'local-grid') localGrids.add(page.candidatePath)
    }
  }
  for (const selection of store.selections) panelHashes.set(canonicalPanelPath(selection.panelNumber), selection.sha256)
  return { panelHashes, localGrids }
}

const writeAtomically = async (path: string, data: string | Uint8Array): Promise<void> => {
  const temporary = join(resolve(path, '..'), `.${basename(path)}.${process.pid}.${crypto.randomUUID()}.tmp`)
  try {
    await writeFileExact(temporary, data)
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

const writeStore = async (sceneDirectory: string, store: ComicPanelSelectionStore): Promise<void> => {
  await mkdir(metadataDirectory(sceneDirectory), { recursive: true })
  await writeAtomically(storePath(sceneDirectory), `${JSON.stringify(store, null, 2)}\n`)
}

const sceneQueues = new Map<string, Promise<unknown>>()

/** Serialize selection writes per scene: in-process queue first, then a cross-process lock directory. */
const withSceneSelectionLock = async <T>(sceneDirectory: string, action: () => Promise<T>): Promise<T> => {
  const key = resolve(sceneDirectory)
  const previous = sceneQueues.get(key) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(async () => {
    for (const path of [storePath(sceneDirectory), transactionPath(sceneDirectory), join(metadataDirectory(sceneDirectory), '.locks', LOCK_NAME), join(sceneDirectory, 'manifest.json')]) {
      assertContainedPath(sceneDirectory, resolve(path, '..'))
      assertContainedPath(sceneDirectory, path)
    }
    await mkdir(metadataDirectory(sceneDirectory), { recursive: true })
    return await withProcessLock(LOCK_NAME, async () => {
      await recoverInterruptedReplacement(sceneDirectory)
      return await action()
    }, { lockRoot: join(metadataDirectory(sceneDirectory), '.locks') })
  })
  sceneQueues.set(key, current)
  try {
    return await current
  } finally {
    if (sceneQueues.get(key) === current) sceneQueues.delete(key)
  }
}

const restoreFile = async (sceneDirectory: string, relativePath: string, bytes: Uint8Array): Promise<void> => {
  const absolute = join(sceneDirectory, relativePath)
  assertContainedPath(sceneDirectory, resolve(absolute, '..'))
  await mkdir(resolve(absolute, '..'), { recursive: true })
  await writeAtomically(absolute, bytes)
}

const readPreservedPanel = async (sceneDirectory: string, path: string, hash: string): Promise<Buffer> => {
  const bytes = await readContainedBytes(sceneDirectory, path)
  if (sha256Hex(bytes) !== hash) throw ValidationError(`Preserved selection ${path} no longer matches its recorded hash.`, { stage: STAGE })
  return bytes
}

const rollBackReplacement = async (sceneDirectory: string, transaction: ComicPanelSelectionTransaction): Promise<void> => {
  const invalid = () => ValidationError('Interrupted panel selection journal has an unsupported shape.', { stage: STAGE })
  if (!transaction || ![1, 2].includes(transaction.schemaVersion) || !Array.isArray(transaction.changes) || !transaction.changes.length || typeof transaction.startedAt !== 'string') throw invalid()
  if (transaction.storeBefore !== null) {
    if (typeof transaction.storeBefore !== 'string') throw invalid()
    parseStore(transaction.storeBefore, storePath(sceneDirectory))
  }
  const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value)
  const paths = new Set<string>()
  for (const change of transaction.changes) {
    if (!change || !Number.isSafeInteger(change.panelNumber) || change.panelNumber < 1 || change.canonicalPath !== canonicalPanelPath(change.panelNumber) || paths.has(change.canonicalPath) || !hash(change.nextSha256)) throw invalid()
    paths.add(change.canonicalPath)
    assertCanonicalSlot(sceneDirectory, change.panelNumber)
    if (change.previousSha256 === null && change.preservedPath === null) continue
    if (!hash(change.previousSha256) || change.preservedPath !== historyPanelPath(change.panelNumber, change.previousSha256)) throw invalid()
    await readPreservedPanel(sceneDirectory, change.preservedPath, change.previousSha256)
  }
  const refsBefore = transaction.schemaVersion === 2 ? transaction.refsBefore : undefined
  const presentationBefore = transaction.schemaVersion === 2 ? transaction.presentationBefore : undefined
  if (presentationBefore !== undefined) {
    if (refsBefore === null || !hash(presentationBefore?.audioHash)) throw invalid()
    if (presentationBefore.stage?.status !== 'full' || !hash(presentationBefore.presentation?.selectedPresentationId)) throw invalid()
  }
  if (transaction.schemaVersion === 2 && refsBefore !== null) {
    if (!Array.isArray(refsBefore)) throw invalid()
    for (const ref of refsBefore) {
      if (!ref || !paths.delete(ref.path) || !hash(ref.sha256)) throw invalid()
    }
  }
  for (const change of transaction.changes) {
    const relativePath = canonicalPanelPath(change.panelNumber)
    const canonical = join(sceneDirectory, relativePath)
    if (change.preservedPath && change.previousSha256) {
      const preserved = await readPreservedPanel(sceneDirectory, change.preservedPath, change.previousSha256)
      const current = await readOptionalBytes(canonical)
      if (!current || sha256Hex(current) !== change.previousSha256) await restoreFile(sceneDirectory, relativePath, preserved)
    } else {
      const current = await readOptionalBytes(canonical)
      if (current && sha256Hex(current) === change.nextSha256) await rm(canonical, { force: true })
    }
  }
  if (transaction.storeBefore === null) await rm(storePath(sceneDirectory), { force: true })
  else await writeAtomically(storePath(sceneDirectory), transaction.storeBefore)
  if (refsBefore !== null && (transaction.schemaVersion === 2 || existsSync(join(sceneDirectory, 'manifest.json')))) {
    const refs = transaction.changes.map(change => ({
      path: canonicalPanelPath(change.panelNumber),
      sha256: refsBefore === undefined ? change.previousSha256 : refsBefore.find(ref => ref.path === change.canonicalPath)?.sha256 ?? null,
    }))
    const panels = transaction.changes.map(change => ({ path: change.canonicalPath, sha256: change.previousSha256 }))
    await updateComicImageSelectionRefs({ sceneRunDir: sceneDirectory, refs, rollback: { panels, presentationBefore } })
  }
  await rm(transactionPath(sceneDirectory), { force: true })
}

const recoverInterruptedReplacement = async (sceneDirectory: string): Promise<void> => {
  const bytes = await readOptionalBytes(transactionPath(sceneDirectory))
  if (!bytes) return
  let transaction: ComicPanelSelectionTransaction
  try {
    transaction = JSON.parse(bytes.toString('utf8')) as ComicPanelSelectionTransaction
  } catch {
    throw ValidationError(`Interrupted panel selection journal is unreadable: ${normalizeProjectPath(transactionPath(sceneDirectory))}`, { stage: STAGE })
  }
  await rollBackReplacement(sceneDirectory, transaction)
}

const listDirectory = async (path: string) => await readdir(path, { withFileTypes: true }).catch(() => [])

const panelFilesIn = async (sceneDirectory: string, relativeDirectory: string): Promise<Array<{ panelNumber: number, path: string }>> =>
  (await listDirectory(join(sceneDirectory, relativeDirectory)))
    .flatMap(entry => {
      const match = entry.isFile() ? PANEL_FILE_PATTERN.exec(entry.name) : null
      return match?.[1] ? [{ panelNumber: Number(match[1]), path: `${relativeDirectory}/${entry.name}` }] : []
    })
    .sort((left, right) => left.panelNumber - right.panelNumber)

const parsePagePanels = (label: string): number[] => {
  if (label.includes('_')) return label.split('_').map(Number)
  const [first, last = first] = label.split('-').map(Number)
  if (first === undefined || last === undefined || !Number.isInteger(first) || !Number.isInteger(last) || last < first) return []
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

const pageFilesIn = async (sceneDirectory: string, relativeDirectory: string): Promise<Array<{ pageNumber: number, panelNumbers: number[], path: string }>> =>
  (await listDirectory(join(sceneDirectory, relativeDirectory)))
    .flatMap(entry => {
      const match = entry.isFile() ? PAGE_FILE_PATTERN.exec(entry.name) : null
      if (!match?.[1] || !match[2]) return []
      const panelNumbers = parsePagePanels(match[2])
      return panelNumbers.length > 0 && getPageComicImageFilename(Number(match[1]), panelNumbers) === entry.name
        ? [{ pageNumber: Number(match[1]), panelNumbers, path: `${relativeDirectory}/${entry.name}` }]
        : []
    })
    .sort((left, right) => left.pageNumber - right.pageNumber)

const layoutHasOutputs = async (sceneDirectory: string, layout: Pick<RunLayout, 'panelDirectory' | 'pageDirectory'>): Promise<boolean> =>
  (await panelFilesIn(sceneDirectory, layout.panelDirectory)).length > 0 || (await pageFilesIn(sceneDirectory, layout.pageDirectory)).length > 0

const subdirectoryNames = async (sceneDirectory: string, relativeDirectories: string[]): Promise<string[]> => {
  const names = new Set<string>()
  for (const directory of relativeDirectories) {
    for (const entry of await listDirectory(join(sceneDirectory, directory))) {
      if (entry.isDirectory() && RUN_SEGMENT_PATTERN.test(entry.name)) names.add(entry.name)
    }
  }
  return [...names].sort()
}

/** Discover the current (`<run-id>/`) and historical (`<run-id>/<model>/`, `<run-id>/<variation>/<model>/`) layouts of a run. */
const discoverRunLayouts = async (sceneDirectory: string, runId: string): Promise<RunLayout[]> => {
  const layouts: RunLayout[] = []
  const direct = { panelDirectory: `panels/${runId}`, pageDirectory: `pages/${runId}` }
  if (await layoutHasOutputs(sceneDirectory, direct)) layouts.push({ selector: runId, runId, ...direct })
  for (const first of await subdirectoryNames(sceneDirectory, [direct.panelDirectory, direct.pageDirectory])) {
    const modelLayout = { panelDirectory: `${direct.panelDirectory}/${first}`, pageDirectory: `${direct.pageDirectory}/${first}` }
    if (await layoutHasOutputs(sceneDirectory, modelLayout)) layouts.push({ selector: `${runId}/${first}`, runId, model: first, ...modelLayout })
    for (const second of await subdirectoryNames(sceneDirectory, [modelLayout.panelDirectory, modelLayout.pageDirectory])) {
      const variationLayout = { panelDirectory: `${modelLayout.panelDirectory}/${second}`, pageDirectory: `${modelLayout.pageDirectory}/${second}` }
      if (await layoutHasOutputs(sceneDirectory, variationLayout)) layouts.push({ selector: `${runId}/${first}/${second}`, runId, variation: first, model: second, ...variationLayout })
    }
  }
  return layouts
}

const readManifestImageStates = async (sceneDirectory: string): Promise<PipelineProviderState[]> => {
  const manifest = await readManifest(sceneDirectory, { verifyArtifacts: false }).catch(() => undefined)
  const item = manifest?.command === 'comic' && manifest.items.length === 1 ? manifest.items[0] : undefined
  if (!item) return []
  try { return listComicImageProviderStates(item) } catch { return [] }
}

const statesForRun = (states: PipelineProviderState[], runId: string): PipelineProviderState[] =>
  states.filter(state => state.metadata['runId'] === runId && typeof state.model === 'string' && state.model.length > 0)

const resolveLayoutIdentity = (layout: RunLayout, states: PipelineProviderState[]): { service: string, model: string } => {
  const runStates = statesForRun(states, layout.runId)
  if (layout.model) {
    const recorded = runStates.find(state => state.model === layout.model)
    // Historical directories name their model; a model no longer in the registry keeps its identity with an unrecorded service.
    return { service: recorded?.service ?? findRegistryServiceForModel('image', layout.model) ?? UNRECORDED, model: layout.model }
  }
  const models = [...new Set(runStates.map(state => state.model as string))]
  if (models.length > 1) {
    throw ValidationError(`Image run ${layout.runId} recorded several image models (${models.join(', ')}) but its candidates are not separated by model; select candidates explicitly with --panels after confirming their model.`, { stage: STAGE })
  }
  const model = models[0]
  if (model) {
    const service = runStates.find(state => state.model === model)?.service ?? findRegistryServiceForModel('image', model)
    if (service) return { service, model }
  }
  throw ValidationError(`Image run ${layout.runId} has no recorded image model; it cannot be verified for selection.`, { stage: STAGE })
}

const buildRecordFromLayout = async (sceneDirectory: string, layout: RunLayout, states: PipelineProviderState[]): Promise<ComicImageRunRecord> => {
  const identity = resolveLayoutIdentity(layout, states)
  const panelFiles = await panelFilesIn(sceneDirectory, layout.panelDirectory)
  const panels: ComicImageRunCandidate[] = []
  for (const file of panelFiles) {
    const evidence = inspectComicPanelImage(await readContainedBytes(sceneDirectory, file.path), `Run ${layout.selector} panel ${file.panelNumber}`)
    panels.push({ panelNumber: file.panelNumber, candidatePath: file.path, ...evidence })
  }
  const pageKind = panelFiles.length > 0 ? 'local-grid' as const : 'provider-page' as const
  const pages = (await pageFilesIn(sceneDirectory, layout.pageDirectory)).map(page => ({ pageNumber: page.pageNumber, panelNumbers: page.panelNumbers, candidatePath: page.path, kind: pageKind }))
  const createdAt = await stat(join(sceneDirectory, panelFiles.length > 0 ? layout.panelDirectory : layout.pageDirectory)).then(info => info.mtime.toISOString()).catch(() => new Date(0).toISOString())
  return { runId: layout.selector, service: identity.service, model: identity.model, panels, ...(pages.length > 0 ? { pages } : {}), createdAt }
}

const filterLayouts = (layouts: RunLayout[], segments: string[]): RunLayout[] => {
  if (segments.length === 1) return layouts
  if (segments.length === 2) return layouts.filter(layout => (layout.model === segments[1] && !layout.variation) || layout.variation === segments[1])
  return layouts.filter(layout => layout.variation === segments[1] && layout.model === segments[2])
}

const knownRunsHint = (store: ComicPanelSelectionStore): string =>
  store.runs.length > 0 ? ` Recorded runs: ${store.runs.map(run => run.runId).join(', ')}.` : ''

const findRunRecord = async (sceneDirectory: string, runId: string, store: ComicPanelSelectionStore): Promise<ComicImageRunRecord | undefined> => {
  const segments = parseRunSelector(runId)
  const recorded = store.runs.find(run => run.runId === runId)
  if (recorded) return recorded
  const matches = filterLayouts(await discoverRunLayouts(sceneDirectory, segments[0] as string), segments)
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw ValidationError(`Image run "${runId}" is ambiguous; it contains candidates for several models or variations. Choose one: ${matches.map(layout => layout.selector).join(', ')}.`, { stage: STAGE })
  }
  return await buildRecordFromLayout(sceneDirectory, matches[0] as RunLayout, await readManifestImageStates(sceneDirectory))
}

const resolveRunRecord = async (sceneDirectory: string, runId: string, store: ComicPanelSelectionStore): Promise<ComicImageRunRecord> => {
  const record = await findRunRecord(sceneDirectory, runId, store)
  if (!record) throw ValidationError(`Unknown image run "${runId}" for this scene: no candidates were found under panels/ or pages/.${knownRunsHint(store)}`, { stage: STAGE })
  return record
}

const normalizeRunRecord = (sceneDirectory: string, record: ComicImageRunRecord): ComicImageRunRecord => {
  parseRunSelector(record.runId)
  if (!record.service || !record.model) throw ValidationError(`Image run ${record.runId} must record its service and model.`, { stage: STAGE })
  const panels = record.panels.map(panel => {
    assertPanelNumber(panel.panelNumber)
    return { ...panel, candidatePath: assertCandidatePanelPath(sceneDirectory, panel.candidatePath, panel.panelNumber, record.runId) }
  })
  const pages = record.pages?.map(page => ({ ...page, candidatePath: toWorkspaceRelative(sceneDirectory, page.candidatePath) }))
  return { ...record, panels, ...(pages ? { pages } : {}) }
}

const mergeRunRecord = (store: ComicPanelSelectionStore, record: ComicImageRunRecord): ComicPanelSelectionStore => {
  const existing = store.runs.find(run => run.runId === record.runId)
  if (existing && (existing.service !== record.service || existing.model !== record.model)) {
    throw ValidationError(`Image run ${record.runId} was recorded for ${existing.service}/${existing.model}, not ${record.service}/${record.model}; each run uses exactly one model.`, { stage: STAGE })
  }
  const panels = new Map((existing?.panels ?? []).map(panel => [panel.panelNumber, panel] as const))
  for (const panel of record.panels) panels.set(panel.panelNumber, panel)
  const pages = new Map((existing?.pages ?? []).map(page => [page.candidatePath, page] as const))
  for (const page of record.pages ?? []) pages.set(page.candidatePath, page)
  const merged: ComicImageRunRecord = {
    runId: record.runId,
    service: record.service,
    model: record.model,
    panels: [...panels.values()].sort((left, right) => left.panelNumber - right.panelNumber),
    ...(pages.size > 0 ? { pages: [...pages.values()].sort((left, right) => left.pageNumber - right.pageNumber) } : {}),
    createdAt: existing?.createdAt ?? record.createdAt,
  }
  return { ...store, runs: [...store.runs.filter(run => run.runId !== record.runId), merged] }
}

/** Only individual final panels under `panels/` are eligible; composite pages and grids are rejected. */
const assertCandidatePanelPath = (sceneDirectory: string, candidatePath: string, panelNumber: number, runId?: string): string => {
  const relativePath = toWorkspaceRelative(sceneDirectory, candidatePath)
  if (relativePath.startsWith('pages/') || PAGE_FILE_PATTERN.test(basename(relativePath))) {
    throw ValidationError(`Composite page or grid ${relativePath} cannot be selected as panel ${panelNumber}; only individual final panels are eligible.`, { stage: STAGE })
  }
  if (!relativePath.startsWith('panels/') || relativePath === canonicalPanelPath(panelNumber) || basename(relativePath) !== getPanelComicImageFilename(panelNumber)) {
    throw ValidationError(`Candidate ${relativePath} is not a run-scoped individual image for panel ${panelNumber}.`, { stage: STAGE })
  }
  const runDirectory = runId ? `panels/${runId.split('/')[0]}/` : undefined
  if (runDirectory && !relativePath.startsWith(runDirectory)) throw ValidationError(`Candidate ${relativePath} is not inside run ${runId}'s directory ${runDirectory}.`, { stage: STAGE })
  return relativePath
}

const legacySelection = (panelNumber: number, evidence: ComicPanelImageEvidence, selectedAt: string): ComicPanelSelectionRecord => ({
  panelNumber,
  candidatePath: canonicalPanelPath(panelNumber),
  sha256: evidence.sha256,
  width: evidence.width,
  height: evidence.height,
  runId: LEGACY_RUN_ID,
  service: UNRECORDED,
  model: UNRECORDED,
  selectedAt,
  origin: 'legacy',
})

/** Inspect a canonical file; undecodable legacy canonicals are reported with zero dimensions rather than hidden. */
const canonicalEvidence = async (sceneDirectory: string, panelNumber: number): Promise<{ evidence: ComicPanelImageEvidence, mtime: string, decodable: boolean } | undefined> => {
  const path = join(sceneDirectory, canonicalPanelPath(panelNumber))
  const bytes = await readOptionalBytes(path)
  if (!bytes) return undefined
  const mtime = await stat(path).then(info => info.mtime.toISOString()).catch(() => new Date(0).toISOString())
  try {
    return { evidence: inspectComicPanelImage(bytes, `Selected panel ${panelNumber}`), mtime, decodable: true }
  } catch {
    return { evidence: { sha256: sha256Hex(bytes), width: 0, height: 0 }, mtime, decodable: false }
  }
}

const currentSelections = async (sceneDirectory: string, store: ComicPanelSelectionStore): Promise<Map<number, ComicPanelSelectionRecord>> => {
  const selections = new Map<number, ComicPanelSelectionRecord>()
  for (const file of await panelFilesIn(sceneDirectory, 'panels')) {
    const canonical = await canonicalEvidence(sceneDirectory, file.panelNumber)
    if (!canonical) continue
    const recorded = store.selections.find(selection => selection.panelNumber === file.panelNumber)
    selections.set(file.panelNumber, recorded && recorded.sha256 === canonical.evidence.sha256 ? recorded : legacySelection(file.panelNumber, canonical.evidence, canonical.mtime))
  }
  return selections
}

const readDeclaredScenePanels = async (sceneSlug: string): Promise<number[]> => {
  const path = getSceneJsonPath(sceneSlug)
  let value: unknown
  try { value = JSON.parse(await Bun.file(path).text()) } catch {
    throw ValidationError(`Reviewed scene is missing or unreadable at ${normalizeProjectPath(path)}; run comic draft-scenes before selecting panels.`, { stage: STAGE })
  }
  const panels = isRecord(value) && Array.isArray(value['panels']) ? value['panels'] : []
  const numbers = panels.flatMap(panel => isRecord(panel) && Number.isInteger(panel['number']) ? [panel['number'] as number] : [])
  if (numbers.length === 0) throw ValidationError(`Reviewed scene ${normalizeProjectPath(path)} declares no panels.`, { stage: STAGE })
  return [...new Set(numbers)].sort((left, right) => left - right)
}

/** Merge per-run evidence (idempotent by runId; panels merged by panelNumber). Survives later runs. */
export const recordImageRunCandidates = async (sceneSlug: string, record: ComicImageRunRecord): Promise<void> => {
  const sceneDirectory = workspaceDirectory(sceneSlug)
  const normalized = normalizeRunRecord(sceneDirectory, record)
  await withSceneSelectionLock(sceneDirectory, async () => {
    const { store } = await readStoreSnapshot(sceneDirectory)
    await writeStore(sceneDirectory, mergeRunRecord(store, normalized))
  })
}

const assertRecordedPanelEvidence = (runId: string, candidate: ComicImageRunCandidate, evidence: ComicPanelImageEvidence): void => {
  const label = `Run ${runId} panel ${candidate.panelNumber}`
  if (evidence.sha256 !== candidate.sha256) throw ValidationError(`${label} changed since it was recorded (stale hash): ${candidate.candidatePath}. Restore the recorded candidate before using it.`, { stage: STAGE })
  if (evidence.width !== candidate.width || evidence.height !== candidate.height) throw ValidationError(`${label} decodes as ${evidence.width}x${evidence.height}, not the recorded ${candidate.width}x${candidate.height}.`, { stage: STAGE })
}

/**
 * Verify a run-scoped candidate and fill the empty canonical slot `panels/panel-NN.png` with it. An existing selection,
 * including a legacy canonical file with no record, is never replaced. Re-calling after an interrupted publication completes it.
 */
export const publishFirstPanelSelection = async (input: PublishFirstPanelSelectionInput): Promise<PublishFirstPanelSelectionResult> => {
  assertPanelNumber(input.panelNumber)
  parseRunSelector(input.runId)
  const sceneDirectory = workspaceDirectory(input.sceneSlug)
  const candidatePath = assertCandidatePanelPath(sceneDirectory, input.candidatePath, input.panelNumber, input.runId)
  return await withSceneSelectionLock(sceneDirectory, async () => {
    const bytes = await readContainedBytes(sceneDirectory, candidatePath)
    const evidence = inspectComicPanelImage(bytes, `Panel ${input.panelNumber} candidate ${candidatePath}`)
    const snapshot = await readStoreSnapshot(sceneDirectory)
    const previousCandidate = snapshot.store.runs.find(run => run.runId === input.runId)?.panels.find(panel => panel.panelNumber === input.panelNumber)
    if (previousCandidate) {
      if (candidatePath !== previousCandidate.candidatePath) throw ValidationError(`Run ${input.runId} panel ${input.panelNumber} was recorded at ${previousCandidate.candidatePath}; cannot publish ${candidatePath}.`, { stage: STAGE })
      assertRecordedPanelEvidence(input.runId, previousCandidate, evidence)
    }
    let store = mergeRunRecord(snapshot.store, {
      runId: input.runId,
      service: input.service,
      model: input.model,
      panels: [{ panelNumber: input.panelNumber, candidatePath, ...evidence }],
      createdAt: new Date().toISOString(),
    })
    const canonicalRelative = canonicalPanelPath(input.panelNumber)
    const canonicalAbsolute = join(sceneDirectory, canonicalRelative)
    assertCanonicalSlot(sceneDirectory, input.panelNumber)
    const recorded = store.selections.find(selection => selection.panelNumber === input.panelNumber)
    const selected: ComicPanelSelectionRecord = {
      panelNumber: input.panelNumber,
      candidatePath,
      ...evidence,
      runId: input.runId,
      service: input.service,
      model: input.model,
      selectedAt: new Date().toISOString(),
      origin: 'first-generation',
    }
    const selectedMessage = { outcome: 'selected' as const, message: `Panel ${input.panelNumber} selected` }
    const existing = await readOptionalBytes(canonicalAbsolute)
    if (existing) {
      const existingSha = sha256Hex(existing)
      if (recorded && recorded.sha256 === existingSha && recorded.runId === input.runId && existingSha === evidence.sha256) {
        await writeStore(sceneDirectory, store)
        return selectedMessage
      }
      if (existingSha === evidence.sha256 && (!recorded || recorded.sha256 !== existingSha)) {
        store = { ...store, selections: [...store.selections.filter(selection => selection.panelNumber !== input.panelNumber), selected] }
        await writeStore(sceneDirectory, store)
        return selectedMessage
      }
      await writeStore(sceneDirectory, store)
      return { outcome: 'preserved', message: `New version of panel ${input.panelNumber} saved. Current selection preserved.` }
    }
    await mkdir(join(sceneDirectory, 'panels'), { recursive: true })
    const temporary = join(sceneDirectory, 'panels', `.${getPanelComicImageFilename(input.panelNumber)}.${process.pid}.${crypto.randomUUID()}.tmp`)
    try {
      await writeFileExact(temporary, bytes)
      try {
        await link(temporary, canonicalAbsolute)
      } catch (error) {
        if (!hasErrorCode(error, 'EEXIST')) throw error
        await writeStore(sceneDirectory, store)
        return { outcome: 'preserved', message: `New version of panel ${input.panelNumber} saved. Current selection preserved.` }
      }
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
    const written = await readOptionalBytes(canonicalAbsolute)
    if (!written || sha256Hex(written) !== evidence.sha256) throw ValidationError(`Selected panel ${input.panelNumber} did not match its verified candidate after publication.`, { stage: STAGE })
    store = { ...store, selections: [...store.selections.filter(selection => selection.panelNumber !== input.panelNumber), selected] }
    await writeStore(sceneDirectory, store)
    const otherSizes = new Set(store.selections.filter(selection => selection.panelNumber !== input.panelNumber).map(selection => `${selection.width}x${selection.height}`))
    otherSizes.delete(`${evidence.width}x${evidence.height}`)
    return otherSizes.size > 0
      ? { outcome: 'selected', message: `Panel ${input.panelNumber} selected (${evidence.width}x${evidence.height} differs from other selected panels: ${[...otherSizes].join(', ')})` }
      : selectedMessage
  })
}

export const findImageRunRecord = async (sceneSlug: string, runId: string): Promise<ComicImageRunRecord | undefined> => {
  const sceneDirectory = workspaceDirectory(sceneSlug)
  const { store } = await readStoreSnapshot(sceneDirectory)
  return await findRunRecord(sceneDirectory, runId, store)
}

/** Resolve a run's verified candidates. Throws ValidationError for unknown runs and for ambiguous historical multi-model or variation runs. */
export const readImageRunRecord = async (sceneSlug: string, runId: string): Promise<ComicImageRunRecord> => {
  const sceneDirectory = workspaceDirectory(sceneSlug)
  const { store } = await readStoreSnapshot(sceneDirectory)
  return await resolveRunRecord(sceneDirectory, runId, store)
}

/** Current selections keyed by panel number. Canonical files without a matching record are reported with origin `legacy`. */
export const readPanelSelections = async (sceneSlug: string): Promise<Map<number, ComicPanelSelectionRecord>> => {
  const sceneDirectory = workspaceDirectory(sceneSlug)
  const { store } = await readStoreSnapshot(sceneDirectory)
  return await currentSelections(sceneDirectory, store)
}

type PlannedAdoption = {
  panelNumber: number
  candidate: ComicImageRunCandidate
  bytes: Buffer
  previous: ComicPanelSelectionRecord | undefined
}

const requestedPanels = (record: ComicImageRunRecord, declared: number[], panels: AdoptRunCandidatesInput['panels']): number[] => {
  const available = new Set(record.panels.map(panel => panel.panelNumber))
  if (panels === undefined) {
    const missing = declared.filter(panelNumber => !available.has(panelNumber))
    if (missing.length > 0) {
      throw ValidationError(`Image run ${record.runId} is a subset run without panel(s) ${missing.join(', ')}; pass --panels with the panels to use (available: ${[...available].sort((left, right) => left - right).join(', ') || 'none'}).`, { stage: STAGE })
    }
    return declared
  }
  if (panels === 'all') return declared
  if (panels.length === 0) throw ValidationError('Select at least one panel to use.', { stage: STAGE })
  const unique = [...new Set(panels)].sort((left, right) => left - right)
  const undeclared = unique.filter(panelNumber => !declared.includes(panelNumber))
  if (undeclared.length > 0) throw ValidationError(`Panel(s) ${undeclared.join(', ')} are not declared by the reviewed scene.`, { stage: STAGE })
  return unique
}

const planAdoption = async (
  sceneDirectory: string,
  record: ComicImageRunRecord,
  requested: number[],
  declared: number[],
  selections: Map<number, ComicPanelSelectionRecord>
): Promise<PlannedAdoption[]> => {
  const missing = requested.filter(panelNumber => !record.panels.some(panel => panel.panelNumber === panelNumber))
  if (missing.length > 0) throw ValidationError(`Image run ${record.runId} has no individual candidate for panel(s) ${missing.join(', ')}.`, { stage: STAGE })
  const planned: PlannedAdoption[] = []
  for (const panelNumber of requested) {
    const candidate = record.panels.find(panel => panel.panelNumber === panelNumber) as ComicImageRunCandidate
    if (record.pages?.some(page => page.candidatePath === candidate.candidatePath)) throw ValidationError(`Composite page or grid ${candidate.candidatePath} cannot be selected as panel ${panelNumber}.`, { stage: STAGE })
    const candidatePath = assertCandidatePanelPath(sceneDirectory, candidate.candidatePath, panelNumber, record.runId)
    const bytes = await readContainedBytes(sceneDirectory, candidatePath)
    const evidence = inspectComicPanelImage(bytes, `Run ${record.runId} panel ${panelNumber}`)
    assertRecordedPanelEvidence(record.runId, candidate, evidence)
    planned.push({ panelNumber, candidate: { ...candidate, candidatePath }, bytes, previous: selections.get(panelNumber) })
  }
  const sizes = new Map<string, number[]>()
  const addSize = (key: string, panelNumber: number): void => { sizes.set(key, [...(sizes.get(key) ?? []), panelNumber]) }
  for (const item of planned) addSize(`${item.candidate.width}x${item.candidate.height}`, item.panelNumber)
  const undecodable: number[] = []
  for (const panelNumber of declared.filter(number => !requested.includes(number))) {
    const kept = selections.get(panelNumber)
    if (!kept) continue
    // An undecodable legacy canonical has no known size (recorded as 0x0); it cannot conflict, it needs replacement.
    if (kept.width === 0 || kept.height === 0) undecodable.push(panelNumber)
    else addSize(`${kept.width}x${kept.height}`, panelNumber)
  }
  if (sizes.size > 1) {
    throw ValidationError(`Selected panels would not share one size: ${[...sizes.entries()].map(([size, numbers]) => `${size} (panels ${numbers.join(', ')})`).join('; ')}. Use candidates that match the current selection.`, { stage: STAGE })
  }
  if (undecodable.length > 0) {
    appLog.write('warn', `Kept panel(s) ${undecodable.join(', ')} cannot be decoded and were left out of the size check; replace them before presentation.`, { category: 'command', metadata: { runId: record.runId, panels: undecodable } })
  }
  return planned
}

const preserveSelection = async (sceneDirectory: string, previous: ComicPanelSelectionRecord): Promise<string> => {
  const preservedPath = historyPanelPath(previous.panelNumber, previous.sha256)
  const absolute = join(sceneDirectory, preservedPath)
  const existing = await readOptionalBytes(absolute)
  if (existing && sha256Hex(existing) === previous.sha256) return preservedPath
  const bytes = await readContainedBytes(sceneDirectory, canonicalPanelPath(previous.panelNumber))
  if (sha256Hex(bytes) !== previous.sha256) throw ValidationError(`Selected panel ${previous.panelNumber} changed while it was being preserved.`, { stage: STAGE })
  await restoreFile(sceneDirectory, preservedPath, bytes)
  return preservedPath
}

/**
 * Explicitly adopt a run's individual panel candidates (`comic review --run <id> --use`). Every requested panel is validated
 * before any canonical file changes; prior bytes and provenance are preserved; a failure rolls every change back.
 */
export const adoptRunCandidates = async (input: AdoptRunCandidatesInput): Promise<ComicPanelSelectionRecord[]> => {
  const sceneDirectory = workspaceDirectory(input.sceneSlug)
  return await withSceneSelectionLock(sceneDirectory, async () => {
    const snapshot = await readStoreSnapshot(sceneDirectory)
    const record = await resolveRunRecord(sceneDirectory, input.runId, snapshot.store)
    const declared = await readDeclaredScenePanels(input.sceneSlug)
    const requested = requestedPanels(record, declared, input.panels)
    for (const panelNumber of declared) assertCanonicalSlot(sceneDirectory, panelNumber)
    const selections = await currentSelections(sceneDirectory, snapshot.store)
    const planned = await planAdoption(sceneDirectory, record, requested, declared, selections)
    const selectedAt = new Date().toISOString()
    const nextRecords = planned.map((item): ComicPanelSelectionRecord => {
      const unchanged = item.previous && item.previous.sha256 === item.candidate.sha256 && item.previous.runId === record.runId
      return unchanged ? item.previous as ComicPanelSelectionRecord : {
        panelNumber: item.panelNumber,
        candidatePath: item.candidate.candidatePath,
        sha256: item.candidate.sha256,
        width: item.candidate.width,
        height: item.candidate.height,
        runId: record.runId,
        service: record.service,
        model: record.model,
        selectedAt,
        origin: 'review-use',
      }
    })
    const changes = planned.filter((item, index) => nextRecords[index] !== item.previous)
    if (changes.length === 0) return nextRecords

    const history: ComicPanelSelectionHistoryEntry[] = []
    const journalChanges: ComicPanelSelectionTransaction['changes'] = []
    for (const item of changes) {
      const preservedPath = item.previous ? await preserveSelection(sceneDirectory, item.previous) : null
      if (item.previous && preservedPath) history.push({ ...item.previous, supersededAt: selectedAt, supersededByRunId: record.runId, preservedPath })
      journalChanges.push({ panelNumber: item.panelNumber, canonicalPath: canonicalPanelPath(item.panelNumber), previousSha256: item.previous?.sha256 ?? null, preservedPath, nextSha256: item.candidate.sha256 })
    }
    const publish = async (refsBefore: Array<{ path: string, sha256: string }> | null, presentationBefore?: ComicSelectionPresentationSnapshot) => {
      const transaction: ComicPanelSelectionTransaction = { schemaVersion: 2, startedAt: selectedAt, storeBefore: snapshot.text, changes: journalChanges, refsBefore, ...(presentationBefore ? { presentationBefore } : {}) }
      await writeAtomically(transactionPath(sceneDirectory), `${JSON.stringify(transaction, null, 2)}\n`)
      await mkdir(join(sceneDirectory, 'panels'), { recursive: true })
      for (const item of changes) {
        if (item.previous?.sha256 === item.candidate.sha256) continue
        await writeAtomically(join(sceneDirectory, canonicalPanelPath(item.panelNumber)), item.bytes)
      }
      const changedNumbers = new Set(changes.map(item => item.panelNumber))
      const nextStore: ComicPanelSelectionStore = {
        ...mergeRunRecord(snapshot.store, record),
        selections: [
          ...snapshot.store.selections.filter(selection => !changedNumbers.has(selection.panelNumber)),
          ...nextRecords.filter(next => changedNumbers.has(next.panelNumber)),
        ].sort((left, right) => left.panelNumber - right.panelNumber),
        history: [...snapshot.store.history, ...history],
      }
      await writeStore(sceneDirectory, nextStore)
    }
    try {
      if (existsSync(join(sceneDirectory, 'manifest.json'))) {
        await updateComicImageSelectionRefs({ sceneRunDir: sceneDirectory, refs: changes.map(item => ({ path: canonicalPanelPath(item.panelNumber), sha256: item.candidate.sha256 })), publish })
      } else await publish(null)
      await rm(transactionPath(sceneDirectory))
    } catch (error) {
      // A failed rollback keeps the journal so the next selection operation retries recovery before doing anything else.
      await recoverInterruptedReplacement(sceneDirectory)
      throw error
    }
    return nextRecords
  })
}
