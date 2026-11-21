import type { HostedConcurrencyRuntimeOptions, LlmModel } from '~/types'

export type SceneDraftRequest = {
  prompt: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  model: LlmModel
  attempt: number
  sceneSlug: string
}

export type SceneDraftResponse = {
  text: string
  inputTokens?: number | undefined
  outputTokens?: number | undefined
  returnedModel?: string | undefined
}

export type ScenePanelCountContract = {
  panelCount: number
  panelNoteSegmentIds: string[]
}

export type GenerateSceneJsonOptions = HostedConcurrencyRuntimeOptions & {
  model: LlmModel
  concurrency?: number | undefined
  panelCount?: number | undefined
  requestScene?: ((request: SceneDraftRequest) => Promise<SceneDraftResponse>) | undefined
}
