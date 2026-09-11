import { describe, expect, test } from 'bun:test'
import { axisSideForCamera, BLOCKING_GEOMETRY, cameraBasis, cameraHeadingDeg, facingRelativeToCamera, nearestRegisteredView, pointInFootprint, projectAnchor, projectPoint } from '~/cli/commands/visuals/comic/comic-utils/blocking-geometry'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
const { fixturePlan } = setupBlockingContractFixtures()


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
