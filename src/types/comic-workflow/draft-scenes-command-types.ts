import type { DraftScenesCommandOptions, DraftScenesStage, PanelPromptsCommandOptions } from '~/types'

export type DraftScenesLogMode = 'standalone' | 'nested'

export type DraftScenesWorkflowDependencies = {
  runPrepare?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runSceneDraft?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runPanelPrompts?: (options: PanelPromptsCommandOptions) => Promise<unknown>
}

export type DraftScenesWorkflowResult = {
  stages: DraftScenesStage[]
  durationMs: number
}
