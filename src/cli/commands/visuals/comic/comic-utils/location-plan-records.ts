import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as v from 'valibot'
import type { BlockingLocationPlansRecord, LocationPlanEntry, LocationPlanRecord, LocationPlanValidationContext, LocationReferenceCatalog } from '~/types'
import { AppValidationError, ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { BlockingCameraCellSchema, BlockingLocationPlanAnchorSchema } from '../schemas/blocking-plan-schemas'
import { isAnchorGroundedInSpecification } from './blocking-plan-validation'
import { pointInFootprint } from './blocking-geometry'
import { getLocationReferencePath, getLocationsRoot, LOCATION_KEY_PATTERN, readLocationReferenceCatalogSync, resolveLocationAssetPath } from './location-reference'

export const LOCATION_PLANS_SCHEMA_VERSION = 1
export const LOCATION_PLANS_FILENAME = 'location-plans.json'
export const LOCATION_PLAN_REVIEW_STATUSES = ['provisional', 'reviewed'] as const

const STAGE = 'comic:location-plans'
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const KebabKeySchema = v.pipe(v.string(), v.regex(LOCATION_KEY_PATTERN, 'Expected a lowercase kebab-case key'))
const Sha256Schema = v.pipe(v.string(), v.regex(SHA256_PATTERN, 'Expected a lowercase SHA-256 hex digest'))
const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1, 'Expected a non-empty string'))
const PositiveNumberSchema = v.pipe(v.number(), v.finite('Expected a finite number'), v.minValue(0, 'Expected a non-negative number'))

export const LocationPlanDrawingSchema = v.strictObject({
  path: NonEmptyStringSchema,
  sha256: Sha256Schema,
})

export const LocationPlanEntrySchema = v.strictObject({
  locationKey: KebabKeySchema,
  reviewStatus: v.picklist(LOCATION_PLAN_REVIEW_STATUSES),
  reviewedBy: v.nullable(v.string()),
  reviewedAt: v.nullable(v.string()),
  drawing: v.nullable(LocationPlanDrawingSchema),
  roomExtent: v.strictObject({ width: PositiveNumberSchema, depth: PositiveNumberSchema }),
  anchors: v.array(BlockingLocationPlanAnchorSchema),
  cameraCells: v.array(BlockingCameraCellSchema),
  geometrySha256: Sha256Schema,
})

export const LocationPlanRecordSchema = v.strictObject({
  schemaVersion: v.literal(LOCATION_PLANS_SCHEMA_VERSION),
  plans: v.array(LocationPlanEntrySchema),
})

export const EMPTY_LOCATION_PLANS: LocationPlanRecord = { schemaVersion: LOCATION_PLANS_SCHEMA_VERSION, plans: [] }

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).filter(key => record[key] !== undefined).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const canonicalLocationPlanJson = (entry: Omit<LocationPlanEntry, 'geometrySha256'> & { geometrySha256?: string | undefined }): string => {
  const { geometrySha256: _geometrySha256, ...rest } = entry
  return canonicalJson(rest)
}

export const computeLocationPlanGeometrySha256 = (entry: Omit<LocationPlanEntry, 'geometrySha256'> & { geometrySha256?: string | undefined }): string => sha256Bytes(canonicalLocationPlanJson(entry))

export const stampLocationPlanGeometrySha256 = (entry: Omit<LocationPlanEntry, 'geometrySha256'> & { geometrySha256?: string | undefined }): LocationPlanEntry => ({ ...entry, geometrySha256: computeLocationPlanGeometrySha256(entry) })

export const getLocationPlansPath = (locationsRoot: string = getLocationsRoot()): string => join(locationsRoot, LOCATION_PLANS_FILENAME)

const fail = (path: string, message: string): never => {
  throw ValidationError(`Invalid location plans at ${path}: ${message}`, { stage: STAGE })
}

const readCatalogSpecifications = (locationsRoot: string): Map<string, string> => {
  const specifications = new Map<string, string>()
  if (!existsSync(getLocationReferencePath(locationsRoot))) return specifications
  const catalog: LocationReferenceCatalog = readLocationReferenceCatalogSync(locationsRoot)
  for (const entry of catalog.locations) specifications.set(entry.key, entry.specification)
  return specifications
}

export const validateLocationPlanRecord = (record: LocationPlanRecord, context: LocationPlanValidationContext, path: string = getLocationPlansPath(context.locationsRoot)): LocationPlanRecord => {
  const seen = new Set<string>()
  for (const plan of record.plans) {
    const label = `Location plan "${plan.locationKey}"`
    if (seen.has(plan.locationKey)) fail(path, `${label} is listed more than once`)
    seen.add(plan.locationKey)
    const specification = context.specifications.get(plan.locationKey)
    if (specification === undefined) fail(path, `${label} is not a catalog location`)
    const anchorKeys = new Set<string>()
    for (const anchor of plan.anchors) {
      if (anchorKeys.has(anchor.key)) fail(path, `${label} lists anchor "${anchor.key}" more than once`)
      anchorKeys.add(anchor.key)
      if (!isAnchorGroundedInSpecification(anchor.key, specification!)) fail(path, `${label} anchor "${anchor.key}" is not a substring of the "${plan.locationKey}" specification`)
    }
    const cellIds = new Set<string>()
    for (const cell of plan.cameraCells) {
      if (cellIds.has(cell.id)) fail(path, `${label} lists camera cell "${cell.id}" more than once`)
      cellIds.add(cell.id)
      const blocking = plan.anchors.find(anchor => pointInFootprint(cell.position, anchor))
      if (blocking) fail(path, `${label} camera cell "${cell.id}" sits inside the "${blocking.key}" footprint`)
    }
    if (plan.drawing) {
      const drawingPath = resolveLocationAssetPath(plan.drawing.path, `${label} drawing`, context.locationsRoot)
      if (!existsSync(drawingPath)) fail(path, `${label} drawing ${plan.drawing.path} is missing under the locations root`)
      const actual = sha256Bytes(readFileSync(drawingPath))
      if (actual !== plan.drawing.sha256) fail(path, `${label} drawing ${plan.drawing.path} does not match its registered sha256`)
    }
    const expected = computeLocationPlanGeometrySha256(plan)
    if (plan.geometrySha256 !== expected) fail(path, `${label} geometrySha256 does not match its geometry (expected ${expected})`)
  }
  return record
}

export const parseLocationPlans = (value: unknown, path: string, locationsRoot: string = getLocationsRoot()): LocationPlanRecord => {
  const parsed = v.safeParse(LocationPlanRecordSchema, value)
  if (!parsed.success) {
    const first = parsed.issues[0]
    const at = first?.path ? v.getDotPath(first) : undefined
    return fail(path, `${first?.message ?? 'schema mismatch'}${at ? ` at ${at}` : ''}`)
  }
  return validateLocationPlanRecord(parsed.output, { locationsRoot, specifications: readCatalogSpecifications(locationsRoot) }, path)
}

const parseJsonText = (text: string, path: string): unknown => {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw ValidationError(`Invalid location plans JSON at ${path}`, { stage: STAGE, cause: error instanceof Error ? error : undefined })
  }
}

export const readLocationPlansSync = (locationsRoot: string = getLocationsRoot()): LocationPlanRecord => {
  const path = getLocationPlansPath(locationsRoot)
  if (!existsSync(path)) return { ...EMPTY_LOCATION_PLANS, plans: [] }
  try {
    return parseLocationPlans(parseJsonText(readFileSync(path, 'utf8'), path), path, locationsRoot)
  } catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError(`Invalid location plans at ${path}`, { stage: STAGE, cause: error instanceof Error ? error : undefined })
  }
}

export const readLocationPlans = async (locationsRoot: string = getLocationsRoot()): Promise<LocationPlanRecord> => {
  const path = getLocationPlansPath(locationsRoot)
  if (!(await Bun.file(path).exists())) return { ...EMPTY_LOCATION_PLANS, plans: [] }
  try {
    return parseLocationPlans(parseJsonText(await Bun.file(path).text(), path), path, locationsRoot)
  } catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError(`Invalid location plans at ${path}`, { stage: STAGE, cause: error instanceof Error ? error : undefined })
  }
}

export const findLocationPlan = (record: LocationPlanRecord | BlockingLocationPlansRecord | undefined, locationKey: string): LocationPlanEntry | undefined =>
  record?.plans.find(plan => plan.locationKey === locationKey) as LocationPlanEntry | undefined

export const asBlockingLocationPlans = (record: LocationPlanRecord): BlockingLocationPlansRecord => record
