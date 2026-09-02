import type { DraftScenesCommandOptions, DraftScenesLogMode, DraftScenesStage, DraftScenesWorkflowDependencies, DraftScenesWorkflowResult } from '~/types'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/cli-args'
import { comicLog, formatDuration } from '../../comic-utils/comic-logger'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { beginSceneRun, isSceneRunActive } from '../../comic-utils/scene-run-context'
import { draftPromptsCommand } from '../draft-prompts/draft-prompts-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { structureScriptsCommand } from '../structure-scripts/structure-scripts-command'
import { readLocationPlans } from '../../comic-utils/location-plan-records'
import { generateBlockingPlan } from './generate-blocking-plan'
import { rebindBlockingPlan } from './blocking-plan-rebind'
import { reconcileFromDirectives } from '../review/review-reconcile'
import { generateSceneJson } from './generate-scene-json'
import { InfraError } from '~/utils/error-handler'

const DRAFT_SCENE_STAGE_ORDER: DraftScenesStage[] = ['structure', 'prompt', 'blocking', 'scene', 'panel-prompts']

export const getDraftSceneStages = (options: Pick<DraftScenesCommandOptions, 'only' | 'blocking'>): DraftScenesStage[] => {
  if (options.only) return [options.only]
  return options.blocking === false ? DRAFT_SCENE_STAGE_ORDER.filter(stage => stage !== 'blocking') : [...DRAFT_SCENE_STAGE_ORDER]
}

const runBlockingPlanStage = async (options: DraftScenesCommandOptions) => {
  const locationPlans = await readLocationPlans()
  if (options.rebind) return await rebindBlockingPlan(options.sceneSlug, { locationPlans })
  return await generateBlockingPlan(options.sceneSlug, {
    model: options.llmModel ?? DEFAULT_LLM_MODEL,
    importPath: options.blockingPlan,
    locationPlans,
    concurrency: options.concurrency,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode
  })
}

const runSceneDraftStage = async (options: DraftScenesCommandOptions) => {
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL

  try {
    return await generateSceneJson(options.sceneSlug, {
      model: llmModel,
      concurrency: options.concurrency,
      blocking: options.blocking,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
      concurrencyMode: options.concurrencyMode
    })
  } catch {
    throw InfraError('Failed at scene JSON generation step', { stage: 'comic:draft-scenes' })
  }
}

const runReconcileStage = async (options: DraftScenesCommandOptions): Promise<void> => {
  const result = await reconcileFromDirectives({ sceneSlug: options.sceneSlug })
  comicLog.outputDirectory(result.logPath)
}

export const draftScenesCommand = async (
  options: DraftScenesCommandOptions,
  dependencies: DraftScenesWorkflowDependencies = {},
  logMode: DraftScenesLogMode = 'standalone'
): Promise<DraftScenesWorkflowResult> => {
  const runStructureScripts = dependencies.runStructureScripts ?? structureScriptsCommand
  const runDraftPrompts = dependencies.runDraftPrompts ?? ((opts: DraftScenesCommandOptions) => draftPromptsCommand({ sceneSlug: opts.sceneSlug }))
  const runBlockingPlan = dependencies.runBlockingPlan ?? runBlockingPlanStage
  const runSceneDraft = dependencies.runSceneDraft ?? runSceneDraftStage
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const stages = getDraftSceneStages(options)

  if (!isSceneRunActive(options.sceneSlug)) {
    const startsFromSource = !options.only || options.only === 'structure'
    beginSceneRun(options.sceneSlug, { resume: !startsFromSource })
  }

  const startTime = Date.now()

  if (options.reconcileFromDirectives) {
    if (logMode === 'standalone') {
      comicLog.header('comic draft-scenes', [
        `scene=${options.sceneSlug}`,
        'stages=reconcile-from-directives',
      ])
    }
    await (dependencies.runReconcileFromDirectives ?? runReconcileStage)(options)
    const reconcileDurationMs = Date.now() - startTime
    if (logMode === 'standalone') {
      comicLog.summary(['stages=1', `duration=${formatDuration(reconcileDurationMs)}`])
      comicLog.outputDirectory(getSceneOutputDirectory(options.sceneSlug))
    }
    return { stages: [], durationMs: reconcileDurationMs }
  }

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

    if (stage === 'blocking') {
      await runBlockingPlan(options)
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
        ...(options.blocking === false ? { blocking: false } : {}),
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
