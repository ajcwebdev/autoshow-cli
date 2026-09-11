import type { ComicLlmResponseUsage, DraftSceneRunStats, GenerateSceneJsonOptions, SceneDraftRetryReason } from '~/types'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { buildSceneDraftRetryPrompt, describeSceneDraftRetryReason, validateSceneDraftCandidate } from './scene-draft-candidate-validation'
import { prepareSceneDraft } from './scene-draft-preparation'
import { publishSceneDraft } from './scene-draft-publication'

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
    const prepared = await prepareSceneDraft(sceneSlug, options)
    if (!prepared) return stats
    const { sceneJsonSchema, basePrompt, requestScene, maxAttempts } = prepared

    const usage: ComicLlmResponseUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
    let reviewModel: string = options.model
    let requestDurationMs = 0
    let previousIssues: string[] = []
    let previousReason: SceneDraftRetryReason = 'blocking'

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const prompt = previousIssues.length > 0 ? buildSceneDraftRetryPrompt(basePrompt, previousIssues, previousReason) : basePrompt
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

      const { validated, retryIssues, retryReason } = await validateSceneDraftCandidate(response.text, sceneSlug, attempt, prepared)

      if (retryIssues) {
        previousIssues = retryIssues
        previousReason = retryReason ?? 'blocking'
        comicLog.line(`Scene draft attempt ${attempt} ${describeSceneDraftRetryReason(previousReason)}; retrying once with ${retryIssues.length} issue${retryIssues.length === 1 ? '' : 's'} appended`)
        continue
      }

      await publishSceneDraft(sceneSlug, validated, stats, reviewModel, usage, requestDurationMs, prepared.blockingPlan, attempt)
      return stats
    }
  } catch (error) {
    err(`Failed to generate scene JSON for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }

  return stats
}

export { SCENE_DRAFT_MAX_ATTEMPTS_WITH_PLAN, SCENE_DRAFT_RETRY_HEADER } from './scene-draft-defaults'

export { buildSceneDraftRetryPrompt } from './scene-draft-candidate-validation'
