import type * as v from 'valibot'

type LocationPlanSchemas = typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/location-plan-records')

export type LocationPlanRecord = v.InferOutput<LocationPlanSchemas['LocationPlanRecordSchema']>
export type LocationPlanEntry = v.InferOutput<LocationPlanSchemas['LocationPlanEntrySchema']>
export type LocationPlanAnchor = LocationPlanEntry['anchors'][number]
export type LocationPlanCameraCell = LocationPlanEntry['cameraCells'][number]
export type LocationPlanDrawing = v.InferOutput<LocationPlanSchemas['LocationPlanDrawingSchema']>
export type LocationPlanReviewStatus = LocationPlanSchemas['LOCATION_PLAN_REVIEW_STATUSES'][number]

export type LocationPlanValidationContext = {
  locationsRoot: string
  specifications: ReadonlyMap<string, string>
}
