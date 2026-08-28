import type { RenderAdmissionJournalSnapshot } from '~/types'

export type RetainedJournalEvidence = {
  value: RenderAdmissionJournalSnapshot
  path: string
  sha256: string
  attemptRoot: string
}
