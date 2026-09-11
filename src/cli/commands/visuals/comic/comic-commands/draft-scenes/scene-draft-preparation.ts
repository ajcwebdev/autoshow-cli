import type { GenerateSceneJsonOptions, SceneDraftRequest, SceneDraftResponse, ScenePanelCountContract } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { comicLog } from '../../comic-utils/comic-logger'
import { appendScenePlanSection, parseJsonFile, readBlockingPlanIfPresent, stripScenePlanSection } from '../../comic-utils/json-prompt-utils'
import {
  getDraftPromptPath,
  getStructuredScriptPath
} from '../../comic-utils/project-paths'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { buildSceneJsonSchema, ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { SCENE_DRAFT_MAX_ATTEMPTS_WITH_PLAN, STAGE } from './scene-draft-defaults'
import { appendPanelCountSection, buildPanelCountContract } from './scene-panel-count-contract'

const requestSceneFromProvider = (options: GenerateSceneJsonOptions) => async (request: SceneDraftRequest): Promise<SceneDraftResponse> => {
  const { text, metadata } = await runComicStructuredLlm(request.prompt, {
    schemaName: request.schemaName,
    valibotSchema: ScenePromptDataSchema,
    jsonSchema: request.jsonSchema,
  }, request.model, {
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrency: options.concurrency,
    workId: `comic-scene:${request.sceneSlug}`,
    unitIndex: request.attempt - 1,
  })
  return {
    text,
    inputTokens: metadata.inputTokenCount,
    outputTokens: metadata.outputTokenCount,
    returnedModel: metadata.providerReturnedModel ?? metadata.llmModel,
  }
}

const resolvePanelCountContract = async (
  options: GenerateSceneJsonOptions,
  structuredScriptPath: string,
  planStructuredScript: Awaited<ReturnType<typeof parseJsonFile<typeof StructuredScriptDataSchema>>> | undefined,
): Promise<ScenePanelCountContract | undefined> => {
  if (options.panelCount === undefined) return undefined
  const structuredScript = planStructuredScript ?? await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
  return buildPanelCountContract(structuredScript, options.panelCount, structuredScriptPath)
}

export const prepareSceneDraft = async (sceneSlug: string, options: GenerateSceneJsonOptions) => {
  const filePath = getDraftPromptPath(sceneSlug)
  const content = await Bun.file(filePath).text()

  if (!content.trim()) {
    comicLog.line(`Skipping empty draft prompt bundle: ${sceneSlug}`)
    return undefined
  }

  const catalog = loadCharacterCatalog()
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  const blockingPlan = options.blocking === false ? undefined : await readBlockingPlanIfPresent(sceneSlug)
  if (blockingPlan) {
    const structuredScriptSha256 = sha256Bytes(new Uint8Array(await Bun.file(structuredScriptPath).arrayBuffer()))
    if (blockingPlan.plan.structuredScriptSha256 !== structuredScriptSha256) {
      throw ValidationError(`Blocking plan at ${blockingPlan.planPath} was drafted against a different structured script; run "bun autoshow comic draft-scenes <script-path> --only blocking --rebind" first.`, { stage: STAGE })
    }
  }
  const planStructuredScript = blockingPlan ? await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema) : undefined
  const segmentOrder = planStructuredScript?.sourceSegments.map(segment => segment.id)
  const sceneJsonSchema = buildSceneJsonSchema(catalog.characterKeys, blockingPlan
    ? {
      cameraSetupIds: blockingPlan.plan.cameraSetups.map(camera => camera.id),
      stageStateIds: blockingPlan.plan.stageStates.map(state => state.id),
      segmentIds: segmentOrder,
    }
    : {})
  const planPrompt = blockingPlan ? appendScenePlanSection(content, blockingPlan.plan) : stripScenePlanSection(content)
  const panelCountContract = await resolvePanelCountContract(options, structuredScriptPath, planStructuredScript)
  const basePrompt = panelCountContract ? appendPanelCountSection(planPrompt, panelCountContract) : planPrompt
  const requestScene = options.requestScene ?? requestSceneFromProvider(options)
  const maxAttempts = blockingPlan || panelCountContract ? SCENE_DRAFT_MAX_ATTEMPTS_WITH_PLAN : 1
  return { catalog, structuredScriptPath, blockingPlan, planStructuredScript, segmentOrder, sceneJsonSchema, basePrompt, requestScene, maxAttempts, panelCountContract }
}

export type SceneDraftPreparation = NonNullable<Awaited<ReturnType<typeof prepareSceneDraft>>>
