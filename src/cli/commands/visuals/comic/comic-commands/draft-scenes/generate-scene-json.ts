import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { ComicLlmResponseUsage, DraftSceneRunStats, GenerateSceneJsonOptions, SceneDraftRequest, SceneDraftResponse } from '~/types'
import { buildSceneJsonSchema, ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters } from '../../schemas/schemas'
import { stripSceneBlockingNulls } from '../../schemas/blocking-plan-schemas'
import { appendScenePlanSection, parseJsonFile, readBlockingPlanIfPresent, stripScenePlanSection } from '../../comic-utils/json-prompt-utils'
import { comicLog, err, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import {
getDraftPromptPath,
getInvalidSceneJsonPath,
getSceneJsonPath,
getStructuredScriptPath,
} from '../../comic-utils/project-paths'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { validateSceneSourceSegmentCoverage } from '../../comic-utils/source-coverage-utils'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { validateScenePanelBlocking } from '../../comic-utils/blocking-plan-validation'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'

const STAGE = 'comic:draft-scenes'

export const SCENE_DRAFT_MAX_ATTEMPTS_WITH_PLAN = 2

export const SCENE_DRAFT_RETRY_HEADER = '## Validation errors from the previous attempt'

const parseSceneJsonResponse = (
  content: string,
  options: { lenient: boolean }
): unknown => {
  return JSON.parse(options.lenient ? extractLlmJsonPayload(content, STAGE) : content)
}

const stripSpeechToneNulls = (parsed: unknown): void => {
  if (parsed && typeof parsed === 'object' && 'panels' in parsed && Array.isArray(parsed.panels)) {
    for (const panel of parsed.panels) {
      if (
        panel
        && typeof panel === 'object'
        && 'speech' in panel
        && Array.isArray(panel.speech)
      ) {
        for (const item of panel.speech) {
          if (item && typeof item === 'object' && 'tone' in item && item.tone === null) {
            delete item.tone
          }
        }
      }
    }
  }
}

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

export const buildSceneDraftRetryPrompt = (basePrompt: string, issues: readonly string[]): string =>
  `${basePrompt}\n\n${SCENE_DRAFT_RETRY_HEADER}\nThe previous scene JSON contradicted the blocking plan geometry. Fix every issue below by choosing a camera setup that sees exactly the listed cast, listing every on-stage character that camera sees, declaring deliberate crops in croppedOnStage, or citing an axisBreak, then return the complete corrected scene JSON.\n- ${issues.join('\n- ')}`

export const generateSceneJson = async (
  sceneSlug: string,
  options: GenerateSceneJsonOptions
): Promise<DraftSceneRunStats> => {
  const stats: DraftSceneRunStats = {
    filesProcessed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalDurationMs: 0
  }

  try {
    const filePath = getDraftPromptPath(sceneSlug)
    const content = await Bun.file(filePath).text()

    if (!content.trim()) {
      comicLog.line(`Skipping empty draft prompt bundle: ${sceneSlug}`)
      return stats
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
    const basePrompt = blockingPlan ? appendScenePlanSection(content, blockingPlan.plan) : stripScenePlanSection(content)
    const requestScene = options.requestScene ?? requestSceneFromProvider(options)
    const maxAttempts = blockingPlan ? SCENE_DRAFT_MAX_ATTEMPTS_WITH_PLAN : 1

    const usage: ComicLlmResponseUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
    let reviewModel: string = options.model
    let requestDurationMs = 0
    let previousIssues: string[] = []

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const prompt = previousIssues.length > 0 ? buildSceneDraftRetryPrompt(basePrompt, previousIssues) : basePrompt
      const requestStart = Date.now()
      const response = await requestScene({ prompt, schemaName: sceneJsonSchema.name, jsonSchema: sceneJsonSchema.schema, model: options.model, attempt, sceneSlug })
      const attemptDurationMs = Date.now() - requestStart
      requestDurationMs += attemptDurationMs

      usage.input_tokens += response.inputTokens ?? 0
      usage.output_tokens += response.outputTokens ?? 0
      usage.total_tokens = usage.input_tokens + usage.output_tokens
      reviewModel = response.returnedModel ?? options.model
      stats.totalInputTokens += response.inputTokens ?? 0
      stats.totalOutputTokens += response.outputTokens ?? 0
      stats.totalCost += estimateLlmCostFromRegistry(options.model, response.inputTokens ?? 0, response.outputTokens ?? 0)
      stats.totalDurationMs += attemptDurationMs

      const parsed = parseSceneJsonResponse(response.text, { lenient: true })
      stripSpeechToneNulls(parsed)
      stripSceneBlockingNulls(parsed)

      let validated: v.InferOutput<typeof ScenePromptDataSchema>
      let retryIssues: string[] | undefined
      try {
        validated = v.parse(ScenePromptDataSchema, parsed)
        validateSceneCharacters(validated, catalog)
        const structuredScript = planStructuredScript ?? await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
        validateSceneSourceSegmentCoverage(validated, structuredScript.sourceSegments)
        await validateSceneRecapMontageExpansion(validated, structuredScript)
        if (blockingPlan) {
          const issues = validateScenePanelBlocking(blockingPlan.plan, validated.panels, { segmentOrder }).map(issue => issue.message)
          if (issues.length > 0) {
            if (attempt < maxAttempts) {
              retryIssues = issues
            } else {
              throw ValidationError(`Scene JSON for ${sceneSlug} contradicts the blocking plan after ${attempt} attempt${attempt === 1 ? '' : 's'}:\n- ${issues.join('\n- ')}`, { stage: STAGE })
            }
          } else {
            validated.blockingPlanSha256 = blockingPlan.planSha256
          }
        }
      } catch (validationError) {
        const invalidOutputPath = getInvalidSceneJsonPath(sceneSlug)
        try {
          await mkdir(dirname(invalidOutputPath), { recursive: true })
          await Bun.write(invalidOutputPath, JSON.stringify({
            schemaVersion: 4,
            validationError: validationError instanceof Error ? validationError.message : String(validationError),
            output: parsed,
          }, null, 2))
          comicLog.line(`Saved invalid scene draft candidate: ${invalidOutputPath}`)
        } catch (writeError) {
          comicLog.line(
            `Could not save invalid scene draft candidate: ${
              writeError instanceof Error ? writeError.message : String(writeError)
            }`
          )
        }
        throw validationError
      }

      if (retryIssues) {
        previousIssues = retryIssues
        comicLog.line(`Scene draft attempt ${attempt} contradicts the blocking plan; retrying once with ${retryIssues.length} issue${retryIssues.length === 1 ? '' : 's'} appended`)
        continue
      }

      const outputPath = getSceneJsonPath(sceneSlug)
      await mkdir(dirname(outputPath), { recursive: true })
      await Bun.write(outputPath, JSON.stringify(validated, null, 2))

      stats.filesProcessed++
      comicLog.line('scene-json generated', [
        `file=${basename(outputPath)}`,
        `model=${reviewModel}`,
        `tokens=${usage.total_tokens.toLocaleString()}`,
        `cost=${formatCompactCost(stats.totalCost)}`,
        `api=${formatDuration(requestDurationMs)}`,
        blockingPlan ? `attempts=${attempt}` : undefined,
        blockingPlan ? `blockingPlan=${blockingPlan.planSha256.slice(0, 12)}` : undefined,
      ])
      return stats
    }
  } catch (error) {
    err(`Failed to generate scene JSON for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }

  return stats
}
