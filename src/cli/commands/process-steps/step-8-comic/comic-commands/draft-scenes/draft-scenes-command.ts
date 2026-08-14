import type { DraftScenesCommandOptions, DraftScenesLogMode, DraftScenesStage, DraftScenesWorkflowDependencies, DraftScenesWorkflowResult } from '~/types'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/cli-args'
import { comicLog, formatDuration } from '../../comic-utils/comic-logger'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { beginSceneRun, isSceneRunActive } from '../../comic-utils/scene-run-context'
import { draftPromptsCommand } from '../draft-prompts/draft-prompts-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { structureScriptsCommand } from '../structure-scripts/structure-scripts-command'
import { generateSceneJson } from './generate-scene-json'
import { InfraError } from '~/utils/error-handler'

const DRAFT_SCENE_STAGE_ORDER: DraftScenesStage[] = ['structure', 'prompt', 'scene', 'panel-prompts']

const getDraftSceneStages = (only: DraftScenesCommandOptions['only']): DraftScenesStage[] => {
  return only ? [only] : DRAFT_SCENE_STAGE_ORDER
}

const runSceneDraftStage = async (options: DraftScenesCommandOptions) => {
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL

  try {
    return await generateSceneJson(options.sceneSlug, {
      model: llmModel,
      concurrency: options.concurrency,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
      concurrencyMode: options.concurrencyMode
    })
  } catch {
    throw InfraError('Failed at scene JSON generation step', { stage: 'comic:draft-scenes' })
  }
}

export const draftScenesCommand = async (
  options: DraftScenesCommandOptions,
  dependencies: DraftScenesWorkflowDependencies = {},
  logMode: DraftScenesLogMode = 'standalone'
): Promise<DraftScenesWorkflowResult> => {
  const runStructureScripts = dependencies.runStructureScripts ?? structureScriptsCommand
  const runDraftPrompts = dependencies.runDraftPrompts ?? ((opts: DraftScenesCommandOptions) => draftPromptsCommand({ sceneSlug: opts.sceneSlug }))
  const runSceneDraft = dependencies.runSceneDraft ?? runSceneDraftStage
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const stages = getDraftSceneStages(options.only)

  // Resolve a single run directory for this invocation. When nested under
  // generate-images the run is already active and reused. The initial 'structure'
  // stage produces a fresh run; partial runs of later stages resume the latest.
  if (!isSceneRunActive(options.sceneSlug)) {
    const startsFromSource = !options.only || options.only === 'structure'
    beginSceneRun(options.sceneSlug, { resume: !startsFromSource })
  }

  const startTime = Date.now()

  if (logMode === 'standalone') {
    comicLog.header('comic draft-scenes', [
      `scene=${options.sceneSlug}`,
      `stages=${stages.join(',')}`,
    ])
  }

  for (const stage of stages) {
    if (stage === 'structure') {
      await runStructureScripts(options)
      continue
    }

    if (stage === 'prompt') {
      await runDraftPrompts(options)
      continue
    }

    if (stage === 'scene') {
      await runSceneDraft(options)
      continue
    }

    await runPanelPrompts({
      sceneSlug: options.sceneSlug,
      ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
    })
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
