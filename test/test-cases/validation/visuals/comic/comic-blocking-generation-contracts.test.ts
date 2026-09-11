import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/command-shared/hosted-concurrency-coordinator'
import { estimateBlockingPlanCalls, generateBlockingPlan } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/generate-blocking-plan'
import { compileSceneBlocking, hashBlockingPlan } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-compile'
import { getBlockingBindingsPath, getBlockingDirectory, getBlockingPlanPath, getInvalidBlockingPlanPath } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-paths'
import { BLOCKING_DRAFTER_PINNED_SENTENCE } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-prompt'
import { getSceneJsonPath } from '~/cli/commands/visuals/comic/comic-utils/project-paths'
import { BlockingBindingsSchema, BlockingPlanSchema } from '~/cli/commands/visuals/comic/schemas/blocking-plan-schemas'
import { ScenePromptDataSchema } from '~/cli/commands/visuals/comic/schemas/schemas'
import type { BlockingPlanRequest, HostedConcurrencyAdmission, HostedConcurrencyCoordinator } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
import { BLOCKING_FIXTURE_SCENE_SLUG, buildBlockingFixtureScene, citationFor } from './fixtures/blocking/blocking-plan-fixture'
const { script, segmentOrder, fixturePlan, fixturePanels, stripStampedFields, prepareWorkspace, draftResponse } = setupBlockingContractFixtures()


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
