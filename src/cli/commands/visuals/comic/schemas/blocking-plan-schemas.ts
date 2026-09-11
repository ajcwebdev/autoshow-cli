import * as v from 'valibot'
import { isRecord } from '~/utils/value-helpers'

export const BLOCKING_PLAN_SCHEMA_VERSION = 1
export const BLOCKING_BINDINGS_SCHEMA_VERSION = 1
export const BLOCKING_PLAN_JSON_SCHEMA_NAME = 'blocking_plan_v1'

export const BLOCKING_POSTURES = ['standing', 'seated', 'kneeling', 'crouching', 'lying', 'leaning'] as const
export const BLOCKING_LENSES = ['wide', 'normal', 'long'] as const
export const BLOCKING_FRAMINGS = ['wide', 'medium-wide', 'medium', 'medium-close', 'close-up'] as const
export const BLOCKING_ELEVATIONS = ['low', 'eye', 'high'] as const
export const BLOCKING_MOVE_TYPES = ['enter', 'exit', 'sit', 'stand', 'cross', 'turn'] as const
export const BLOCKING_WALLS = ['left', 'right', 'rear', 'front', 'floor', 'ceiling'] as const
export const BLOCKING_LONG_AXES = ['x', 'y'] as const
export const BLOCKING_AXIS_SIDES = ['left', 'right'] as const
export const BLOCKING_GEOMETRY_SOURCES = ['specification', 'location-plans'] as const
export const BLOCKING_GENERATION_MODES = ['llm', 'import'] as const
export const BLOCKING_SCREEN_SIDES = ['left', 'center', 'right'] as const
export const BLOCKING_DEPTH_BANDS = ['foreground', 'midground', 'background'] as const
export const BLOCKING_FACINGS = ['toward-camera', 'away-from-camera', 'profile-screen-left', 'profile-screen-right'] as const
export const BLOCKING_FRAME_STATUSES = ['in', 'edge', 'out'] as const
export const BLOCKING_SEEN_FROM = ['front', 'left', 'right', 'rear'] as const
export const BLOCKING_REGISTERED_VIEWS = ['establishing', 'reverse', 'side'] as const

export const BLOCKING_AUDIT_STATUSES = [
  'on-mark',
  'side-swapped',
  'depth-swapped',
  'facing-wrong',
  'posture-wrong',
  'wardrobe-wrong',
  'missing-on-mark',
  'unlisted-on-stage',
  'exposed-empty-mark',
  'excluded-extra-present',
  'scale-wrong',
  'crowd-uniform',
  'not-assessable',
] as const

export const BLOCKING_HARD_CANDIDATE_STATUSES = [
  'side-swapped',
  'depth-swapped',
  'facing-wrong',
  'posture-wrong',
  'wardrobe-wrong',
  'missing-on-mark',
  'unlisted-on-stage',
  'exposed-empty-mark',
  'excluded-extra-present',
  'axis-side',
] as const

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const KebabKeySchema = v.pipe(v.string(), v.regex(KEY_PATTERN, 'Expected a lowercase kebab-case key'))
const Sha256Schema = v.pipe(v.string(), v.regex(SHA256_PATTERN, 'Expected a lowercase SHA-256 hex digest'))
const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1, 'Expected a non-empty string'))
const FiniteNumberSchema = v.pipe(v.number(), v.finite('Expected a finite number'))

export const BlockingPositionSchema = v.strictObject({ x: FiniteNumberSchema, y: FiniteNumberSchema })
export const BlockingFootprintSchema = v.strictObject({
  width: v.pipe(v.number(), v.finite(), v.minValue(0)),
  depth: v.pipe(v.number(), v.finite(), v.minValue(0)),
})
export const BlockingRegionSchema = v.strictObject({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  width: v.pipe(v.number(), v.finite(), v.minValue(0)),
  depth: v.pipe(v.number(), v.finite(), v.minValue(0)),
})
export const BlockingCitationSchema = v.strictObject({
  sourceSegmentId: NonEmptyStringSchema,
  sourceSegmentSha256: Sha256Schema,
})
const BlockingDraftCitationSchema = v.strictObject({ sourceSegmentId: NonEmptyStringSchema })

const anchorFields = {
  key: NonEmptyStringSchema,
  position: BlockingPositionSchema,
  footprint: v.nullable(BlockingFootprintSchema),
  wall: v.nullable(v.picklist(BLOCKING_WALLS)),
  facingDeg: v.nullable(FiniteNumberSchema),
  longAxis: v.nullable(v.picklist(BLOCKING_LONG_AXES)),
}
export const BlockingAnchorSchema = v.strictObject(anchorFields)
export const BlockingCameraCellSchema = v.strictObject({
  id: NonEmptyStringSchema,
  position: BlockingPositionSchema,
  heightM: v.pipe(v.number(), v.finite(), v.minValue(0)),
})

const buildSuppressedAnchorSchema = <TCitation extends v.GenericSchema>(citation: TCitation) => v.strictObject({
  key: NonEmptyStringSchema,
  citation,
  reason: NonEmptyStringSchema,
})
const buildDressingSchema = <TCitation extends v.GenericSchema>(citation: TCitation) => v.strictObject({
  key: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  position: BlockingPositionSchema,
  citation: v.nullable(citation),
})
const buildCharacterMarkSchema = <TCitation extends v.GenericSchema>(citation: TCitation) => v.strictObject({
  characterKey: KebabKeySchema,
  position: BlockingPositionSchema,
  facingDeg: FiniteNumberSchema,
  posture: v.picklist(BLOCKING_POSTURES),
  seatAnchorKey: v.nullable(v.string()),
  wardrobe: NonEmptyStringSchema,
  wardrobeCitation: v.nullable(citation),
})
export const BlockingExtrasRegionSchema = v.strictObject({
  ensembleKey: KebabKeySchema,
  region: BlockingRegionSchema,
  count: v.pipe(v.number(), v.integer(), v.minValue(1)),
  variety: v.array(v.string()),
  exclude: v.array(v.string()),
  props: v.array(v.string()),
})
export const BlockingActionAxisSchema = v.strictObject({
  from: KebabKeySchema,
  to: KebabKeySchema,
  establishedSide: v.nullable(v.picklist(BLOCKING_AXIS_SIDES)),
})
const buildMoveSchema = <TCitation extends v.GenericSchema>(citation: TCitation) => v.strictObject({
  type: v.picklist(BLOCKING_MOVE_TYPES),
  characterKey: KebabKeySchema,
  citation,
})
const buildStageStateSchema = <TCitation extends v.GenericSchema>(citation: TCitation) => v.strictObject({
  id: NonEmptyStringSchema,
  locationKey: KebabKeySchema,
  startsAt: citation,
  characters: v.array(buildCharacterMarkSchema(citation)),
  extras: v.array(BlockingExtrasRegionSchema),
  actionAxis: v.nullable(BlockingActionAxisSchema),
  dressing: v.nullable(v.string()),
  moves: v.array(buildMoveSchema(citation)),
})
export const BlockingCameraSetupSchema = v.strictObject({
  id: NonEmptyStringSchema,
  locationKey: KebabKeySchema,
  position: BlockingPositionSchema,
  heightM: v.pipe(v.number(), v.finite(), v.minValue(0)),
  target: BlockingPositionSchema,
  lens: v.picklist(BLOCKING_LENSES),
  framing: v.picklist(BLOCKING_FRAMINGS),
  elevation: v.picklist(BLOCKING_ELEVATIONS),
  overShoulderOf: v.nullable(v.string()),
})

export const BlockingSuppressedAnchorSchema = buildSuppressedAnchorSchema(BlockingCitationSchema)
export const BlockingDressingItemSchema = buildDressingSchema(BlockingCitationSchema)
export const BlockingCharacterMarkSchema = buildCharacterMarkSchema(BlockingCitationSchema)
export const BlockingMoveSchema = buildMoveSchema(BlockingCitationSchema)
export const BlockingStageStateSchema = buildStageStateSchema(BlockingCitationSchema)
export const BlockingLocationMapSchema = v.strictObject({
  locationKey: KebabKeySchema,
  specificationSha256: Sha256Schema,
  geometrySource: v.picklist(BLOCKING_GEOMETRY_SOURCES),
  anchors: v.array(BlockingAnchorSchema),
  suppressedAnchors: v.array(BlockingSuppressedAnchorSchema),
  dressing: v.array(BlockingDressingItemSchema),
  cameraCells: v.optional(v.array(BlockingCameraCellSchema)),
})

export const BlockingPlanSchema = v.strictObject({
  schemaVersion: v.literal(BLOCKING_PLAN_SCHEMA_VERSION),
  sceneSlug: NonEmptyStringSchema,
  structuredScriptSha256: Sha256Schema,
  generatedBy: v.strictObject({ mode: v.picklist(BLOCKING_GENERATION_MODES), model: v.nullable(v.string()) }),
  locations: v.array(BlockingLocationMapSchema),
  stageStates: v.array(BlockingStageStateSchema),
  cameraSetups: v.array(BlockingCameraSetupSchema),
})

const BlockingDraftLocationMapSchema = v.strictObject({
  locationKey: KebabKeySchema,
  anchors: v.array(BlockingAnchorSchema),
  suppressedAnchors: v.array(buildSuppressedAnchorSchema(BlockingDraftCitationSchema)),
  dressing: v.array(buildDressingSchema(BlockingDraftCitationSchema)),
  cameraCells: v.optional(v.array(BlockingCameraCellSchema)),
})

export const PanelBlockingCitationSchema = v.strictObject({
  stageStateId: v.optional(v.string()),
  cameraSetupId: NonEmptyStringSchema,
  croppedOnStage: v.array(v.strictObject({ characterKey: KebabKeySchema, reason: NonEmptyStringSchema })),
  axisBreak: v.nullable(v.strictObject({ sourceSegmentId: NonEmptyStringSchema, reason: NonEmptyStringSchema })),
})

export const BlockingBindingsPanelSchema = v.strictObject({
  panelNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  stageStateId: v.nullable(v.string()),
  cameraSetupId: NonEmptyStringSchema,
  croppedOnStage: v.array(v.strictObject({ characterKey: KebabKeySchema, reason: NonEmptyStringSchema })),
  axisBreak: v.nullable(v.strictObject({ sourceSegmentId: NonEmptyStringSchema, reason: NonEmptyStringSchema })),
})

export const BlockingBindingsSchema = v.strictObject({
  schemaVersion: v.literal(BLOCKING_BINDINGS_SCHEMA_VERSION),
  sceneSha256: Sha256Schema,
  planSha256: Sha256Schema,
  panels: v.array(BlockingBindingsPanelSchema),
})

export const BlockingPlanDraftSchema = v.strictObject({
  locations: v.array(BlockingDraftLocationMapSchema),
  stageStates: v.array(buildStageStateSchema(BlockingDraftCitationSchema)),
  cameraSetups: v.array(BlockingCameraSetupSchema),
  panelBindings: v.optional(v.array(BlockingBindingsPanelSchema)),
})

export const CompiledBlockingLedgerEntrySchema = v.strictObject({
  characterKey: KebabKeySchema,
  screenSide: v.picklist(BLOCKING_SCREEN_SIDES),
  depthBand: v.picklist(BLOCKING_DEPTH_BANDS),
  posture: v.picklist(BLOCKING_POSTURES),
  facing: v.picklist(BLOCKING_FACINGS),
  seatAnchorKey: v.nullable(v.string()),
  wardrobe: v.string(),
  frame: v.picklist(['in', 'edge']),
  lateral: FiniteNumberSchema,
})

export const CompiledPanelBlockingSchema = v.strictObject({
  planSha256: Sha256Schema,
  stageStateId: NonEmptyStringSchema,
  cameraSetupId: NonEmptyStringSchema,
  camera: v.strictObject({
    position: BlockingPositionSchema,
    heightM: FiniteNumberSchema,
    lens: v.picklist(BLOCKING_LENSES),
    framing: v.picklist(BLOCKING_FRAMINGS),
    elevation: v.picklist(BLOCKING_ELEVATIONS),
    overShoulderOf: v.nullable(v.string()),
    headingDeg: FiniteNumberSchema,
    nearestView: v.picklist(BLOCKING_REGISTERED_VIEWS),
  }),
  axis: v.nullable(v.strictObject({
    from: KebabKeySchema,
    to: KebabKeySchema,
    cameraSide: v.nullable(v.picklist(BLOCKING_AXIS_SIDES)),
    establishedSide: v.nullable(v.picklist(BLOCKING_AXIS_SIDES)),
    matchesEstablished: v.boolean(),
    axisBreak: v.nullable(v.strictObject({ sourceSegmentId: NonEmptyStringSchema, reason: NonEmptyStringSchema })),
  })),
  ledger: v.array(CompiledBlockingLedgerEntrySchema),
  offFrameRoster: v.array(v.strictObject({ characterKey: KebabKeySchema, note: v.string() })),
  croppedOnStage: v.array(v.strictObject({ characterKey: KebabKeySchema, reason: v.string() })),
  extrasInFrame: v.array(v.strictObject({
    ensembleKey: KebabKeySchema,
    count: v.number(),
    variety: v.array(v.string()),
    exclude: v.array(v.string()),
    props: v.array(v.string()),
  })),
  dressingInFrame: v.string(),
  anchorsInFrame: v.array(v.strictObject({
    key: v.string(),
    screenSide: v.picklist(BLOCKING_SCREEN_SIDES),
    depthBand: v.picklist(BLOCKING_DEPTH_BANDS),
    seenFrom: v.picklist(BLOCKING_SEEN_FROM),
    projection: v.string(),
  })),
  lines: v.strictObject({
    camera: v.string(),
    ledger: v.array(v.string()),
    offFrame: v.string(),
    wardrobe: v.string(),
    extras: v.string(),
    dressing: v.string(),
    anchors: v.string(),
  }),
})

export const BlockingLocationPlanAnchorSchema = v.strictObject(anchorFields)
export const BlockingLocationPlanEntrySchema = v.looseObject({
  locationKey: KebabKeySchema,
  anchors: v.array(BlockingLocationPlanAnchorSchema),
  cameraCells: v.optional(v.array(BlockingCameraCellSchema)),
  roomExtent: v.optional(v.nullable(v.strictObject({ width: FiniteNumberSchema, depth: FiniteNumberSchema }))),
})
export const BlockingLocationPlansRecordSchema = v.looseObject({
  schemaVersion: v.literal(1),
  plans: v.array(BlockingLocationPlanEntrySchema),
})

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' as const }] })
const stringEnum = (values: readonly string[]) => values.length > 0 ? { type: 'string' as const, enum: [...values] } : { type: 'string' as const }
const numberSchema = { type: 'number' as const }
const positionJsonSchema = () => ({ type: 'object', properties: { x: numberSchema, y: numberSchema }, required: ['x', 'y'], additionalProperties: false })
const citationJsonSchema = (segmentIds: readonly string[]) => ({ type: 'object', properties: { sourceSegmentId: stringEnum(segmentIds) }, required: ['sourceSegmentId'], additionalProperties: false })
const croppedJsonSchema = (characterKeys: readonly string[]) => ({ type: 'array', items: { type: 'object', properties: { characterKey: stringEnum(characterKeys), reason: { type: 'string' } }, required: ['characterKey', 'reason'], additionalProperties: false } })
const axisBreakJsonSchema = (segmentIds: readonly string[]) => nullable({ type: 'object', properties: { sourceSegmentId: stringEnum(segmentIds), reason: { type: 'string' } }, required: ['sourceSegmentId', 'reason'], additionalProperties: false })

export const buildBlockingPlanJsonSchema = (options: {
  characterKeys: readonly string[]
  locationKeys: readonly string[]
  segmentIds: readonly string[]
  bindPanelNumbers?: readonly number[] | undefined
}) => {
  const characterKey = stringEnum(options.characterKeys)
  const locationKey = stringEnum(options.locationKeys)
  const citation = citationJsonSchema(options.segmentIds)
  const anchor = { type: 'object', properties: {
    key: { type: 'string' }, position: positionJsonSchema(),
    footprint: nullable({ type: 'object', properties: { width: numberSchema, depth: numberSchema }, required: ['width', 'depth'], additionalProperties: false }),
    wall: nullable(stringEnum(BLOCKING_WALLS)), facingDeg: nullable(numberSchema), longAxis: nullable(stringEnum(BLOCKING_LONG_AXES)),
  }, required: ['key', 'position', 'footprint', 'wall', 'facingDeg', 'longAxis'], additionalProperties: false }
  const properties: Record<string, unknown> = {
    locations: { type: 'array', items: { type: 'object', properties: {
      locationKey,
      anchors: { type: 'array', items: anchor },
      suppressedAnchors: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, citation, reason: { type: 'string' } }, required: ['key', 'citation', 'reason'], additionalProperties: false } },
      dressing: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, description: { type: 'string' }, position: positionJsonSchema(), citation: nullable(citation) }, required: ['key', 'description', 'position', 'citation'], additionalProperties: false } },
      cameraCells: nullable({ type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, position: positionJsonSchema(), heightM: numberSchema }, required: ['id', 'position', 'heightM'], additionalProperties: false } }),
    }, required: ['locationKey', 'anchors', 'suppressedAnchors', 'dressing', 'cameraCells'], additionalProperties: false } },
    stageStates: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, locationKey, startsAt: citation,
      characters: { type: 'array', items: { type: 'object', properties: {
        characterKey, position: positionJsonSchema(), facingDeg: numberSchema, posture: stringEnum(BLOCKING_POSTURES), seatAnchorKey: nullable({ type: 'string' }), wardrobe: { type: 'string' }, wardrobeCitation: nullable(citation),
      }, required: ['characterKey', 'position', 'facingDeg', 'posture', 'seatAnchorKey', 'wardrobe', 'wardrobeCitation'], additionalProperties: false } },
      extras: { type: 'array', items: { type: 'object', properties: {
        ensembleKey: characterKey,
        region: { type: 'object', properties: { x: numberSchema, y: numberSchema, width: numberSchema, depth: numberSchema }, required: ['x', 'y', 'width', 'depth'], additionalProperties: false },
        count: { type: 'integer', minimum: 1 }, variety: { type: 'array', items: { type: 'string' } }, exclude: { type: 'array', items: { type: 'string' } }, props: { type: 'array', items: { type: 'string' } },
      }, required: ['ensembleKey', 'region', 'count', 'variety', 'exclude', 'props'], additionalProperties: false } },
      actionAxis: nullable({ type: 'object', properties: { from: characterKey, to: characterKey, establishedSide: nullable(stringEnum(BLOCKING_AXIS_SIDES)) }, required: ['from', 'to', 'establishedSide'], additionalProperties: false }),
      dressing: nullable({ type: 'string' }),
      moves: { type: 'array', items: { type: 'object', properties: { type: stringEnum(BLOCKING_MOVE_TYPES), characterKey, citation }, required: ['type', 'characterKey', 'citation'], additionalProperties: false } },
    }, required: ['id', 'locationKey', 'startsAt', 'characters', 'extras', 'actionAxis', 'dressing', 'moves'], additionalProperties: false } },
    cameraSetups: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, locationKey, position: positionJsonSchema(), heightM: numberSchema, target: positionJsonSchema(),
      lens: stringEnum(BLOCKING_LENSES), framing: stringEnum(BLOCKING_FRAMINGS), elevation: stringEnum(BLOCKING_ELEVATIONS), overShoulderOf: nullable(characterKey),
    }, required: ['id', 'locationKey', 'position', 'heightM', 'target', 'lens', 'framing', 'elevation', 'overShoulderOf'], additionalProperties: false } },
  }
  const required = ['locations', 'stageStates', 'cameraSetups']
  if (options.bindPanelNumbers && options.bindPanelNumbers.length > 0) {
    properties['panelBindings'] = { type: 'array', items: { type: 'object', properties: {
      panelNumber: { type: 'integer', enum: [...options.bindPanelNumbers] },
      stageStateId: nullable({ type: 'string' }),
      cameraSetupId: { type: 'string' },
      croppedOnStage: croppedJsonSchema(options.characterKeys),
      axisBreak: axisBreakJsonSchema(options.segmentIds),
    }, required: ['panelNumber', 'stageStateId', 'cameraSetupId', 'croppedOnStage', 'axisBreak'], additionalProperties: false } }
    required.push('panelBindings')
  }
  return {
    name: BLOCKING_PLAN_JSON_SCHEMA_NAME,
    strict: true,
    schema: { type: 'object' as const, properties, required, additionalProperties: false },
  }
}

export const buildPanelBlockingJsonSchema = (options: { characterKeys: readonly string[]; segmentIds?: readonly string[] | undefined; cameraSetupIds?: readonly string[] | undefined; stageStateIds?: readonly string[] | undefined }) => nullable({
  type: 'object',
  properties: {
    stageStateId: nullable(stringEnum(options.stageStateIds ?? [])),
    cameraSetupId: stringEnum(options.cameraSetupIds ?? []),
    croppedOnStage: croppedJsonSchema(options.characterKeys),
    axisBreak: axisBreakJsonSchema(options.segmentIds ?? []),
  },
  required: ['stageStateId', 'cameraSetupId', 'croppedOnStage', 'axisBreak'],
  additionalProperties: false,
})

const deleteNullProperty = (value: Record<string, unknown>, key: string): void => {
  if (value[key] === null) delete value[key]
}

export const stripBlockingPlanNulls = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  if (Array.isArray(value['locations'])) {
    for (const location of value['locations']) {
      if (isRecord(location)) deleteNullProperty(location, 'cameraCells')
    }
  }
  deleteNullProperty(value, 'panelBindings')
  return value
}

export const stripSceneBlockingNulls = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  deleteNullProperty(value, 'blockingPlanSha256')
  if (Array.isArray(value['panels'])) {
    for (const panel of value['panels']) {
      if (!isRecord(panel)) continue
      deleteNullProperty(panel, 'blocking')
      const blocking = panel['blocking']
      if (isRecord(blocking)) deleteNullProperty(blocking, 'stageStateId')
    }
  }
  return value
}
