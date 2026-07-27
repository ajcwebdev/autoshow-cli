import type { GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageRunStats, SourceCoverageReport } from '~/types'

// Resolved options for the final-image stage: the command computes a single
// per-run timestamp and concurrency value and threads them through.
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
}
