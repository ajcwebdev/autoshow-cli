import type { ComicImageGenerationDependencies, GenerateComicGridPagesDependencies, GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageRunStats, SourceCoverageReport } from '~/types'

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

export type FinalPanelImageStageDependencies = ComicImageGenerationDependencies & GenerateComicGridPagesDependencies & Pick<GenerateImagesWorkflowDependencies, 'checkPanelPromptSourceCoverage'>

export type ComicImageWorkItemResult = {
  stats: ImageRunStats
  error?: unknown | undefined
}

export type ComicImageRunStop = {
  item: string
  reason: string
  abandoned: number
}
