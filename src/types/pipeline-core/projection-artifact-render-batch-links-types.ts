export type PlannedSlot = {
  batchId: string
  generationSlotId: string
  orderedTurnIds: string[]
}

export type AggregateBatchLinks = {
  pairs: string[]
  batches: Array<Record<string, unknown>>
}
