import type { BlockingAnchor, BlockingAnchorProjection, BlockingAxisSide, BlockingCameraBasis, BlockingCameraLike, BlockingDepthBand, BlockingFacing, BlockingFrameStatus, BlockingLens, BlockingPointProjection, BlockingPosition, BlockingRegion, BlockingRegisteredView, BlockingScreenSide, BlockingSeenFrom, BlockingVector } from '~/types'

export const BLOCKING_GEOMETRY = {
  horizontalFieldOfViewDeg: { wide: 84, normal: 54, long: 30 } as Record<BlockingLens, number>,
  edgeBandDeg: 6,
  screenSideThreshold: 0.2,
  foregroundMaxM: 2.5,
  midgroundMaxM: 6,
  towardCameraMaxDeg: 45,
  awayFromCameraMinDeg: 135,
  registeredViewToleranceDeg: 60,
  reviewedAnchorToleranceM: 0.25,
  offFrameAnchorProximityM: 2.5,
} as const

const DEG = 180 / Math.PI
const EPSILON = 1e-9

export const round2 = (value: number): number => {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export const normalizeDegrees = (value: number): number => {
  const wrapped = value % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export const facingVector = (facingDeg: number): BlockingVector => {
  const radians = facingDeg / DEG
  return { x: Math.sin(radians), y: Math.cos(radians) }
}

export const headingDegrees = (vector: BlockingVector): number => normalizeDegrees(Math.atan2(vector.x, vector.y) * DEG)

export const subtract = (a: BlockingPosition, b: BlockingPosition): BlockingVector => ({ x: a.x - b.x, y: a.y - b.y })

export const dot = (a: BlockingVector, b: BlockingVector): number => a.x * b.x + a.y * b.y

export const cross = (a: BlockingVector, b: BlockingVector): number => a.x * b.y - a.y * b.x

export const length = (vector: BlockingVector): number => Math.hypot(vector.x, vector.y)

export const distance = (a: BlockingPosition, b: BlockingPosition): number => length(subtract(a, b))

const positiveZero = (value: number): number => value + 0

export const normalize = (vector: BlockingVector): BlockingVector => {
  const magnitude = length(vector)
  if (magnitude < EPSILON) return { x: 0, y: 1 }
  return { x: positiveZero(vector.x / magnitude), y: positiveZero(vector.y / magnitude) }
}

export const angleBetweenDeg = (a: BlockingVector, b: BlockingVector): number => {
  const denominator = length(a) * length(b)
  if (denominator < EPSILON) return 0
  const cosine = Math.min(1, Math.max(-1, dot(a, b) / denominator))
  return Math.acos(cosine) * DEG
}

export const cameraBasis = (setup: BlockingCameraLike): BlockingCameraBasis => {
  const forward = normalize(subtract(setup.target, setup.position))
  return { forward, right: { x: positiveZero(forward.y), y: positiveZero(-forward.x) } }
}

export const cameraHeadingDeg = (setup: BlockingCameraLike): number => headingDegrees(cameraBasis(setup).forward)

export const horizontalFieldOfViewDeg = (lens: BlockingLens): number => BLOCKING_GEOMETRY.horizontalFieldOfViewDeg[lens]

export const projectPoint = (setup: BlockingCameraLike, point: BlockingPosition): BlockingPointProjection => {
  const basis = cameraBasis(setup)
  const offset = subtract(point, setup.position)
  const forward = dot(offset, basis.forward)
  const lateralM = dot(offset, basis.right)
  const halfFov = horizontalFieldOfViewDeg(setup.lens) / 2
  const angle = Math.atan2(lateralM, forward) * DEG
  const lateral = angle / halfFov
  const magnitude = Math.abs(angle)
  const inFrame: BlockingFrameStatus = forward <= EPSILON
    ? 'out'
    : magnitude <= halfFov - BLOCKING_GEOMETRY.edgeBandDeg
      ? 'in'
      : magnitude <= halfFov
        ? 'edge'
        : 'out'
  return { forward: round2(forward), lateral: round2(lateral), inFrame }
}

export const screenSideFromLateral = (lateral: number): BlockingScreenSide => {
  if (lateral < -BLOCKING_GEOMETRY.screenSideThreshold) return 'left'
  if (lateral > BLOCKING_GEOMETRY.screenSideThreshold) return 'right'
  return 'center'
}

export const depthBandFromForward = (forward: number): BlockingDepthBand => {
  if (forward < BLOCKING_GEOMETRY.foregroundMaxM) return 'foreground'
  if (forward < BLOCKING_GEOMETRY.midgroundMaxM) return 'midground'
  return 'background'
}

export const facingRelativeToCamera = (characterPosition: BlockingPosition, facingDeg: number, cameraPosition: BlockingPosition): BlockingFacing => {
  const facing = facingVector(facingDeg)
  const toCamera = subtract(cameraPosition, characterPosition)
  const angle = angleBetweenDeg(facing, toCamera)
  if (angle < BLOCKING_GEOMETRY.towardCameraMaxDeg) return 'toward-camera'
  if (angle > BLOCKING_GEOMETRY.awayFromCameraMinDeg) return 'away-from-camera'
  return cross(facing, toCamera) > 0 ? 'profile-screen-left' : 'profile-screen-right'
}

export const axisSideForCamera = (from: BlockingPosition, to: BlockingPosition, cameraPosition: BlockingPosition): BlockingAxisSide | null => {
  const value = cross(subtract(to, from), subtract(cameraPosition, from))
  if (Math.abs(value) < EPSILON) return null
  return value > 0 ? 'left' : 'right'
}

const angularDistanceDeg = (a: number, b: number): number => {
  const difference = Math.abs(normalizeDegrees(a) - normalizeDegrees(b))
  return Math.min(difference, 360 - difference)
}

export const nearestRegisteredView = (headingDeg: number): BlockingRegisteredView => {
  if (angularDistanceDeg(headingDeg, 0) <= BLOCKING_GEOMETRY.registeredViewToleranceDeg) return 'establishing'
  if (angularDistanceDeg(headingDeg, 180) <= BLOCKING_GEOMETRY.registeredViewToleranceDeg) return 'reverse'
  return 'side'
}

export const pointInFootprint = (point: BlockingPosition, anchor: Pick<BlockingAnchor, 'position' | 'footprint'>): boolean => {
  if (!anchor.footprint) return false
  return Math.abs(point.x - anchor.position.x) <= anchor.footprint.width / 2 + EPSILON
    && Math.abs(point.y - anchor.position.y) <= anchor.footprint.depth / 2 + EPSILON
}

export const regionCorners = (region: BlockingRegion): BlockingPosition[] => [
  { x: region.x, y: region.y },
  { x: region.x - region.width / 2, y: region.y - region.depth / 2 },
  { x: region.x + region.width / 2, y: region.y - region.depth / 2 },
  { x: region.x - region.width / 2, y: region.y + region.depth / 2 },
  { x: region.x + region.width / 2, y: region.y + region.depth / 2 },
]

export const regionInFrame = (setup: BlockingCameraLike, region: BlockingRegion): boolean =>
  regionCorners(region).some(corner => projectPoint(setup, corner).inFrame !== 'out')

export const anchorFacingDeg = (anchor: Pick<BlockingAnchor, 'wall' | 'facingDeg'>): number => {
  if (typeof anchor.facingDeg === 'number') return normalizeDegrees(anchor.facingDeg)
  switch (anchor.wall) {
    case 'left': return 90
    case 'right': return 270
    case 'front': return 0
    default: return 180
  }
}

export const anchorSeenFrom = (setup: BlockingCameraLike, anchor: Pick<BlockingAnchor, 'position' | 'wall' | 'facingDeg'>): BlockingSeenFrom => {
  const facing = facingVector(anchorFacingDeg(anchor))
  const toCamera = subtract(setup.position, anchor.position)
  const angle = angleBetweenDeg(facing, toCamera)
  if (angle < BLOCKING_GEOMETRY.towardCameraMaxDeg) return 'front'
  if (angle > BLOCKING_GEOMETRY.awayFromCameraMinDeg) return 'rear'
  return cross(facing, toCamera) > 0 ? 'left' : 'right'
}

const depthWord = (band: BlockingDepthBand): string => band === 'foreground' ? 'near' : band === 'midground' ? 'mid' : 'far'

const longEdgeDescription = (setup: BlockingCameraLike, anchor: Pick<BlockingAnchor, 'longAxis'>): string | null => {
  if (!anchor.longAxis) return null
  const axis: BlockingVector = anchor.longAxis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 }
  const alignment = Math.abs(dot(axis, cameraBasis(setup).forward))
  if (alignment > 0.7) return 'long edge receding'
  if (alignment < 0.3) return 'long edge across frame'
  return 'long edge diagonal'
}

export const projectAnchor = (setup: BlockingCameraLike, anchor: BlockingAnchor): BlockingAnchorProjection => {
  const point = projectPoint(setup, anchor.position)
  const screenSide = screenSideFromLateral(point.lateral)
  const depthBand = depthBandFromForward(point.forward)
  const seenFrom = anchorSeenFrom(setup, anchor)
  const parts = [screenSide === 'center' ? 'center' : `screen-${screenSide}`, depthWord(depthBand)]
  const edge = longEdgeDescription(setup, anchor)
  if (edge) parts.push(edge)
  parts.push(`${seenFrom} face toward camera`)
  return { screenSide, depthBand, seenFrom, projection: `${anchor.key}: ${parts.join(', ')}` }
}
