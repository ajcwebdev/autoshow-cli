import type { GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageRunStats, PageQaEntry, SourceCoverageReport } from '~/types'

export type FinalPanelImageStageOptions = GenerateImagesCommandOptions & {
  runId: string
  concurrency: number
}

export type GenerateImagesWorkflowDependencies = {
  runSketches?: (options: GenerateSketchesCommandOptions) => Promise<ImageRunStats | void>
  runImages?: (options: FinalPanelImageStageOptions) => Promise<ImageRunStats | void>
  checkScenesExist?: (sceneSlug: string) => Promise<boolean>
  checkPromptsExist?: (sceneSlug: string) => Promise<boolean>
  checkPanelPromptSourceCoverage?: (sceneSlug: string) => Promise<SourceCoverageReport>
  runRevisionEvaluation?: (options: GenerateImagesCommandOptions) => Promise<ImageRunStats | void>
}

export type ComicImageWorkItemResult = {
  stats: ImageRunStats
  qaEntries: Array<{ directory: string, entry: PageQaEntry }>
  error?: unknown | undefined
}
