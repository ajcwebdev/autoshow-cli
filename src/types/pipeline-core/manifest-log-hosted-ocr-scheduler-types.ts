import type { ManifestLogCollection } from '~/types'

type HostedOcrSchedulerSummaryRow = {
  lane: string
  status: string
  cap: string
  capSource: string
  peak: number
  retryPressure: number
  pause: string
  pagesPerMinute: string
  targetShare: string
}

export type HostedOcrSchedulerSection = ManifestLogCollection<HostedOcrSchedulerSummaryRow>
