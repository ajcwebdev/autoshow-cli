import type { BlockingAxisSide, BlockingBindings, BlockingCameraSetup, BlockingCitation, BlockingPlan, BlockingRebindOptions, BlockingRebindResult, BlockingScenePanelInput, BlockingScenePanelValidationOptions, BlockingStageState, BlockingValidationContext, BlockingValidationIssue, CharacterCatalogService, PanelBlockingCitation, StructuredScriptData } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { BLOCKING_GEOMETRY, axisSideForCamera, distance, facingRelativeToCamera, pointInFootprint, projectPoint, regionInFrame, round2 } from './blocking-geometry'

type SourceSegment = StructuredScriptData['sourceSegments'][number]

const BLOCKING_VALIDATION_STAGE = 'comic:blocking-plan'

export const normalizeSegmentText = (text: string): string => text
  .normalize('NFC')
  .replace(/\r\n/g, '\n')
  .trim()
  .replace(/\s+/gu, ' ')

export const hashSourceSegmentText = (text: string): string => sha256Bytes(normalizeSegmentText(text))

export const hashStructuredScriptData = (structuredScript: StructuredScriptData): string => sha256Bytes(`${JSON.stringify(structuredScript, null, 2)}\n`)

export const normalizeSpecificationText = (specification: string): string => specification.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase()

export const isAnchorGroundedInSpecification = (anchorKey: string, specification: string): boolean => {
  const needle = normalizeSpecificationText(anchorKey)
  return needle.length > 0 && normalizeSpecificationText(specification).includes(needle)
}

const issue = (code: string, path: string, message: string): BlockingValidationIssue => ({ code, path, message })

const segmentIndexMap = (segments: ReadonlyArray<Pick<SourceSegment, 'id'>>): Map<string, number> => {
  const map = new Map<string, number>()
  segments.forEach((segment, index) => { if (!map.has(segment.id)) map.set(segment.id, index) })
  return map
}

type MentionCatalog = Pick<CharacterCatalogService, 'detectMentions'>

const segmentNamesCharacter = (segment: SourceSegment, characterKey: string, catalog: MentionCatalog | undefined, beats: StructuredScriptData['beats'] | undefined): boolean => {
  if (segment.speakerKey === characterKey) return true
  if (segment.speakerKeys?.includes(characterKey)) return true
  if (catalog) {
    if (catalog.detectMentions(segment.text).some(mention => mention.characterKeys.includes(characterKey))) return true
    if (segment.speakerLabel && catalog.detectMentions(segment.speakerLabel).some(mention => mention.characterKeys.includes(characterKey))) return true
  }
  const beat = typeof segment.beatIndex === 'number' ? beats?.find(item => item.index === segment.beatIndex) : undefined
  return beat?.characterKeys.includes(characterKey) ?? false
}

const validateCitation = (citation: BlockingCitation, path: string, segmentsById: Map<string, SourceSegment>, issues: BlockingValidationIssue[]): SourceSegment | undefined => {
  const segment = segmentsById.get(citation.sourceSegmentId)
  if (!segment) {
    issues.push(issue('citation-unknown', path, `Blocking plan citation "${citation.sourceSegmentId}" at ${path} is not a structured script segment`))
    return undefined
  }
  if (hashSourceSegmentText(segment.text) !== citation.sourceSegmentSha256) {
    issues.push(issue('citation-stale', path, `Blocking plan citation "${citation.sourceSegmentId}" at ${path} does not match the current structured script segment text; run draft-scenes --rebind`))
  }
  return segment
}

export const orderStageStates = (plan: BlockingPlan, segmentOrder: readonly string[]): BlockingStageState[] => {
  const indices = segmentIndexMap(segmentOrder.map(id => ({ id })))
  return plan.stageStates
    .map((state, order) => ({ state, order, index: indices.get(state.startsAt.sourceSegmentId) ?? Number.POSITIVE_INFINITY }))
    .sort((left, right) => left.index - right.index || left.order - right.order)
    .map(item => item.state)
}

export const validateBlockingPlan = (plan: BlockingPlan, context: BlockingValidationContext): BlockingValidationIssue[] => {
  const issues: BlockingValidationIssue[] = []
  const segments = context.structuredScript.sourceSegments
  const segmentsById = new Map(segments.map(segment => [segment.id, segment] as const))
  const segmentIndices = segmentIndexMap(segments)
  const catalogKeys = new Set(context.catalog.characterKeys as readonly string[])
  const requireCharacter = (key: string, path: string): void => {
    if (!catalogKeys.has(key)) issues.push(issue('unknown-character', path, `Blocking plan names unknown character "${key}" at ${path}`))
  }

  const locationsByKey = new Map<string, BlockingPlan['locations'][number]>()
  plan.locations.forEach((location, locationIndex) => {
    const path = `locations[${locationIndex}]`
    if (locationsByKey.has(location.locationKey)) issues.push(issue('duplicate-location', path, `Blocking plan lists location "${location.locationKey}" more than once`))
    locationsByKey.set(location.locationKey, location)
    const specification = context.locationSpecifications[location.locationKey]
    if (!specification) {
      issues.push(issue('unknown-location', path, `Blocking plan location "${location.locationKey}" has no canonical specification`))
      return
    }
    const anchorKeys = new Set<string>()
    const reviewed = context.locationPlans?.plans.find(entry => entry.locationKey === location.locationKey)
    location.anchors.forEach((anchor, anchorIndex) => {
      const anchorPath = `${path}.anchors[${anchorIndex}]`
      if (anchorKeys.has(anchor.key)) issues.push(issue('duplicate-anchor', anchorPath, `Blocking plan location "${location.locationKey}" lists anchor "${anchor.key}" more than once`))
      anchorKeys.add(anchor.key)
      if (!isAnchorGroundedInSpecification(anchor.key, specification.specification)) {
        issues.push(issue('anchor-not-grounded', anchorPath, `Blocking plan anchor "${anchor.key}" is not a substring of the "${location.locationKey}" specification`))
      }
      const reviewedAnchor = reviewed?.anchors.find(item => item.key === anchor.key)
      if (reviewedAnchor) {
        const deviation = distance(anchor.position, reviewedAnchor.position)
        if (deviation > BLOCKING_GEOMETRY.reviewedAnchorToleranceM) {
          issues.push(issue('anchor-deviates', anchorPath, `Blocking plan anchor "${anchor.key}" deviates from the reviewed "${location.locationKey}" geometry by ${round2(deviation)} m`))
        }
      }
    })
    location.suppressedAnchors.forEach((suppressed, index) => {
      const suppressedPath = `${path}.suppressedAnchors[${index}]`
      if (!isAnchorGroundedInSpecification(suppressed.key, specification.specification)) {
        issues.push(issue('anchor-not-grounded', suppressedPath, `Blocking plan anchor "${suppressed.key}" is not a substring of the "${location.locationKey}" specification`))
      }
      validateCitation(suppressed.citation, `${suppressedPath}.citation`, segmentsById, issues)
    })
    const dressingKeys = new Set<string>()
    location.dressing.forEach((item, index) => {
      const dressingPath = `${path}.dressing[${index}]`
      if (dressingKeys.has(item.key)) issues.push(issue('duplicate-dressing', dressingPath, `Blocking plan location "${location.locationKey}" lists dressing "${item.key}" more than once`))
      dressingKeys.add(item.key)
      if (item.citation) validateCitation(item.citation, `${dressingPath}.citation`, segmentsById, issues)
    })
  })

  const scriptLocationKeys = new Set(segments.map(segment => segment.location.key))
  for (const locationKey of scriptLocationKeys) {
    if (!locationsByKey.has(locationKey)) issues.push(issue('missing-location', 'locations', `Blocking plan has no location map for "${locationKey}"`))
  }

  const stateIds = new Set<string>()
  let previousStateIndex = Number.NEGATIVE_INFINITY
  let previousState: BlockingStageState | undefined
  plan.stageStates.forEach((state, stateIndex) => {
    const path = `stageStates[${stateIndex}]`
    if (stateIds.has(state.id)) issues.push(issue('duplicate-state', path, `Blocking plan lists stage state "${state.id}" more than once`))
    stateIds.add(state.id)
    const location = locationsByKey.get(state.locationKey)
    if (!location) issues.push(issue('unknown-location', path, `Blocking plan stage state "${state.id}" uses location "${state.locationKey}" which has no location map`))
    const startSegment = validateCitation(state.startsAt, `${path}.startsAt`, segmentsById, issues)
    if (startSegment) {
      if (startSegment.location.key !== state.locationKey) {
        issues.push(issue('state-location-mismatch', path, `Blocking plan stage state "${state.id}" starts at segment "${startSegment.id}" whose location is "${startSegment.location.key}", not "${state.locationKey}"`))
      }
      const startIndex = segmentIndices.get(startSegment.id) ?? Number.POSITIVE_INFINITY
      if (startIndex <= previousStateIndex && previousState) {
        issues.push(issue('state-order', path, `Blocking plan stage states are not in script order: "${state.id}" starts before "${previousState.id}" ends`))
      }
      previousStateIndex = startIndex
    }
    const seatsByKey = new Map<string, { position: { x: number; y: number } }>([
      ...(location?.anchors.map(anchor => [anchor.key, anchor] as const) ?? []),
      ...(location?.dressing.map(item => [item.key, item] as const) ?? []),
    ])
    const dressingSeatKeys = new Set(location?.dressing.map(item => item.key) ?? [])
    const onStage = new Set<string>()
    state.characters.forEach((mark, markIndex) => {
      const markPath = `${path}.characters[${markIndex}]`
      requireCharacter(mark.characterKey, markPath)
      if (onStage.has(mark.characterKey)) issues.push(issue('duplicate-mark', markPath, `Blocking plan stage state "${state.id}" places "${mark.characterKey}" more than once`))
      onStage.add(mark.characterKey)
      const seat = mark.seatAnchorKey === null ? undefined : seatsByKey.get(mark.seatAnchorKey)
      if (mark.seatAnchorKey !== null && location && !seat) {
        issues.push(issue('unknown-seat', markPath, `Blocking plan stage state "${state.id}" seats "${mark.characterKey}" on unknown anchor "${mark.seatAnchorKey}"`))
      }
      if (seat && mark.seatAnchorKey !== null && dressingSeatKeys.has(mark.seatAnchorKey) && distance(mark.position, seat.position) > BLOCKING_GEOMETRY.reviewedAnchorToleranceM) {
        issues.push(issue('seat-mark-deviates', markPath, `Blocking plan stage state "${state.id}" places "${mark.characterKey}" ${round2(distance(mark.position, seat.position))} m from seat "${mark.seatAnchorKey}"`))
      }
      if (mark.wardrobeCitation) validateCitation(mark.wardrobeCitation, `${markPath}.wardrobeCitation`, segmentsById, issues)
    })
    const extrasKeys = new Set<string>()
    state.extras.forEach((extras, extrasIndex) => {
      const extrasPath = `${path}.extras[${extrasIndex}]`
      requireCharacter(extras.ensembleKey, extrasPath)
      if (extrasKeys.has(extras.ensembleKey)) issues.push(issue('duplicate-extras', extrasPath, `Blocking plan stage state "${state.id}" lists extras "${extras.ensembleKey}" more than once`))
      extrasKeys.add(extras.ensembleKey)
    })
    if (state.actionAxis) {
      for (const endpoint of [state.actionAxis.from, state.actionAxis.to]) {
        if (!onStage.has(endpoint)) issues.push(issue('axis-off-stage', `${path}.actionAxis`, `Blocking plan stage state "${state.id}" action axis names "${endpoint}" who is not on stage`))
      }
      if (state.actionAxis.from === state.actionAxis.to) issues.push(issue('axis-degenerate', `${path}.actionAxis`, `Blocking plan stage state "${state.id}" action axis must run between two different characters`))
    }
    state.moves.forEach((move, moveIndex) => {
      const movePath = `${path}.moves[${moveIndex}]`
      requireCharacter(move.characterKey, movePath)
      const segment = validateCitation(move.citation, `${movePath}.citation`, segmentsById, issues)
      if (segment && !segmentNamesCharacter(segment, move.characterKey, context.catalog, context.structuredScript.beats)) {
        issues.push(issue('move-uncited', movePath, `Blocking plan move "${move.type}" for "${move.characterKey}" cites segment "${segment.id}" which does not name that character`))
      }
    })
    if (previousState && previousState.locationKey === state.locationKey) {
      const before = new Set(previousState.characters.map(mark => mark.characterKey))
      const exits = new Set(state.moves.filter(move => move.type === 'exit').map(move => move.characterKey))
      const enters = new Set(state.moves.filter(move => move.type === 'enter').map(move => move.characterKey))
      for (const key of before) {
        if (!onStage.has(key) && !exits.has(key)) issues.push(issue('cast-dropped', path, `Blocking plan stage state "${state.id}" drops "${key}" without an exit move`))
      }
      for (const key of onStage) {
        if (!before.has(key) && !enters.has(key)) issues.push(issue('cast-added', path, `Blocking plan stage state "${state.id}" adds "${key}" without an enter move`))
      }
      for (const key of exits) {
        if (onStage.has(key)) issues.push(issue('exit-still-on-stage', path, `Blocking plan stage state "${state.id}" has an exit move for "${key}" who is still on stage`))
      }
      for (const key of enters) {
        if (before.has(key)) issues.push(issue('enter-already-on-stage', path, `Blocking plan stage state "${state.id}" has an enter move for "${key}" who was already on stage`))
      }
    }
    previousState = state
  })

  const cameraIds = new Set<string>()
  plan.cameraSetups.forEach((camera, cameraIndex) => {
    const path = `cameraSetups[${cameraIndex}]`
    if (cameraIds.has(camera.id)) issues.push(issue('duplicate-camera', path, `Blocking plan lists camera "${camera.id}" more than once`))
    cameraIds.add(camera.id)
    const location = locationsByKey.get(camera.locationKey)
    if (!location) issues.push(issue('unknown-location', path, `Blocking plan camera "${camera.id}" uses location "${camera.locationKey}" which has no location map`))
    if (camera.position.x === camera.target.x && camera.position.y === camera.target.y) {
      issues.push(issue('camera-no-direction', path, `Blocking plan camera "${camera.id}" has no look direction because its target equals its position`))
    }
    for (const anchor of location?.anchors ?? []) {
      if (pointInFootprint(camera.position, anchor)) issues.push(issue('camera-in-footprint', path, `Blocking plan camera "${camera.id}" sits inside the "${anchor.key}" footprint`))
    }
    if (camera.overShoulderOf !== null) requireCharacter(camera.overShoulderOf, `${path}.overShoulderOf`)
  })

  return issues
}

export const assertValidBlockingPlan = (plan: BlockingPlan, context: BlockingValidationContext): void => {
  const issues = validateBlockingPlan(plan, context)
  if (issues.length > 0) throw ValidationError(`Blocking plan is invalid:\n- ${issues.map(item => item.message).join('\n- ')}`, { stage: BLOCKING_VALIDATION_STAGE })
}

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

const segmentOrderFromPanels = (panels: readonly BlockingScenePanelInput[]): string[] => {
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

const cameraById = (plan: BlockingPlan, id: string): BlockingCameraSetup | undefined => plan.cameraSetups.find(camera => camera.id === id)

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

export const validateScenePanelBlocking = (plan: BlockingPlan, panels: readonly BlockingScenePanelInput[], options: BlockingScenePanelValidationOptions = {}): BlockingValidationIssue[] => {
  const issues: BlockingValidationIssue[] = []
  const segmentOrder = options.segmentOrder ?? segmentOrderFromPanels(panels)
  const established = establishAxisSides(plan, panels, { ...options, segmentOrder })
  for (const panel of [...panels].sort((left, right) => left.number - right.number)) {
    const path = `panels[${panel.number}]`
    const blocking = resolvePanelBlocking(panel, options.bindings)
    if (!blocking) {
      issues.push(issue('panel-missing-blocking', path, `Panel ${panel.number} is missing a blocking citation`))
      continue
    }
    const camera = cameraById(established, blocking.cameraSetupId)
    if (!camera) {
      issues.push(issue('panel-unknown-camera', path, `Panel ${panel.number} cites unknown camera setup "${blocking.cameraSetupId}"`))
      continue
    }
    if (camera.locationKey !== panel.locationKey) {
      issues.push(issue('panel-camera-location', path, `Panel ${panel.number} camera "${camera.id}" belongs to location "${camera.locationKey}", not "${panel.locationKey}"`))
    }
    if (blocking.stageStateId && !established.stageStates.some(state => state.id === blocking.stageStateId)) {
      issues.push(issue('panel-unknown-state', path, `Panel ${panel.number} cites unknown stage state "${blocking.stageStateId}"`))
      continue
    }
    const state = deriveStateForPanel(established, panel, segmentOrder, options.bindings)
    if (!state) {
      issues.push(issue('panel-no-state', path, `Panel ${panel.number} has no active stage state`))
      continue
    }
    if (state.locationKey !== panel.locationKey) {
      issues.push(issue('panel-state-location', path, `Panel ${panel.number} stage state "${state.id}" belongs to location "${state.locationKey}", not "${panel.locationKey}"`))
    }
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
  return issues
}

export const assertScenePanelBlocking = (plan: BlockingPlan, panels: readonly BlockingScenePanelInput[], options: BlockingScenePanelValidationOptions = {}): void => {
  const issues = validateScenePanelBlocking(plan, panels, options)
  if (issues.length > 0) throw ValidationError(`Scene panels contradict the blocking plan:\n- ${issues.map(item => item.message).join('\n- ')}`, { stage: BLOCKING_VALIDATION_STAGE })
}

type CitationSlotKind = 'startsAt' | 'move' | 'wardrobe' | 'suppressedAnchor' | 'dressing'

type CitationSlot = {
  path: string
  kind: CitationSlotKind
  characterKey?: string | undefined
  needle?: string | undefined
  get: () => BlockingCitation
  set: (citation: BlockingCitation) => void
}

const collectCitationSlots = (plan: BlockingPlan): CitationSlot[] => {
  const slots: CitationSlot[] = []
  plan.locations.forEach((location, locationIndex) => {
    location.suppressedAnchors.forEach((suppressed, index) => {
      slots.push({ path: `locations[${locationIndex}].suppressedAnchors[${index}].citation`, kind: 'suppressedAnchor', needle: suppressed.key, get: () => suppressed.citation, set: citation => { suppressed.citation = citation } })
    })
    location.dressing.forEach((item, index) => {
      if (item.citation) slots.push({ path: `locations[${locationIndex}].dressing[${index}].citation`, kind: 'dressing', needle: item.key, get: () => item.citation!, set: citation => { item.citation = citation } })
    })
  })
  plan.stageStates.forEach((state, stateIndex) => {
    slots.push({ path: `stageStates[${stateIndex}].startsAt`, kind: 'startsAt', get: () => state.startsAt, set: citation => { state.startsAt = citation } })
    state.characters.forEach((mark, index) => {
      if (mark.wardrobeCitation) slots.push({ path: `stageStates[${stateIndex}].characters[${index}].wardrobeCitation`, kind: 'wardrobe', characterKey: mark.characterKey, get: () => mark.wardrobeCitation!, set: citation => { mark.wardrobeCitation = citation } })
    })
    state.moves.forEach((move, index) => {
      slots.push({ path: `stageStates[${stateIndex}].moves[${index}].citation`, kind: 'move', characterKey: move.characterKey, get: () => move.citation, set: citation => { move.citation = citation } })
    })
  })
  return slots
}

const resolveSplitCitation = (previous: SourceSegment, slot: CitationSlot, newStructuredScript: StructuredScriptData, catalog: MentionCatalog | undefined): { target?: SourceSegment | undefined; reason?: string | undefined } => {
  const previousText = normalizeSegmentText(previous.text)
  const pieces = newStructuredScript.sourceSegments.filter(segment => {
    const text = normalizeSegmentText(segment.text)
    return text.length > 0 && (previousText.includes(text) || text.includes(previousText))
  })
  if (pieces.length === 0) return { reason: `no current segment shares text with the previous segment "${previous.id}"` }
  if (pieces.length === 1 || slot.kind === 'startsAt') return { target: pieces[0] }
  const pieceIds = pieces.map(piece => piece.id).join(', ')
  if (slot.characterKey) {
    const characterKey = slot.characterKey
    const named = pieces.filter(piece => segmentNamesCharacter(piece, characterKey, catalog, newStructuredScript.beats))
    if (named.length > 0) return { target: named[0] }
    return {
      reason: catalog
        ? `the previous segment "${previous.id}" was split into ${pieceIds} and none of them names "${characterKey}"`
        : `the previous segment "${previous.id}" was split into ${pieceIds}; pass the character catalog to choose the piece that names "${characterKey}"`,
    }
  }
  if (slot.needle) {
    const needle = normalizeSpecificationText(slot.needle)
    const mentioning = needle.length > 0 ? pieces.filter(piece => normalizeSpecificationText(piece.text).includes(needle)) : []
    if (mentioning.length > 0) return { target: mentioning[0] }
  }
  return { reason: `the previous segment "${previous.id}" was split into ${pieceIds} and none of them mentions "${slot.needle ?? slot.kind}"` }
}

export const rebindPlanCitations = (plan: BlockingPlan, newStructuredScript: StructuredScriptData, options: BlockingRebindOptions = {}): BlockingRebindResult => {
  const next = structuredClone(plan) as BlockingPlan
  const newSegments = newStructuredScript.sourceSegments
  const newById = new Map(newSegments.map(segment => [segment.id, segment] as const))
  const newByHash = new Map<string, SourceSegment[]>()
  for (const segment of newSegments) {
    const hash = hashSourceSegmentText(segment.text)
    const list = newByHash.get(hash) ?? []
    list.push(segment)
    newByHash.set(hash, list)
  }
  const previousById = new Map((options.previousStructuredScript?.sourceSegments ?? []).map(segment => [segment.id, segment] as const))
  const remapped: BlockingRebindResult['remapped'] = []
  const unresolved: BlockingRebindResult['unresolved'] = []
  for (const slot of collectCitationSlots(next)) {
    const citation = slot.get()
    const sameId = newById.get(citation.sourceSegmentId)
    if (sameId && hashSourceSegmentText(sameId.text) === citation.sourceSegmentSha256) continue
    const candidates = newByHash.get(citation.sourceSegmentSha256) ?? []
    let target = candidates.find(segment => segment.id === citation.sourceSegmentId) ?? (candidates.length === 1 ? candidates[0] : undefined)
    let reason: string | undefined
    if (!target && candidates.length > 1) {
      reason = `the cited content hash matches ${candidates.length} current segments (${candidates.map(segment => segment.id).join(', ')}) and none of them keeps the cited id, so the rebind cannot choose between them`
    } else if (!target) {
      const previous = previousById.get(citation.sourceSegmentId)
      if (previous && hashSourceSegmentText(previous.text) === citation.sourceSegmentSha256) {
        const resolved = resolveSplitCitation(previous, slot, newStructuredScript, options.catalog)
        target = resolved.target
        reason = resolved.reason
      } else if (previous) {
        reason = `the previous structured script segment "${citation.sourceSegmentId}" does not carry the cited content hash`
      } else {
        reason = options.previousStructuredScript
          ? `no current segment carries the cited content hash and the previous structured script has no segment "${citation.sourceSegmentId}"`
          : 'no current segment carries the cited content hash and no previous structured script was available to recognize a split or merge'
      }
    }
    if (!target) {
      unresolved.push({ path: slot.path, sourceSegmentId: citation.sourceSegmentId, sourceSegmentSha256: citation.sourceSegmentSha256, reason: reason ?? 'no current segment carries the cited content hash' })
      continue
    }
    slot.set({ sourceSegmentId: target.id, sourceSegmentSha256: hashSourceSegmentText(target.text) })
    remapped.push({ path: slot.path, from: citation.sourceSegmentId, to: target.id })
  }
  next.structuredScriptSha256 = options.structuredScriptSha256 ?? hashStructuredScriptData(newStructuredScript)
  return { plan: next, remapped, unresolved }
}
