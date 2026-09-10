import type { BlockingCameraSetup, BlockingLocationMap, BlockingPlan, BlockingPosition, BlockingStageState, CompiledPanelBlocking } from '~/types'
import { cameraBasis, facingVector, horizontalFieldOfViewDeg } from './blocking-geometry'

const DIAGRAM_WIDTH = 800
const DIAGRAM_PADDING_M = 1.5
const LABEL_FONT = 'font-family="monospace" font-size="12"'

type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

type Mapper = { width: number; height: number; toX: (x: number) => number; toY: (y: number) => number; scale: number }

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmt = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2)
}

const extendBounds = (bounds: Bounds, point: BlockingPosition, margin = 0): void => {
  bounds.minX = Math.min(bounds.minX, point.x - margin)
  bounds.maxX = Math.max(bounds.maxX, point.x + margin)
  bounds.minY = Math.min(bounds.minY, point.y - margin)
  bounds.maxY = Math.max(bounds.maxY, point.y + margin)
}

const locationBounds = (location: BlockingLocationMap, states: readonly BlockingStageState[], cameras: readonly BlockingCameraSetup[]): Bounds => {
  const bounds: Bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  for (const anchor of location.anchors) extendBounds(bounds, anchor.position, Math.max(anchor.footprint?.width ?? 0, anchor.footprint?.depth ?? 0) / 2)
  for (const item of location.dressing) extendBounds(bounds, item.position)
  for (const cell of location.cameraCells ?? []) extendBounds(bounds, cell.position)
  for (const state of states) {
    for (const mark of state.characters) extendBounds(bounds, mark.position, 0.5)
    for (const extras of state.extras) extendBounds(bounds, { x: extras.region.x, y: extras.region.y }, Math.max(extras.region.width, extras.region.depth) / 2)
  }
  for (const camera of cameras) {
    extendBounds(bounds, camera.position)
    extendBounds(bounds, camera.target)
  }
  bounds.minX -= DIAGRAM_PADDING_M
  bounds.maxX += DIAGRAM_PADDING_M
  bounds.minY -= DIAGRAM_PADDING_M
  bounds.maxY += DIAGRAM_PADDING_M
  return bounds
}

const createMapper = (bounds: Bounds): Mapper => {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1)
  const spanY = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = DIAGRAM_WIDTH / spanX
  const height = Math.ceil(spanY * scale)
  return {
    width: DIAGRAM_WIDTH,
    height,
    scale,
    toX: x => (x - bounds.minX) * scale,
    toY: y => (bounds.maxY - y) * scale,
  }
}

const renderAnchors = (location: BlockingLocationMap, map: Mapper): string[] => {
  const lines: string[] = []
  for (const anchor of location.anchors) {
    const width = Math.max((anchor.footprint?.width ?? 0.4) * map.scale, 6)
    const depth = Math.max((anchor.footprint?.depth ?? 0.4) * map.scale, 6)
    const x = map.toX(anchor.position.x) - width / 2
    const y = map.toY(anchor.position.y) - depth / 2
    lines.push(`<rect class="anchor" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(depth)}" fill="#d9d2c5" stroke="#5b5348" stroke-width="1.5" />`)
    lines.push(`<text class="anchor-label" x="${fmt(map.toX(anchor.position.x))}" y="${fmt(map.toY(anchor.position.y) - depth / 2 - 4)}" text-anchor="middle" ${LABEL_FONT} fill="#5b5348">${escapeXml(anchor.key)}</text>`)
  }
  for (const item of location.dressing) {
    lines.push(`<rect class="dressing" x="${fmt(map.toX(item.position.x) - 5)}" y="${fmt(map.toY(item.position.y) - 5)}" width="10" height="10" fill="#f2e6b5" stroke="#8a7a2a" stroke-width="1" />`)
    lines.push(`<text class="dressing-label" x="${fmt(map.toX(item.position.x))}" y="${fmt(map.toY(item.position.y) - 9)}" text-anchor="middle" ${LABEL_FONT} fill="#8a7a2a">${escapeXml(item.key)}</text>`)
  }
  return lines
}

const renderState = (state: BlockingStageState, map: Mapper, labelSuffix: string): string[] => {
  const lines: string[] = [`<g class="state" data-state="${escapeXml(state.id)}">`]
  for (const extras of state.extras) {
    const width = extras.region.width * map.scale
    const depth = extras.region.depth * map.scale
    lines.push(`<rect class="extras" x="${fmt(map.toX(extras.region.x) - width / 2)}" y="${fmt(map.toY(extras.region.y) - depth / 2)}" width="${fmt(width)}" height="${fmt(depth)}" fill="#c9dcef" fill-opacity="0.5" stroke="#3b5f88" stroke-dasharray="6 4" stroke-width="1" />`)
    lines.push(`<text class="extras-label" x="${fmt(map.toX(extras.region.x))}" y="${fmt(map.toY(extras.region.y))}" text-anchor="middle" ${LABEL_FONT} fill="#3b5f88">${escapeXml(`${extras.count} ${extras.ensembleKey}`)}</text>`)
  }
  for (const mark of state.characters) {
    const cx = map.toX(mark.position.x)
    const cy = map.toY(mark.position.y)
    const facing = facingVector(mark.facingDeg)
    const tickLength = 0.45 * map.scale
    lines.push(`<circle class="mark" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(0.25 * map.scale)}" fill="#f6c28b" stroke="#8a4b1f" stroke-width="1.5" />`)
    lines.push(`<line class="facing" x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(cx + facing.x * tickLength)}" y2="${fmt(cy - facing.y * tickLength)}" stroke="#8a4b1f" stroke-width="2" />`)
    lines.push(`<text class="mark-label" x="${fmt(cx)}" y="${fmt(cy + 0.25 * map.scale + 12)}" text-anchor="middle" ${LABEL_FONT} fill="#8a4b1f">${escapeXml(`${mark.characterKey}${labelSuffix}`)}</text>`)
  }
  if (state.actionAxis) {
    const from = state.characters.find(mark => mark.characterKey === state.actionAxis?.from)
    const to = state.characters.find(mark => mark.characterKey === state.actionAxis?.to)
    if (from && to) {
      lines.push(`<line class="axis" x1="${fmt(map.toX(from.position.x))}" y1="${fmt(map.toY(from.position.y))}" x2="${fmt(map.toX(to.position.x))}" y2="${fmt(map.toY(to.position.y))}" stroke="#b03030" stroke-width="1.5" stroke-dasharray="8 4" />`)
    }
  }
  lines.push('</g>')
  return lines
}

const renderCamera = (camera: BlockingCameraSetup, map: Mapper, emphasized: boolean): string[] => {
  const basis = cameraBasis(camera)
  const halfFov = (horizontalFieldOfViewDeg(camera.lens) / 2) * Math.PI / 180
  const reach = Math.max(Math.hypot(camera.target.x - camera.position.x, camera.target.y - camera.position.y) * 1.2, 2)
  const rotate = (angle: number): BlockingPosition => ({
    x: basis.forward.x * Math.cos(angle) - basis.forward.y * Math.sin(angle),
    y: basis.forward.x * Math.sin(angle) + basis.forward.y * Math.cos(angle),
  })
  const left = rotate(halfFov)
  const right = rotate(-halfFov)
  const origin = { x: map.toX(camera.position.x), y: map.toY(camera.position.y) }
  const leftEnd = { x: map.toX(camera.position.x + left.x * reach), y: map.toY(camera.position.y + left.y * reach) }
  const rightEnd = { x: map.toX(camera.position.x + right.x * reach), y: map.toY(camera.position.y + right.y * reach) }
  const color = emphasized ? '#1f6f3f' : '#7a8a7f'
  return [
    `<path class="camera" data-camera="${escapeXml(camera.id)}" d="M ${fmt(origin.x)} ${fmt(origin.y)} L ${fmt(leftEnd.x)} ${fmt(leftEnd.y)} L ${fmt(rightEnd.x)} ${fmt(rightEnd.y)} Z" fill="${color}" fill-opacity="${emphasized ? '0.25' : '0.12'}" stroke="${color}" stroke-width="${emphasized ? '2' : '1'}" />`,
    `<text class="camera-label" x="${fmt(origin.x)}" y="${fmt(origin.y + 14)}" text-anchor="middle" ${LABEL_FONT} fill="${color}">${escapeXml(camera.id)}</text>`,
  ]
}

const renderLocationGroup = (location: BlockingLocationMap, states: readonly BlockingStageState[], cameras: readonly BlockingCameraSetup[], options: { emphasizedCameraId?: string | undefined; stateLabelSuffix: (state: BlockingStageState) => string }): { lines: string[]; height: number } => {
  const map = createMapper(locationBounds(location, states, cameras))
  const lines: string[] = [`<g class="location" data-location="${escapeXml(location.locationKey)}">`]
  lines.push(`<rect class="floor" x="0" y="0" width="${fmt(map.width)}" height="${fmt(map.height)}" fill="#f7f4ee" stroke="#bdb5a8" stroke-width="1" />`)
  lines.push(`<text class="location-label" x="8" y="16" ${LABEL_FONT} fill="#3a352e">${escapeXml(`${location.locationKey} (top-down, +y up the page)`)}</text>`)
  lines.push(...renderAnchors(location, map))
  for (const state of states) lines.push(...renderState(state, map, options.stateLabelSuffix(state)))
  for (const camera of cameras) lines.push(...renderCamera(camera, map, camera.id === options.emphasizedCameraId))
  lines.push('</g>')
  return { lines, height: map.height }
}

const wrapSvg = (groups: Array<{ lines: string[]; height: number }>, title: string): string => {
  const gap = 24
  const totalHeight = groups.reduce((sum, group) => sum + group.height, 0) + gap * Math.max(groups.length - 1, 0) + 32
  const body: string[] = [`<title>${escapeXml(title)}</title>`, `<text class="title" x="8" y="20" font-family="monospace" font-size="14" fill="#1f1c18">${escapeXml(title)}</text>`]
  let offset = 32
  for (const group of groups) {
    body.push(`<g transform="translate(0 ${fmt(offset)})">`)
    body.push(...group.lines)
    body.push('</g>')
    offset += group.height + gap
  }
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${DIAGRAM_WIDTH}" height="${fmt(totalHeight)}" viewBox="0 0 ${DIAGRAM_WIDTH} ${fmt(totalHeight)}">`, ...body, '</svg>', ''].join('\n')
}

export const renderPlanOverviewSvg = (plan: BlockingPlan): string => {
  const groups = plan.locations.map(location => renderLocationGroup(
    location,
    plan.stageStates.filter(state => state.locationKey === location.locationKey),
    plan.cameraSetups.filter(camera => camera.locationKey === location.locationKey),
    { stateLabelSuffix: state => `@${state.id}` },
  ))
  return wrapSvg(groups, `Blocking plan overview: ${plan.sceneSlug}`)
}

export const renderPanelSvg = (plan: BlockingPlan, compiled: CompiledPanelBlocking, panelNumber?: number): string => {
  const state = plan.stageStates.find(item => item.id === compiled.stageStateId)
  const camera = plan.cameraSetups.find(item => item.id === compiled.cameraSetupId)
  const location = plan.locations.find(item => item.locationKey === (state?.locationKey ?? camera?.locationKey))
  if (!state || !camera || !location) return wrapSvg([], `Blocking panel diagram unavailable for ${plan.sceneSlug}`)
  const group = renderLocationGroup(location, [state], [camera], { emphasizedCameraId: camera.id, stateLabelSuffix: () => '' })
  const label = panelNumber === undefined ? `Blocking panel diagram: ${plan.sceneSlug}` : `Blocking panel ${panelNumber}: ${plan.sceneSlug}`
  return wrapSvg([group], `${label} (state ${state.id}, camera ${camera.id})`)
}
