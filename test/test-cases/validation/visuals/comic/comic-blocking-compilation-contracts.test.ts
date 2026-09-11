import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { renderPanelSvg, renderPlanOverviewSvg } from '~/cli/commands/visuals/comic/comic-utils/blocking-diagram-svg'
import { describeBlockingLayoutGuideMarkers, renderBlockingLayoutGuidePng, shouldUseBlockingLayoutGuide } from '~/cli/commands/visuals/comic/comic-utils/blocking-layout-guide'
import { buildBlockingLedgerLine, compileBlockingForPanel, compileSceneBlocking, hashBlockingPlan, OFF_FRAME_PINNED_SENTENCE, writeBlockingArtifacts } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-compile'
import { establishAxisSides } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-validation'
import type { BlockingPlan, BlockingScenePanelInput } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
const { temporaryDirectories, segmentOrder, fixturePlan, fixturePanels, reorderKeys } = setupBlockingContractFixtures()


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
