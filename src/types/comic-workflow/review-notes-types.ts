export type ReviewNoteKind = 'blocking' | 'camera' | 'axis-break' | 'costume' | 'extras'

export type ReviewNoteDirectiveLabel = 'BLOCKING' | 'CAMERA' | 'BREAK-180' | 'COSTUME' | 'EXTRAS'

export type ReviewNotesCommandOptions = {
  scriptPath: string
  sceneSlug: string
  notesPath: string
  runId?: string | undefined
}

export type ReviewNotesCommandDependencies = {
  runId?: () => string
  catalog?: Pick<import('~/types').CharacterCatalogService, 'detectMentions'> | undefined
}

export type ParsedReviewNotesArgs = {
  showHelp: boolean
  scriptPath: string
  notes: string
}

export type ReviewNote = {
  panelNumber: number
  lineIndex: number
  text: string
}

export type ReviewNoteClassification = {
  kind: ReviewNoteKind
  matches: string[]
}

export type ReviewNoteTarget = {
  panelNumber: number
  locationKey: string
  characterKeys: string[]
  segmentId: string | null
  beatIndex: number | null
  beatType: string | null
  beatText: string | null
  speakerLabel: string | null
  scriptLine: number | null
}

export type ReviewNoteDirective = {
  note: ReviewNote
  kind: ReviewNoteKind
  label: ReviewNoteDirectiveLabel
  matches: string[]
  header: Record<string, string>
  placeholders: string[]
  directive: string
  target: ReviewNoteTarget
}

export type ReviewNoteUnmatched = {
  note: ReviewNote
  reason: string
}

export type ReviewNotesResult = {
  runId: string
  sceneSlug: string
  sceneTitle: string
  scriptPath: string
  notesPath: string
  outputPath: string
  panelCount: number
  directives: ReviewNoteDirective[]
  unmatched: ReviewNoteUnmatched[]
  countsByKind: Record<ReviewNoteKind, number>
}
