import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CanonicalComicItemMetadata, ComicRecoveryFlags, ComicRecoveryInput, ResumeTarget, StepEstimate } from '~/types'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/visuals/comic/comic-utils/comic-dialogue-plan'
import { writeVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/voice-reference-snapshot'
import { writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { captureComicImageRecoveryInputs, comicImageRecoveryHashFromFlags, currentComicImageRecoveryInputs, inspectLegacyComicImageOutputs, resolveComicImageRecoveryFlags } from '~/cli/commands/visuals/comic/comic-utils/comic-image-recovery'
import { recordComicRecoveryIntent } from '~/cli/commands/visuals/comic/comic-utils/comic-recovery-intent'
import { DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-utils'
import { planComicResume } from '~/cli/commands/setup-and-utilities/resume/resume-comic/comic-resume'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { seededPng } from '../../../test-utils/seeded-png-fixture'
import { buildComicAudioPhase2SnapshotEntry, buildComicAudioPhase2Structured, COMIC_AUDIO_PHASE_2_CREATED_AT as createdAt } from '../visuals/comic/comic-audio-phase-fixture'
import { createLiveCharacterFixture } from '../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../test-utils/live-location-reference-fixture'

const tempDirs = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'AUTOSHOW_REQUIRED_IMAGE_MODEL'], tempPrefix: 'autoshow-comic-legacy-intent-' })
afterEach(() => { resetPinnedRunDir(); resetSceneRunContext(); configureCharactersRoot('input/characters'); resetLoggerForInvocation(false) })

const GEMINI = 'gemini-nano-banana-2.1'
const OPENAI = 'gpt-image-2.6-flare'
const RUN = '2026-10-01_12-00-00-000'

/** The exact flag shape `comic generate-images` recorded before QA, blocking, variations and multi-model runs were retired. */
const legacyFlags = (overrides: Partial<{ providers: string[], qa: boolean, bloopers: boolean, blockingLayoutGuide: boolean, blockingHardKeys: string, variation: string, panelsPerImage: string, force: boolean }> = {}): ComicRecoveryFlags => ({
  target: 'images',
  provider: overrides.providers ?? [`gemini=${GEMINI}`],
  size: '1536x1024',
  quality: 'high',
  panels: 'all',
  qa: overrides.qa ?? false,
  'qa-provider': 'openai=gpt-6.1-sol',
  'max-repairs': '2',
  'provider-concurrency': '1',
  'concurrency-mode': 'ramp',
  force: overrides.force ?? false,
  bloopers: overrides.bloopers ?? false,
  'stop-on-provider-error': false,
  'blocking-layout-guide': overrides.blockingLayoutGuide ?? false,
  ...(overrides.blockingHardKeys ? { 'blocking-hard-keys': overrides.blockingHardKeys } : {}),
  ...(overrides.panelsPerImage ? { 'panels-per-image': overrides.panelsPerImage } : {}),
  ...(overrides.variation ? { variation: overrides.variation } : {}),
})

/** Historical plan hash computed independently of the current helper, exactly as the pre-removal recorder did. */
const historicalPlanHash = (flags: ComicRecoveryFlags, imageRunId: string): string => {
  const panelsPerImage = typeof flags['panels-per-image'] === 'string' ? Number(flags['panels-per-image']) : undefined
  return hashCanonicalTtsValue({ flags, imageRunId, finalPanelsPerImage: panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE, sketchPanelsPerImage: panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE })
}

const fixture = async () => {
  const root = await tempDirs.make('autoshow-comic-legacy-intent-')
  const source = '# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
  const scriptPath = join(root, 'scene.md')
  const run = join(root, 'run')
  await mkdir(join(run, 'metadata'), { recursive: true })
  await writeFile(scriptPath, source)
  const sourceIdentity = await createComicSourceIdentity(scriptPath, source)
  const structured = buildComicAudioPhase2Structured(sourceIdentity, source)
  const bytes = `${canonicalTtsJson(structured)}\n`
  const structuredScript = createStructuredScriptArtifactRef(bytes)
  await writeFile(join(run, structuredScript.path), bytes)
  await writeInitialComicStructureManifest({ sceneRunDir: run, createdAt, sourceIdentity, structuredScript })
  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredScript)
  const dialogue = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredScript, sceneRunIdentity, createdAt })
  const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialogue.dialoguePlanId, catalogHash: 'a'.repeat(64), briefSetHash: 'b'.repeat(64), createdAt, entries: [buildComicAudioPhase2SnapshotEntry('navigator', 'onyx', 'openai'), buildComicAudioPhase2SnapshotEntry('pilot', 'alloy', 'openai')] }
  await writeVoiceReferenceManifest(run, validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) }))
  configureCharactersRoot(join(root, 'characters'))
  configurePinnedRunDir(run)
  await createLiveCharacterFixture(root)
  await createLiveLocationFixture(root, [{ key: 'bridge', name: 'Bridge', specification: 'An empty bridge.', sourceScripts: ['scene.md'] }], seededPng(1))
  const panels = structured.sourceSegments.map((segment, index) => ({ number: index + 1, description: 'Empty bridge.', shotPlan: 'Wide shot.', characterKeys: [], speech: [{ speaker: { kind: 'character', characterKey: segment.speakerKey, offscreen: true }, line: segment.text }], sourceSegmentIds: [segment.id], sourceSegments: [segment], locationKey: 'bridge', designReferences: [] }))
  await writeFile(join(run, 'metadata/scene.json'), JSON.stringify({ schemaVersion: 4, title: 'Scene', location: 'Bridge', panels: panels.map(({ sourceSegments: _sourceSegments, ...panel }) => panel) }))
  for (const panel of panels) {
    const path = join(run, `metadata/panel-prompts/panel-0${panel.number}/prompt.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '```json\n' + JSON.stringify({ schemaVersion: 4, title: 'Scene', location: 'Bridge', panels: [panel] }) + '\n```\n')
  }
  delete process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  process.env['GEMINI_API_KEY'] = 'fixture'
  process.env['OPENAI_API_KEY'] = 'fixture'
  const target: ResumeTarget = { kind: 'comic', scope: 'single', dir: run, manifestPath: join(run, 'manifest.json') }
  return { root, run, scriptPath, target, sourceIdentity, sceneSlug: sourceIdentity.scriptSlug }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

const recordLegacyIntent = async (f: Fixture, flags: ComicRecoveryFlags, extraInputs: ComicRecoveryInput[] = [], planHash = historicalPlanHash(flags, RUN)): Promise<void> => {
  const inputs = [...await captureComicImageRecoveryInputs(f.run), ...extraInputs]
  await recordComicRecoveryIntent({ rootDir: f.run, sourceIdentity: f.sourceIdentity, stage: 'image', flags, inputs, planHash, imageRunId: RUN })
}

const writeOutput = async (f: Fixture, relativePath: string, seed: number): Promise<void> => {
  const path = join(f.run, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, seededPng(seed))
}

const hashes = async (run: string): Promise<Record<string, string>> => {
  const result: Record<string, string> = {}
  for (const item of await readdir(run, { recursive: true, withFileTypes: true })) if (item.isFile()) {
    const path = join(item.parentPath, item.name)
    result[path] = sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer()))
  }
  return result
}

const imageIntent = async (run: string) => ((await readManifest(run))!.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata).recovery!.image!
/** One image step and nothing else; checked field by field because nested asymmetric matchers are avoided here. */
const expectOnlyImageStep = (steps: readonly StepEstimate[], fields: Partial<StepEstimate>): void => {
  expect(steps.map(step => step.step)).toEqual(['image'])
  expect(steps[0]).toMatchObject(fields)
}
const noDispatch = () => installMockFetch(call => { throw new Error(`Legacy intent inspection must not dispatch: ${call.url}`) })

describe('legacy image intent resolution at the recovery boundary', () => {
  test('a current single-model intent passes through unchanged', () => {
    const flags = { target: 'images', provider: `gemini=${GEMINI}`, size: '1536x1024', quality: 'high', panels: 'all', force: false }
    expect(resolveComicImageRecoveryFlags(flags)).toEqual({ status: 'current', flags })
  })

  test('a one-element provider list with QA off and no variation normalizes to legacy-equivalent current flags', () => {
    const resolution = resolveComicImageRecoveryFlags(legacyFlags())
    expect(resolution).toMatchObject({ status: 'legacy-equivalent', model: GEMINI, explicitCanonicalVariation: false })
    if (resolution.status !== 'legacy-equivalent') throw new Error('Expected legacy-equivalent')
    expect(resolution.flags['provider']).toBe(`gemini=${GEMINI}`)
    for (const retired of ['qa', 'qa-provider', 'max-repairs', 'bloopers', 'blocking-layout-guide', 'blocking-hard-keys', 'variation']) expect(resolution.flags).not.toHaveProperty(retired)
    expect(resolveComicImageRecoveryFlags(legacyFlags({ variation: 'canonical' }))).toMatchObject({ status: 'legacy-equivalent', explicitCanonicalVariation: true })
  })

  const incompatibleCases: Array<[string, ComicRecoveryFlags, string]> = [
    ['several image models', legacyFlags({ providers: [`openai=${OPENAI}`, `gemini=${GEMINI}`] }), 'requested 2 image models'],
    ['automated QA', legacyFlags({ qa: true }), 'automated QA'],
    ['QA bloopers', legacyFlags({ bloopers: true }), 'bloopers'],
    ['the blocking layout guide', legacyFlags({ blockingLayoutGuide: true }), 'blocking workflow'],
    ['blocking hard keys', legacyFlags({ blockingHardKeys: 'side-swapped' }), 'blocking workflow'],
    ['a cinematic-depth variation', legacyFlags({ variation: 'cinematic-depth' }), 'prompt variations (cinematic-depth)'],
    ['canonical plus cinematic-depth variations', legacyFlags({ variation: 'canonical,cinematic-depth' }), 'prompt variations (canonical, cinematic-depth)'],
  ]
  for (const [label, flags, reason] of incompatibleCases) test(`an intent that depended on ${label} is incompatible`, () => {
    const resolution = resolveComicImageRecoveryFlags(flags)
    expect(resolution.status).toBe('incompatible')
    if (resolution.status !== 'incompatible') throw new Error('Expected incompatible')
    expect(resolution.reasons.join('; ')).toContain(reason)
  })

  test('the current hash helper verifies historical plan hashes without reinterpreting retired flags', () => {
    for (const flags of [legacyFlags(), legacyFlags({ qa: true, variation: 'canonical,cinematic-depth', panelsPerImage: '2' }), legacyFlags({ providers: [`openai=${OPENAI}`, `gemini=${GEMINI}`] })]) {
      expect(comicImageRecoveryHashFromFlags(flags, RUN)).toBe(historicalPlanHash(flags, RUN))
    }
    expect(comicImageRecoveryHashFromFlags(legacyFlags(), RUN)).not.toBe(comicImageRecoveryHashFromFlags(legacyFlags(), 'another-run'))
  })

  test('retired blocking inputs are filtered from recorded inputs; every other input is kept', () => {
    const kept = [{ path: 'metadata/scene.json', sha256: 'a'.repeat(64) }, { path: 'input/locations/bridge.png', sha256: 'b'.repeat(64), base: 'project' as const }]
    const retired = [{ path: 'metadata/blocking-plan.json', sha256: 'c'.repeat(64) }, { path: 'metadata/blocking/panel-01.json', sha256: 'd'.repeat(64) }]
    expect(currentComicImageRecoveryInputs({ schemaVersion: 1, flags: {}, inputs: [...kept, ...retired], planHash: 'x', charactersRoot: '/c', completed: false })).toEqual(kept)
  })
})

describe('legacy image intents through comic resume', () => {
  for (const qaEvidence of ['absent', 'failed', 'obsolete'] as const) {
    test(`old completed images with ${qaEvidence} QA reports are reused with zero dispatch (transport mock; decoded PNG integrity)`, async () => {
      const f = await fixture()
      await recordLegacyIntent(f, legacyFlags(), [{ path: 'metadata/blocking-plan.json', sha256: 'e'.repeat(64) }])
      for (const panelNumber of [1, 2]) await writeOutput(f, `panels/${RUN}/panel-0${panelNumber}.png`, 10 + panelNumber)
      if (qaEvidence === 'failed') await writeFile(join(f.run, `panels/${RUN}/page-qa-report.json`), JSON.stringify({ schemaVersion: 3, pages: [{ pageNumber: 1, hardFailure: true, result: { summary: 'Fail.' } }] }))
      if (qaEvidence === 'obsolete') await writeFile(join(f.run, `panels/${RUN}/page-qa-report.json`), JSON.stringify({ schemaVersion: 1, pages: [{ pageNumber: 1 }] }))
      const candidates = await Promise.all([1, 2].map(async panelNumber => await Bun.file(join(f.run, `panels/${RUN}/panel-0${panelNumber}.png`)).bytes()))
      const calls = noDispatch()

      const before = await hashes(f.run)
      const plan = await planComicResume(f.target)
      expect(plan.stages[0]).toMatchObject({ stage: 'image', action: 'resume' })
      expectOnlyImageStep(plan.stages[0]!.steps, { model: GEMINI, imageCount: 0, totalCost: 0 })
      expect(await hashes(f.run)).toEqual(before)

      await dispatchResume(f.run, {})
      expect(calls).toHaveLength(0)
      for (const [index, panelNumber] of [1, 2].entries()) {
        expect(await Bun.file(join(f.run, `panels/${RUN}/panel-0${panelNumber}.png`)).bytes()).toEqual(candidates[index]!)
        // The retained paid candidate fills the empty canonical slot without a new request.
        expect(await Bun.file(join(f.run, `panels/panel-0${panelNumber}.png`)).bytes()).toEqual(candidates[index]!)
      }
      if (qaEvidence !== 'absent') expect(await hashes(f.run)).toMatchObject({ [join(f.run, `panels/${RUN}/page-qa-report.json`)]: before[join(f.run, `panels/${RUN}/page-qa-report.json`)]! })
      expect((await imageIntent(f.run)).completed).toBe(true)
    }, 20_000)
  }

  test('a partially completed legacy generation-only intent prices one image step for the missing panel and no judge step', async () => {
    const f = await fixture()
    await recordLegacyIntent(f, legacyFlags())
    await writeOutput(f, `panels/${RUN}/panel-01.png`, 21)
    const calls = noDispatch()
    const before = await hashes(f.run)
    const plan = await planComicResume(f.target)
    expect(plan.stages[0]).toMatchObject({ action: 'resume' })
    expectOnlyImageStep(plan.stages[0]!.steps, { model: GEMINI, imageCount: 1 })
    expect(plan.estimate.steps.map(step => step.step)).toEqual(['image'])
    expect(plan.estimate.totalEstimatedCost).toBeGreaterThan(0)
    expect(await hashes(f.run)).toEqual(before)
    expect(calls).toHaveLength(0)
  })

  test('an explicit canonical variation with no retained outputs normalizes and prices both panels', async () => {
    const f = await fixture()
    await recordLegacyIntent(f, legacyFlags({ variation: 'canonical' }))
    const plan = await planComicResume(f.target)
    expect(plan.stages[0]).toMatchObject({ action: 'resume' })
    expectOnlyImageStep(plan.stages[0]!.steps, { model: GEMINI, imageCount: 2 })
  })

  test('a legacy selector that no longer re-resolves to the recorded flags is blocked', async () => {
    const f = await fixture()
    await recordLegacyIntent(f, legacyFlags({ providers: ['gemini'] }))
    const calls = noDispatch()
    const plan = await planComicResume(f.target)
    expect(plan.stages[0]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('no longer resolve to the original model') })
    expect(calls).toHaveLength(0)
  })

  test('a recorded force: true legacy intent is still rejected', async () => {
    const f = await fixture()
    await recordLegacyIntent(f, legacyFlags({ force: true }))
    const plan = await planComicResume(f.target)
    expect(plan.stages[0]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('Forced regeneration requires the explicit comic image command') })
  })

  test('tampered legacy flags fail plan-hash integrity before any resolution', async () => {
    const f = await fixture()
    const flags = legacyFlags()
    await recordLegacyIntent(f, { ...flags, size: '1024x1024' }, [], historicalPlanHash(flags, RUN))
    const intent = await imageIntent(f.run)
    expect(comicImageRecoveryHashFromFlags(intent.flags, intent.imageRunId)).not.toBe(intent.planHash)
    expect((await planComicResume(f.target)).stages[0]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('do not match their plan hash') })
  })

  const blockedCases = [
    {
      label: 'an unfinished multi-model intent',
      flags: legacyFlags({ providers: [`openai=${OPENAI}`, `gemini=${GEMINI}`] }),
      outputs: [`panels/${RUN}/${OPENAI}/panel-01.png`, `panels/${RUN}/${OPENAI}/panel-02.png`, `panels/${RUN}/${GEMINI}/panel-01.png`],
      expected: [{ model: OPENAI, label: 'panel 1' }, { model: OPENAI, label: 'panel 2' }, { model: GEMINI, label: 'panel 1' }],
      reason: 'requested 2 image models',
    },
    {
      label: 'an explicit canonical intent with retained outputs',
      flags: legacyFlags({ variation: 'canonical' }),
      outputs: [`panels/${RUN}/canonical/${GEMINI}/panel-01.png`],
      expected: [{ model: GEMINI, variation: 'canonical', label: 'panel 1' }],
      reason: 'explicit canonical variation directory',
    },
    {
      label: 'a cinematic-depth intent',
      flags: legacyFlags({ variation: 'canonical,cinematic-depth' }),
      outputs: [`panels/${RUN}/canonical/${GEMINI}/panel-01.png`, `panels/${RUN}/canonical/${GEMINI}/panel-02.png`, `panels/${RUN}/cinematic-depth/${GEMINI}/panel-02.png`],
      expected: [{ model: GEMINI, variation: 'canonical', label: 'panel 1' }, { model: GEMINI, variation: 'canonical', label: 'panel 2' }, { model: GEMINI, variation: 'cinematic-depth', label: 'panel 2' }],
      reason: 'prompt variations',
    },
    {
      label: 'a QA intent',
      flags: legacyFlags({ qa: true }),
      outputs: [`panels/${RUN}/panel-01.png`],
      expected: [{ model: GEMINI, label: 'panel 1' }],
      reason: 'automated QA',
    },
    {
      label: 'a QA bloopers intent',
      flags: legacyFlags({ qa: true, bloopers: true }),
      outputs: [],
      expected: [],
      reason: 'bloopers',
    },
    {
      label: 'a blocking intent on grouped pages',
      flags: legacyFlags({ blockingLayoutGuide: true, panelsPerImage: '2' }),
      outputs: [`pages/${RUN}/page-01-panels-01-02.png`],
      expected: [{ model: GEMINI, kind: 'page' as const, label: 'page 1 (panels 1, 2)' }],
      reason: 'blocking workflow',
    },
  ]

  for (const blocked of blockedCases) {
    test(`${blocked.label} is blocked with a report of completed outputs, zero dispatch and no file moves or promotion`, async () => {
      const f = await fixture()
      await recordLegacyIntent(f, blocked.flags)
      for (const [index, output] of blocked.outputs.entries()) await writeOutput(f, output, 30 + index)
      const calls = noDispatch()
      const before = await hashes(f.run)

      const plan = await planComicResume(f.target)
      const stage = plan.stages[0]!
      expect(stage).toMatchObject({ stage: 'image', action: 'blocked', steps: [] })
      expect(plan.ready).toBe(false)
      expect(stage.detail).toContain(blocked.reason)
      expect(stage.detail).toContain('choose one model explicitly')
      expect(stage.legacyImageIntent).toMatchObject({ runId: RUN })
      const completed = stage.legacyImageIntent!.completedOutputs
      expect(completed.map(({ path: _path, ...output }) => output)).toEqual(blocked.expected.map(output => ({ kind: 'panel' as const, ...output })))
      for (const [index, output] of completed.entries()) {
        expect(output.path.endsWith(blocked.outputs[index]!)).toBe(true)
        expect(stage.detail).toContain(output.path)
      }
      expect(inspectLegacyComicImageOutputs(f.sceneSlug, blocked.flags, RUN)).toEqual(completed)

      await expect(dispatchResume(f.run, {})).rejects.toThrow()
      expect(calls).toHaveLength(0)
      expect(await hashes(f.run)).toEqual(before)
      for (const panelNumber of [1, 2]) expect(await Bun.file(join(f.run, `panels/panel-0${panelNumber}.png`)).exists()).toBe(false)
      expect(await Bun.file(join(f.run, 'metadata/panel-selections.json')).exists()).toBe(false)
      expect((await imageIntent(f.run)).completed).toBe(false)
    })
  }
})
