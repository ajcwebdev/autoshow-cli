import * as v from 'valibot'
import { ValidationError } from '~/utils/error-handler'
import { validateScenePanelBlocking } from '../../comic-utils/blocking-plan-validation'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { validateSceneSourceSegmentCoverage } from '../../comic-utils/source-coverage-utils'
import { stripSceneBlockingNulls } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters } from '../../schemas/schemas'
import { SCENE_DRAFT_RETRY_HEADER, STAGE } from './scene-draft-defaults'
import type { SceneDraftPreparation } from './scene-draft-preparation'
import { persistInvalidSceneCandidate } from './scene-draft-publication'

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

export const buildSceneDraftRetryPrompt = (basePrompt: string, issues: readonly string[]): string =>
  `${basePrompt}\n\n${SCENE_DRAFT_RETRY_HEADER}\nThe previous scene JSON contradicted the blocking plan geometry. Fix every issue below by choosing a camera setup that sees exactly the listed cast, listing every on-stage character that camera sees, declaring deliberate crops in croppedOnStage, or citing an axisBreak, then return the complete corrected scene JSON.\n- ${issues.join('\n- ')}`

export const validateSceneDraftCandidate = async (content: string, sceneSlug: string, attempt: number, prepared: SceneDraftPreparation) => {
  const { catalog, structuredScriptPath, blockingPlan, planStructuredScript, segmentOrder, maxAttempts } = prepared
  const parsed = parseSceneJsonResponse(content, { lenient: true })
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
    await persistInvalidSceneCandidate(sceneSlug, parsed, validationError)
    throw validationError
  }
  return { validated, retryIssues }
}
