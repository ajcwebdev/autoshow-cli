import type { PipelineManifestItem } from '~/types'

type ComicStageStatus = Extract<PipelineManifestItem['status'], 'full' | 'skipped' | 'failed' | 'incomplete'>

export const aggregateComicStageStatus = (
  stages: readonly { status: ComicStageStatus }[]
): ComicStageStatus => {
  if (stages.every(stage => stage.status === 'full' || stage.status === 'skipped') && stages.some(stage => stage.status === 'full')) return 'full'
  if (stages.every(stage => stage.status === 'skipped')) return 'skipped'
  if (stages.every(stage => stage.status === 'failed' || stage.status === 'skipped') && stages.some(stage => stage.status === 'failed')) return 'failed'
  return 'incomplete'
}
