import type { SttBatchWorkerContext, SttTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logSttRecoveryPass } from '../stt-logging'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { runSttProviderTargetAtIndex } from './stt-batch-worker'

const STT_RECOVERY_MAX_PASSES = 3

export const runSttRecoveryPasses = async (
  ctx: SttBatchWorkerContext
): Promise<void> => {
  for (let pass = 1; pass <= STT_RECOVERY_MAX_PASSES; pass++) {
    const recoveryIndices = [...ctx.failuresByIndex.values()]
      .map((failure) => failure.index)

    if (recoveryIndices.length === 0) {
      break
    }

    let recoveredCount = 0
    logSttRecoveryPass(l, {
      pass,
      maxPasses: STT_RECOVERY_MAX_PASSES,
      failures: recoveryIndices.length,
      providers: recoveryIndices.map((index) => `${(ctx.requestedTargets[index] as SttTarget).service}/${(ctx.requestedTargets[index] as SttTarget).model}`).join(', ')
    })
    await mapWithConcurrency(1, recoveryIndices, async (index) => {
      const hadFailure = ctx.failuresByIndex.has(index)
      await runSttProviderTargetAtIndex(ctx, index, 'recovery')
      if (hadFailure && !ctx.failuresByIndex.has(index)) {
        recoveredCount += 1
      }
    })

    if (recoveredCount === 0) {
      break
    }
  }
}
