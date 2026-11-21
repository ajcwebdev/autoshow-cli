import type { DraftScenesCommandOptions, DraftScenesLogMode, DraftScenesStage, DraftScenesWorkflowDependencies, DraftScenesWorkflowResult } from '~/types'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/cli-args'
import { comicLog, formatDuration } from '../../comic-utils/comic-logger'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { beginSceneRun, isSceneRunActive } from '../../comic-utils/scene-run-context'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { generateSceneJson } from './generate-scene-json'
import { prepareSceneCommand } from './prepare-scene'
import { InfraError } from '~/utils/error-handler'

const DRAFT_SCENE_STAGE_ORDER: DraftScenesStage[] = ['prepare', 'scene', 'panel-prompts']

export const getDraftSceneStages = (options: Pick<DraftScenesCommandOptions, 'only'>): DraftScenesStage[] =>
  options.only ? [options.only] : [...DRAFT_SCENE_STAGE_ORDER]

const runSceneDraftStage = async (options: DraftScenesCommandOptions) => {
  try {
    return await generateSceneJson(options.sceneSlug, {
      model: options.llmModel ?? DEFAULT_LLM_MODEL,
      concurrency: options.concurrency,
      panelCount: options.panelCount,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
      concurrencyMode: options.concurrencyMode
    })
  } catch (error) {
    throw InfraError('Failed at scene JSON generation step', { stage: 'comic:draft-scenes', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

export const draftScenesCommand = async (
  options: DraftScenesCommandOptions,
  dependencies: DraftScenesWorkflowDependencies = {},
  logMode: DraftScenesLogMode = 'standalone'
): Promise<DraftScenesWorkflowResult> => {
  const runPrepare = dependencies.runPrepare ?? prepareSceneCommand
  const runSceneDraft = dependencies.runSceneDraft ?? runSceneDraftStage
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const stages = getDraftSceneStages(options)

  if (!isSceneRunActive(options.sceneSlug)) {
    beginSceneRun(options.sceneSlug, { resume: !stages.includes('prepare') })
  }

  const startTime = Date.now()

  if (logMode === 'standalone') {
    comicLog.header('comic draft-scenes', [
      `scene=${options.sceneSlug}`,
      `stages=${stages.join(',')}`,
    ])
  }

  for (const stage of stages) {
    if (stage === 'prepare') {
      await runPrepare(options)
      continue
    }

    if (stage === 'scene') {
      await runSceneDraft(options)
      continue
    }

    if (stage === 'panel-prompts') {
      await runPanelPrompts({
        sceneSlug: options.sceneSlug,
        ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
      })
      continue
    }

    throw InfraError(`Unknown draft-scenes stage "${String(stage)}"`, { stage: 'comic:draft-scenes' })
  }

  const durationMs = Date.now() - startTime

  if (logMode === 'standalone') {
    comicLog.summary([
      `stages=${stages.length}`,
      `duration=${formatDuration(durationMs)}`,
    ])
    comicLog.outputDirectory(getSceneOutputDirectory(options.sceneSlug))
  }

  return { stages, durationMs }
}
