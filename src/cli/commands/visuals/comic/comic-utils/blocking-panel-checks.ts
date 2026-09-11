import type { BlockingValidationIssue } from '~/types'
import { BLOCKING_GEOMETRY, facingRelativeToCamera, projectPoint, regionInFrame } from './blocking-geometry'

import { cameraAxisSide, type ResolvedScenePanelContext } from './blocking-panel-context'
const issue = (code: string, path: string, message: string): BlockingValidationIssue => ({ code, path, message })
export const validateScenePanelAxis = ({ panel, blocking, camera, state, path }: ResolvedScenePanelContext, issues: BlockingValidationIssue[]): void => {
  if (state.actionAxis?.establishedSide) {
    const side = cameraAxisSide(state, camera)
    if (side && side !== state.actionAxis.establishedSide) {
      const cited = blocking.axisBreak && panel.sourceSegmentIds.includes(blocking.axisBreak.sourceSegmentId)
      if (!cited) issues.push(issue('panel-axis-crossed', path, `Panel ${panel.number} crosses the action axis without an axisBreak citing one of its own source segments`))
    }
  }
  if (blocking.axisBreak && !panel.sourceSegmentIds.includes(blocking.axisBreak.sourceSegmentId)) {
    issues.push(issue('panel-axis-break-citation', path, `Panel ${panel.number} axisBreak cites segment "${blocking.axisBreak.sourceSegmentId}" which is not one of its own source segments`))
  }
}

export const validateScenePanelVisibility = ({ panel, blocking, camera, state, path }: ResolvedScenePanelContext, issues: BlockingValidationIssue[]) => {
  const listed = new Set(panel.characterKeys)
  const cropped = new Map(blocking.croppedOnStage.map(item => [item.characterKey, item] as const))
  const onStage = new Map(state.characters.map(mark => [mark.characterKey, mark] as const))
  const inFrame = new Set<string>()
  const projections = new Map<string, ReturnType<typeof projectPoint>>()
  for (const mark of state.characters) {
    const projection = projectPoint(camera, mark.position)
    projections.set(mark.characterKey, projection)
    if (projection.inFrame === 'out') continue
    inFrame.add(mark.characterKey)
    if (!listed.has(mark.characterKey) && !cropped.has(mark.characterKey)) {
      issues.push(issue('panel-unlisted-visible', path, `Panel ${panel.number} camera "${camera.id}" sees "${mark.characterKey}" who is not in characterKeys and is not declared croppedOnStage`))
    }
  }
  const extrasInFrame = new Set<string>()
  for (const extras of state.extras) {
    if (regionInFrame(camera, extras.region)) extrasInFrame.add(extras.ensembleKey)
  }
  for (const key of panel.characterKeys) {
    if (extrasInFrame.has(key)) continue
    if (!inFrame.has(key)) issues.push(issue('panel-listed-not-in-frame', path, `Panel ${panel.number} lists "${key}" who is not in frame for camera "${camera.id}"`))
  }
  for (const [key] of cropped) {
    if (listed.has(key)) issues.push(issue('panel-cropped-listed', path, `Panel ${panel.number} declares "${key}" croppedOnStage but also lists that character in characterKeys`))
    else if (!onStage.has(key) || !inFrame.has(key)) issues.push(issue('panel-cropped-not-in-frame', path, `Panel ${panel.number} declares "${key}" croppedOnStage but that character is not in frame for camera "${camera.id}"`))
  }
  for (const ensembleKey of extrasInFrame) {
    if (!listed.has(ensembleKey)) issues.push(issue('panel-extras-unlisted', path, `Panel ${panel.number} frames extras region "${ensembleKey}" but does not list that ensemble key`))
  }
  return { listed, projections }
}

export const validateScenePanelFraming = ({ panel, camera, state, path }: ResolvedScenePanelContext, { listed, projections }: ReturnType<typeof validateScenePanelVisibility>, issues: BlockingValidationIssue[]): void => {
  const listedCharacterMarks = state.characters.filter(mark => listed.has(mark.characterKey))
  if ((camera.framing === 'close-up' || camera.framing === 'medium-close') && listedCharacterMarks.length > 0 && listedCharacterMarks.every(mark => (projections.get(mark.characterKey)?.forward ?? 0) >= BLOCKING_GEOMETRY.midgroundMaxM)) {
    issues.push(issue('panel-close-framing-background', path, `Panel ${panel.number} uses ${camera.framing} framing but every listed character projects into the background`))
  }
  if (camera.overShoulderOf !== null) {
    const shoulder = state.characters.find(mark => mark.characterKey === camera.overShoulderOf)
    const shoulderProjection = shoulder ? projections.get(shoulder.characterKey) : undefined
    if (!listed.has(camera.overShoulderOf)) {
      issues.push(issue('panel-ots-subject-unlisted', path, `Panel ${panel.number} camera "${camera.id}" is over the shoulder of "${camera.overShoulderOf}", who is not listed in characterKeys`))
    } else if (!shoulder || shoulderProjection === undefined || shoulderProjection.inFrame === 'out' || shoulderProjection.forward >= BLOCKING_GEOMETRY.foregroundMaxM || Math.abs(shoulderProjection.lateral) <= BLOCKING_GEOMETRY.screenSideThreshold) {
      issues.push(issue('panel-ots-subject-not-foreground-side', path, `Panel ${panel.number} camera "${camera.id}" requires "${camera.overShoulderOf}" in the near foreground on one side of the frame for an over-shoulder composition`))
    } else if (facingRelativeToCamera(shoulder.position, shoulder.facingDeg, camera.position) !== 'away-from-camera') {
      issues.push(issue('panel-ots-subject-facing', path, `Panel ${panel.number} camera "${camera.id}" requires "${camera.overShoulderOf}" to face away from the camera toward the other subject`))
    }
    const targetVisible = listedCharacterMarks.some(mark => mark.characterKey !== camera.overShoulderOf && (projections.get(mark.characterKey)?.inFrame ?? 'out') !== 'out' && (projections.get(mark.characterKey)?.forward ?? 0) > (shoulderProjection?.forward ?? Number.POSITIVE_INFINITY))
    if (!targetVisible) {
      issues.push(issue('panel-ots-target-missing', path, `Panel ${panel.number} camera "${camera.id}" has no listed target visible beyond the over-shoulder subject`))
    }
  }
}
