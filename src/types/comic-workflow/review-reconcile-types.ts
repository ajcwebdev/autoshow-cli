export type ReviewReconcileChangeKind = 'camera' | 'axis-break' | 'costume' | 'extras'

export type ReviewReconcileChange = {
  kind: ReviewReconcileChangeKind
  panelNumber: number | null
  target: string
  before: string
  after: string
  detail: string
}

export type ReviewReconcileSkip = {
  kind: ReviewReconcileChangeKind
  panelNumber: number | null
  reason: string
}

export type ReviewReconcileResult = {
  runId: string
  sceneSlug: string
  sceneChanged: boolean
  planChanged: boolean
  changes: ReviewReconcileChange[]
  skipped: ReviewReconcileSkip[]
  logPath: string
}
