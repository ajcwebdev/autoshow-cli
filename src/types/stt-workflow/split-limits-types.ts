export type SplitLimitClassification = {
  reason: 'attachment_cap' | 'duration_cap' | 'request_budget'
  durationCapSeconds?: number | undefined
}
