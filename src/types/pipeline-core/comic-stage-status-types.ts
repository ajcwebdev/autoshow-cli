import type { PipelineManifestItem } from '~/types'

export type ComicStageStatus = Extract<PipelineManifestItem['status'], 'full' | 'skipped' | 'failed' | 'incomplete'>
