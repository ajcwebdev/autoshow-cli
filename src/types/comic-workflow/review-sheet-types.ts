import type { PageQaEntry, ScenePromptData, StructuredScriptData } from '~/types'

export type ReviewSheetPanelQa = {
  attempts: number
  hardFailureKeys: string[]
  repairRoute: string
  lineage: string
}

export type ReviewSheetPanel = {
  panelNumber: number
  description: string
  shotPlan: string
  characterKeys: string[]
  speech: Array<{ speaker: string; line: string }>
  sourceSegments: Array<{ id: string; text: string }>
  stageBoardSvg: string | null
  imagePath: string | null
  qa: ReviewSheetPanelQa | null
}

export type ReviewSheetResult = {
  sceneSlug: string
  sceneTitle: string
  outputPath: string
  exportDocPath: string | null
  panels: ReviewSheetPanel[]
}

export type ReviewSheetCommandOptions = {
  scriptPath: string
  sceneSlug: string
  exportDoc?: boolean | undefined
}

export type ReviewSheetCommandDependencies = {
  scene?: ScenePromptData | undefined
  structuredScript?: StructuredScriptData | undefined
  pageQaEntries?: PageQaEntry[] | undefined
}

export type ParsedReviewSheetArgs = {
  showHelp: boolean
  scriptPath: string
  exportDoc?: boolean
}
