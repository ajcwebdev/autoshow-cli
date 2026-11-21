import type { GenerateSceneJsonOptions, SceneDraftRequest, SceneDraftResponse } from '~/types'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { buildSceneJsonSchema, ScenePromptDataSchema } from '../../schemas/schemas'
import { readPreparedScenePair } from './prepare-scene'
import { SCENE_DRAFT_MAX_ATTEMPTS_WITH_PANEL_COUNT } from './scene-draft-defaults'
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

export const prepareSceneDraft = async (sceneSlug: string, options: GenerateSceneJsonOptions) => {
  const { structuredScript, structuredScriptPath, draftPrompt } = await readPreparedScenePair(sceneSlug)
  const catalog = loadCharacterCatalog()
  const sceneJsonSchema = buildSceneJsonSchema(catalog.characterKeys)
  const panelCountContract = options.panelCount === undefined ? undefined : buildPanelCountContract(structuredScript, options.panelCount, structuredScriptPath)
  const basePrompt = panelCountContract ? appendPanelCountSection(draftPrompt, panelCountContract) : draftPrompt
  const requestScene = options.requestScene ?? requestSceneFromProvider(options)
  const maxAttempts = panelCountContract ? SCENE_DRAFT_MAX_ATTEMPTS_WITH_PANEL_COUNT : 1
  return { catalog, structuredScript, sceneJsonSchema, basePrompt, requestScene, maxAttempts, panelCountContract }
}

export type SceneDraftPreparation = Awaited<ReturnType<typeof prepareSceneDraft>>
