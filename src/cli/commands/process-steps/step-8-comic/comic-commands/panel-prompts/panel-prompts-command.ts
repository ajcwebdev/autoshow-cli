import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { err } from '../../comic-utils/comic-logger'
import { processScene } from '../process-scenes/process-scenes-command'
import {
  getSceneJsonPath,
  getPanelPromptsDirectory,
} from '../../comic-utils/project-paths'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { InfraError } from '~/utils/error-handler'
import type { PanelPromptsCommandOptions, ProcessSceneResult } from '~/types'


export const panelPromptsCommand = async (options: PanelPromptsCommandOptions): Promise<ProcessSceneResult> => {
  try {
    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!existsSync(sceneJsonPath)) {
      throw InfraError(
        `Scene JSON not found at ${sceneJsonPath}. ` +
        `Run "bun autoshow comic draft-scenes <script-path>" first.`,
        { stage: 'comic:panel-prompts' }
      )
    }

    const outputDir = getPanelPromptsDirectory(options.sceneSlug)
    await mkdir(outputDir, { recursive: true })

    return await processScene({
      sceneSlug: options.sceneSlug,
      sceneJsonPath,
      outputDir,
      concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    })
  } catch (error) {
    err('Scene processing failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
