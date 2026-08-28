import type { ReportHistoricalLookup, TestRunArtifacts } from '~/types'
import { readFileTimings } from '../file-timings'

export const readHistoricalLookups = async (
  _artifacts: TestRunArtifacts,
  cachePath?: string
): Promise<ReportHistoricalLookup> => {
  const timings = await readFileTimings(cachePath)
  return {
    durationById: timings.testDurations,
    processingTimeById: new Map(),
  }
}
