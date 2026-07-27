import type { ManifestLogSection } from '~/types'

export type HostedOcrSchedulerSummaryRow = {
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

export type HostedOcrSchedulerSection = ManifestLogSection<HostedOcrSchedulerSummaryRow>
