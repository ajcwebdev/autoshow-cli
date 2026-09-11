import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { BlockingBindings, BlockingCompileOptions, BlockingPlan, BlockingScenePanelInput, BlockingStageState, CompiledBlockingLedgerEntry, CompiledBlockingLines, CompiledPanelBlocking, SceneBlockingCompilation } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { BLOCKING_GEOMETRY, cameraHeadingDeg, depthBandFromForward, distance, facingRelativeToCamera, nearestRegisteredView, projectAnchor, projectPoint, regionInFrame, round2, screenSideFromLateral } from './blocking-geometry'
import { renderPanelSvg, renderPlanOverviewSvg } from './blocking-diagram-svg'
import { BLOCKING_LEDGER_FILENAME, BLOCKING_PLAN_OVERVIEW_SVG_FILENAME, getBlockingPanelLayoutGuideFilename, getBlockingPanelSvgFilename } from './blocking-plan-paths'
import { renderBlockingLayoutGuidePng, shouldUseBlockingLayoutGuide } from './blocking-layout-guide'
import { cameraAxisSide, deriveStateForPanel, establishAxisSides, resolvePanelBlocking } from './blocking-plan-validation'

const COMPILE_STAGE = 'comic:blocking-compile'

export const serializeBlockingPlan = (plan: BlockingPlan): string => `${JSON.stringify(plan, null, 2)}\n`

export const hashBlockingPlan = (plan: BlockingPlan): string => sha256Bytes(serializeBlockingPlan(plan))

const formatPosition = (position: { x: number; y: number }): string => `(${round2(position.x)}, ${round2(position.y)})`

const nearestAnchorNote = (plan: BlockingPlan, state: BlockingStageState, mark: BlockingStageState['characters'][number]): string | null => {
  if (mark.seatAnchorKey) return mark.seatAnchorKey
  const location = plan.locations.find(item => item.locationKey === state.locationKey)
  let best: { key: string; distance: number } | undefined
  for (const anchor of location?.anchors ?? []) {
    const gap = distance(anchor.position, mark.position)
    if (gap <= BLOCKING_GEOMETRY.offFrameAnchorProximityM && (!best || gap < best.distance)) best = { key: anchor.key, distance: gap }
  }
  return best?.key ?? null
}

const describeFacing = (facing: CompiledBlockingLedgerEntry['facing']): string => {
  switch (facing) {
    case 'toward-camera': return 'facing the camera'
    case 'away-from-camera': return 'facing away from the camera'
    case 'profile-screen-left': return 'in profile facing screen-left'
    default: return 'in profile facing screen-right'
  }
}

const sideWord = (side: 'left' | 'center' | 'right'): string => side === 'center' ? 'center frame' : `screen-${side}`

export const buildBlockingLedgerEntryLine = (entry: CompiledBlockingLedgerEntry): string => [
  `${entry.characterKey}: ${sideWord(entry.screenSide)}, ${entry.depthBand}, ${entry.posture}${entry.seatAnchorKey ? ` on ${entry.seatAnchorKey}` : ''}`,
  describeFacing(entry.facing),
  `wardrobe ${entry.wardrobe}`,
  ...(entry.frame === 'edge' ? ['at the frame edge'] : []),
].join(', ')

export const OFF_FRAME_PINNED_SENTENCE = 'Their seats and marks remain occupied. Keep every named occupied seat and mark completely outside the crop; if the image reveals one, its named occupant must be visibly present there and it must never appear as an empty chair or empty floor.'

export const buildBlockingLines = (blocking: Omit<CompiledPanelBlocking, 'lines'>): CompiledBlockingLines => {
  const camera = blocking.camera
  const cameraLine = `Camera "${blocking.cameraSetupId}": ${camera.framing} framing, ${camera.lens} lens, ${camera.elevation} elevation, positioned at ${formatPosition(camera.position)} at height ${round2(camera.heightM)} m, heading ${round2(camera.headingDeg)} degrees in the location frame (nearest registered view: ${camera.nearestView})${camera.overShoulderOf ? `, over the shoulder of ${camera.overShoulderOf}` : ''}.${blocking.axis ? ` Action axis runs from ${blocking.axis.from} to ${blocking.axis.to}; this camera is on the ${blocking.axis.cameraSide ?? 'axis'} side${blocking.axis.establishedSide ? ` and the established side is ${blocking.axis.establishedSide}` : ''}${blocking.axis.axisBreak ? `; deliberate axis break: ${blocking.axis.axisBreak.reason}` : ''}.` : ''}`
  const ledger = blocking.ledger.map(buildBlockingLedgerEntryLine)
  const offFrameParts: string[] = []
  if (blocking.offFrameRoster.length > 0) {
    offFrameParts.push(`On stage but outside this frame: ${blocking.offFrameRoster.map(item => `${item.characterKey} (${item.note})`).join('; ')}. ${OFF_FRAME_PINNED_SENTENCE}`)
  }
  if (blocking.croppedOnStage.length > 0) {
    offFrameParts.push(`Deliberately cropped out of this frame although the camera could see them: ${blocking.croppedOnStage.map(item => `${item.characterKey} (${item.reason})`).join('; ')}.`)
  }
  const offFrame = offFrameParts.length > 0 ? offFrameParts.join(' ') : 'Every on-stage character is inside this frame.'
  const wardrobe = blocking.ledger.length > 0
    ? `Wardrobe: ${blocking.ledger.map(entry => `${entry.characterKey} ${entry.wardrobe === 'canonical' ? 'in canonical wardrobe' : entry.wardrobe}`).join('; ')}.`
    : 'Wardrobe: no character is in frame.'
  const extras = blocking.extrasInFrame.length > 0
    ? `Extras in frame: ${blocking.extrasInFrame.map(item => `${item.count} ${item.ensembleKey}${item.variety.length > 0 ? ` (${item.variety.join(', ')})` : ''}${item.exclude.length > 0 ? `, excluding ${item.exclude.join(', ')}` : ''}${item.props.length > 0 ? `, with ${item.props.join(', ')}` : ''}`).join('; ')}.`
    : 'No extras or crowd are in frame; do not add background people.'
  const dressing = blocking.dressingInFrame.length > 0
    ? `Temporary dressing state: ${blocking.dressingInFrame} Visibility depends on the declared camera crop; never widen the shot merely to show this dressing.`
    : 'No temporary dressing is declared for this stage state.'
  const anchors = blocking.anchorsInFrame.length > 0
    ? `Fixed anchors in frame: ${blocking.anchorsInFrame.map(item => item.projection).join('; ')}.`
    : 'No fixed anchor is inside this frame.'
  return { camera: cameraLine, ledger, offFrame, wardrobe, extras, dressing, anchors }
}

export const compileBlockingForPanel = (plan: BlockingPlan, panel: BlockingScenePanelInput, bindings?: BlockingBindings | undefined, options: BlockingCompileOptions = {}): CompiledPanelBlocking => {
  const blocking = resolvePanelBlocking(panel, bindings)
  if (!blocking) throw ValidationError(`Panel ${panel.number} has no blocking citation and no binding`, { stage: COMPILE_STAGE })
  const camera = plan.cameraSetups.find(item => item.id === blocking.cameraSetupId)
  if (!camera) throw ValidationError(`Panel ${panel.number} cites unknown camera setup "${blocking.cameraSetupId}"`, { stage: COMPILE_STAGE })
  if (!options.segmentOrder && !blocking.stageStateId) {
    throw ValidationError(`Panel ${panel.number} cannot derive its stage state without a segment order; pass options.segmentOrder (the structured script segment ids in script order) or cite blocking.stageStateId explicitly`, { stage: COMPILE_STAGE })
  }
  const state = deriveStateForPanel(plan, panel, options.segmentOrder ?? [], bindings)
  if (!state) throw ValidationError(`Panel ${panel.number} has no active stage state`, { stage: COMPILE_STAGE })
  const location = plan.locations.find(item => item.locationKey === state.locationKey)
  const planSha256 = options.planSha256 ?? hashBlockingPlan(plan)
  const headingDeg = round2(cameraHeadingDeg(camera))
  const cropped = new Set(blocking.croppedOnStage.map(item => item.characterKey))
  const ledger: CompiledBlockingLedgerEntry[] = []
  const offFrameRoster: CompiledPanelBlocking['offFrameRoster'] = []
  for (const mark of state.characters) {
    const projection = projectPoint(camera, mark.position)
    if (projection.inFrame === 'out' || cropped.has(mark.characterKey)) {
      if (projection.inFrame === 'out') {
        const side = projection.forward <= 0 ? 'behind the camera' : `${projection.lateral < 0 ? 'screen-left' : 'screen-right'} of frame`
        const anchor = nearestAnchorNote(plan, state, mark)
        offFrameRoster.push({ characterKey: mark.characterKey, note: `on stage ${side}${anchor ? ` at the ${anchor}` : ''}` })
      }
      continue
    }
    ledger.push({
      characterKey: mark.characterKey,
      screenSide: screenSideFromLateral(projection.lateral),
      depthBand: depthBandFromForward(projection.forward),
      posture: mark.posture,
      facing: facingRelativeToCamera(mark.position, mark.facingDeg, camera.position),
      seatAnchorKey: mark.seatAnchorKey,
      wardrobe: mark.wardrobe,
      frame: projection.inFrame,
      lateral: projection.lateral,
    })
  }
  const extrasInFrame = state.extras
    .filter(extras => regionInFrame(camera, extras.region))
    .map(extras => ({ ensembleKey: extras.ensembleKey, count: extras.count, variety: [...extras.variety], exclude: [...extras.exclude], props: [...extras.props] }))
  const dressingParts: string[] = []
  if (state.dressing) dressingParts.push(state.dressing)
  for (const item of location?.dressing ?? []) {
    if (projectPoint(camera, item.position).inFrame !== 'out') dressingParts.push(`${item.key}: ${item.description}`)
  }
  const anchorsInFrame = (location?.anchors ?? [])
    .filter(anchor => projectPoint(camera, anchor.position).inFrame !== 'out')
    .map(anchor => {
      const projection = projectAnchor(camera, anchor)
      return { key: anchor.key, screenSide: projection.screenSide, depthBand: projection.depthBand, seenFrom: projection.seenFrom, projection: projection.projection }
    })
  const cameraSide = cameraAxisSide(state, camera)
  const axis = state.actionAxis
    ? {
      from: state.actionAxis.from,
      to: state.actionAxis.to,
      cameraSide,
      establishedSide: state.actionAxis.establishedSide,
      matchesEstablished: cameraSide === null || state.actionAxis.establishedSide === null || cameraSide === state.actionAxis.establishedSide,
      axisBreak: blocking.axisBreak,
    }
    : null
  const withoutLines: Omit<CompiledPanelBlocking, 'lines'> = {
    planSha256,
    stageStateId: state.id,
    cameraSetupId: camera.id,
    camera: {
      position: { x: round2(camera.position.x), y: round2(camera.position.y) },
      heightM: round2(camera.heightM),
      lens: camera.lens,
      framing: camera.framing,
      elevation: camera.elevation,
      overShoulderOf: camera.overShoulderOf,
      headingDeg,
      nearestView: nearestRegisteredView(headingDeg),
    },
    axis,
    ledger,
    offFrameRoster,
    croppedOnStage: blocking.croppedOnStage.map(item => ({ characterKey: item.characterKey, reason: item.reason })),
    extrasInFrame,
    dressingInFrame: dressingParts.join('; '),
    anchorsInFrame,
  }
  return { ...withoutLines, lines: buildBlockingLines(withoutLines) }
}

export const buildBlockingLedgerLine = (panelNumber: number, compiled: CompiledPanelBlocking): string => {
  const cast = compiled.ledger.length > 0 ? compiled.ledger.map(entry => `${entry.characterKey} ${sideWord(entry.screenSide)} ${entry.depthBand} ${entry.posture}`).join('; ') : 'nobody in frame'
  const off = compiled.offFrameRoster.length > 0 ? `; off frame: ${compiled.offFrameRoster.map(item => item.characterKey).join(', ')}` : ''
  const cropped = compiled.croppedOnStage.length > 0 ? `; cropped: ${compiled.croppedOnStage.map(item => item.characterKey).join(', ')}` : ''
  const extras = compiled.extrasInFrame.length > 0 ? `; extras: ${compiled.extrasInFrame.map(item => `${item.count} ${item.ensembleKey}`).join(', ')}` : ''
  const axis = compiled.axis ? `; axis ${compiled.axis.from}->${compiled.axis.to} camera ${compiled.axis.cameraSide ?? 'on-axis'} established ${compiled.axis.establishedSide ?? 'unset'}${compiled.axis.matchesEstablished ? '' : ' (crossed)'}${compiled.axis.axisBreak ? ' (axis break)' : ''}` : ''
  return `- Panel ${panelNumber}: state ${compiled.stageStateId}; camera ${compiled.cameraSetupId} heading ${round2(compiled.camera.headingDeg)} (${compiled.camera.nearestView}, ${compiled.camera.framing}, ${compiled.camera.lens}); cast ${cast}${off}${cropped}${extras}${axis}`
}

export const buildBlockingLedgerMarkdown = (sceneSlug: string, panels: ReadonlyArray<{ panelNumber: number; compiled: CompiledPanelBlocking }>): string => [
  `# Blocking ledger: ${sceneSlug}`,
  '',
  `Plan SHA-256: ${panels[0]?.compiled.planSha256 ?? 'none'}`,
  '',
  ...panels.map(item => buildBlockingLedgerLine(item.panelNumber, item.compiled)),
  '',
].join('\n')

export const compileSceneBlocking = (plan: BlockingPlan, panels: readonly BlockingScenePanelInput[], bindings?: BlockingBindings | undefined, options: BlockingCompileOptions = {}): SceneBlockingCompilation => {
  const segmentOrder = options.segmentOrder ?? (() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const panel of [...panels].sort((left, right) => left.number - right.number)) {
      for (const id of panel.sourceSegmentIds) if (!seen.has(id)) { seen.add(id); order.push(id) }
    }
    return order
  })()
  const planSha256 = options.planSha256 ?? hashBlockingPlan(plan)
  const established = establishAxisSides(plan, panels, { segmentOrder, bindings })
  const ordered = [...panels].sort((left, right) => left.number - right.number)
  const compiledPanels = ordered.map(panel => ({ panelNumber: panel.number, compiled: compileBlockingForPanel(established, panel, bindings, { planSha256, segmentOrder }) }))
  return {
    planSha256,
    panels: compiledPanels.map(item => item.compiled),
    ledgerMarkdown: buildBlockingLedgerMarkdown(plan.sceneSlug, compiledPanels),
    planOverviewSvg: renderPlanOverviewSvg(established),
    panelSvgs: compiledPanels.map(item => ({ panelNumber: item.panelNumber, svg: renderPanelSvg(established, item.compiled, item.panelNumber) })),
    panelLayoutGuides: compiledPanels.filter(item => shouldUseBlockingLayoutGuide(item.compiled)).map(item => ({ panelNumber: item.panelNumber, png: renderBlockingLayoutGuidePng(item.compiled) })),
  }
}

export const writeBlockingArtifacts = async (blockingDirectory: string, compilation: SceneBlockingCompilation): Promise<string[]> => {
  await mkdir(blockingDirectory, { recursive: true })
  const written: string[] = []
  const overviewPath = join(blockingDirectory, BLOCKING_PLAN_OVERVIEW_SVG_FILENAME)
  await Bun.write(overviewPath, compilation.planOverviewSvg)
  written.push(overviewPath)
  for (const item of compilation.panelSvgs) {
    const path = join(blockingDirectory, getBlockingPanelSvgFilename(item.panelNumber))
    await Bun.write(path, item.svg)
    written.push(path)
  }
  for (const item of compilation.panelLayoutGuides) {
    const path = join(blockingDirectory, getBlockingPanelLayoutGuideFilename(item.panelNumber))
    await Bun.write(path, item.png)
    written.push(path)
  }
  const ledgerPath = join(blockingDirectory, BLOCKING_LEDGER_FILENAME)
  await Bun.write(ledgerPath, compilation.ledgerMarkdown)
  written.push(ledgerPath)
  return written
}
