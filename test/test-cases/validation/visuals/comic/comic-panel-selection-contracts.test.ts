import { afterEach, describe, expect, test } from 'bun:test'
import { lstat, mkdir, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { createProviderSettingsRecord } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'
import { canonicalTargetKey } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { collectImageArtifactRefs, generateImagesCommand } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-images-command'
import { reviewSheetCommand } from '~/cli/commands/visuals/comic/comic-commands/review/review-sheet-command'
import { auditComicSceneArtifactLineage } from '~/cli/commands/visuals/comic/comic-utils/comic-artifact-lineage-audit'
import { createStructuredScriptArtifactRef } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { COMIC_IMAGE_RUN_HISTORY_KEY, listComicImageProviderStates, updateComicImageManifest, writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { loadCanonicalPresentationPanels } from '~/cli/commands/visuals/comic/comic-utils/comic-presentation-inputs'
import { adoptRunCandidates, publishFirstPanelSelection, readImageRunRecord, readPanelSelections, recordImageRunCandidates } from '~/cli/commands/visuals/comic/comic-utils/panel-selection'
import { verifyStrictPngIntegrity } from '~/cli/commands/visuals/comic/comic-utils/png-integrity'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { ComicImageRequestInput, ComicPanelSelectionStore, ComicPanelSelectionTransaction, GeneratedImageResponse, ImageGenerationModel, PanelBundleData, PipelineProviderState, StructuredScriptData } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
import { encodeTestPngRows, makeTestPng, pngChunk, readBytes, SELECTION_SCENE_SLUG, SELECTION_SCRIPT_PATH, sha256Hex, snapshotSelectionState, writeRunCandidate, writeSelectionSceneInputs } from './comic-panel-selection-fixtures'

const SLUG = SELECTION_SCENE_SLUG
const MODEL: ImageGenerationModel = 'gpt-image-2.6-flare'
const temporaryDirectories: string[] = []

afterEach(async () => {
  resetPinnedRunDir()
  resetSceneRunContext()
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const setup = async (panelCount = 4): Promise<string> => {
  const workspace = await makeTempDir('autoshow-panel-selection-')
  temporaryDirectories.push(workspace)
  beginSceneRun(SLUG, { outputDir: workspace })
  await writeSelectionSceneInputs(workspace, panelCount)
  return workspace
}

const canonical = (workspace: string, panelNumber: number): string => join(workspace, 'panels', `panel-${String(panelNumber).padStart(2, '0')}.png`)
const readStore = async (workspace: string): Promise<ComicPanelSelectionStore> => JSON.parse(await Bun.file(join(workspace, 'metadata', 'panel-selections.json')).text()) as ComicPanelSelectionStore
const publish = async (runId: string, panelNumber: number, candidatePath: string) =>
  await publishFirstPanelSelection({ sceneSlug: SLUG, runId, service: 'openai', model: MODEL, panelNumber, candidatePath })

const imageState = (runId: string, service: string, model: string): PipelineProviderState => ({
  service, model, local: false, operation: 'comic-image', targetKey: canonicalTargetKey('comic-image', service, model, 'hosted-api'), transport: 'hosted-api', artifactDir: '.', status: 'succeeded', attempts: 1, options: {},
  settings: createProviderSettingsRecord({ service, operation: 'comic-image', request: { model }, local: {} }), metadata: { runId }, result: {},
})

const writeStructureManifest = async (workspace: string) => {
  const structuredText = await Bun.file(join(workspace, 'metadata', 'structured-script.json')).text()
  const { sourceIdentity } = JSON.parse(structuredText) as StructuredScriptData
  await writeInitialComicStructureManifest({ sceneRunDir: workspace, createdAt: '2026-11-20T00:00:00.000Z', sourceIdentity, structuredScript: createStructuredScriptArtifactRef(structuredText) })
  return { sourceIdentity }
}

/** Write and publish one run's candidates; returns the candidate bytes keyed by panel number. */
const seedRun = async (workspace: string, runId: string, panels: number[], seedBase: number, size: { width: number, height: number } = { width: 8, height: 6 }) => {
  const bytes = new Map<number, Buffer>()
  for (const panelNumber of panels) {
    const png = makeTestPng({ ...size, seed: seedBase + panelNumber })
    bytes.set(panelNumber, png)
    await publish(runId, panelNumber, await writeRunCandidate(workspace, runId, panelNumber, png))
  }
  return bytes
}

/** Record a run's candidates without publishing them, so canonical slots stay as the test arranges them. */
const writeRunAndRecord = async (workspace: string, runId: string, panels: number[]) => {
  const bytes = new Map<number, Buffer>()
  const candidates = []
  for (const panelNumber of panels) {
    const png = makeTestPng({ seed: 60 + panelNumber })
    bytes.set(panelNumber, png)
    candidates.push({ panelNumber, candidatePath: await writeRunCandidate(workspace, runId, panelNumber, png), ...verifyStrictPngIntegrity(png) })
  }
  await recordImageRunCandidates(SLUG, { runId, service: 'openai', model: MODEL, createdAt: new Date().toISOString(), panels: candidates })
  return bytes
}

describe('first publication into empty canonical slots', () => {
  test('fills an empty slot, records run/model/candidate/hash provenance, and decoded PNG integrity', async () => {
    const workspace = await setup()
    const png = makeTestPng({ seed: 3 })
    const candidatePath = await writeRunCandidate(workspace, 'run-a', 3, png)
    expect(await publish('run-a', 3, candidatePath)).toEqual({ outcome: 'selected', message: 'Panel 3 selected' })
    expect(await readBytes(canonical(workspace, 3))).toEqual(png)
    const store = await readStore(workspace)
    expect(store.selections).toEqual([expect.objectContaining({ panelNumber: 3, candidatePath: 'panels/run-a/panel-03.png', sha256: sha256Hex(png), width: 8, height: 6, runId: 'run-a', service: 'openai', model: MODEL, origin: 'first-generation' })])
    expect(store.runs).toEqual([expect.objectContaining({ runId: 'run-a', service: 'openai', model: MODEL, panels: [{ panelNumber: 3, candidatePath, sha256: sha256Hex(png), width: 8, height: 6 }] })])
    expect(store.history).toEqual([])
  })

  test('a later run saves a new candidate but preserves the existing selection bytes', async () => {
    const workspace = await setup()
    const first = await seedRun(workspace, 'run-a', [3], 0)
    const later = makeTestPng({ seed: 99 })
    const result = await publish('run-b', 3, await writeRunCandidate(workspace, 'run-b', 3, later))
    expect(result).toEqual({ outcome: 'preserved', message: 'New version of panel 3 saved. Current selection preserved.' })
    expect(await readBytes(canonical(workspace, 3))).toEqual(first.get(3)!)
    const store = await readStore(workspace)
    expect(store.selections.map(selection => [selection.panelNumber, selection.runId])).toEqual([[3, 'run-a']])
    expect(store.runs.map(run => run.runId).sort()).toEqual(['run-a', 'run-b'])
  })

  test('a legacy canonical panel with no selection record is never replaced and reads as a legacy selection', async () => {
    const workspace = await setup()
    const legacy = makeTestPng({ seed: 7 })
    await mkdir(join(workspace, 'panels'), { recursive: true })
    await writeFile(canonical(workspace, 2), legacy)
    const result = await publish('run-a', 2, await writeRunCandidate(workspace, 'run-a', 2, makeTestPng({ seed: 8 })))
    expect(result.outcome).toBe('preserved')
    expect(await readBytes(canonical(workspace, 2))).toEqual(legacy)
    const selections = await readPanelSelections(SLUG)
    expect(selections.get(2)).toMatchObject({ origin: 'legacy', runId: 'legacy', sha256: sha256Hex(legacy), candidatePath: 'panels/panel-02.png' })
  })

  test('competing first publications for one slot fill it exactly once', async () => {
    const workspace = await setup()
    const a = makeTestPng({ seed: 11 })
    const b = makeTestPng({ seed: 12 })
    const [pathA, pathB] = [await writeRunCandidate(workspace, 'run-a', 1, a), await writeRunCandidate(workspace, 'run-b', 1, b)]
    const outcomes = await Promise.all([publish('run-a', 1, pathA), publish('run-b', 1, pathB), publish('run-a', 1, pathA)])
    const store = await readStore(workspace)
    expect(store.selections).toHaveLength(1)
    const winner = store.selections[0]!
    expect(await readBytes(canonical(workspace, 1))).toEqual(winner.runId === 'run-a' ? a : b)
    expect(outcomes.filter(outcome => outcome.outcome === 'preserved')).toHaveLength(winner.runId === 'run-a' ? 1 : 2)
    expect(store.runs.map(run => run.runId).sort()).toEqual(['run-a', 'run-b'])
  })

  test('an interrupted publication (canonical written, record missing) completes without any new image', async () => {
    const workspace = await setup()
    const png = makeTestPng({ seed: 21 })
    const candidatePath = await writeRunCandidate(workspace, 'run-a', 4, png)
    await mkdir(join(workspace, 'panels'), { recursive: true })
    await writeFile(canonical(workspace, 4), png)
    const filesBefore = (await readdir(join(workspace, 'panels'), { recursive: true })).sort()
    expect(await publish('run-a', 4, candidatePath)).toEqual({ outcome: 'selected', message: 'Panel 4 selected' })
    expect((await readdir(join(workspace, 'panels'), { recursive: true })).sort()).toEqual(filesBefore)
    expect((await readStore(workspace)).selections).toEqual([expect.objectContaining({ panelNumber: 4, runId: 'run-a', sha256: sha256Hex(png), origin: 'first-generation' })])
    expect(await publish('run-a', 4, candidatePath)).toEqual({ outcome: 'selected', message: 'Panel 4 selected' })
    expect((await readStore(workspace)).selections).toHaveLength(1)
  })
})

describe('explicit adoption of a named run', () => {
  test('--panels 3 changes only panel 3 hash and origin, keeps prior bytes in history, and repeated --use is idempotent', async () => {
    const workspace = await setup()
    const runA = await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    const runB = await seedRun(workspace, 'run-b', [1, 2, 3, 4], 50)
    const before = await readPanelSelections(SLUG)
    const adopted = await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })
    expect(adopted).toEqual([expect.objectContaining({ panelNumber: 3, runId: 'run-b', origin: 'review-use', sha256: sha256Hex(runB.get(3)!) })])
    const after = await readPanelSelections(SLUG)
    for (const panelNumber of [1, 2, 4]) {
      expect(after.get(panelNumber)).toEqual(before.get(panelNumber)!)
      expect(await readBytes(canonical(workspace, panelNumber))).toEqual(runA.get(panelNumber)!)
    }
    expect(await readBytes(canonical(workspace, 3))).toEqual(runB.get(3)!)
    const store = await readStore(workspace)
    expect(store.history).toEqual([expect.objectContaining({ panelNumber: 3, runId: 'run-a', sha256: sha256Hex(runA.get(3)!), supersededByRunId: 'run-b', origin: 'first-generation' })])
    expect(await readBytes(join(workspace, store.history[0]!.preservedPath))).toEqual(runA.get(3)!)
    expect(await Bun.file(join(workspace, 'metadata', 'panel-selection-transaction.json')).exists()).toBe(false)

    const stable = await snapshotSelectionState(workspace)
    expect(await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })).toEqual(adopted)
    expect(await snapshotSelectionState(workspace)).toEqual(stable)
    expect((await readStore(workspace)).history).toHaveLength(1)
  })

  test('a subset run requires explicit --panels; with --panels it adopts only the available panel', async () => {
    const workspace = await setup()
    await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    const runB = await seedRun(workspace, 'run-b', [3], 50)
    const before = await snapshotSelectionState(workspace)
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b' })).rejects.toThrow('subset run without panel(s) 1, 2, 4')
    expect(await snapshotSelectionState(workspace)).toEqual(before)
    await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })
    expect(await readBytes(canonical(workspace, 3))).toEqual(runB.get(3)!)
  })

  test('an undecodable legacy canonical outside --panels does not block adoption with a 0x0 size conflict and stays untouched', async () => {
    const workspace = await setup()
    const runB = await writeRunAndRecord(workspace, 'run-b', [1, 2, 3])
    const undecodable = Buffer.concat([makeTestPng({ seed: 9 }), Buffer.from('trailing')])
    await mkdir(join(workspace, 'panels'), { recursive: true })
    await writeFile(canonical(workspace, 4), undecodable)
    const { result: adopted, events } = await captureLogEvents(async () => await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [1, 2, 3] }))
    expect(adopted.map(selection => selection.panelNumber)).toEqual([1, 2, 3])
    for (const panelNumber of [1, 2, 3]) expect(await readBytes(canonical(workspace, panelNumber))).toEqual(runB.get(panelNumber)!)
    expect(await readBytes(canonical(workspace, 4))).toEqual(undecodable)
    expect(events.some(event => event.message.includes('Kept panel(s) 4 cannot be decoded'))).toBe(true)
  })

  test('missing run, missing panel, stale hash, mismatched dimensions, composite page and outside paths are rejected before any change', async () => {
    const workspace = await setup()
    await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    await seedRun(workspace, 'run-b', [3], 50)
    await seedRun(workspace, 'run-wide', [3], 70, { width: 16, height: 10 })
    const before = await snapshotSelectionState(workspace)
    const unchanged = async () => expect(await snapshotSelectionState(workspace)).toEqual(before)

    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-missing', panels: [3] })).rejects.toThrow('Unknown image run "run-missing"')
    await unchanged()
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [2, 3] })).rejects.toThrow('has no individual candidate for panel(s) 2')
    await unchanged()
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [9] })).rejects.toThrow('not declared by the reviewed scene')
    await unchanged()
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-wide', panels: [3] })).rejects.toThrow('would not share one size')
    await unchanged()

    await mkdir(join(workspace, 'pages', 'run-b'), { recursive: true })
    await writeFile(join(workspace, 'pages', 'run-b', 'page-01-panels-01-02.png'), makeTestPng({ seed: 80 }))
    await expect(publish('run-b', 1, 'pages/run-b/page-01-panels-01-02.png')).rejects.toThrow('Composite page or grid')
    await expect(recordImageRunCandidates(SLUG, { runId: 'run-b', service: 'openai', model: MODEL, panels: [{ panelNumber: 1, candidatePath: 'pages/run-b/page-01-panels-01-02.png', sha256: 'a'.repeat(64), width: 8, height: 6 }], createdAt: new Date().toISOString() })).rejects.toThrow('Composite page or grid')
    await unchanged()

    const outside = await makeTempDir('autoshow-panel-selection-outside-')
    temporaryDirectories.push(outside)
    await writeFile(join(outside, 'panel-03.png'), makeTestPng({ seed: 81 }))
    await expect(publish('run-b', 3, join(outside, 'panel-03.png'))).rejects.toThrow('outside the scene workspace')
    await expect(publish('run-b', 3, '../panel-03.png')).rejects.toThrow('outside the scene workspace')
    await unchanged()

    // Stale hash: the recorded candidate is replaced on disk by different (still decodable) bytes.
    await writeFile(join(workspace, 'panels', 'run-b', 'panel-03.png'), makeTestPng({ seed: 82 }))
    const staleBefore = await snapshotSelectionState(workspace)
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })).rejects.toThrow('stale hash')
    expect(await snapshotSelectionState(workspace)).toEqual(staleBefore)
  })

  test('an undecodable candidate is rejected before it can fill a slot', async () => {
    const workspace = await setup()
    const candidatePath = await writeRunCandidate(workspace, 'run-a', 1, Buffer.from('not a png'))
    await expect(publish('run-a', 1, candidatePath)).rejects.toThrow('is not a decodable PNG')
    expect(await Bun.file(canonical(workspace, 1)).exists()).toBe(false)
  })

  test('a PNG missing only its IEND chunk is rejected before it can fill a slot (the lenient Bun.Image decoder accepts it)', async () => {
    const workspace = await setup()
    const valid = makeTestPng({ seed: 91 })
    const withoutIend = valid.subarray(0, valid.length - 12)
    expect((await new Bun.Image(withoutIend).metadata()).width).toBe(8)
    const candidatePath = await writeRunCandidate(workspace, 'run-a', 1, withoutIend)
    await expect(publish('run-a', 1, candidatePath)).rejects.toThrow('is not a decodable PNG')
    expect(await Bun.file(canonical(workspace, 1)).exists()).toBe(false)
  })


  test('a failed manifest update rolls every canonical file and the selection record back', async () => {
    const workspace = await setup()
    const runA = await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    await seedRun(workspace, 'run-b', [1, 2, 3, 4], 50)
    const storeBefore = await Bun.file(join(workspace, 'metadata', 'panel-selections.json')).text()
    await writeFile(join(workspace, 'manifest.json'), '{"command":"not-a-comic"}\n')
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [1, 3] })).rejects.toThrow()
    for (const panelNumber of [1, 2, 3, 4]) expect(await readBytes(canonical(workspace, panelNumber))).toEqual(runA.get(panelNumber)!)
    expect(await Bun.file(join(workspace, 'metadata', 'panel-selections.json')).text()).toBe(storeBefore)
    expect(await Bun.file(join(workspace, 'metadata', 'panel-selection-transaction.json')).exists()).toBe(false)
  })

  test('adoption rejects a linked canonical panel before changing any requested slot', async () => {
    const workspace = await setup(2)
    const original = await seedRun(workspace, 'run-a', [1, 2], 0)
    await seedRun(workspace, 'run-b', [1, 2], 50)
    await rm(canonical(workspace, 2))
    await symlink('run-a/panel-02.png', canonical(workspace, 2))
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b' })).rejects.toThrow('regular file')
    expect((await lstat(canonical(workspace, 2))).isSymbolicLink()).toBe(true)
    expect(await readBytes(canonical(workspace, 1))).toEqual(original.get(1)!)
  })

  test('recovery validates every destination and its physical directory before changing any slot', async () => {
    const workspace = await setup(2)
    const original = await seedRun(workspace, 'run-a', [1, 2], 0)
    const changes = [1, 2].map(panelNumber => ({
      panelNumber, canonicalPath: `panels/panel-0${panelNumber}.png`, previousSha256: null, preservedPath: null, nextSha256: sha256Hex(original.get(panelNumber)!),
    }))
    const journal = { schemaVersion: 2, startedAt: new Date().toISOString(), storeBefore: null, refsBefore: null, changes }
    const path = join(workspace, 'metadata', 'panel-selection-transaction.json')
    const recover = () => recordImageRunCandidates(SLUG, { runId: 'run-a', service: 'openai', model: MODEL, panels: [], createdAt: journal.startedAt })
    await writeFile(path, JSON.stringify({ ...journal, changes: [changes[0], { ...changes[1], canonicalPath: 'metadata/scene.json' }] }))
    await expect(recover()).rejects.toThrow('unsupported shape')
    expect(await readBytes(canonical(workspace, 1))).toEqual(original.get(1)!)
    const outside = await makeTempDir('autoshow-linked-panels-')
    temporaryDirectories.push(outside)
    await rename(join(workspace, 'panels'), join(outside, 'panels'))
    await symlink(join(outside, 'panels'), join(workspace, 'panels'))
    await writeFile(path, JSON.stringify(journal))
    await expect(recover()).rejects.toThrow('outside the scene workspace')
    expect(await readBytes(canonical(workspace, 1))).toEqual(original.get(1)!)
    expect(await Bun.file(path).exists()).toBe(true)
  })

  test('recovery removes the reference for a previously empty slot and retries a failed manifest restoration', async () => {
    const workspace = await setup(2)
    const { sourceIdentity } = await writeStructureManifest(workspace)
    const run = await seedRun(workspace, 'run-a', [1, 2], 0)
    const refs = [1, 2].map(n => ({ path: `panels/panel-0${n}.png`, sha256: sha256Hex(run.get(n)!) }))
    await updateComicImageManifest({ sceneRunDir: workspace, sourceIdentity, providers: [imageState('run-a', 'openai', MODEL)], artifactRefs: refs })
    const manifestPath = join(workspace, 'manifest.json')
    const manifest = await Bun.file(manifestPath).text()
    const storeBefore = await readStore(workspace)
    storeBefore.selections = storeBefore.selections.filter(selection => selection.panelNumber !== 2)
    const journalPath = join(workspace, 'metadata', 'panel-selection-transaction.json')
    const journal: ComicPanelSelectionTransaction = {
      schemaVersion: 2, startedAt: new Date().toISOString(), storeBefore: JSON.stringify(storeBefore), refsBefore: [],
      changes: [{ panelNumber: 2, canonicalPath: refs[1]!.path, previousSha256: null, preservedPath: null, nextSha256: refs[1]!.sha256 }],
    }
    await writeFile(journalPath, JSON.stringify(journal))
    await writeFile(manifestPath, '{}')
    const recover = () => recordImageRunCandidates(SLUG, { runId: 'run-a', service: 'openai', model: MODEL, panels: [], createdAt: journal.startedAt })
    await expect(recover()).rejects.toThrow()
    expect(await Bun.file(journalPath).exists()).toBe(true)
    await writeFile(manifestPath, manifest)
    await recover()
    const comic = (await readManifest(workspace))!.items[0]!.metadata['comic'] as { stages: { image: { artifactRefs: unknown[] } } }
    expect(comic.stages.image.artifactRefs).toEqual([refs[0]])
    expect(await Bun.file(canonical(workspace, 2)).exists()).toBe(false)
    expect(await Bun.file(journalPath).exists()).toBe(false)
  })

  test('a leftover replacement journal is rolled back by the next selection operation', async () => {
    const workspace = await setup()
    const runA = await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    const runB = await seedRun(workspace, 'run-b', [3], 50)
    const storeBefore = await Bun.file(join(workspace, 'metadata', 'panel-selections.json')).text()
    // Simulate a crash after the canonical write and before the record update completed.
    const previousSha256 = sha256Hex(runA.get(3)!)
    const preservedPath = `metadata/panel-selection-history/panel-03-${previousSha256}.png`
    await mkdir(join(workspace, 'metadata', 'panel-selection-history'), { recursive: true })
    await writeFile(join(workspace, preservedPath), runA.get(3)!)
    await writeFile(canonical(workspace, 3), runB.get(3)!)
    const journal: ComicPanelSelectionTransaction = { schemaVersion: 1, startedAt: new Date().toISOString(), storeBefore, changes: [{ panelNumber: 3, canonicalPath: 'panels/panel-03.png', previousSha256, preservedPath, nextSha256: sha256Hex(runB.get(3)!) }] }
    await writeFile(join(workspace, 'metadata', 'panel-selection-transaction.json'), JSON.stringify(journal))
    await writeFile(join(workspace, 'metadata', 'panel-selections.json'), storeBefore.replace('"first-generation"', '"review-use"'))

    await recordImageRunCandidates(SLUG, { runId: 'run-b', service: 'openai', model: MODEL, panels: [], createdAt: new Date().toISOString() })
    expect(await readBytes(canonical(workspace, 3))).toEqual(runA.get(3)!)
    expect(await Bun.file(join(workspace, 'metadata', 'panel-selection-transaction.json')).exists()).toBe(false)
    expect(JSON.parse(await Bun.file(join(workspace, 'metadata', 'panel-selections.json')).text())).toEqual(JSON.parse(storeBefore))
  })
})

describe('run lookup and per-run evidence', () => {
  test('a legacy multi-model run directory is ambiguous unless run/model or run/variation/model is named', async () => {
    const workspace = await setup()
    const flare = makeTestPng({ seed: 31 })
    await writeRunCandidate(workspace, 'run-legacy/gpt-image-2.6-flare', 1, flare)
    await writeRunCandidate(workspace, 'run-legacy/gemini-nano-banana-2.1', 1, makeTestPng({ seed: 32 }))
    await expect(readImageRunRecord(SLUG, 'run-legacy')).rejects.toThrow('is ambiguous')
    await expect(readImageRunRecord(SLUG, 'run-legacy')).rejects.toThrow('run-legacy/gemini-nano-banana-2.1, run-legacy/gpt-image-2.6-flare')
    expect(await readImageRunRecord(SLUG, 'run-legacy/gpt-image-2.6-flare')).toMatchObject({ runId: 'run-legacy/gpt-image-2.6-flare', model: 'gpt-image-2.6-flare', panels: [{ panelNumber: 1, candidatePath: 'panels/run-legacy/gpt-image-2.6-flare/panel-01.png', sha256: sha256Hex(flare) }] })

    const cinematic = makeTestPng({ seed: 33 })
    await writeRunCandidate(workspace, 'run-var/cinematic-depth/gpt-image-2.6-flare', 1, cinematic)
    await writeRunCandidate(workspace, 'run-var/canonical/gpt-image-2.6-flare', 1, makeTestPng({ seed: 34 }))
    await expect(readImageRunRecord(SLUG, 'run-var')).rejects.toThrow('is ambiguous')
    expect(await readImageRunRecord(SLUG, 'run-var/cinematic-depth/gpt-image-2.6-flare')).toMatchObject({ model: 'gpt-image-2.6-flare', panels: [{ panelNumber: 1, sha256: sha256Hex(cinematic) }] })
    const before = await snapshotSelectionState(workspace)
    await expect(readImageRunRecord(SLUG, 'run-unknown')).rejects.toThrow('Unknown image run')
    await expect(readImageRunRecord(SLUG, '../escape')).rejects.toThrow('Invalid image run ID')
    expect(await snapshotSelectionState(workspace)).toEqual(before)
  })

  test('updateComicImageManifest archives earlier run provider states, keeps only the current run in providers, and lookup still verifies the old run', async () => {
    const workspace = await setup()
    const { sourceIdentity } = await writeStructureManifest(workspace)
    await updateComicImageManifest({ sceneRunDir: workspace, sourceIdentity, providers: [imageState('run-a', 'gemini', 'gemini-nano-banana-2.1')], artifactRefs: [] })
    await updateComicImageManifest({ sceneRunDir: workspace, sourceIdentity, providers: [imageState('run-b', 'openai', MODEL)], artifactRefs: [] })
    await updateComicImageManifest({ sceneRunDir: workspace, sourceIdentity, providers: [imageState('run-b', 'openai', MODEL)], artifactRefs: [] })
    const item = (await readManifest(workspace, { verifyArtifacts: false }))!.items[0]!
    expect(item.providers.filter(provider => provider.operation === 'comic-image').map(provider => provider.metadata['runId'])).toEqual(['run-b'])
    expect((item.metadata[COMIC_IMAGE_RUN_HISTORY_KEY] as PipelineProviderState[]).map(provider => provider.metadata['runId'])).toEqual(['run-a'])
    expect(listComicImageProviderStates(item).map(provider => provider.metadata['runId'])).toEqual(['run-a', 'run-b'])

    // Run A has candidates on disk but no selection record: its identity comes from the archived provider state.
    await writeRunCandidate(workspace, 'run-a', 1, makeTestPng({ seed: 41 }))
    expect(await readImageRunRecord(SLUG, 'run-a')).toMatchObject({ runId: 'run-a', service: 'gemini', model: 'gemini-nano-banana-2.1' })
  })

  test('adoption rebinds the recorded image-stage refs, and the lineage audit flags a tampered selected or superseded panel', async () => {
    const workspace = await setup()
    const { sourceIdentity } = await writeStructureManifest(workspace)
    const runA = await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    const canonicalRefs = [1, 2, 3, 4].map(panelNumber => ({ path: `panels/panel-0${panelNumber}.png`, sha256: sha256Hex(runA.get(panelNumber)!) }))
    await updateComicImageManifest({ sceneRunDir: workspace, sourceIdentity, providers: [imageState('run-a', 'openai', MODEL)], artifactRefs: canonicalRefs })
    const runB = await seedRun(workspace, 'run-b', [3], 50)
    await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })
    const comic = (await readManifest(workspace, { verifyArtifacts: false }))!.items[0]!.metadata['comic'] as { stages: { image: { artifactRefs: Array<{ path: string, sha256: string }> } } }
    expect(comic.stages.image.artifactRefs).toEqual(canonicalRefs.map(ref => ref.path === 'panels/panel-03.png' ? { path: ref.path, sha256: sha256Hex(runB.get(3)!) } : ref))
    const passed = await auditComicSceneArtifactLineage(workspace)
    expect(passed.errors).toEqual([])
    expect(passed.status).toBe('passed')
    expect(passed.selectedPanels).toEqual([1, 2, 3, 4])

    const original = await readBytes(canonical(workspace, 2))
    await writeFile(canonical(workspace, 2), makeTestPng({ seed: 200 }))
    const tampered = await auditComicSceneArtifactLineage(workspace)
    expect(tampered.status).toBe('failed')
    expect(tampered.errors.length).toBeGreaterThan(0)
    expect(tampered.errors.every(error => error.code === 'checksum-mismatch' && error.path === 'panels/panel-02.png')).toBe(true)
    expect(tampered.errors.some(error => error.message.startsWith('Selected panel 2 from run run-a'))).toBe(true)
    await writeFile(canonical(workspace, 2), original)

    const preservedPath = (await readStore(workspace)).history[0]!.preservedPath
    await writeFile(join(workspace, preservedPath), makeTestPng({ seed: 201 }))
    const history = await auditComicSceneArtifactLineage(workspace)
    expect(history.errors).toEqual([expect.objectContaining({ code: 'checksum-mismatch', path: preservedPath })])
  })

  test('adoption succeeds when the manifest has no recorded image stage and leaves that stage unrequested', async () => {
    const workspace = await setup()
    await writeStructureManifest(workspace)
    await seedRun(workspace, 'run-a', [1, 2, 3, 4], 0)
    const runB = await seedRun(workspace, 'run-b', [3], 50)
    await adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-b', panels: [3] })
    expect(await readBytes(canonical(workspace, 3))).toEqual(runB.get(3)!)
    const comic = (await readManifest(workspace, { verifyArtifacts: false }))!.items[0]!.metadata['comic'] as { stages: { image: { requirement: string, artifactRefs: unknown[] } } }
    expect(comic.stages.image).toMatchObject({ requirement: 'not-requested', artifactRefs: [] })
    expect((await auditComicSceneArtifactLineage(workspace)).status).toBe('passed')
  })
})

describe('first generation feeds the slideshow; review previews and explicitly replaces (acceptance 5 and 6)', () => {
  const panelBundle = (panelNumber: number): PanelBundleData => ({
    schemaVersion: 4, snapshotId: 'character-snapshot', title: 'Selection Fixture', location: 'Cargo Bay',
    panels: [{
      number: panelNumber, description: `Authored staging ${panelNumber}.`,
      shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
      characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
      sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: { key: 'cargo-bay', raw: 'cargo-bay' } }],
      locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
    }],
  })

  const setupGeneration = async () => {
    const project = await makeTempDir('autoshow-panel-selection-generation-')
    temporaryDirectories.push(project)
    const workspace = join(project, 'scene')
    beginSceneRun(SLUG, { outputDir: workspace })
    await createLiveCharacterFixture(project)
    await createLiveLocationFixture(project, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: [SELECTION_SCRIPT_PATH] }], makeTestPng({ seed: 250 }))
    for (const panelNumber of [1, 2, 3, 4]) {
      const directory = join(workspace, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
      await mkdir(directory, { recursive: true })
      await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
    }
    const { scene } = await writeSelectionSceneInputs(workspace, 4, join(workspace, `${SLUG}.md`))
    return { workspace, scene }
  }

  /** Fake image transport: returns a distinct decodable 16x8 PNG per request and records which panel was requested. */
  const fakeImages = (seedBase: number, failPanels: number[] = []) => {
    const requested: number[] = []
    const returned = new Map<number, Buffer>()
    const requestImage = async (input: ComicImageRequestInput): Promise<GeneratedImageResponse> => {
      const panelNumber = Number(/Authored staging (\d+)\./u.exec(input.normalizedPrompt)?.[1])
      requested.push(panelNumber)
      if (failPanels.includes(panelNumber)) throw new Error(`fake transport failure for panel ${panelNumber}`)
      const png = makeTestPng({ width: 16, height: 8, seed: seedBase + panelNumber })
      returned.set(panelNumber, png)
      return { mode: 'edit', result: { imageBase64: png.toString('base64'), mimeType: 'image/png' } }
    }
    return { requested, returned, requestImage }
  }

  const runImages = async (runId: string, fake: ReturnType<typeof fakeImages>, options: { force?: boolean, panels?: number[] | 'all' } = {}) =>
    await generatePanelImages(SLUG, { model: MODEL, size: '1536x1024', quality: 'high', force: options.force ?? false, runId, concurrency: 1, panels: options.panels ?? 'all' }, { requestImage: fake.requestImage })

  const retryPanelOne = (workspace: string, runId: string, fake: ReturnType<typeof fakeImages>) => generateImagesCommand({
    scriptPath: join(workspace, `${SLUG}.md`), sceneSlug: SLUG, imageModel: MODEL, panels: [1], recoveryRunId: runId,
  }, {
    checkPanelPromptSourceCoverage: async () => ({ complete: true, totalSegments: 4, coveredSegments: 4, missingSegments: [], missingItems: [], promptFiles: [] }),
    runImages: options => runImages(options.runId, fake, { panels: [1] }),
  })

  test('resume rejects a different decodable PNG before changing recorded evidence or publishing a panel', async () => {
    const { workspace } = await setupGeneration()
    configurePinnedRunDir(workspace)
    await writeStructureManifest(workspace)
    const runId = 'interrupted'
    const original = makeTestPng({ width: 16, height: 8, seed: 10 })
    const replacement = makeTestPng({ width: 16, height: 8, seed: 11 })
    const candidatePath = await writeRunCandidate(workspace, runId, 1, original)
    await recordImageRunCandidates(SLUG, {
      runId, service: 'openai', model: MODEL, createdAt: new Date().toISOString(),
      panels: [{ panelNumber: 1, candidatePath, ...verifyStrictPngIntegrity(original) }],
    })
    const before = await readStore(workspace)
    expect(verifyStrictPngIntegrity(replacement).sha256).not.toBe(before.runs[0]!.panels[0]!.sha256)
    await writeFile(join(workspace, candidatePath), replacement)

    const resumed = fakeImages(20)
    const retry = () => retryPanelOne(workspace, runId, resumed)
    const { events } = await captureLogEvents(async () => {
      await expect(retry()).rejects.toThrow('1 image generation task(s) failed')
    })
    expect(events.some(event => event.message.includes('stale hash') && event.message.includes(candidatePath))).toBe(true)
    expect(resumed.requested).toEqual([])
    expect(await readStore(workspace)).toEqual(before)
    expect(await Bun.file(canonical(workspace, 1)).exists()).toBe(false)
    expect(await readBytes(join(workspace, candidatePath))).toEqual(replacement)

    await writeFile(join(workspace, candidatePath), original)
    await retry()
    expect(resumed.requested).toEqual([])
    expect(await readBytes(canonical(workspace, 1))).toEqual(original)
    expect((await readPanelSelections(SLUG)).get(1)).toMatchObject({ runId, candidatePath, sha256: sha256Hex(original) })
  })

  test('repairing an unrecorded corrupt selected PNG unblocks the same image command without a purchase', async () => {
    const { workspace } = await setupGeneration()
    configurePinnedRunDir(workspace)
    await writeStructureManifest(workspace)
    const selected = canonical(workspace, 1)
    const original = makeTestPng({ width: 16, height: 8, seed: 21 })
    const damaged = original.subarray(0, original.length - 12)
    await mkdir(join(workspace, 'panels'), { recursive: true })
    await writeFile(selected, damaged)
    const transport = fakeImages(40)
    await expect(retryPanelOne(workspace, 'repair', transport)).rejects.toThrow('Restore a valid PNG')
    expect(await readBytes(selected)).toEqual(damaged)
    await writeFile(selected, original)
    await retryPanelOne(workspace, 'repair', transport)
    expect(transport.requested).toEqual([])
    const manifest = await readManifest(workspace)
    expect(manifest?.items[0]?.metadata['comic']).toMatchObject({ stages: { image: { status: 'full', artifactRefs: [{ path: 'panels/panel-01.png', sha256: sha256Hex(original) }] } } })
  })

  test('run A auto-selects four panels for the slideshow inputs; run B --force preserves; review previews without change; --use --panels 3 replaces only panel 3', async () => {
    const { workspace, scene } = await setupGeneration()
    const runA = fakeImages(0)
    await runImages('run-a', runA)
    expect(runA.requested.sort()).toEqual([1, 2, 3, 4])
    const selections = await readPanelSelections(SLUG)
    expect([...selections.values()].map(selection => [selection.panelNumber, selection.runId, selection.origin])).toEqual([[1, 'run-a', 'first-generation'], [2, 'run-a', 'first-generation'], [3, 'run-a', 'first-generation'], [4, 'run-a', 'first-generation']])

    // Slideshow visual inputs come straight from the first-generation selection; review was never called.
    expect(await Bun.file(join(workspace, 'metadata', 'review')).exists()).toBe(false)
    const firstInputs = await loadCanonicalPresentationPanels(workspace, scene)
    expect(firstInputs.map(panel => [panel.panelNumber, panel.sha256, panel.width, panel.height])).toEqual([1, 2, 3, 4].map(panelNumber => [panelNumber, sha256Hex(runA.returned.get(panelNumber)!), 16, 8]))

    const runB = fakeImages(100)
    await runImages('run-b', runB, { force: true, panels: [3] })
    expect(runB.requested).toEqual([3])
    expect(await readBytes(canonical(workspace, 3))).toEqual(runA.returned.get(3)!)
    expect((await readPanelSelections(SLUG)).get(3)).toMatchObject({ runId: 'run-a', origin: 'first-generation' })

    const preserved = await snapshotSelectionState(workspace)
    await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG })
    await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, exportDoc: true })
    const preview = await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, run: 'run-b', exportDoc: true })
    expect(await snapshotSelectionState(workspace)).toEqual(preserved)
    expect(preview.changes).toEqual([])
    expect(preview.run).toMatchObject({ runId: 'run-b', model: MODEL, missingPanels: [1, 2, 4] })
    expect(preview.panels.map(panel => panel.candidate?.status)).toEqual(['missing', 'missing', 'alternative', 'missing'])
    expect(await Bun.file(preview.outputPath).text()).toContain('Subset run: no individual image for panel(s) 1, 2, 4.')

    const before = await readPanelSelections(SLUG)
    const used = await reviewSheetCommand({ scriptPath: join(workspace, `${SLUG}.md`), sceneSlug: SLUG, run: 'run-b', use: true, panels: [3] })
    expect(used.changes.map(change => [change.panelNumber, change.changed])).toEqual([[3, true]])
    const after = await readPanelSelections(SLUG)
    for (const panelNumber of [1, 2, 4]) expect(after.get(panelNumber)).toEqual(before.get(panelNumber)!)
    expect(after.get(3)).toMatchObject({ runId: 'run-b', origin: 'review-use', sha256: sha256Hex(runB.returned.get(3)!) })
    expect(after.get(3)!.sha256).not.toBe(before.get(3)!.sha256)

    const previewA = await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, run: 'run-a' })
    expect(previewA.panels.map(panel => panel.candidate?.status)).toEqual(['selected', 'selected', 'alternative', 'selected'])

    const nextInputs = await loadCanonicalPresentationPanels(workspace, scene)
    expect(nextInputs.map(panel => panel.sha256)).toEqual([sha256Hex(runA.returned.get(1)!), sha256Hex(runA.returned.get(2)!), sha256Hex(runB.returned.get(3)!), sha256Hex(runA.returned.get(4)!)])
  })

  test('an interrupted first run selects each completed panel once and resuming buys only the missing panels', async () => {
    const { workspace } = await setupGeneration()
    const interrupted = fakeImages(0, [3, 4])
    await expect(runImages('run-a', interrupted)).rejects.toThrow('2 image generation task(s) failed')
    expect([...(await readPanelSelections(SLUG)).keys()]).toEqual([1, 2])
    const paid = new Map([1, 2].map(panelNumber => [panelNumber, interrupted.returned.get(panelNumber)!]))

    // Panel 2's first publication was cut short: the paid candidate exists but the slot and record do not.
    await rm(canonical(workspace, 2))
    const store = await readStore(workspace)
    await writeFile(join(workspace, 'metadata', 'panel-selections.json'), JSON.stringify({ ...store, selections: store.selections.filter(selection => selection.panelNumber !== 2) }))

    const resumed = fakeImages(10)
    await runImages('run-a', resumed)
    expect(resumed.requested.sort()).toEqual([3, 4])
    for (const panelNumber of [1, 2]) expect(await readBytes(canonical(workspace, panelNumber))).toEqual(paid.get(panelNumber)!)
    for (const panelNumber of [3, 4]) expect(await readBytes(canonical(workspace, panelNumber))).toEqual(resumed.returned.get(panelNumber)!)
    const final = await readStore(workspace)
    expect([...final.selections].sort((left, right) => left.panelNumber - right.panelNumber).map(selection => [selection.panelNumber, selection.runId])).toEqual([[1, 'run-a'], [2, 'run-a'], [3, 'run-a'], [4, 'run-a']])
    expect(final.history).toEqual([])
  })
})

describe('shared strict PNG integrity verifier', () => {
  const valid = makeTestPng({ width: 5, height: 3, seed: 7 })

  test('a complete PNG returns its sha256 and decoded dimensions (decoded integrity only)', () => {
    expect(verifyStrictPngIntegrity(valid)).toEqual({ sha256: sha256Hex(valid), width: 5, height: 3 })
  })

  test('decodes every Adam7 pass and rejects an incomplete final pass', () => {
    const rows = [0, 1, 2, 3, 1, 4, 5, 6, 2, 7, 8, 9, 10, 11, 12]
    expect(verifyStrictPngIntegrity(encodeTestPngRows(rows, true))).toMatchObject({ width: 2, height: 2 })
    expect(() => verifyStrictPngIntegrity(encodeTestPngRows(rows.slice(0, -1), true))).toThrow('scanline size')
    rows[8] = 5
    expect(() => verifyStrictPngIntegrity(encodeTestPngRows(rows, true))).toThrow('row filter')
  })

  test('bounds decompression by the 16-bit row size and requires consecutive IDAT chunks', () => {
    const header = Buffer.from(valid.subarray(16, 29))
    header.writeUInt32BE(1, 0)
    header.writeUInt32BE(1, 4)
    header[8] = 16
    const encode = (...data: Buffer[]) => Buffer.concat([valid.subarray(0, 8), pngChunk('IHDR', header), ...data, pngChunk('IEND', Buffer.alloc(0))])
    const idat = pngChunk('IDAT', deflateSync(Buffer.alloc(7)))
    expect(verifyStrictPngIntegrity(encode(idat))).toMatchObject({ width: 1, height: 1 })
    expect(() => verifyStrictPngIntegrity(encode(pngChunk('IDAT', deflateSync(Buffer.alloc(8)))))).toThrow()
    expect(() => verifyStrictPngIntegrity(encode(idat, pngChunk('tEXt', Buffer.from('key\0value')), pngChunk('IDAT', Buffer.alloc(0))))).toThrow('nonconsecutive')
    expect(() => verifyStrictPngIntegrity(encode(idat, pngChunk('PLTE', Buffer.alloc(3))))).toThrow('order')
  })

  test('panel publication rejects valid chunk framing with an undecodable second scanline', async () => {
    const workspace = await setup()
    const invalid = encodeTestPngRows([0, 1, 2, 3, 4, 5, 6, 5, 7, 8, 9, 10, 11, 12], false)
    const path = await writeRunCandidate(workspace, 'invalid-row', 1, invalid)
    await expect(publish('invalid-row', 1, path)).rejects.toThrow('row filter')
    expect(await Bun.file(canonical(workspace, 1)).exists()).toBe(false)
  })

  test('rejects missing IEND, trailing bytes, a corrupted chunk CRC, and a truncated chunk', () => {
    const corrupted = Buffer.from(valid)
    corrupted[41] = (corrupted[41] as number) ^ 0xff
    expect(() => verifyStrictPngIntegrity(valid.subarray(0, valid.length - 12))).toThrow('framing')
    expect(() => verifyStrictPngIntegrity(Buffer.concat([valid, Buffer.from([0])]))).toThrow('framing')
    expect(() => verifyStrictPngIntegrity(corrupted)).toThrow('checksum')
    expect(() => verifyStrictPngIntegrity(valid.subarray(0, valid.length - 14))).toThrow('Truncated')
  })
})

describe('image-stage artifact refs track the bytes on disk', () => {
  test('deleted, replaced-against-selection and damaged files drop their retained refs, unchanged and non-image refs survive, and every ref matches disk', async () => {
    const workspace = await setup()
    await seedRun(workspace, 'run-a', [1, 2, 3], 10)
    const initial = await collectImageArtifactRefs(workspace, [])
    expect(initial.map(ref => ref.path)).toEqual(['panels/panel-01.png', 'panels/panel-02.png', 'panels/panel-03.png', 'panels/run-a/panel-01.png', 'panels/run-a/panel-02.png', 'panels/run-a/panel-03.png'])

    await rm(join(workspace, 'panels', 'run-a'), { recursive: true })
    await writeFile(canonical(workspace, 3), makeTestPng({ seed: 77 }))
    await writeRunCandidate(workspace, 'run-b', 4, Buffer.from('not a png'))
    const nonImageRef = { path: 'metadata/structured-script.json', sha256: 'f'.repeat(64) }
    const retained = [...initial, { path: 'panels/run-b/panel-04.png', sha256: '0'.repeat(64) }, nonImageRef]

    const refs = await collectImageArtifactRefs(workspace, retained)
    expect(refs.map(ref => ref.path)).toEqual(['metadata/structured-script.json', 'panels/panel-01.png', 'panels/panel-02.png'])
    expect(refs.find(ref => ref.path === nonImageRef.path)).toEqual(nonImageRef)
    for (const ref of refs.filter(ref => ref.path.startsWith('panels/'))) expect(ref.sha256).toBe(sha256Hex(await readBytes(join(workspace, ref.path))))
  })
})
