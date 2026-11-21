import type { ComicImageRunRecord, ComicPanelSelectionRecord, ReviewSheetCommandSelectionOptions, ScenePromptData, StructuredScriptData } from '~/types'

export type ReviewSheetCandidate = {
  /** Only verified candidates can be labeled selected or alternative. */
  status: 'missing' | 'changed' | 'invalid' | 'selected' | 'alternative'
  imagePath: string | null
  /** Expected digest from the run. Null when it never recorded this panel. */
  recordedSha256: string | null
  /** Digest and dimensions of the file inspected for this preview, when decodable. */
  sha256: string | null
  width: number | null
  height: number | null
}

export type ReviewSheetPanel = {
  panelNumber: number
  description: string
  shotPlan: string
  characterKeys: string[]
  speech: Array<{ speaker: string; line: string }>
  sourceSegments: Array<{ id: string; text: string }>
  /** Current selected image (`panels/panel-NN.png`) relative to the review directory. */
  imagePath: string | null
  selection: ComicPanelSelectionRecord | null
  /** Present only when a run is previewed with `--run`. */
  candidate: ReviewSheetCandidate | null
}

export type ReviewSheetRunPage = {
  pageNumber: number
  panelNumbers: number[]
  panelRange: string
  kind: NonNullable<ComicImageRunRecord['pages']>[number]['kind']
  status: 'available' | 'missing' | 'invalid'
  imagePath: string | null
}

export type ReviewSheetRunPreview = {
  runId: string
  service: string
  model: string
  missingPanels: number[]
  changedPanels: number[]
  invalidPanels: number[]
  pages: ReviewSheetRunPage[]
}

export type ReviewSheetSelectionChange = {
  panelNumber: number
  previous: ComicPanelSelectionRecord | null
  current: ComicPanelSelectionRecord
  changed: boolean
}

export type ReviewSheetResult = {
  sceneSlug: string
  sceneTitle: string
  outputPath: string
  exportDocPath: string | null
  panels: ReviewSheetPanel[]
  run: ReviewSheetRunPreview | null
  changes: ReviewSheetSelectionChange[]
}

export type ReviewSheetCommandOptions = ReviewSheetCommandSelectionOptions & {
  scriptPath: string
  sceneSlug: string
  exportDoc?: boolean | undefined
}

export type ReviewSheetCommandDependencies = {
  scene?: ScenePromptData | undefined
  structuredScript?: StructuredScriptData | undefined
}

export type ParsedReviewSheetArgs = {
  showHelp: boolean
  scriptPath: string
  exportDoc?: boolean
}
