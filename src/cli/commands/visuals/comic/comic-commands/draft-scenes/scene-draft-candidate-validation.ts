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
import { validatePanelCount } from './scene-panel-count-contract'
import type { SceneDraftRetryReason } from '~/types'

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

const RETRY_GUIDANCE: Record<SceneDraftRetryReason, string> = {
  blocking: 'The previous scene JSON contradicted the blocking plan geometry. Fix every issue below by choosing a camera setup that sees exactly the listed cast, listing every on-stage character that camera sees, declaring deliberate crops in croppedOnStage, or citing an axisBreak, then return the complete corrected scene JSON.',
  'panel-count': 'The previous scene JSON did not honour the panel count contract. Fix every issue below by returning exactly the required number of panels, one per authored panel note in order, each citing its authored panel-note segment, then return the complete corrected scene JSON.',
  both: 'The previous scene JSON contradicted the blocking plan geometry and did not honour the panel count contract. Fix every issue below, keeping exactly the required number of panels in authored order and choosing camera setups that see exactly the listed cast, then return the complete corrected scene JSON.',
}

export const describeSceneDraftRetryReason = (reason: SceneDraftRetryReason): string =>
  reason === 'panel-count' ? 'missed the panel count contract' : reason === 'both' ? 'contradicts the blocking plan and missed the panel count contract' : 'contradicts the blocking plan'

export const buildSceneDraftRetryPrompt = (basePrompt: string, issues: readonly string[], reason: SceneDraftRetryReason = 'blocking'): string =>
  `${basePrompt}\n\n${SCENE_DRAFT_RETRY_HEADER}\n${RETRY_GUIDANCE[reason]}\n- ${issues.join('\n- ')}`

export const validateSceneDraftCandidate = async (content: string, sceneSlug: string, attempt: number, prepared: SceneDraftPreparation) => {
  const { catalog, structuredScriptPath, blockingPlan, planStructuredScript, segmentOrder, maxAttempts, panelCountContract } = prepared
  const parsed = parseSceneJsonResponse(content, { lenient: true })
  stripSpeechToneNulls(parsed)
  stripSceneBlockingNulls(parsed)

  let validated: v.InferOutput<typeof ScenePromptDataSchema>
  let retryIssues: string[] | undefined
  let retryReason: SceneDraftRetryReason | undefined
  try {
    validated = v.parse(ScenePromptDataSchema, parsed)
    validateSceneCharacters(validated, catalog)
    const structuredScript = planStructuredScript ?? await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
    validateSceneSourceSegmentCoverage(validated, structuredScript.sourceSegments)
    await validateSceneRecapMontageExpansion(validated, structuredScript)
    const panelCountIssues = panelCountContract ? validatePanelCount(validated, panelCountContract) : []
    const blockingIssues = blockingPlan ? validateScenePanelBlocking(blockingPlan.plan, validated.panels, { segmentOrder }).map(issue => issue.message) : []
    const issues = [...panelCountIssues, ...blockingIssues]
    if (issues.length > 0) {
      const reason: SceneDraftRetryReason = panelCountIssues.length > 0 && blockingIssues.length > 0 ? 'both' : panelCountIssues.length > 0 ? 'panel-count' : 'blocking'
      if (attempt < maxAttempts) {
        retryIssues = issues
        retryReason = reason
      } else {
        throw ValidationError(`Scene JSON for ${sceneSlug} ${describeSceneDraftRetryReason(reason)} after ${attempt} attempt${attempt === 1 ? '' : 's'}:\n- ${issues.join('\n- ')}`, { stage: STAGE })
      }
    } else if (blockingPlan) {
      validated.blockingPlanSha256 = blockingPlan.planSha256
    }
  } catch (validationError) {
    await persistInvalidSceneCandidate(sceneSlug, parsed, validationError)
    throw validationError
  }
  return { validated, retryIssues, retryReason }
}
