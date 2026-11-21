import * as v from 'valibot'
import { ValidationError } from '~/utils/error-handler'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { validateSceneSourceSegmentCoverage } from '../../comic-utils/source-coverage-utils'
import { ScenePromptDataSchema, validateSceneCharacters } from '../../schemas/schemas'
import { SCENE_DRAFT_RETRY_HEADER, STAGE } from './scene-draft-defaults'
import type { SceneDraftPreparation } from './scene-draft-preparation'
import { persistInvalidSceneCandidate } from './scene-draft-publication'
import { validatePanelCount } from './scene-panel-count-contract'

const parseSceneJsonResponse = (content: string): unknown => JSON.parse(extractLlmJsonPayload(content, STAGE))

const stripPanelSpeechToneNulls = (panel: unknown): void => {
  if (!(panel && typeof panel === 'object' && 'speech' in panel && Array.isArray(panel.speech))) return
  for (const item of panel.speech) {
    if (item && typeof item === 'object' && 'tone' in item && item.tone === null) {
      delete item.tone
    }
  }
}

const stripSpeechToneNulls = (parsed: unknown): void => {
  if (!(parsed && typeof parsed === 'object' && 'panels' in parsed && Array.isArray(parsed.panels))) return
  for (const panel of parsed.panels) stripPanelSpeechToneNulls(panel)
}

const PANEL_COUNT_RETRY_GUIDANCE = 'The previous scene JSON did not honour the panel count contract. Fix every issue below by returning exactly the required number of panels, one per authored panel note in order, each citing its authored panel-note segment, then return the complete corrected scene JSON.'

export const buildSceneDraftRetryPrompt = (basePrompt: string, issues: readonly string[]): string =>
  `${basePrompt}\n\n${SCENE_DRAFT_RETRY_HEADER}\n${PANEL_COUNT_RETRY_GUIDANCE}\n- ${issues.join('\n- ')}`

export const validateSceneDraftCandidate = async (content: string, sceneSlug: string, attempt: number, prepared: SceneDraftPreparation) => {
  const { catalog, structuredScript, maxAttempts, panelCountContract } = prepared
  const parsed = parseSceneJsonResponse(content)
  stripSpeechToneNulls(parsed)

  let validated: v.InferOutput<typeof ScenePromptDataSchema>
  let retryIssues: string[] | undefined
  try {
    validated = v.parse(ScenePromptDataSchema, parsed)
    validateSceneCharacters(validated, catalog)
    validateSceneSourceSegmentCoverage(validated, structuredScript.sourceSegments)
    await validateSceneRecapMontageExpansion(validated, structuredScript)
    const issues = panelCountContract ? validatePanelCount(validated, panelCountContract) : []
    if (issues.length > 0) {
      if (attempt >= maxAttempts) {
        throw ValidationError(`Scene JSON for ${sceneSlug} missed the panel count contract after ${attempt} attempt${attempt === 1 ? '' : 's'}:\n- ${issues.join('\n- ')}`, { stage: STAGE })
      }
      retryIssues = issues
    }
  } catch (validationError) {
    await persistInvalidSceneCandidate(sceneSlug, parsed, validationError)
    throw validationError
  }
  return { validated, retryIssues }
}
