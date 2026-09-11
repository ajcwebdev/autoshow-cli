import type { BlockingPlan, BlockingStageState, StructuredScriptData } from '~/types'

type SourceSegment = StructuredScriptData['sourceSegments'][number]
export const segmentIndexMap = (segments: ReadonlyArray<Pick<SourceSegment, 'id'>>): Map<string, number> => {
  const map = new Map<string, number>()
  segments.forEach((segment, index) => { if (!map.has(segment.id)) map.set(segment.id, index) })
  return map
}

export const orderStageStates = (plan: BlockingPlan, segmentOrder: readonly string[]): BlockingStageState[] => {
  const indices = segmentIndexMap(segmentOrder.map(id => ({ id })))
  return plan.stageStates
    .map((state, order) => ({ state, order, index: indices.get(state.startsAt.sourceSegmentId) ?? Number.POSITIVE_INFINITY }))
    .sort((left, right) => left.index - right.index || left.order - right.order)
    .map(item => item.state)
}
