import type { BlockingAxisSide, BlockingBindings, BlockingCameraSetup, BlockingPlan, BlockingScenePanelInput, BlockingScenePanelValidationOptions, BlockingStageState, BlockingValidationIssue, PanelBlockingCitation } from '~/types'
import { axisSideForCamera } from './blocking-geometry'

import { orderStageStates, segmentIndexMap } from './blocking-segment-order'
const issue = (code: string, path: string, message: string): BlockingValidationIssue => ({ code, path, message })
export const resolvePanelBlocking = (panel: BlockingScenePanelInput, bindings?: BlockingBindings | undefined): PanelBlockingCitation | undefined => {
  if (panel.blocking) return panel.blocking
  const bound = bindings?.panels.find(item => item.panelNumber === panel.number)
  if (!bound) return undefined
  return {
    ...(bound.stageStateId !== null ? { stageStateId: bound.stageStateId } : {}),
    cameraSetupId: bound.cameraSetupId,
    croppedOnStage: bound.croppedOnStage,
    axisBreak: bound.axisBreak,
  }
}

export const segmentOrderFromPanels = (panels: readonly BlockingScenePanelInput[]): string[] => {
  const seen = new Set<string>()
  const order: string[] = []
  for (const panel of [...panels].sort((left, right) => left.number - right.number)) {
    for (const id of panel.sourceSegmentIds) {
      if (!seen.has(id)) { seen.add(id); order.push(id) }
    }
  }
  return order
}

export const deriveStateForPanel = (plan: BlockingPlan, panel: BlockingScenePanelInput, segmentOrder: readonly string[], bindings?: BlockingBindings | undefined): BlockingStageState | undefined => {
  const blocking = resolvePanelBlocking(panel, bindings)
  if (blocking?.stageStateId) return plan.stageStates.find(state => state.id === blocking.stageStateId)
  const indices = segmentIndexMap(segmentOrder.map(id => ({ id })))
  const firstSegment = panel.sourceSegmentIds[0]
  const panelIndex = firstSegment === undefined ? Number.NEGATIVE_INFINITY : indices.get(firstSegment) ?? Number.NEGATIVE_INFINITY
  let active: BlockingStageState | undefined
  for (const state of orderStageStates(plan, segmentOrder)) {
    const startIndex = indices.get(state.startsAt.sourceSegmentId)
    if (startIndex === undefined) continue
    if (startIndex <= panelIndex) active = state
    else break
  }
  return active
}

export const cameraById = (plan: BlockingPlan, id: string): BlockingCameraSetup | undefined => plan.cameraSetups.find(camera => camera.id === id)

export const cameraAxisSide = (state: BlockingStageState, camera: BlockingCameraSetup): BlockingAxisSide | null => {
  if (!state.actionAxis) return null
  const from = state.characters.find(mark => mark.characterKey === state.actionAxis?.from)
  const to = state.characters.find(mark => mark.characterKey === state.actionAxis?.to)
  if (!from || !to) return null
  return axisSideForCamera(from.position, to.position, camera.position)
}

export const establishAxisSides = (plan: BlockingPlan, panels: readonly BlockingScenePanelInput[], options: BlockingScenePanelValidationOptions = {}): BlockingPlan => {
  const segmentOrder = options.segmentOrder ?? segmentOrderFromPanels(panels)
  const established = new Map<string, BlockingAxisSide>()
  for (const state of plan.stageStates) {
    if (state.actionAxis?.establishedSide) established.set(state.id, state.actionAxis.establishedSide)
  }
  for (const panel of [...panels].sort((left, right) => left.number - right.number)) {
    const blocking = resolvePanelBlocking(panel, options.bindings)
    if (!blocking) continue
    const state = deriveStateForPanel(plan, panel, segmentOrder, options.bindings)
    const camera = cameraById(plan, blocking.cameraSetupId)
    if (!state || !camera || !state.actionAxis || established.has(state.id)) continue
    const side = cameraAxisSide(state, camera)
    if (side) established.set(state.id, side)
  }
  return {
    ...plan,
    stageStates: plan.stageStates.map(state => state.actionAxis
      ? { ...state, actionAxis: { ...state.actionAxis, establishedSide: established.get(state.id) ?? state.actionAxis.establishedSide } }
      : state),
  }
}

export const resolveScenePanelContext = (established: BlockingPlan, panel: BlockingScenePanelInput, segmentOrder: readonly string[], options: BlockingScenePanelValidationOptions, issues: BlockingValidationIssue[]) => {
  const path = `panels[${panel.number}]`
  const blocking = resolvePanelBlocking(panel, options.bindings)
  if (!blocking) {
    issues.push(issue('panel-missing-blocking', path, `Panel ${panel.number} is missing a blocking citation`))
    return undefined
  }
  const camera = cameraById(established, blocking.cameraSetupId)
  if (!camera) {
    issues.push(issue('panel-unknown-camera', path, `Panel ${panel.number} cites unknown camera setup "${blocking.cameraSetupId}"`))
    return undefined
  }
  if (camera.locationKey !== panel.locationKey) {
    issues.push(issue('panel-camera-location', path, `Panel ${panel.number} camera "${camera.id}" belongs to location "${camera.locationKey}", not "${panel.locationKey}"`))
  }
  if (blocking.stageStateId && !established.stageStates.some(state => state.id === blocking.stageStateId)) {
    issues.push(issue('panel-unknown-state', path, `Panel ${panel.number} cites unknown stage state "${blocking.stageStateId}"`))
    return undefined
  }
  const state = deriveStateForPanel(established, panel, segmentOrder, options.bindings)
  if (!state) {
    issues.push(issue('panel-no-state', path, `Panel ${panel.number} has no active stage state`))
    return undefined
  }
  if (state.locationKey !== panel.locationKey) {
    issues.push(issue('panel-state-location', path, `Panel ${panel.number} stage state "${state.id}" belongs to location "${state.locationKey}", not "${panel.locationKey}"`))
  }
  return { panel, blocking, camera, state, path }
}

export type ResolvedScenePanelContext = NonNullable<ReturnType<typeof resolveScenePanelContext>>
