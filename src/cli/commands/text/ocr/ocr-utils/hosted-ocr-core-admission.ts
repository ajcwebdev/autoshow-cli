import type { HostedConcurrencyAdmission, HostedOcrSchedulerLaneState, QueuedHostedOcrJob } from '~/types'

export const buildHostedOcrCoreAdmission = (
  lane: HostedOcrSchedulerLaneState,
  job: QueuedHostedOcrJob
): HostedConcurrencyAdmission => {
  return {
    provider: lane.service,
    accountLabel: lane.scopeLabel,
    lane: lane.lane,
    workClass: 'ocr-page',
    configuredLimit: lane.maxCap,
    workId: job.admission.documentKey
      ? `${job.admission.documentKey}:${job.targetKey}`
      : job.targetKey,
    unitIndex: job.admission.pageNumber ?? 0,
    context: {
      targetKey: job.targetKey,
      ...(typeof job.admission.pageNumber === 'number'
        ? { pageNumber: job.admission.pageNumber }
        : {})
    }
  }
}
