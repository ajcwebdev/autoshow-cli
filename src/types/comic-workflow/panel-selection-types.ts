import type { CanonicalComicItemMetadata, ComicImageRunRecord, ComicPanelSelection, ComicPanelSelectionRecord, ImageGenerationModel } from '~/types'

/** A selection that was replaced by explicit adoption. The prior canonical bytes are kept at `preservedPath`. */
export type ComicPanelSelectionHistoryEntry = ComicPanelSelectionRecord & {
  supersededAt: string
  supersededByRunId: string
  /** Scene-workspace-relative copy of the superseded canonical bytes (content addressed by sha256). */
  preservedPath: string
}

/** Persisted at `<scene>/metadata/panel-selections.json`. */
export type ComicPanelSelectionStore = {
  schemaVersion: 1
  runs: ComicImageRunRecord[]
  selections: ComicPanelSelectionRecord[]
  history: ComicPanelSelectionHistoryEntry[]
}

export type ComicSelectionPresentationSnapshot = {
  stage: CanonicalComicItemMetadata['stages']['presentation']
  presentation: CanonicalComicItemMetadata['presentation']
  audioHash: string
}

/** Journal written at `<scene>/metadata/panel-selection-transaction.json` while canonical files are being replaced. */
export type ComicPanelSelectionTransaction = ({
  schemaVersion: 1
} | {
  schemaVersion: 2
  /** Prior entries for changed paths. A missing entry means the path was unreferenced. */
  refsBefore: Array<{ path: string, sha256: string }> | null
  /** The published presentation invalidated by this selection, for restoring an interrupted adoption. */
  presentationBefore?: ComicSelectionPresentationSnapshot
}) & {
  startedAt: string
  /** Exact store text before the transaction, or null when the store did not exist. */
  storeBefore: string | null
  changes: Array<{
    panelNumber: number
    canonicalPath: string
    previousSha256: string | null
    preservedPath: string | null
    nextSha256: string
  }>
}

export type PublishFirstPanelSelectionInput = {
  sceneSlug: string
  runId: string
  service: string
  model: ImageGenerationModel
  panelNumber: number
  candidatePath: string
}

export type PublishFirstPanelSelectionResult = {
  outcome: 'selected' | 'preserved'
  message: string
}

export type AdoptRunCandidatesInput = {
  sceneSlug: string
  runId: string
  panels?: ComicPanelSelection | undefined
}

export type ComicPanelImageEvidence = {
  sha256: string
  width: number
  height: number
}
