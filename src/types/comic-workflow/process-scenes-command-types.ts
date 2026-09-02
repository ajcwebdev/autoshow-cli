import type { SourceCoverageReport } from '~/types'


export type ProcessSceneResult = {
  success: number
  errors: number
  panels: number
  coverageReport?: SourceCoverageReport
}

export type ProcessSceneOptions = {
  sceneSlug: string
  sceneJsonPath: string
  outputDir: string
  concurrency: number
  blocking?: boolean | undefined
}
