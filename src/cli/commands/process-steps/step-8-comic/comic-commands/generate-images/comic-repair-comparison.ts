import type { PanelBundleData, RepairCandidateComparisonJudgment, RepairCandidateComparisonRequest, RepairCandidateComparisonResponse } from '~/types'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { InfraError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { decideRevisionPromotion, normalizeRevisionComparison, parseRevisionComparison, REVISION_COMPARISON_SCHEMA } from './revision-evaluation'
import { resolveComicQaProvider } from './comic-page-qa'

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'
const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')
const imageDataUrl = async (path: string): Promise<string> => `data:${imageMimeType(path)};base64,${await imageBase64(path)}`

export const buildComicRepairComparisonPrompt = (input: {
  pass: 1 | 2
  targetedFinding: string
  targetedCorrection: string
  preservationRequirements?: string[]
  panelData: PanelBundleData
  blockingOnlyCorrection?: boolean
}): string => [
  'Blindly compare Image A and Image B as alternate renderings of the same reviewed comic panel. Do not assume the first image is the original.',
  `QA finding that triggered the edit: ${input.targetedFinding}`,
  `Only requested correction: ${input.targetedCorrection}`,
  `Explicit frozen preservation requirements: ${input.preservationRequirements?.length ? input.preservationRequirements.join('; ') : 'none beyond avoiding newly introduced regressions'}`,
  'After Image A and Image B, all remaining images are immutable canonical character, location, and design references in contract order.',
  'First determine the targeted DEFECT status independently in A and B. targetedDefectStatusImageA and targetedDefectStatusImageB report whether the defect itself is visible: visible means the defect exists in that image, partly-visible means some of the defect exists, and not-visible means the defect is absent. targetedDefectLowerIn names the image with less of the defect, or neither when severity is equal or not assessable. The same coarse status may still have different severity—for example both images may be partly-visible while one has less of the defect—so name that image when the visual evidence supports a real within-category improvement.',
  input.blockingOnlyCorrection === true
    ? 'The only requested correction is a blocking-ledger finding: a listed character\'s screen side, depth order, posture, facing, wardrobe, or presence on stage. The corresponding character pose, position, and placement change is the target change itself, so never report it as non-target drift; judge drift on crop, camera, composition, identity, object placement, background architecture, lighting, and every other element instead.'
    : 'Every element outside the only requested correction, character pose and position included, is non-target and must be judged as drift.',
  'Independently audit change outside the only requested correction. nonTargetDifferenceLevel is none only when the rest of the pair is visually preserved, minor only for immaterial antialiasing, texture, or tiny paint drift, and major when crop, camera, composition, character pose/position/identity, object placement, background architecture, lighting, or another meaningful non-target element changes. List every observed non-target change in nonTargetDifferences; none requires an empty list, while minor or major requires evidence. Judge only the explicit frozen preservation requirements separately for A and B. A defect already present to the same degree in both images is pre-existing evidence, not a regression introduced by either image: list the same evidence for both images and do not use it to favor or disqualify one. If the explicit list is empty, set both preservationRequirementsSatisfied fields true. A full-contract preference cannot excuse major non-target drift or a newly introduced preservation failure.',
  'Then decide whether the targeted difference matters to panel reading, whether either image newly worsens any correct cast, identity, dialogue, action, staging, composition, or major set anchor, and which image better satisfies the full reviewed contract. Do not prefer an image merely because it is prettier or more polished.',
  'A candidate is not a win when the issue was not directly visible in the original, the change is marginal, the images are effectively equivalent, the preference is uncertain, or the correction creates a different contract failure.',
  `This is order-swapped comparison pass ${input.pass} of 2. Evaluate only the supplied order and return only the required JSON.`,
  `Reviewed full panel contract:\n${JSON.stringify(input.panelData)}`,
].join('\n\n')

export const requestComicRepairComparison = async (request: RepairCandidateComparisonRequest): Promise<RepairCandidateComparisonResponse> => {
  const provider = resolveComicQaProvider(request.model)
  if (provider === 'openai') {
    const response = await createOpenAIResponse(getOpenAIClientConfig(), {
      model: request.model,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: request.prompt },
        ...(await Promise.all(request.imagePaths.map(async path => ({ type: 'input_image', image_url: await imageDataUrl(path), detail: 'high' as const })))),
      ] }],
      text: { verbosity: 'low', format: { type: 'json_schema', name: 'comic_repair_comparison_v4', schema: REVISION_COMPARISON_SCHEMA, strict: true } },
    })
    const text = extractOpenAIResponseText(response)
    if (!text) throw InfraError('Comic repair comparison returned no structured text.', { stage: 'comic:repair-comparison' })
    const usage = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
    return {
      text,
      inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0,
      outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : 0,
    }
  }

  const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:repair-comparison', description: 'Comic repair candidate comparison' }), {
    model: request.model,
    contents: geminiUserContent([{ text: request.prompt }, ...(await Promise.all(request.imagePaths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } }))))]),
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: REVISION_COMPARISON_SCHEMA },
  })
  if (!response.text) throw InfraError('Comic repair comparison returned no structured text.', { stage: 'comic:repair-comparison' })
  return {
    text: response.text,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  }
}

export const parseComicRepairComparison = (text: string, pass: 1 | 2): RepairCandidateComparisonJudgment => normalizeRevisionComparison(parseRevisionComparison(text), pass)

export const decideComicRepairCandidate = (judgments: RepairCandidateComparisonJudgment[]): { decision: 'clear-winner' | 'retain-original' | 'incomplete'; reason: string } => {
  const base = decideRevisionPromotion('medium', judgments)
  if (base.decision !== 'clear-winner') return base
  if (!judgments.every(judgment => judgment.confidence === 'high')) return { decision: 'retain-original', reason: 'Both comparison passes must have high confidence before a repair can replace the original.' }
  return base
}
