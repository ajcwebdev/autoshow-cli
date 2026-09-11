import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import { compileBlockingForPanel } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-compile'
import { BLOCKING_AUDIT_STATUSES, BLOCKING_HARD_CANDIDATE_STATUSES, BLOCKING_PLAN_SCHEMA_VERSION, BlockingBindingsSchema, BlockingPlanSchema, buildBlockingPlanJsonSchema, stripBlockingPlanNulls, stripSceneBlockingNulls } from '~/cli/commands/visuals/comic/schemas/blocking-plan-schemas'
import { buildSceneJsonSchema, PanelBundleDataSchema, ScenePromptDataSchema } from '~/cli/commands/visuals/comic/schemas/schemas'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
import { buildBlockingFixtureScene } from './fixtures/blocking/blocking-plan-fixture'
const { segmentOrder, fixturePlan, fixturePanels, visitJsonSchema } = setupBlockingContractFixtures()


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
