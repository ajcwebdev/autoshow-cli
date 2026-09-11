import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import { deriveStateForPanel, establishAxisSides, hashSourceSegmentText, rebindPlanCitations, validateBlockingPlan, validateScenePanelBlocking } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-validation'
import { BlockingPlanSchema } from '~/cli/commands/visuals/comic/schemas/blocking-plan-schemas'
import type { BlockingScenePanelInput, StructuredScriptData } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
import { BLOCKING_FIXTURE_ENSEMBLE_KEY, BLOCKING_FIXTURE_SEGMENTS, buildBlockingFixtureStructuredScript, buildBlockingFixtureValidationContext, citationFor } from './fixtures/blocking/blocking-plan-fixture'
const { script, segmentOrder, fixturePlan, fixturePanels, context, messages } = setupBlockingContractFixtures()


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
