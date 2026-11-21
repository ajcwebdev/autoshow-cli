import type { PreparedStructuredScript, StructuredScriptData } from '~/types'

export type PreparedSceneArtifacts = {
  structure: PreparedStructuredScript
  structuredScript: StructuredScriptData
  draftPrompt: string
  recapMontages: number
}

export type PrepareSceneResult = {
  structuredScriptPath: string
  draftPromptPath: string
  sourceSegments: number
  durationMs: number
}

export type PreparedScenePair = {
  structuredScript: StructuredScriptData
  structuredScriptPath: string
  draftPrompt: string
  draftPromptPath: string
}
