import type { ProviderState, SttBatchProviderStatsSnapshot, SttBatchSchedulerSnapshot, SttTarget } from '~/types'
import { createProviderLaneIdentity } from '~/cli/commands/command-shared/provider-lane-contract'
import { formatSttTargetLabel } from '../stt-targets'
import { getSttBatchProviderProfile } from './stt-batch-policy'

export const projectSttCoordinatorSnapshot = (providerStates: ReadonlyMap<string, ProviderState>, batchConcurrency: number): SttBatchSchedulerSnapshot => {
  return {
    providers: [...providerStates.entries()]
      .map(([key, state]) => {
        const [service, ...modelParts] = key.split(':')
        const model = modelParts.join(':')
        const target = {
          service: service as SttTarget['service'],
          model,
          local: false
        }
        const profile = getSttBatchProviderProfile(target, batchConcurrency)

        return {
          lane: createProviderLaneIdentity(target.service, target.model),
          service: target.service,
          model: target.model,
          kind: profile.kind,
          launchSlotLimit: profile.launchSlotLimit,
          pollSlotLimit: profile.pollSlotLimit,
          launchedCount: state.stats.launchedCount,
          completedCount: state.stats.completedCount,
          blockedCount: state.stats.blockedCount,
          degradedCount: state.stats.degradedCount,
          queueWaitMs: state.stats.queueWaitMs,
          pollCount: state.stats.pollCount,
          backfillCount: state.stats.backfillCount,
          warmupComplete: state.warmupComplete
        } satisfies SttBatchProviderStatsSnapshot
      })
      .sort((left, right) =>
        formatSttTargetLabel(left).localeCompare(formatSttTargetLabel(right))
      )
  }
}
