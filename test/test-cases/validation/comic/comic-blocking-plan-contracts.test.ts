import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { generateBlockingPlan, estimateBlockingPlanCalls } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/generate-blocking-plan'
import { BLOCKING_GEOMETRY, axisSideForCamera, cameraBasis, cameraHeadingDeg, facingRelativeToCamera, nearestRegisteredView, pointInFootprint, projectAnchor, projectPoint } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-geometry'
import { renderPanelSvg, renderPlanOverviewSvg } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-diagram-svg'
import { buildBlockingLedgerLine, compileBlockingForPanel, compileSceneBlocking, hashBlockingPlan, OFF_FRAME_PINNED_SENTENCE, writeBlockingArtifacts } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-compile'
import { describeBlockingLayoutGuideMarkers, renderBlockingLayoutGuidePng, shouldUseBlockingLayoutGuide } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-layout-guide'
import { getBlockingBindingsPath, getBlockingDirectory, getBlockingPlanPath, getInvalidBlockingPlanPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-paths'
import { BLOCKING_DRAFTER_PINNED_SENTENCE, BLOCKING_FRAME_CONVENTION, buildBlockingDrafterPrompt, buildScenePlanSection, extractBracketPanelNotes, extractFixedAnchorSentence, SCENE_PLAN_PINNED_SENTENCE } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-prompt'
import { deriveStateForPanel, establishAxisSides, hashSourceSegmentText, rebindPlanCitations, validateBlockingPlan, validateScenePanelBlocking } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-validation'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import { getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { BLOCKING_AUDIT_STATUSES, BLOCKING_HARD_CANDIDATE_STATUSES, BLOCKING_PLAN_SCHEMA_VERSION, BlockingBindingsSchema, BlockingPlanSchema, buildBlockingPlanJsonSchema, stripBlockingPlanNulls, stripSceneBlockingNulls } from '~/cli/commands/process-steps/step-8-comic/schemas/blocking-plan-schemas'
import { buildSceneJsonSchema, PanelBundleDataSchema, ScenePromptDataSchema } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
import type { BlockingPlan, BlockingPlanRequest, BlockingScenePanelInput, HostedConcurrencyAdmission, HostedConcurrencyCoordinator, StructuredScriptData } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { BLOCKING_FIXTURE_ENSEMBLE_KEY, BLOCKING_FIXTURE_SCENE_SLUG, BLOCKING_FIXTURE_SEGMENTS, BLOCKING_FIXTURE_TINY_PNG, buildBlockingFixturePlan, buildBlockingFixtureScene, buildBlockingFixtureScenePanels, buildBlockingFixtureStructuredScript, buildBlockingFixtureValidationContext, citationFor, writeBlockingFixtureInputRoot } from './fixtures/blocking/blocking-plan-fixture'

const temporaryDirectories: string[] = []

afterEach(async () => {
  resetSceneRunContext()
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const script = buildBlockingFixtureStructuredScript()
const segmentOrder = script.sourceSegments.map(segment => segment.id)
const fixturePlan = (): BlockingPlan => buildBlockingFixturePlan(script)
const fixturePanels = (): BlockingScenePanelInput[] => buildBlockingFixtureScenePanels()
const context = () => buildBlockingFixtureValidationContext(script)
const messages = (issues: Array<{ message: string }>): string[] => issues.map(issue => issue.message)

const stripStampedFields = (plan: BlockingPlan): Record<string, unknown> => {
  const clone = structuredClone(plan) as unknown as Record<string, unknown>
  delete clone['schemaVersion']
  delete clone['sceneSlug']
  delete clone['structuredScriptSha256']
  delete clone['generatedBy']
  const dropHash = (citation: unknown): void => { if (citation && typeof citation === 'object') delete (citation as Record<string, unknown>)['sourceSegmentSha256'] }
  for (const location of clone['locations'] as Array<Record<string, unknown>>) {
    delete location['specificationSha256']
    delete location['geometrySource']
    for (const item of location['suppressedAnchors'] as Array<Record<string, unknown>>) dropHash(item['citation'])
    for (const item of location['dressing'] as Array<Record<string, unknown>>) dropHash(item['citation'])
  }
  for (const state of clone['stageStates'] as Array<Record<string, unknown>>) {
    dropHash(state['startsAt'])
    for (const mark of state['characters'] as Array<Record<string, unknown>>) dropHash(mark['wardrobeCitation'])
    for (const move of state['moves'] as Array<Record<string, unknown>>) dropHash(move['citation'])
  }
  return clone
}

const reorderKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(reorderKeys)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => right.localeCompare(left))
  return Object.fromEntries(entries.map(([key, item]) => [key, reorderKeys(item)]))
}

const visitJsonSchema = (value: unknown, visit: (record: Record<string, unknown>) => void): void => {
  if (Array.isArray(value)) { value.forEach(item => visitJsonSchema(item, visit)); return }
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  visit(record)
  Object.values(record).forEach(item => visitJsonSchema(item, visit))
}

const prepareWorkspace = async (options: { scene?: boolean | undefined } = {}) => {
  const root = await makeTempDir('autoshow-blocking-inputs-')
  temporaryDirectories.push(root)
  const inputs = await writeBlockingFixtureInputRoot(root)
  configureCharactersRoot(inputs.charactersRoot)
  const workspace = await makeTempDir('autoshow-blocking-workspace-')
  temporaryDirectories.push(workspace)
  const slug = `${BLOCKING_FIXTURE_SCENE_SLUG}-${crypto.randomUUID().slice(0, 8)}`
  beginSceneRun(slug, { outputDir: workspace })
  const structuredPath = getStructuredScriptPath(slug)
  await mkdir(join(workspace, 'metadata'), { recursive: true })
  const structuredBytes = `${JSON.stringify(script, null, 2)}\n`
  await writeFile(structuredPath, structuredBytes)
  let sceneBytes: string | undefined
  if (options.scene) {
    sceneBytes = JSON.stringify(buildBlockingFixtureScene(), null, 2)
    await writeFile(getSceneJsonPath(slug), sceneBytes)
  }
  return { slug, workspace, inputs, structuredSha256: sha256Bytes(structuredBytes), sceneBytes }
}

const draftResponse = (plan: BlockingPlan, extra: Record<string, unknown> = {}) => ({ text: JSON.stringify({ ...stripStampedFields(plan), ...extra }), inputTokens: 1200, outputTokens: 800 })

describe('blocking plan schema contracts', () => {
  test('accepts the eleven-character two-location fixture plan and rejects malformed plans', () => {
    const plan = fixturePlan()
    expect(v.parse(BlockingPlanSchema, plan)).toEqual(plan)
    expect(BLOCKING_PLAN_SCHEMA_VERSION).toBe(1)
    expect(plan.stageStates).toHaveLength(3)
    expect(new Set(plan.stageStates.flatMap(state => state.characters.map(mark => mark.characterKey))).size).toBe(11)
    expect(plan.locations.map(location => location.locationKey)).toEqual(['cargo-bay', 'seamus-quarters'])
    expect(() => v.parse(BlockingPlanSchema, { ...plan, schemaVersion: 2 })).toThrow()
    expect(() => v.parse(BlockingPlanSchema, { ...plan, extra: true })).toThrow()
    const badPosture = structuredClone(plan)
    ;(badPosture.stageStates[0]!.characters[0] as { posture: string }).posture = 'floating'
    expect(() => v.parse(BlockingPlanSchema, badPosture)).toThrow()
    const missingHash = structuredClone(plan)
    delete (missingHash.stageStates[0]!.startsAt as { sourceSegmentSha256?: string }).sourceSegmentSha256
    expect(() => v.parse(BlockingPlanSchema, missingHash)).toThrow()
    expect(() => v.parse(BlockingBindingsSchema, { schemaVersion: 1, sceneSha256: 'a'.repeat(64), planSha256: 'b'.repeat(64), panels: [{ panelNumber: 1, stageStateId: null, cameraSetupId: 'wide', croppedOnStage: [], axisBreak: null }] })).not.toThrow()
    expect(BLOCKING_AUDIT_STATUSES).toEqual(['on-mark', 'side-swapped', 'depth-swapped', 'facing-wrong', 'posture-wrong', 'wardrobe-wrong', 'missing-on-mark', 'unlisted-on-stage', 'exposed-empty-mark', 'excluded-extra-present', 'scale-wrong', 'crowd-uniform', 'not-assessable'])
    expect(BLOCKING_HARD_CANDIDATE_STATUSES).toEqual(['side-swapped', 'depth-swapped', 'facing-wrong', 'posture-wrong', 'wardrobe-wrong', 'missing-on-mark', 'unlisted-on-stage', 'exposed-empty-mark', 'excluded-extra-present', 'axis-side'])
  })

  test('OpenAI-subset JSON schema requires every property and makes optionals nullable', () => {
    const schema = buildBlockingPlanJsonSchema({ characterKeys: ['hero', 'sidekick'], locationKeys: ['cargo-bay'], segmentIds: ['beat-0001'], bindPanelNumbers: [1, 2] })
    expect(schema.name).toBe('blocking_plan_v1')
    expect(schema.strict).toBe(true)
    let objects = 0
    visitJsonSchema(schema.schema, record => {
      expect(record).not.toHaveProperty('const')
      expect(record).not.toHaveProperty('oneOf')
      expect(record).not.toHaveProperty('uniqueItems')
      if (record['type'] === 'object') {
        objects++
        expect(record['additionalProperties']).toBe(false)
        expect([...(record['required'] as string[])].sort()).toEqual(Object.keys(record['properties'] as Record<string, unknown>).sort())
      }
    })
    expect(objects).toBeGreaterThan(10)
    const anchor = (schema.schema.properties['locations'] as { items: { properties: { anchors: { items: { properties: Record<string, unknown> } } } } }).items.properties.anchors.items.properties
    expect(anchor['footprint']).toEqual({ anyOf: [{ type: 'object', properties: { width: { type: 'number' }, depth: { type: 'number' } }, required: ['width', 'depth'], additionalProperties: false }, { type: 'null' }] })
    expect(schema.schema.required).toEqual(['locations', 'stageStates', 'cameraSetups', 'panelBindings'])
    expect(buildBlockingPlanJsonSchema({ characterKeys: [], locationKeys: [], segmentIds: [] }).schema.required).toEqual(['locations', 'stageStates', 'cameraSetups'])
    const scene = buildSceneJsonSchema(['hero'], { cameraSetupIds: ['wide'], stageStateIds: ['open'], segmentIds: ['beat-0001'] }).schema
    const panel = (scene.properties.panels as { items: { properties: Record<string, unknown>; required: string[] } }).items
    expect(panel.required).toContain('blocking')
    expect(panel.properties['blocking']).toMatchObject({ anyOf: [{ type: 'object', required: ['stageStateId', 'cameraSetupId', 'croppedOnStage', 'axisBreak'] }, { type: 'null' }] })
    expect((scene.properties as Record<string, unknown>)['blockingPlanSha256']).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] })
    expect(scene.required).toContain('blockingPlanSha256')
    expect(scene.properties.schemaVersion).toEqual({ type: 'integer', enum: [4] })
    visitJsonSchema(scene, record => {
      expect(record).not.toHaveProperty('const')
      expect(record).not.toHaveProperty('oneOf')
    })
  })

  test('a plan-free scene schema keeps the legacy shape and round-trips through ScenePromptDataSchema', () => {
    const legacy = buildSceneJsonSchema(['hero']).schema
    const panel = (legacy.properties.panels as { items: { properties: Record<string, unknown>; required: string[] } }).items
    expect(panel.required).toEqual(['number', 'description', 'shotPlan', 'characterKeys', 'speech', 'sourceSegmentIds', 'locationKey', 'designReferences'])
    expect(panel.properties).not.toHaveProperty('blocking')
    expect(legacy.required).toEqual(['schemaVersion', 'title', 'location', 'panels'])
    expect(legacy.properties).not.toHaveProperty('blockingPlanSha256')
    expect(Object.keys(legacy.properties)).toEqual(legacy.required)
    expect(Object.keys(panel.properties).sort()).toEqual([...panel.required].sort())
    const modelOutput: Record<string, unknown> = {
      schemaVersion: 4, title: 'T', location: 'L',
      panels: [{ number: 1, description: 'd', shotPlan: 's', characterKeys: ['hero'], speech: [{ speaker: { kind: 'character', characterKey: 'hero', offscreen: false }, line: 'Hi', tone: null }], sourceSegmentIds: ['beat-0001'], locationKey: 'cargo-bay', designReferences: [] }],
    }
    const modelPanel = (modelOutput['panels'] as Array<Record<string, unknown>>)[0]!
    expect(Object.keys(modelOutput).sort()).toEqual([...legacy.required].sort())
    expect(Object.keys(modelPanel).sort()).toEqual([...panel.required].sort())
    delete (modelPanel['speech'] as Array<Record<string, unknown>>)[0]!['tone']
    const parsed = v.parse(ScenePromptDataSchema, modelOutput)
    expect(parsed.panels[0]?.blocking).toBeUndefined()
    expect(parsed.blockingPlanSha256).toBeUndefined()
    expect(buildSceneJsonSchema(['hero'], { cameraSetupIds: [] }).schema.required).toContain('blockingPlanSha256')
    expect(buildSceneJsonSchema(['hero'], { stageStateIds: ['open'] }).schema.required).not.toContain('blockingPlanSha256')
  })

  test('null-strip passes mirror the tone:null handling for plan and scene optionals', () => {
    const plan = { locations: [{ locationKey: 'cargo-bay', cameraCells: null }], panelBindings: null }
    expect(stripBlockingPlanNulls(plan)).toEqual({ locations: [{ locationKey: 'cargo-bay' }] })
    const scene = { schemaVersion: 4, blockingPlanSha256: null, panels: [{ number: 1, blocking: null }, { number: 2, blocking: { stageStateId: null, cameraSetupId: 'wide', croppedOnStage: [], axisBreak: null } }] }
    expect(stripSceneBlockingNulls(scene)).toEqual({ schemaVersion: 4, panels: [{ number: 1 }, { number: 2, blocking: { cameraSetupId: 'wide', croppedOnStage: [], axisBreak: null } }] })
    const parsedScene = v.parse(ScenePromptDataSchema, { ...buildBlockingFixtureScene({ withBlocking: true }), blockingPlanSha256: 'a'.repeat(64) })
    expect(parsedScene.panels[0]?.blocking?.cameraSetupId).toBe('wide-from-airlock')
    expect(parsedScene.blockingPlanSha256).toBe('a'.repeat(64))
    const compiled = compileBlockingForPanel(fixturePlan(), fixturePanels()[0]!, undefined, { segmentOrder })
    const bundle = v.parse(PanelBundleDataSchema, { schemaVersion: 4, snapshotId: 'snap', title: 'T', location: 'L', panels: [{ number: 1, description: 'd', shotPlan: 's', characterKeys: ['peaches'], speech: [], sourceSegmentIds: ['beat-0001'], sourceSegments: [], locationKey: 'cargo-bay', locationSnapshotId: 'loc', blocking: fixturePanels()[0]!.blocking }], blocking: compiled, planSha256: compiled.planSha256 })
    expect(bundle.blocking?.stageStateId).toBe('meeting-open')
    expect(bundle.planSha256).toBe(compiled.planSha256)
  })
})

describe('blocking plan validators', () => {
  test('the fixture plan and panels validate cleanly', () => {
    expect(messages(validateBlockingPlan(fixturePlan(), context()))).toEqual([])
    expect(messages(validateScenePanelBlocking(fixturePlan(), fixturePanels(), { segmentOrder }))).toEqual([])
  })

  test('anchor grounding names the anchor and the location, and reviewed geometry bounds anchors', () => {
    const plan = fixturePlan()
    plan.locations[0]!.anchors.push({ key: 'magic desk', position: { x: 1, y: 1 }, footprint: null, wall: null, facingDeg: null, longAxis: null })
    expect(messages(validateBlockingPlan(plan, context()))).toContain('Blocking plan anchor "magic desk" is not a substring of the "cargo-bay" specification')
    const reviewed = validateBlockingPlan(fixturePlan(), { ...context(), locationPlans: { schemaVersion: 1, plans: [{ locationKey: 'cargo-bay', anchors: [{ key: 'grav lift', position: { x: 0, y: 8 }, footprint: null, wall: null, facingDeg: null, longAxis: null }], cameraCells: [] }] } })
    expect(messages(reviewed)).toEqual(['Blocking plan anchor "grav lift" deviates from the reviewed "cargo-bay" geometry by 1 m'])
    expect(messages(validateBlockingPlan(fixturePlan(), { ...context(), locationPlans: { schemaVersion: 1, plans: [{ locationKey: 'cargo-bay', anchors: [{ key: 'grav lift', position: { x: 0.1, y: 7.2 }, footprint: null, wall: null, facingDeg: null, longAxis: null }], cameraCells: [] }] } }))).toEqual([])
  })

  test('derives the active stage state from segment order and honours explicit overrides', () => {
    const plan = fixturePlan()
    const panel = (ids: string[], stageStateId?: string): BlockingScenePanelInput => ({ number: 9, locationKey: 'cargo-bay', characterKeys: [], sourceSegmentIds: ids, blocking: { ...(stageStateId ? { stageStateId } : {}), cameraSetupId: 'wide-from-airlock', croppedOnStage: [], axisBreak: null } })
    expect(deriveStateForPanel(plan, panel(['beat-0003']), segmentOrder)?.id).toBe('meeting-open')
    expect(deriveStateForPanel(plan, panel(['beat-0004']), segmentOrder)?.id).toBe('gulp-sits')
    expect(deriveStateForPanel(plan, panel(['beat-0005']), segmentOrder)?.id).toBe('gulp-sits')
    expect(deriveStateForPanel(plan, panel(['beat-0007']), segmentOrder)?.id).toBe('quarters-talk')
    expect(deriveStateForPanel(plan, panel(['beat-0007'], 'meeting-open'), segmentOrder)?.id).toBe('meeting-open')
    expect(deriveStateForPanel(plan, { number: 1, locationKey: 'cargo-bay', characterKeys: [], sourceSegmentIds: ['beat-0002'] }, segmentOrder, { schemaVersion: 1, sceneSha256: 'a'.repeat(64), planSha256: 'b'.repeat(64), panels: [{ panelNumber: 1, stageStateId: 'gulp-sits', cameraSetupId: 'wide-from-airlock', croppedOnStage: [], axisBreak: null }] })?.id).toBe('gulp-sits')
  })

  test('rejects moves whose cited segment does not name the character and stale or unknown citations', () => {
    const plan = fixturePlan()
    plan.stageStates[1]!.moves[0] = { type: 'sit', characterKey: 'gulp', citation: citationFor(script, 'beat-0002') }
    expect(messages(validateBlockingPlan(plan, context()))).toContain('Blocking plan move "sit" for "gulp" cites segment "beat-0002" which does not name that character')
    const stale = fixturePlan()
    stale.stageStates[0]!.startsAt = { sourceSegmentId: 'beat-0001', sourceSegmentSha256: 'f'.repeat(64) }
    expect(messages(validateBlockingPlan(stale, context()))).toContain('Blocking plan citation "beat-0001" at stageStates[0].startsAt does not match the current structured script segment text; run draft-scenes --rebind')
    const unknown = fixturePlan()
    unknown.stageStates[1]!.moves[1] = { type: 'cross', characterKey: 'bishop', citation: { sourceSegmentId: 'beat-0099', sourceSegmentSha256: 'f'.repeat(64) } }
    expect(messages(validateBlockingPlan(unknown, context()))).toContain('Blocking plan citation "beat-0099" at stageStates[1].moves[1].citation is not a structured script segment')
  })

  test('cast persistence, camera footprints, axis endpoints, and seats are enforced with exact messages', () => {
    const dropped = fixturePlan()
    dropped.stageStates[1]!.characters = dropped.stageStates[1]!.characters.filter(mark => mark.characterKey !== 'chat')
    expect(messages(validateBlockingPlan(dropped, context()))).toContain('Blocking plan stage state "gulp-sits" drops "chat" without an exit move')
    const added = fixturePlan()
    added.stageStates[0]!.characters = added.stageStates[0]!.characters.filter(mark => mark.characterKey !== 'paddy')
    expect(messages(validateBlockingPlan(added, context()))).toContain('Blocking plan stage state "gulp-sits" adds "paddy" without an enter move')
    const exited = fixturePlan()
    exited.stageStates[1]!.characters = exited.stageStates[1]!.characters.filter(mark => mark.characterKey !== 'chat')
    exited.stageStates[1]!.moves.push({ type: 'exit', characterKey: 'chat', citation: citationFor(script, 'beat-0001') })
    expect(messages(validateBlockingPlan(exited, context()))).toEqual([])
    const camera = fixturePlan()
    camera.cameraSetups.push({ id: 'inside-lift', locationKey: 'cargo-bay', position: { x: 0, y: 7 }, heightM: 1.6, target: { x: 0, y: 12 }, lens: 'wide', framing: 'wide', elevation: 'eye', overShoulderOf: null })
    expect(messages(validateBlockingPlan(camera, context()))).toContain('Blocking plan camera "inside-lift" sits inside the "grav lift" footprint')
    const axis = fixturePlan()
    axis.stageStates[2]!.actionAxis = { from: 'seamus', to: 'gulp', establishedSide: null }
    expect(messages(validateBlockingPlan(axis, context()))).toContain('Blocking plan stage state "quarters-talk" action axis names "gulp" who is not on stage')
    const seat = fixturePlan()
    seat.stageStates[2]!.characters[0]!.seatAnchorKey = 'hammock'
    expect(messages(validateBlockingPlan(seat, context()))).toContain('Blocking plan stage state "quarters-talk" seats "seamus" on unknown anchor "hammock"')
    const displacedSeat = fixturePlan()
    displacedSeat.locations[0]!.dressing.push({ key: 'gulp-chair', description: 'Gulp\'s assigned chair.', position: { x: 4, y: 4.8 }, citation: citationFor(script, 'beat-0001') })
    displacedSeat.stageStates[1]!.characters.find(mark => mark.characterKey === 'gulp')!.seatAnchorKey = 'gulp-chair'
    displacedSeat.stageStates[1]!.characters.find(mark => mark.characterKey === 'gulp')!.position = { x: 5, y: 4.8 }
    expect(messages(validateBlockingPlan(displacedSeat, context()))).toContain('Blocking plan stage state "gulp-sits" places "gulp" 1 m from seat "gulp-chair"')
    const order = fixturePlan()
    order.stageStates[1]!.startsAt = citationFor(script, 'beat-0001')
    expect(messages(validateBlockingPlan(order, context()))).toContain('Blocking plan stage states are not in script order: "gulp-sits" starts before "meeting-open" ends')
  })

  test('panel validation enforces axis sides, visibility, cropping, and extras with exact messages', () => {
    const plan = fixturePlan()
    const noBreak = fixturePanels()
    noBreak[1]!.blocking = { cameraSetupId: 'reverse-from-hatch', croppedOnStage: [], axisBreak: null }
    expect(messages(validateScenePanelBlocking(plan, noBreak, { segmentOrder }))).toContain('Panel 2 crosses the action axis without an axisBreak citing one of its own source segments')
    const foreignBreak = fixturePanels()
    foreignBreak[1]!.blocking = { cameraSetupId: 'reverse-from-hatch', croppedOnStage: [], axisBreak: { sourceSegmentId: 'beat-0001', reason: 'wrong segment' } }
    expect(messages(validateScenePanelBlocking(plan, foreignBreak, { segmentOrder }))).toContain('Panel 2 crosses the action axis without an axisBreak citing one of its own source segments')
    const unlisted = fixturePanels()
    unlisted[0]!.characterKeys = unlisted[0]!.characterKeys.filter(key => key !== 'chat')
    expect(messages(validateScenePanelBlocking(plan, unlisted, { segmentOrder }))).toContain('Panel 1 camera "wide-from-airlock" sees "chat" who is not in characterKeys and is not declared croppedOnStage')
    const outOfFrame = fixturePanels()
    outOfFrame[0]!.characterKeys = [...outOfFrame[0]!.characterKeys, 'ironhand-1']
    expect(messages(validateScenePanelBlocking(plan, outOfFrame, { segmentOrder }))).toContain('Panel 1 lists "ironhand-1" who is not in frame for camera "wide-from-airlock"')
    const noExtras = fixturePanels()
    noExtras[0]!.characterKeys = noExtras[0]!.characterKeys.filter(key => key !== BLOCKING_FIXTURE_ENSEMBLE_KEY)
    expect(messages(validateScenePanelBlocking(plan, noExtras, { segmentOrder }))).toContain('Panel 1 frames extras region "deck-crew" but does not list that ensemble key')
    const cropped = fixturePanels()
    cropped[0]!.blocking = { cameraSetupId: 'wide-from-airlock', croppedOnStage: [{ characterKey: 'ironhand-1', reason: 'not visible anyway' }], axisBreak: null }
    expect(messages(validateScenePanelBlocking(plan, cropped, { segmentOrder }))).toContain('Panel 1 declares "ironhand-1" croppedOnStage but that character is not in frame for camera "wide-from-airlock"')
    const missing = fixturePanels()
    delete missing[2]!.blocking
    expect(messages(validateScenePanelBlocking(plan, missing, { segmentOrder }))).toContain('Panel 3 is missing a blocking citation')
    const centeredShoulderPlan = fixturePlan()
    centeredShoulderPlan.cameraSetups.find(camera => camera.id === 'ots-seamus-on-peaches')!.target = { x: 1.2, y: 12 }
    expect(messages(validateScenePanelBlocking(centeredShoulderPlan, fixturePanels(), { segmentOrder }))).toContain('Panel 3 camera "ots-seamus-on-peaches" requires "seamus" in the near foreground on one side of the frame for an over-shoulder composition')
    const established = establishAxisSides(plan, fixturePanels(), { segmentOrder })
    expect(established.stageStates.map(state => state.actionAxis?.establishedSide)).toEqual(['left', 'right', 'left'])
    expect(plan.stageStates.map(state => state.actionAxis?.establishedSide)).toEqual([null, null, null])
  })

  test('rebind remaps renumbered and re-split citations by content hash and reports unresolved ones', () => {
    const plan = fixturePlan()
    const inserted: StructuredScriptData['sourceSegments'][number] = { ...BLOCKING_FIXTURE_SEGMENTS[0]!, id: 'beat-0001', text: 'A klaxon sounds twice.' }
    const renumbered = BLOCKING_FIXTURE_SEGMENTS.map((segment, index) => ({ ...segment, id: `beat-${String(index + 2).padStart(4, '0')}` }))
    renumbered[3] = { ...renumbered[3]!, text: 'Gulp sits on a crate. Bishop stays put.' }
    const nextScript = buildBlockingFixtureStructuredScript({ segments: [inserted, ...renumbered] })
    const result = rebindPlanCitations(plan, nextScript)
    expect(result.remapped).toContainEqual({ path: 'stageStates[0].startsAt', from: 'beat-0001', to: 'beat-0002' })
    expect(result.remapped).toContainEqual({ path: 'stageStates[2].startsAt', from: 'beat-0006', to: 'beat-0007' })
    const noPrevious = 'no current segment carries the cited content hash and no previous structured script was available to recognize a split or merge'
    expect(result.unresolved).toEqual([
      { path: 'stageStates[1].startsAt', sourceSegmentId: 'beat-0004', sourceSegmentSha256: hashSourceSegmentText(BLOCKING_FIXTURE_SEGMENTS[3]!.text), reason: noPrevious },
      { path: 'stageStates[1].moves[0].citation', sourceSegmentId: 'beat-0004', sourceSegmentSha256: hashSourceSegmentText(BLOCKING_FIXTURE_SEGMENTS[3]!.text), reason: noPrevious },
      { path: 'stageStates[1].moves[1].citation', sourceSegmentId: 'beat-0004', sourceSegmentSha256: hashSourceSegmentText(BLOCKING_FIXTURE_SEGMENTS[3]!.text), reason: noPrevious },
    ])
    expect(result.plan.stageStates[0]!.startsAt).toEqual({ sourceSegmentId: 'beat-0002', sourceSegmentSha256: hashSourceSegmentText(BLOCKING_FIXTURE_SEGMENTS[0]!.text) })
    expect(result.plan.structuredScriptSha256).toBe(sha256Bytes(`${JSON.stringify(nextScript, null, 2)}\n`))
    expect(plan.stageStates[0]!.startsAt.sourceSegmentId).toBe('beat-0001')
    const split = BLOCKING_FIXTURE_SEGMENTS.flatMap(segment => segment.id === 'beat-0004'
      ? [{ ...segment, id: 'beat-0004-01', text: 'Gulp sits on a crate near the ladder.' }, { ...segment, id: 'beat-0004-02', text: 'Bishop crosses to the grav lift and leans on it.' }]
      : [segment])
    const splitScript = buildBlockingFixtureStructuredScript({ segments: split })
    const withPrevious = rebindPlanCitations(plan, splitScript, { previousStructuredScript: script, catalog: context().catalog })
    expect(withPrevious.unresolved).toEqual([])
    expect(withPrevious.remapped.map(item => `${item.path}:${item.from}->${item.to}`)).toEqual(['stageStates[1].startsAt:beat-0004->beat-0004-01', 'stageStates[1].moves[0].citation:beat-0004->beat-0004-01', 'stageStates[1].moves[1].citation:beat-0004->beat-0004-02'])
    expect(messages(validateBlockingPlan(withPrevious.plan, buildBlockingFixtureValidationContext(splitScript)))).toEqual([])
    expect(v.parse(BlockingPlanSchema, withPrevious.plan)).toEqual(withPrevious.plan)
    const withoutCatalog = rebindPlanCitations(plan, splitScript, { previousStructuredScript: script })
    expect(withoutCatalog.remapped.map(item => `${item.path}:${item.from}->${item.to}`)).toEqual(['stageStates[1].startsAt:beat-0004->beat-0004-01'])
    expect(withoutCatalog.unresolved.map(item => `${item.path}: ${item.reason}`)).toEqual([
      'stageStates[1].moves[0].citation: the previous segment "beat-0004" was split into beat-0004-01, beat-0004-02; pass the character catalog to choose the piece that names "gulp"',
      'stageStates[1].moves[1].citation: the previous segment "beat-0004" was split into beat-0004-01, beat-0004-02; pass the character catalog to choose the piece that names "bishop"',
    ])
    const stranger = fixturePlan()
    stranger.stageStates[1]!.moves[1] = { type: 'cross', characterKey: 'paddy', citation: citationFor(script, 'beat-0004') }
    expect(rebindPlanCitations(stranger, splitScript, { previousStructuredScript: script, catalog: context().catalog }).unresolved.map(item => item.reason)).toEqual(['the previous segment "beat-0004" was split into beat-0004-01, beat-0004-02 and none of them names "paddy"'])
    expect(rebindPlanCitations(plan, splitScript).unresolved).toHaveLength(3)
    expect(hashSourceSegmentText('  Gulp,\r\n  take   a seat. ')).toBe(hashSourceSegmentText('Gulp, take a seat.'))
  })

  test('rebind refuses to guess when one content hash matches several current segments', () => {
    const plan = fixturePlan()
    // Two segments now carry the cited text verbatim and neither keeps the cited id, so a content-hash
    // match alone cannot say which one the stage state starts at.
    const duplicated = BLOCKING_FIXTURE_SEGMENTS.map((segment, index) => ({ ...segment, id: `beat-${String(index + 2).padStart(4, '0')}` }))
    const echo = { ...duplicated[1]!, id: 'beat-9001', text: BLOCKING_FIXTURE_SEGMENTS[0]!.text }
    const nextScript = buildBlockingFixtureStructuredScript({ segments: [...duplicated, echo] })
    const result = rebindPlanCitations(plan, nextScript)
    const startsAt = result.unresolved.find(item => item.path === 'stageStates[0].startsAt')
    expect(startsAt?.reason).toBe('the cited content hash matches 2 current segments (beat-0002, beat-9001) and none of them keeps the cited id, so the rebind cannot choose between them')
    expect(result.remapped.map(item => item.path)).not.toContain('stageStates[0].startsAt')
    expect(result.plan.stageStates[0]!.startsAt.sourceSegmentId).toBe('beat-0001')
    // One unambiguous candidate still rebinds, so the guard only fires on genuine ambiguity.
    const unique = buildBlockingFixtureStructuredScript({ segments: duplicated })
    expect(rebindPlanCitations(plan, unique).remapped).toContainEqual({ path: 'stageStates[0].startsAt', from: 'beat-0001', to: 'beat-0002' })
  })
})

describe('blocking geometry', () => {
  const plan = fixturePlan()
  const camera = (id: string) => plan.cameraSetups.find(item => item.id === id)!
  const mark = (key: string, stateIndex = 0) => plan.stageStates[stateIndex]!.characters.find(item => item.characterKey === key)!
  const anchor = (locationIndex: number, key: string) => plan.locations[locationIndex]!.anchors.find(item => item.key === key)!

  test('constants are exported and tunable', () => {
    expect(BLOCKING_GEOMETRY.horizontalFieldOfViewDeg).toEqual({ wide: 84, normal: 54, long: 30 })
    expect(BLOCKING_GEOMETRY.edgeBandDeg).toBe(6)
    expect(BLOCKING_GEOMETRY.reviewedAnchorToleranceM).toBe(0.25)
  })

  test('establishing-aligned camera projects screen sides, depth bands, facing, and axis side', () => {
    const wide = camera('wide-from-airlock')
    expect(cameraBasis(wide)).toEqual({ forward: { x: 0, y: 1 }, right: { x: 1, y: 0 } })
    expect(cameraHeadingDeg(wide)).toBe(0)
    expect(nearestRegisteredView(cameraHeadingDeg(wide))).toBe('establishing')
    expect(projectPoint(wide, mark('gulp').position)).toEqual({ forward: 6, lateral: -0.44, inFrame: 'in' })
    expect(projectPoint(wide, mark('chat').position)).toEqual({ forward: 4, lateral: -0.33, inFrame: 'in' })
    expect(projectPoint(wide, mark('peaches').position)).toEqual({ forward: 12, lateral: 0, inFrame: 'in' })
    expect(projectPoint(wide, mark('ironhand-1').position)).toEqual({ forward: 3, lateral: -1.27, inFrame: 'out' })
    expect(facingRelativeToCamera(mark('peaches').position, mark('peaches').facingDeg, wide.position)).toBe('toward-camera')
    expect(facingRelativeToCamera(mark('chat').position, mark('chat').facingDeg, wide.position)).toBe('away-from-camera')
    expect(facingRelativeToCamera(mark('paddy').position, mark('paddy').facingDeg, wide.position)).toBe('profile-screen-left')
    expect(facingRelativeToCamera(mark('geebee').position, mark('geebee').facingDeg, wide.position)).toBe('profile-screen-right')
    expect(axisSideForCamera(mark('peaches').position, mark('gulp').position, wide.position)).toBe('left')
    expect(projectAnchor(wide, anchor(0, 'right catwalk'))).toEqual({ screenSide: 'right', depthBand: 'background', seenFrom: 'left', projection: 'right catwalk: screen-right, far, long edge receding, left face toward camera' })
    expect(projectPoint(wide, anchor(0, 'right catwalk').position)).toEqual({ forward: 8, lateral: 0.88, inFrame: 'edge' })
    expect(pointInFootprint({ x: 0, y: 7 }, anchor(0, 'grav lift'))).toBe(true)
    expect(pointInFootprint({ x: 0, y: 0 }, anchor(0, 'grav lift'))).toBe(false)
    expect(pointInFootprint({ x: 4, y: 4 }, { position: { x: 4, y: 4 }, footprint: null })).toBe(false)
  })

  test('reverse camera mirrors screen sides and reads as the reverse registered view', () => {
    const reverse = camera('reverse-from-hatch')
    expect(cameraHeadingDeg(reverse)).toBe(180)
    expect(nearestRegisteredView(180)).toBe('reverse')
    expect(projectPoint(reverse, mark('gulp').position)).toEqual({ forward: 7.5, lateral: 0.55, inFrame: 'in' })
    expect(projectPoint(reverse, mark('seamus').position)).toEqual({ forward: 1.5, lateral: -1.43, inFrame: 'out' })
    expect(projectPoint(reverse, mark('peaches').position)).toEqual({ forward: 1.5, lateral: 0, inFrame: 'in' })
    expect(facingRelativeToCamera(mark('gulp').position, mark('gulp').facingDeg, reverse.position)).toBe('toward-camera')
    expect(facingRelativeToCamera(mark('peaches').position, mark('peaches').facingDeg, reverse.position)).toBe('away-from-camera')
    expect(axisSideForCamera(mark('peaches').position, mark('gulp').position, reverse.position)).toBe('right')
  })

  test('side camera reads as the side registered view with lateral frame edges', () => {
    const side = camera('side-from-right-catwalk')
    expect(cameraHeadingDeg(side)).toBe(270)
    expect(nearestRegisteredView(270)).toBe('side')
    expect(nearestRegisteredView(59)).toBe('establishing')
    expect(nearestRegisteredView(61)).toBe('side')
    expect(nearestRegisteredView(121)).toBe('reverse')
    expect(projectPoint(side, mark('duco').position)).toEqual({ forward: 3.2, lateral: -0.76, inFrame: 'in' })
    expect(projectPoint(side, mark('peaches').position)).toEqual({ forward: 5.2, lateral: 0.89, inFrame: 'edge' })
    expect(projectPoint(side, mark('bishop').position)).toEqual({ forward: 4.2, lateral: -1.04, inFrame: 'out' })
    expect(facingRelativeToCamera(mark('duco').position, mark('duco').facingDeg, side.position)).toBe('profile-screen-right')
    expect(facingRelativeToCamera(mark('peaches').position, mark('peaches').facingDeg, side.position)).toBe('profile-screen-left')
    expect(axisSideForCamera(mark('peaches').position, mark('gulp').position, side.position)).toBe('left')
    expect(projectAnchor(side, anchor(0, 'grav lift'))).toEqual({ screenSide: 'left', depthBand: 'midground', seenFrom: 'left', projection: 'grav lift: screen-left, mid, long edge across frame, left face toward camera' })
  })

  test('over-the-shoulder camera keeps the shoulder character foreground screen-left and the subject centered', () => {
    const ots = camera('ots-seamus-on-peaches')
    expect(cameraHeadingDeg(ots)).toBeCloseTo(254.29, 2)
    expect(nearestRegisteredView(cameraHeadingDeg(ots))).toBe('side')
    expect(projectPoint(ots, mark('seamus').position)).toEqual({ forward: 2.17, lateral: -0.57, inFrame: 'in' })
    expect(projectPoint(ots, mark('peaches').position)).toEqual({ forward: 3.32, lateral: 0, inFrame: 'in' })
    expect(projectPoint(ots, mark('gulp').position)).toEqual({ forward: 6.87, lateral: -2.49, inFrame: 'out' })
    expect(facingRelativeToCamera(mark('peaches').position, mark('peaches').facingDeg, ots.position)).toBe('profile-screen-left')
    expect(axisSideForCamera(mark('peaches').position, mark('gulp').position, ots.position)).toBe('left')
    expect(axisSideForCamera({ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 0, y: 2 })).toBeNull()
  })
})

describe('blocking compiler, ledger, and diagrams', () => {
  test('compiles the deterministic bundle object with prose lines and the pinned off-frame sentence', () => {
    const plan = fixturePlan()
    const compilation = compileSceneBlocking(plan, fixturePanels(), undefined, { segmentOrder })
    expect(compilation.planSha256).toBe(hashBlockingPlan(plan))
    const first = compilation.panels[0]!
    expect(Object.keys(first)).toEqual(['planSha256', 'stageStateId', 'cameraSetupId', 'camera', 'axis', 'ledger', 'offFrameRoster', 'croppedOnStage', 'extrasInFrame', 'dressingInFrame', 'anchorsInFrame', 'lines'])
    expect(first.camera).toEqual({ position: { x: 0, y: 0 }, heightM: 1.6, lens: 'wide', framing: 'wide', elevation: 'eye', overShoulderOf: null, headingDeg: 0, nearestView: 'establishing' })
    expect(first.axis).toEqual({ from: 'peaches', to: 'gulp', cameraSide: 'left', establishedSide: 'left', matchesEstablished: true, axisBreak: null })
    expect(first.ledger.map(entry => entry.characterKey)).toEqual(['peaches', 'seamus', 'gulp', 'geebee', 'duco', 'paddy', 'chat', 'bishop', 'ironhand-3'])
    expect(first.ledger[2]).toEqual({ characterKey: 'gulp', screenSide: 'left', depthBand: 'background', posture: 'standing', facing: 'away-from-camera', seatAnchorKey: null, wardrobe: 'canonical', frame: 'in', lateral: -0.44 })
    expect(first.offFrameRoster).toEqual([{ characterKey: 'ironhand-1', note: 'on stage screen-left of frame' }, { characterKey: 'ironhand-2', note: 'on stage screen-right of frame at the shipping crates' }])
    expect(first.extrasInFrame).toEqual([{ ensembleKey: 'deck-crew', count: 6, variety: ['mixed ages', 'varied heights'], exclude: ['children'], props: ['clipboards'] }])
    expect(first.dressingInFrame).toBe('Folding chairs face the hatch.; folding chairs: A ragged row of temporary folding chairs facing the hatch.')
    expect(first.anchorsInFrame.map(item => item.key)).toEqual(['centered far main hatch', 'grav lift', 'left catwalk', 'right catwalk'])
    expect(first.lines.camera).toContain('Camera "wide-from-airlock": wide framing, wide lens, eye elevation')
    expect(first.lines.camera).toContain('nearest registered view: establishing')
    expect(first.lines.ledger[2]).toBe('gulp: screen-left, background, standing, facing away from the camera, wardrobe canonical')
    expect(first.lines.offFrame).toContain('On stage but outside this frame: ironhand-1 (on stage screen-left of frame); ironhand-2 (on stage screen-right of frame at the shipping crates).')
    expect(first.lines.offFrame).toContain(OFF_FRAME_PINNED_SENTENCE)
    expect(OFF_FRAME_PINNED_SENTENCE).toBe('Their seats and marks remain occupied. Keep every named occupied seat and mark completely outside the crop; if the image reveals one, its named occupant must be visibly present there and it must never appear as an empty chair or empty floor.')
    expect(first.lines.extras).toBe('Extras in frame: 6 deck-crew (mixed ages, varied heights), excluding children, with clipboards.')
    expect(first.lines.anchors).toContain('right catwalk: screen-right, far, long edge receding, left face toward camera')
    const second = compilation.panels[1]!
    expect(second.axis).toEqual({ from: 'peaches', to: 'gulp', cameraSide: 'right', establishedSide: 'left', matchesEstablished: false, axisBreak: { sourceSegmentId: 'beat-0002', reason: 'Peaches turns to address the whole bay.' } })
    expect(second.offFrameRoster).toEqual([{ characterKey: 'seamus', note: 'on stage screen-left of frame at the centered far main hatch' }])
    expect(second.lines.camera).toContain('deliberate axis break: Peaches turns to address the whole bay.')
    const third = compilation.panels[2]!
    expect(third.ledger.map(entry => `${entry.characterKey}:${entry.screenSide}:${entry.depthBand}`)).toEqual(['peaches:center:midground', 'seamus:left:foreground'])
    expect(third.camera.overShoulderOf).toBe('seamus')
    expect(third.lines.extras).toBe('No extras or crowd are in frame; do not add background people.')
    const fourth = compilation.panels[3]!
    expect(fourth.stageStateId).toBe('gulp-sits')
    expect(fourth.croppedOnStage).toEqual([{ characterKey: 'seamus', reason: 'Seamus is cropped by the right frame edge.' }])
    expect(fourth.ledger.find(entry => entry.characterKey === 'gulp')).toMatchObject({ screenSide: 'right', depthBand: 'midground', posture: 'seated', seatAnchorKey: 'shipping crates' })
    expect(fourth.lines.offFrame).toContain('Deliberately cropped out of this frame although the camera could see them: seamus (Seamus is cropped by the right frame edge.).')
    expect(fourth.lines.ledger.find(line => line.startsWith('gulp:'))).toBe('gulp: screen-right, midground, seated on shipping crates, in profile facing screen-left, wardrobe canonical, at the frame edge')
    const sixth = compilation.panels[5]!
    expect(sixth.axis?.matchesEstablished).toBe(false)
    expect(sixth.axis?.axisBreak?.sourceSegmentId).toBe('beat-0008')
    expect(compilation.ledgerMarkdown.split('\n').filter(line => line.startsWith('- Panel '))).toHaveLength(6)
    expect(compilation.ledgerMarkdown).toContain('- Panel 1: state meeting-open; camera wide-from-airlock heading 0 (establishing, wide, wide); cast peaches center frame background standing;')
    expect(compilation.ledgerMarkdown).toContain('off frame: ironhand-1, ironhand-2; extras: 6 deck-crew; axis peaches->gulp camera left established left')
    expect(buildBlockingLedgerLine(2, second)).toContain('camera right established left (crossed) (axis break)')
    expect(compilation.ledgerMarkdown.split('\n').every(line => !line.startsWith(' '))).toBe(true)
  })

  test('compiles byte-identically twice and under key reordering of the input plan', () => {
    const plan = fixturePlan()
    const once = compileSceneBlocking(plan, fixturePanels(), undefined, { segmentOrder })
    const twice = compileSceneBlocking(structuredClone(plan), fixturePanels(), undefined, { segmentOrder })
    expect(JSON.stringify(twice.panels)).toBe(JSON.stringify(once.panels))
    expect(twice.ledgerMarkdown).toBe(once.ledgerMarkdown)
    expect(twice.planOverviewSvg).toBe(once.planOverviewSvg)
    expect(twice.panelSvgs).toEqual(once.panelSvgs)
    const reordered = reorderKeys(plan) as BlockingPlan
    expect(Object.keys(reordered)).not.toEqual(Object.keys(plan))
    const third = compileSceneBlocking(reordered, fixturePanels(), undefined, { segmentOrder, planSha256: once.planSha256 })
    expect(JSON.stringify(third.panels)).toBe(JSON.stringify(once.panels))
    expect(third.ledgerMarkdown).toBe(once.ledgerMarkdown)
    expect(third.planOverviewSvg).toBe(once.planOverviewSvg)
    const single = compileBlockingForPanel(establishAxisSides(plan, fixturePanels(), { segmentOrder }), fixturePanels()[0]!, undefined, { segmentOrder, planSha256: once.planSha256 })
    expect(JSON.stringify(single)).toBe(JSON.stringify(once.panels[0]))
    expect(() => compileBlockingForPanel(plan, { number: 7, locationKey: 'cargo-bay', characterKeys: [], sourceSegmentIds: ['beat-0001'] })).toThrow('Panel 7 has no blocking citation and no binding')
  })

  test('compiling one panel without a segment order needs an explicit stage state instead of guessing from the panel', () => {
    const plan = fixturePlan()
    const once = compileSceneBlocking(plan, fixturePanels(), undefined, { segmentOrder })
    const established = establishAxisSides(plan, fixturePanels(), { segmentOrder })
    const second = fixturePanels()[1]!
    const explicitState: BlockingScenePanelInput = { ...second, blocking: { ...second.blocking!, stageStateId: 'meeting-open' } }
    const withoutOrder = compileBlockingForPanel(established, explicitState, undefined, { planSha256: once.planSha256 })
    expect(JSON.stringify(withoutOrder)).toBe(JSON.stringify(once.panels[1]))
    expect(() => compileBlockingForPanel(established, second, undefined, { planSha256: once.planSha256 })).toThrow('Panel 2 cannot derive its stage state without a segment order; pass options.segmentOrder (the structured script segment ids in script order) or cite blocking.stageStateId explicitly')
    const fourth = fixturePanels()[3]!
    expect(compileBlockingForPanel(established, fourth, undefined, { segmentOrder, planSha256: once.planSha256 }).stageStateId).toBe('gulp-sits')
  })

  test('renders deterministic dependency-free SVG diagrams with countable elements', async () => {
    const plan = fixturePlan()
    const overview = renderPlanOverviewSvg(plan)
    expect(overview.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect((overview.match(/<rect class="anchor"/g) ?? []).length).toBe(9)
    expect((overview.match(/<circle class="mark"/g) ?? []).length).toBe(24)
    expect((overview.match(/<line class="facing"/g) ?? []).length).toBe(24)
    expect((overview.match(/<path class="camera"/g) ?? []).length).toBe(6)
    expect((overview.match(/<line class="axis"/g) ?? []).length).toBe(3)
    expect((overview.match(/<rect class="extras"/g) ?? []).length).toBe(2)
    expect((overview.match(/<g class="location"/g) ?? []).length).toBe(2)
    expect(overview).toContain('data-camera="wide-from-airlock"')
    expect(overview).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    const compilation = compileSceneBlocking(plan, fixturePanels(), undefined, { segmentOrder })
    const panelSvg = renderPanelSvg(establishAxisSides(plan, fixturePanels(), { segmentOrder }), compilation.panels[0]!, 1)
    expect((panelSvg.match(/<rect class="anchor"/g) ?? []).length).toBe(5)
    expect((panelSvg.match(/<circle class="mark"/g) ?? []).length).toBe(11)
    expect((panelSvg.match(/<path class="camera"/g) ?? []).length).toBe(1)
    expect((panelSvg.match(/<line class="axis"/g) ?? []).length).toBe(1)
    expect(panelSvg).toContain('<title>Blocking panel 1: 01-mandatory-meeting-fixture (state meeting-open, camera wide-from-airlock)</title>')
    expect(compilation.panelSvgs[0]!.svg).toBe(panelSvg)
    const directory = await makeTempDir('autoshow-blocking-artifacts-')
    temporaryDirectories.push(directory)
    const written = await writeBlockingArtifacts(directory, compilation)
    expect(written.map(path => path.slice(directory.length + 1))).toEqual(['plan-overview.svg', 'panel-01.svg', 'panel-02.svg', 'panel-03.svg', 'panel-04.svg', 'panel-05.svg', 'panel-06.svg', 'panel-01-layout.png', 'panel-02-layout.png', 'panel-04-layout.png', 'blocking-ledger.md'])
    expect(await Bun.file(join(directory, 'blocking-ledger.md')).text()).toBe(compilation.ledgerMarkdown)
  })

  test('renders a deterministic PNG screen-space guide only for dense named casts', () => {
    const compilation = compileSceneBlocking(fixturePlan(), fixturePanels(), undefined, { segmentOrder })
    const sparse = compilation.panels[2]!
    expect(shouldUseBlockingLayoutGuide(sparse)).toBe(false)
    const template = sparse.ledger[0]!
    const dense = {
      ...sparse,
      ledger: Array.from({ length: 6 }, (_, index) => ({
        ...template,
        characterKey: `crew-${index + 1}`,
        screenSide: index < 2 ? 'left' as const : index < 4 ? 'center' as const : 'right' as const,
        depthBand: index % 2 === 0 ? 'background' as const : 'foreground' as const,
        facing: index % 2 === 0 ? 'away-from-camera' as const : 'toward-camera' as const,
      })),
    }
    expect(shouldUseBlockingLayoutGuide(dense)).toBe(true)
    expect(describeBlockingLayoutGuideMarkers(dense)).toContain('1=crew-1 (left, background')
    const first = renderBlockingLayoutGuidePng(dense)
    const second = renderBlockingLayoutGuidePng(structuredClone(dense))
    expect(Buffer.from(first).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(Buffer.from(first).readUInt32BE(16)).toBe(1536)
    expect(Buffer.from(first).readUInt32BE(20)).toBe(1024)
    expect(Buffer.from(first)).toEqual(Buffer.from(second))
  })
})

describe('blocking prompt builders', () => {
  test('the drafter prompt carries the pinned sentence, the frame convention, canon cues, and bracket notes', () => {
    const notes = extractBracketPanelNotes({ sourceSegments: [...BLOCKING_FIXTURE_SEGMENTS, { id: 'beat-0009', type: 'panel-note', text: 'BLOCKING: Peaches stays at the hatch for the whole meeting.', sourceSpans: [], location: BLOCKING_FIXTURE_SEGMENTS[0]!.location }, { id: 'beat-0010', type: 'panel-note', text: 'Wide shot of the bay.', sourceSpans: [], location: BLOCKING_FIXTURE_SEGMENTS[0]!.location }] })
    expect(notes).toEqual([{ sourceSegmentId: 'beat-0009', kind: 'BLOCKING', text: 'Peaches stays at the hatch for the whole meeting.' }])
    const fixed = extractFixedAnchorSentence(context().locationSpecifications['cargo-bay']!.specification)
    expect(fixed).toBe('Fixed features only: centered far main hatch, near cargo-airlock threshold, center lane, compact yellow hover grav lift, left catwalk, right catwalk, near-end ladders on both walls, shipping crates.')
    expect(extractFixedAnchorSentence('No anchors here.')).toBeNull()
    const prompt = buildBlockingDrafterPrompt({
      sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG,
      segments: BLOCKING_FIXTURE_SEGMENTS,
      locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification: context().locationSpecifications['cargo-bay']!.specification, fixedAnchorSentence: fixed }],
      characters: [{ key: 'gulp', name: 'Gulp', description: 'Stocky engineer.', wardrobe: { colorTokens: ['hoodie: dark navy zip-up'], never: ['yellow prison jumpsuit'] }, distinguishFrom: [{ characterKey: 'geebee', cue: 'Gulp is the shorter one.' }], variantOf: undefined }],
      panelNotes: notes,
      validationErrors: ['Blocking plan anchor "magic desk" is not a substring of the "cargo-bay" specification'],
    })
    expect(BLOCKING_DRAFTER_PINNED_SENTENCE).toBe('A character the script stops mentioning has not left the room: keep every character on stage on the same mark until the script removes them.')
    expect(prompt).toContain(BLOCKING_DRAFTER_PINNED_SENTENCE)
    expect(prompt).toContain(BLOCKING_FRAME_CONVENTION)
    expect(prompt).toContain('+x is screen-right in the canonical establishing image and +y is depth away from the establishing camera')
    expect(prompt).toContain('Fixed anchors (every anchor key you emit must be a verbatim substring of this specification): Fixed features only:')
    expect(prompt).toContain('- Wardrobe tokens: hoodie: dark navy zip-up')
    expect(prompt).toContain('- Never wear: yellow prison jumpsuit')
    expect(prompt).toContain('- Distinguish from geebee: Gulp is the shorter one.')
    expect(prompt).toContain('- beat-0009 [BLOCKING]: Peaches stays at the hatch for the whole meeting.')
    expect(prompt).toContain('## Validation errors from the previous attempt (fix every one)')
    expect(prompt).toContain('- beat-0003 (dialogue, location cargo-bay) SEAMUS: Gulp, take a seat.')
    expect(prompt).not.toContain('## Bind mode: reviewed panels')
  })

  test('the scene plan section carries the pinned sentence, stage marks, and camera setups', () => {
    const section = buildScenePlanSection(establishAxisSides(fixturePlan(), fixturePanels(), { segmentOrder }))
    expect(SCENE_PLAN_PINNED_SENTENCE).toBe('The plan\'s stage marks are world truth: characterKeys must contain every on-stage character that the chosen camera sees and nobody who is not on stage, so choose a tighter camera setup rather than omitting people.')
    expect(section).toContain(SCENE_PLAN_PINNED_SENTENCE)
    expect(section).toContain('### Stage state meeting-open (location cargo-bay, starts at beat-0001)')
    expect(section).toContain('gulp at (-2, 6) facing 0° standing')
    expect(section).toContain('- wide-from-airlock (location cargo-bay): wide wide lens, eye elevation, at (0, 0) height 1.6 m looking toward (0, 8), heading 0° (nearest registered view: establishing)')
    expect(section).toContain('over the shoulder of seamus')
    expect(section).toContain('Action axis: peaches to gulp (established camera side: left)')
    expect(section).toContain('Extras: 6 deck-crew in a 2 by 3 m region centered at (4.5, 9), excluding children')
  })
})

describe('generateBlockingPlan stage', () => {
  test('writes a validated plan from an injected drafter and stamps hashes and provenance', async () => {
    const { slug, structuredSha256, inputs } = await prepareWorkspace()
    const plan = fixturePlan()
    const requests: BlockingPlanRequest[] = []
    const { result, events } = await captureLogEvents(async () => await generateBlockingPlan(slug, {
      model: 'gpt-5.6-sol',
      requestPlan: async request => { requests.push(request); return { ...draftResponse(plan), returnedModel: 'gpt-5.6-sol-2026' } },
    }))
    expect(requests).toHaveLength(1)
    expect(requests[0]!.imagePaths).toEqual([inputs.establishingImages['cargo-bay']!, inputs.establishingImages['seamus-quarters']!])
    expect(requests[0]!.schemaName).toBe('blocking_plan_v1')
    expect(requests[0]!.prompt).toContain(BLOCKING_DRAFTER_PINNED_SENTENCE)
    expect(result.mode).toBe('llm')
    expect(result.bind).toBe(false)
    expect(result.attempts).toBe(1)
    expect(result.bindingsPath).toBeNull()
    expect(result.planPath).toBe(getBlockingPlanPath(slug))
    const written = v.parse(BlockingPlanSchema, JSON.parse(await Bun.file(result.planPath).text()))
    expect(written.generatedBy).toEqual({ mode: 'llm', model: 'gpt-5.6-sol-2026' })
    expect(written.structuredScriptSha256).toBe(structuredSha256)
    expect(written.locations.map(location => location.specificationSha256)).toEqual(plan.locations.map(location => location.specificationSha256))
    expect(written.stageStates[0]!.startsAt).toEqual(plan.stageStates[0]!.startsAt)
    expect(written.stageStates.map(state => state.characters.length)).toEqual([11, 11, 2])
    expect(sha256Bytes(new Uint8Array(await Bun.file(result.planPath).arrayBuffer()))).toBe(hashBlockingPlan(written))
    expect(result.stats.totalInputTokens).toBe(1200)
    expect(result.stats.totalOutputTokens).toBe(800)
    expect(events.some(event => event.message.startsWith('blocking-plan generated file=blocking-plan.json model=gpt-5.6-sol-2026 tokens=2,000'))).toBe(true)
    expect(await Bun.file(getInvalidBlockingPlanPath(slug)).exists()).toBe(false)
  })

  test('retries once with the validator errors appended and succeeds on the second attempt', async () => {
    const { slug } = await prepareWorkspace()
    const plan = fixturePlan()
    const broken = fixturePlan()
    broken.locations[0]!.anchors.push({ key: 'magic desk', position: { x: 1, y: 1 }, footprint: null, wall: null, facingDeg: null, longAxis: null })
    const requests: BlockingPlanRequest[] = []
    const real = createHostedConcurrencyCoordinator({ mode: 'immediate' })
    const admissions: HostedConcurrencyAdmission[] = []
    const coordinator: HostedConcurrencyCoordinator = {
      mode: real.mode,
      acquire: async admission => { admissions.push(admission); return await real.acquire(admission) },
      release: (token, status) => real.release(token, status),
      run: async (admission, task) => { admissions.push(admission); return await real.run(admission, task) },
      reportRateLimit: (token, feedback) => real.reportRateLimit(token, feedback),
      snapshot: () => real.snapshot(),
      dispose: reason => real.dispose(reason),
    }
    let result
    try {
      result = await generateBlockingPlan(slug, {
        model: 'gpt-5.6-sol',
        concurrency: 3,
        hostedConcurrencyCoordinator: coordinator,
        requestPlan: async request => { requests.push(request); return draftResponse(request.attempt === 1 ? broken : plan) },
      })
    } finally {
      real.dispose()
    }
    expect(admissions.map(admission => ({ provider: admission.provider, workClass: admission.workClass, workId: admission.workId, unitIndex: admission.unitIndex, configuredLimit: admission.configuredLimit }))).toEqual([
      { provider: 'openai', workClass: 'comic-llm', workId: `comic-blocking:${slug}`, unitIndex: 0, configuredLimit: 3 },
      { provider: 'openai', workClass: 'comic-llm', workId: `comic-blocking:${slug}`, unitIndex: 1, configuredLimit: 3 },
    ])
    expect(result.attempts).toBe(2)
    expect(requests.map(request => request.attempt)).toEqual([1, 2])
    expect(requests[0]!.prompt).not.toContain('## Validation errors from the previous attempt')
    expect(requests[1]!.prompt).toContain('## Validation errors from the previous attempt')
    expect(requests[1]!.prompt).toContain('- Blocking plan anchor "magic desk" is not a substring of the "cargo-bay" specification')
    expect(result.stats.totalInputTokens).toBe(2400)
    expect(await Bun.file(getBlockingPlanPath(slug)).exists()).toBe(true)
    expect(await Bun.file(getInvalidBlockingPlanPath(slug)).exists()).toBe(false)
  })

  test('writes blocking-plan.invalid.json and throws after two failed attempts', async () => {
    const { slug } = await prepareWorkspace()
    const broken = fixturePlan()
    broken.stageStates[1]!.characters = broken.stageStates[1]!.characters.filter(mark => mark.characterKey !== 'chat')
    let calls = 0
    await expect(generateBlockingPlan(slug, { model: 'gpt-5.6-sol', requestPlan: async () => { calls++; return draftResponse(broken) } })).rejects.toThrow('Blocking plan stage state "gulp-sits" drops "chat" without an exit move')
    expect(calls).toBe(2)
    const invalid = JSON.parse(await Bun.file(getInvalidBlockingPlanPath(slug)).text())
    expect(invalid.schemaVersion).toBe(1)
    expect(invalid.validationErrors).toContain('Blocking plan stage state "gulp-sits" drops "chat" without an exit move')
    expect(invalid.output.stageStates).toHaveLength(3)
    expect(await Bun.file(getBlockingPlanPath(slug)).exists()).toBe(false)
  })

  test('imports a hand-authored plan without a provider call and stamps import provenance', async () => {
    const { slug, structuredSha256, workspace } = await prepareWorkspace()
    const importPath = join(workspace, 'hand-authored-plan.json')
    await writeFile(importPath, JSON.stringify(stripStampedFields(fixturePlan()), null, 2))
    const { result, events } = await captureLogEvents(async () => await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath, requestPlan: async () => { throw new Error('the import path must not call the drafter') } }))
    expect(result.mode).toBe('import')
    expect(result.attempts).toBe(1)
    expect(result.stats.totalInputTokens).toBe(0)
    const written = v.parse(BlockingPlanSchema, JSON.parse(await Bun.file(result.planPath).text()))
    expect(written.generatedBy).toEqual({ mode: 'import', model: null })
    expect(written.structuredScriptSha256).toBe(structuredSha256)
    expect(written.stageStates[1]!.moves[0]!.citation).toEqual(citationFor(script, 'beat-0004'))
    expect(events.some(event => event.message.startsWith('blocking-plan imported file=blocking-plan.json source=import attempts=1 states=3 cameras=6'))).toBe(true)
    const stale = structuredClone(stripStampedFields(fixturePlan())) as { stageStates: Array<{ startsAt: Record<string, unknown> }> }
    stale.stageStates[0]!.startsAt['sourceSegmentSha256'] = 'f'.repeat(64)
    await writeFile(importPath, JSON.stringify(stale))
    await expect(generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath })).rejects.toThrow('run draft-scenes --rebind')
    expect(getBlockingDirectory(slug)).toBe(join(workspace, 'metadata', 'blocking'))
  })

  test('import mode restamps provenance and derived hashes even when the file carries stale values', async () => {
    const { slug, structuredSha256, workspace } = await prepareWorkspace()
    const importPath = join(workspace, 'stale-plan.json')
    const stale = structuredClone(fixturePlan()) as unknown as Record<string, unknown>
    delete stale['sceneSlug']
    stale['generatedBy'] = { mode: 'llm', model: 'gpt-5.6-sol-2026' }
    stale['structuredScriptSha256'] = 'e'.repeat(64)
    const staleLocation = (stale['locations'] as Array<Record<string, unknown>>)[0]!
    staleLocation['specificationSha256'] = 'd'.repeat(64)
    staleLocation['geometrySource'] = 'location-plans'
    await writeFile(importPath, JSON.stringify(stale, null, 2))
    const result = await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath })
    const written = v.parse(BlockingPlanSchema, JSON.parse(await Bun.file(result.planPath).text()))
    expect(written.generatedBy).toEqual({ mode: 'import', model: null })
    expect(written.structuredScriptSha256).toBe(structuredSha256)
    expect(written.sceneSlug).toBe(slug)
    expect(written.locations[0]!.specificationSha256).toBe(fixturePlan().locations[0]!.specificationSha256)
    expect(written.locations[0]!.geometrySource).toBe('specification')
    await writeFile(importPath, JSON.stringify(fixturePlan(), null, 2))
    await expect(generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath })).rejects.toThrow(`Blocking plan sceneSlug "${BLOCKING_FIXTURE_SCENE_SLUG}" does not match the scene "${slug}"`)
  })

  test('import mode binds a reviewed scene from panelBindings in the import file and leaves scene.json untouched', async () => {
    const { slug, sceneBytes, workspace } = await prepareWorkspace({ scene: true })
    const panelBindings = fixturePanels().map(panel => ({ panelNumber: panel.number, stageStateId: null, cameraSetupId: panel.blocking!.cameraSetupId, croppedOnStage: panel.blocking!.croppedOnStage, axisBreak: panel.blocking!.axisBreak }))
    const importPath = join(workspace, 'hand-authored-plan.json')
    await writeFile(importPath, JSON.stringify({ ...stripStampedFields(fixturePlan()), panelBindings }, null, 2))
    const { result, events } = await captureLogEvents(async () => await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath, requestPlan: async () => { throw new Error('the import path must not call the drafter') } }))
    expect(result.mode).toBe('import')
    expect(result.bind).toBe(true)
    expect(result.bindingsPath).toBe(getBlockingBindingsPath(slug))
    const bindings = v.parse(BlockingBindingsSchema, JSON.parse(await Bun.file(result.bindingsPath!).text()))
    expect(bindings.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(bindings.sceneSha256).toBe(sha256Bytes(sceneBytes!))
    expect(bindings.planSha256).toBe(hashBlockingPlan(result.plan))
    expect(await Bun.file(getSceneJsonPath(slug)).text()).toBe(sceneBytes!)
    const written = JSON.parse(await Bun.file(result.planPath).text()) as Record<string, unknown>
    expect(written).not.toHaveProperty('panelBindings')
    expect(v.parse(BlockingPlanSchema, written).generatedBy).toEqual({ mode: 'import', model: null })
    expect(events.some(event => event.message === 'blocking-bindings generated file=blocking-bindings.json panels=6')).toBe(true)
    const compilation = compileSceneBlocking(result.plan, buildBlockingFixtureScene().panels, bindings, { segmentOrder, planSha256: bindings.planSha256 })
    expect(compilation.panels.map(panel => panel.stageStateId)).toEqual(['meeting-open', 'meeting-open', 'meeting-open', 'gulp-sits', 'quarters-talk', 'quarters-talk'])
  })

  test('import mode into a reviewed workspace without panelBindings reports one actionable error and preserves scene.json', async () => {
    const { slug, sceneBytes, workspace } = await prepareWorkspace({ scene: true })
    const importPath = join(workspace, 'hand-authored-plan.json')
    await writeFile(importPath, JSON.stringify(stripStampedFields(fixturePlan()), null, 2))
    const error = await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(`Blocking plan for ${slug} failed validation after 1 attempt:\n- Bind mode needs panelBindings for panels 1-6 in the import file ${importPath}: the reviewed scene JSON carries no blocking citation for those panels`)
    expect((error as Error).message).not.toContain('is missing a blocking citation')
    expect(await Bun.file(getSceneJsonPath(slug)).text()).toBe(sceneBytes!)
    expect(await Bun.file(getBlockingBindingsPath(slug)).exists()).toBe(false)
    expect(await Bun.file(getBlockingPlanPath(slug)).exists()).toBe(false)
    const invalid = JSON.parse(await Bun.file(getInvalidBlockingPlanPath(slug)).text())
    expect(invalid.validationErrors).toHaveLength(1)
    const partial = fixturePanels().slice(0, 4).map(panel => ({ panelNumber: panel.number, stageStateId: null, cameraSetupId: panel.blocking!.cameraSetupId, croppedOnStage: panel.blocking!.croppedOnStage, axisBreak: panel.blocking!.axisBreak }))
    await writeFile(importPath, JSON.stringify({ ...stripStampedFields(fixturePlan()), panelBindings: [...partial, { ...partial[0]!, panelNumber: 9 }, { ...partial[1]! }] }, null, 2))
    const partialError = await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath }).catch((caught: unknown) => caught)
    expect((partialError as Error).message).toContain('- panelBindings names panel 9 which is not in the reviewed scene JSON')
    expect((partialError as Error).message).toContain('- panelBindings lists panel 2 more than once')
    expect((partialError as Error).message).toContain('- Panel 5 has no binding in panelBindings')
    expect((partialError as Error).message).toContain('- Panel 6 has no binding in panelBindings')
    await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene({ withBlocking: true }), null, 2))
    await writeFile(importPath, JSON.stringify(stripStampedFields(fixturePlan()), null, 2))
    const bound = await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath })
    expect(bound.bind).toBe(true)
    expect(bound.bindings?.panels).toEqual([])
    expect(await Bun.file(getBlockingBindingsPath(slug)).exists()).toBe(true)
  })

  test('bind mode writes blocking-bindings.json from panelBindings and leaves scene.json bytes untouched', async () => {
    const { slug, sceneBytes } = await prepareWorkspace({ scene: true })
    const plan = fixturePlan()
    const panelBindings = fixturePanels().map(panel => ({ panelNumber: panel.number, stageStateId: null, cameraSetupId: panel.blocking!.cameraSetupId, croppedOnStage: panel.blocking!.croppedOnStage, axisBreak: panel.blocking!.axisBreak }))
    const requests: BlockingPlanRequest[] = []
    const { result, events } = await captureLogEvents(async () => await generateBlockingPlan(slug, {
      model: 'gpt-5.6-sol',
      requestPlan: async request => { requests.push(request); return draftResponse(plan, { panelBindings: [...panelBindings].reverse() }) },
    }))
    expect(result.bind).toBe(true)
    expect(requests[0]!.prompt).toContain('## Bind mode: reviewed panels')
    expect((requests[0]!.jsonSchema['required'] as string[])).toContain('panelBindings')
    expect(result.bindingsPath).toBe(getBlockingBindingsPath(slug))
    const bindings = v.parse(BlockingBindingsSchema, JSON.parse(await Bun.file(result.bindingsPath!).text()))
    expect(bindings.sceneSha256).toBe(sha256Bytes(sceneBytes!))
    expect(bindings.planSha256).toBe(sha256Bytes(new Uint8Array(await Bun.file(result.planPath).arrayBuffer())))
    expect(bindings.panels.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(bindings.panels[1]!.axisBreak).toEqual({ sourceSegmentId: 'beat-0002', reason: 'Peaches turns to address the whole bay.' })
    expect(await Bun.file(getSceneJsonPath(slug)).text()).toBe(sceneBytes!)
    expect(v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(getSceneJsonPath(slug)).text())).panels.every(panel => panel.blocking === undefined)).toBe(true)
    expect(events.some(event => event.message === 'blocking-bindings generated file=blocking-bindings.json panels=6')).toBe(true)
    const compilation = compileSceneBlocking(result.plan, buildBlockingFixtureScene().panels, bindings, { segmentOrder, planSha256: bindings.planSha256 })
    expect(compilation.panels[1]!.axis?.axisBreak?.sourceSegmentId).toBe('beat-0002')
    expect(compilation.panels[3]!.croppedOnStage).toEqual([{ characterKey: 'seamus', reason: 'Seamus is cropped by the right frame edge.' }])
  })

  test('bind mode rejects bindings that contradict the reviewed cast and preserves scene.json', async () => {
    const { slug, sceneBytes } = await prepareWorkspace({ scene: true })
    const plan = fixturePlan()
    const panelBindings = fixturePanels().map(panel => ({ panelNumber: panel.number, stageStateId: null, cameraSetupId: panel.number === 1 ? 'reverse-from-hatch' : panel.blocking!.cameraSetupId, croppedOnStage: panel.blocking!.croppedOnStage, axisBreak: panel.blocking!.axisBreak }))
    await expect(generateBlockingPlan(slug, { model: 'gpt-5.6-sol', requestPlan: async () => draftResponse(plan, { panelBindings }) })).rejects.toThrow('Panel 1 lists "seamus" who is not in frame for camera "reverse-from-hatch"')
    expect(await Bun.file(getSceneJsonPath(slug)).text()).toBe(sceneBytes!)
    expect(await Bun.file(getBlockingBindingsPath(slug)).exists()).toBe(false)
    expect(await Bun.file(getInvalidBlockingPlanPath(slug)).exists()).toBe(true)
  })

  test('prices the stage as up to two calls at 3,000 output units each with one image unit block per location', () => {
    const estimate = estimateBlockingPlanCalls(script)
    expect(estimate).toMatchObject({ maxCalls: 2, outputUnitsPerCall: 3000, imageInputUnitsPerCall: 2000, locationCount: 2, segmentCount: 8 })
    expect(estimate.inputUnitsPerCall).toBeGreaterThan(1500)
    expect(estimateBlockingPlanCalls(script, { promptText: 'x'.repeat(4000) }).inputUnitsPerCall).toBe(1000)
  })
})

describe('character catalog blocking fields', () => {
  const makeCatalog = async (characters: unknown[]) => {
    const root = await makeTempDir('autoshow-blocking-catalog-')
    temporaryDirectories.push(root)
    await writeFile(join(root, 'hero.png'), BLOCKING_FIXTURE_TINY_PNG)
    await writeFile(join(root, 'sidekick.png'), BLOCKING_FIXTURE_TINY_PNG)
    await writeFile(join(root, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters, groupAliases: [] }))
    return root
  }
  const hero = (extra: Record<string, unknown> = {}) => ({ key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.png', outlineSheet: 'hero.png', description: 'Hero.', ...extra })
  const sidekick = (extra: Record<string, unknown> = {}) => ({ key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick.', ...extra })

  test('accepts variantOf, distinguishFrom, and wardrobe fields that reference catalog keys', async () => {
    const root = await makeCatalog([
      hero({ distinguishFrom: [{ characterKey: 'sidekick', cue: 'Hero is taller.' }], wardrobe: { colorTokens: ['jacket: red'], never: ['yellow jumpsuit'], deviationStates: [{ state: 'vacation', variantKey: 'sidekick', description: 'Hawaiian shirt.' }] } }),
      sidekick({ variantOf: 'hero', wardrobe: { colorTokens: ['hoodie: navy'] } }),
    ])
    const catalog = loadCharacterCatalog(root)
    expect(catalog.get(catalog.requireKey('hero')).distinguishFrom).toEqual([{ characterKey: 'sidekick', cue: 'Hero is taller.' }])
    expect(catalog.get(catalog.requireKey('hero')).wardrobe?.never).toEqual(['yellow jumpsuit'])
    expect(catalog.get(catalog.requireKey('sidekick')).variantOf).toBe('hero')
  })

  test('rejects variantOf and distinguishFrom references to missing keys and still rejects unknown keys', async () => {
    const load = async (characters: unknown[]) => loadCharacterCatalog(await makeCatalog(characters))
    await expect(load([hero({ variantOf: 'paddy' }), sidekick()])).rejects.toThrow('Character "hero" variantOf "paddy" is not a catalog key')
    await expect(load([hero({ distinguishFrom: [{ characterKey: 'ghost', cue: 'x' }] }), sidekick()])).rejects.toThrow('Character "hero" distinguishFrom "ghost" is not a catalog key')
    await expect(load([hero({ variantOf: 'hero' }), sidekick()])).rejects.toThrow('cannot name itself')
    await expect(load([hero({ unknownField: true }), sidekick()])).rejects.toThrow(/Invalid key|unknown key/i)
    await expect(load([hero({ wardrobe: { colorTokens: ['jacket: red'], extra: 1 } }), sidekick()])).rejects.toThrow(/Invalid key|unknown key/i)
  })
})
