import type { CharacterCatalogService, CharacterKey, ComicSourceIdentity, ExpandedScriptBlock, LocationReferenceCatalog, StructuredScriptBeat, StructuredScriptData } from '~/types'

export type StructuredSourceSpan = StructuredScriptBeat['sourceSpans'][number]

export type StructuredScriptParserOptions = {
  locationCatalog?: LocationReferenceCatalog
  characterCatalog?: CharacterCatalogService
  sourceIdentity?: ComicSourceIdentity
}

export type StructuredScriptEnvelope = {
  content: string
  scriptPath: string
  scriptFile: string
  documentHeading: ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/markdown-blocks').parseHeading>
  sceneHeading: ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/markdown-blocks').parseHeading>
  metadata: StructuredScriptData['document']['metadata']
  locationRaw: string
  locationCatalog: LocationReferenceCatalog
  characterCatalog: CharacterCatalogService
  blocks: ExpandedScriptBlock[]
  providedSourceIdentity: ComicSourceIdentity | undefined
}

export type StructuredScriptParserState = {
  envelope: StructuredScriptEnvelope
  activeLocation: StructuredScriptData['scene']['location']
  beats: StructuredScriptBeat[]
  allCharacters: CharacterKey[]
  characterNameSet: Set<CharacterKey>
  activeSpeakerLabel: string | null
  activeSpeakerCharacters: CharacterKey[]
  pendingDelivery: string | null
  pendingCaptionLabel: string | null
  hasDialogueInCurrentTurn: boolean
  continueDialogueAfterDirection: boolean
  pendingSoundDirectivePrompt: boolean
}

export type StructuredScriptMention = StructuredScriptBeat['rawMentions'][number]

export type StructuredScriptBeatInput = Omit<StructuredScriptBeat, 'index' | 'location' | 'sourceSpans'>

export type SoundDirectiveClassification = {
  kind: 'sound-directive'
  waitsForPrompt: boolean
} | {
  kind: 'sound-directive-prompt'
}

export type BoldLabelClassification = {
  kind: 'bold-label'
  label: string
  role: 'location'
} | {
  kind: 'bold-label'
  label: string
  role: 'transition' | 'direction'
  mentions: StructuredScriptMention[]
  characters: CharacterKey[]
} | {
  kind: 'bold-label'
  label: string
  role: 'speaker'
  characters: CharacterKey[]
} | {
  kind: 'bold-label'
  label: string
  role: 'uncatalogued-speaker' | 'caption'
}

export type TextBlockClassification = {
  kind: 'location-transition' | 'caption' | 'labelled-action-fragment' | 'dialogue' | 'direction'
  text: string
}

export type ClassifiedStructuredScriptBlock =
  | SoundDirectiveClassification
  | BoldLabelClassification
  | { kind: 'panel-note'; block: string }
  | { kind: 'parenthetical'; block: string }
  | TextBlockClassification
