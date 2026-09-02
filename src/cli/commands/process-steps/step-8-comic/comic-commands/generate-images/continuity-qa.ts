import { basename } from 'node:path'
import * as v from 'valibot'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { resolveCredential } from '~/utils/validate/env-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { resolveComicQaProvider } from './comic-page-qa'
import type { ContinuityDownscaledImage, ContinuityHardKey, ContinuityJudgeDependencies, ContinuityJudgeEntry, ContinuityJudgeImage, ContinuityJudgeImagePlan, ContinuityJudgeImageSummary, ContinuityJudgeRequest, ContinuityJudgeResult, ContinuityJudgeResultExpectation } from '~/types'

export const CONTINUITY_QA_SCHEMA_VERSION = 1 as const
export const CONTINUITY_QA_JSON_SCHEMA_NAME = 'comic_continuity_qa_v1'
export const CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL = 9000
export const CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL = 1500
export const CONTINUITY_JUDGE_DOWNSCALE_WIDTH = 768

export const CONTINUITY_HARD_KEYS = ['side-flip', 'seat-swap', 'furniture-spin', 'intruder', 'vanishing-crowd', 'wardrobe-swap'] as const
export const CONTINUITY_BLOOPER_CATEGORIES = [...CONTINUITY_HARD_KEYS, 'none'] as const
export const CONTINUITY_AXIS_STATUSES = ['consistent', 'crossed', 'not-assessable'] as const
export const CONTINUITY_CAST_STATUSES = ['present', 'intruding', 'vanished', 'not-assessable'] as const
export const CONTINUITY_SCREEN_SIDES = ['left', 'center', 'right', 'not-visible'] as const
export const CONTINUITY_FURNITURE_STATUSES = ['same', 'rotated', 'mirrored', 'redesigned', 'not-assessable'] as const
export const CONTINUITY_REPAIR_ROUTES = ['none', 'edit', 'restart', 'redraft'] as const

const HARD_FURNITURE_STATUSES: ReadonlySet<string> = new Set(['rotated', 'mirrored', 'redesigned'])

export const CONTINUITY_BLOCKING_LABEL_SENTENCE = 'Human reviewers use the labels "incorrect character blocking" and "incorrect background characters" for the same defect class: a character on the wrong screen side, seat, or mark, or a roster character drawn where the panel contract excludes them. Classify that class through blooperCategory and castAudit rather than treating the two labels as different defects.'

const integer = () => v.pipe(v.number(), v.integer())

export const ContinuityJudgeResultSchema = v.strictObject({
  panelNumber: integer(),
  anchorPanel: integer(),
  predecessorPanel: v.nullable(integer()),
  axisStatus: v.picklist(CONTINUITY_AXIS_STATUSES),
  castAudit: v.array(v.strictObject({
    characterKey: v.string(),
    status: v.picklist(CONTINUITY_CAST_STATUSES),
    note: v.string(),
  })),
  characters: v.array(v.strictObject({
    characterKey: v.string(),
    screenSide: v.picklist(CONTINUITY_SCREEN_SIDES),
    posture: v.string(),
    relativePlacement: v.string(),
    wardrobe: v.string(),
  })),
  furnitureOrientation: v.strictObject({
    versusAnchor: v.picklist(CONTINUITY_FURNITURE_STATUSES),
    versusPredecessor: v.picklist(CONTINUITY_FURNITURE_STATUSES),
  }),
  observedStageState: v.string(),
  blooperCategory: v.picklist(CONTINUITY_BLOOPER_CATEGORIES),
  repairRoute: v.picklist(CONTINUITY_REPAIR_ROUTES),
  notes: v.string(),
})

export const CONTINUITY_QA_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    panelNumber: { type: 'integer' },
    anchorPanel: { type: 'integer' },
    predecessorPanel: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    axisStatus: { type: 'string', enum: [...CONTINUITY_AXIS_STATUSES] },
    castAudit: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      characterKey: { type: 'string' }, status: { type: 'string', enum: [...CONTINUITY_CAST_STATUSES] }, note: { type: 'string' },
    }, required: ['characterKey', 'status', 'note'] } },
    characters: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      characterKey: { type: 'string' }, screenSide: { type: 'string', enum: [...CONTINUITY_SCREEN_SIDES] }, posture: { type: 'string' }, relativePlacement: { type: 'string' }, wardrobe: { type: 'string' },
    }, required: ['characterKey', 'screenSide', 'posture', 'relativePlacement', 'wardrobe'] } },
    furnitureOrientation: { type: 'object', additionalProperties: false, properties: {
      versusAnchor: { type: 'string', enum: [...CONTINUITY_FURNITURE_STATUSES] }, versusPredecessor: { type: 'string', enum: [...CONTINUITY_FURNITURE_STATUSES] },
    }, required: ['versusAnchor', 'versusPredecessor'] },
    observedStageState: { type: 'string' },
    blooperCategory: { type: 'string', enum: [...CONTINUITY_BLOOPER_CATEGORIES] },
    repairRoute: { type: 'string', enum: [...CONTINUITY_REPAIR_ROUTES] },
    notes: { type: 'string' },
  },
  required: ['panelNumber', 'anchorPanel', 'predecessorPanel', 'axisStatus', 'castAudit', 'characters', 'furnitureOrientation', 'observedStageState', 'blooperCategory', 'repairRoute', 'notes'],
} as const

const describeIssues = (error: unknown): string => {
  if (v.isValiError(error)) {
    return error.issues.map(issue => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`).join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}

export const parseContinuityJudgeResult = (text: string, expected: ContinuityJudgeResultExpectation): ContinuityJudgeResult => {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw ValidationError(`Continuity judge returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:continuity-qa', ...(error instanceof Error ? { cause: error } : {}) })
  }
  let parsed: ContinuityJudgeResult
  try { parsed = v.parse(ContinuityJudgeResultSchema, value) } catch (error) {
    throw ValidationError(`Continuity judge result has missing, unexpected, or invalid fields: ${describeIssues(error)}`, { stage: 'comic:continuity-qa', ...(error instanceof Error ? { cause: error } : {}) })
  }
  if (!parsed.observedStageState.trim()) throw ValidationError('Continuity judge result has an empty observedStageState.', { stage: 'comic:continuity-qa' })
  if (parsed.castAudit.some(item => !item.characterKey.trim())) throw ValidationError('Continuity judge castAudit has an entry without a characterKey.', { stage: 'comic:continuity-qa' })
  if (parsed.characters.some(item => !item.characterKey.trim())) throw ValidationError('Continuity judge characters has an entry without a characterKey.', { stage: 'comic:continuity-qa' })
  return { ...parsed, panelNumber: expected.panelNumber, anchorPanel: expected.anchorPanel, predecessorPanel: expected.predecessorPanel }
}

// Keys the labels join treats as judge positives: only the blooper category and the cast audit imply a key, matching the human verdict vocabulary.
export const deriveContinuityLabelKeys = (result: ContinuityJudgeResult): ContinuityHardKey[] => {
  const keys = new Set<ContinuityHardKey>()
  if (result.blooperCategory !== 'none') keys.add(result.blooperCategory)
  if (result.castAudit.some(item => item.status === 'intruding')) keys.add('intruder')
  if (result.castAudit.some(item => item.status === 'vanished')) keys.add('vanishing-crowd')
  return CONTINUITY_HARD_KEYS.filter(key => keys.has(key))
}

// Keys the ledger counters and per-panel hardKeys carry: the labels-join keys widened by a crossed axis and a rotated, mirrored, or redesigned furniture orientation.
export const deriveContinuityHardKeys = (result: ContinuityJudgeResult): ContinuityHardKey[] => {
  const keys = new Set<ContinuityHardKey>(deriveContinuityLabelKeys(result))
  if (result.axisStatus === 'crossed') keys.add('side-flip')
  const furniture = result.furnitureOrientation.versusAnchor === 'not-assessable' ? result.furnitureOrientation.versusPredecessor : result.furnitureOrientation.versusAnchor
  if (HARD_FURNITURE_STATUSES.has(furniture)) keys.add('furniture-spin')
  return CONTINUITY_HARD_KEYS.filter(key => keys.has(key))
}

export const hasContinuityHardFailure = (result: ContinuityJudgeResult): boolean => deriveContinuityHardKeys(result).length > 0

export const planContinuityJudgeImages = (request: ContinuityJudgeRequest): ContinuityJudgeImagePlan[] => {
  const plan: ContinuityJudgeImagePlan[] = []
  plan.push({ role: 'candidate', label: `the candidate, panel ${request.panelNumber}, at full detail`, characterKey: null, sourcePath: request.panelPath, detail: 'high' })
  const anchorIsCandidate = request.anchorPanel === request.panelNumber
  const predecessorIsAnchor = request.predecessorPanel !== null && request.predecessorPanel === request.anchorPanel
  if (!anchorIsCandidate) {
    plan.push({
      role: 'anchor',
      label: predecessorIsAnchor
        ? `the anchor, panel ${request.anchorPanel}, the trusted reference for this location, which is also the predecessor (downscaled)`
        : `the anchor, panel ${request.anchorPanel}, the trusted reference for this location (downscaled)`,
      characterKey: null,
      sourcePath: request.anchorPath,
      detail: 'low',
    })
  }
  if (request.predecessorPanel !== null && request.predecessorPath !== null && !(predecessorIsAnchor && !anchorIsCandidate)) {
    plan.push({ role: 'predecessor', label: `the predecessor, panel ${request.predecessorPanel} (downscaled)`, characterKey: null, sourcePath: request.predecessorPath, detail: 'low' })
  }
  for (const card of request.castCards) {
    plan.push({ role: 'cast-card', label: `the canonical identity card for characterKey=${card.key}, who is listed in this panel's characterKeys`, characterKey: card.key, sourcePath: card.path, detail: 'high' })
  }
  for (const card of request.absentCards) {
    plan.push({ role: 'absent-card', label: `the canonical identity card for characterKey=${card.key}, who is in the scene roster but absent from this panel's characterKeys and must not appear`, characterKey: card.key, sourcePath: card.path, detail: 'low' })
  }
  return plan
}

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'

export const downscaleImageForContinuityJudge = async (input: ArrayBuffer | Uint8Array, maxWidth: number = CONTINUITY_JUDGE_DOWNSCALE_WIDTH): Promise<ContinuityDownscaledImage> => {
  const source = await new Bun.Image(input).metadata()
  const targetWidth = Math.max(1, Math.min(maxWidth, source.width))
  const targetHeight = Math.max(1, Math.round(source.height * targetWidth / source.width))
  const bytes = await new Bun.Image(input).resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).bytes()
  const output = await new Bun.Image(bytes).metadata()
  return {
    bytes,
    base64: Buffer.from(bytes).toString('base64'),
    mimeType: 'image/jpeg',
    width: output.width,
    height: output.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
  }
}

export const prepareContinuityJudgeImages = async (request: ContinuityJudgeRequest): Promise<ContinuityJudgeImage[]> => {
  const plan = planContinuityJudgeImages(request)
  return await Promise.all(plan.map(async item => {
    const source = await Bun.file(item.sourcePath).arrayBuffer()
    if (item.role === 'anchor' || item.role === 'predecessor') {
      const downscaled = await downscaleImageForContinuityJudge(source)
      return { ...item, mimeType: downscaled.mimeType, base64: downscaled.base64, width: downscaled.width, height: downscaled.height, downscaled: true }
    }
    const metadata = await new Bun.Image(source).metadata()
    return { ...item, mimeType: imageMimeType(item.sourcePath), base64: Buffer.from(source).toString('base64'), width: metadata.width, height: metadata.height, downscaled: false }
  }))
}

export const summarizeContinuityJudgeImages = (images: readonly ContinuityJudgeImage[]): ContinuityJudgeImageSummary[] => images.map(image => {
  const { base64: _base64, ...summary } = image
  return summary
})

export const buildContinuityJudgePrompt = (request: ContinuityJudgeRequest): string => {
  const panel = request.panelData.panels[0]
  if (!panel) throw ValidationError('Continuity judge request is missing its panel payload.', { stage: 'comic:continuity-qa' })
  const plan = planContinuityJudgeImages(request)
  const imageLines = plan.map((item, index) => `Image ${index + 1}: ${item.label}.`)
  const anchorProvenance = request.trustedAnchorPanel === null
    ? `No human trusted-anchor label was supplied, so the scene's first panel of this location, panel ${request.anchorPanel}, is the anchor by default.`
    : request.trustedAnchorPanel === request.anchorPanel
      ? `The anchor panel ${request.anchorPanel} was chosen from the human trusted-anchor label ${request.trustedAnchorPanel}.`
      : `The human trusted-anchor label names panel ${request.trustedAnchorPanel}, which is in a different location, so the scene's first panel of this location, panel ${request.anchorPanel}, is the anchor.`
  const anchorSentence = request.anchorPanel === request.panelNumber
    ? `The candidate is itself the anchor panel ${request.anchorPanel}, so judge it against its predecessor only and set furnitureOrientation.versusAnchor to same unless the predecessor exposes a contradiction. ${anchorProvenance}`
    : anchorProvenance
  const predecessorSentence = request.predecessorPanel === null
    ? `Panel ${request.panelNumber} has no predecessor in its location segment, so set predecessorPanel to null and versusPredecessor to not-assessable.`
    : `The predecessor is panel ${request.predecessorPanel}.`
  const absent = request.absentKeys.length > 0 ? request.absentKeys.join(', ') : 'none'
  return [
    `Audit continuity for panel ${request.panelNumber} of the comic scene "${request.panelData.title}" against the scene's earlier panels. This is an audit-only judgment: report what you observe in the candidate and never assume an image was regenerated, edited, or repaired.`,
    `${imageLines.join(' ')} ${anchorSentence} ${predecessorSentence}`,
    `Panel contract. characterKeys, exact and authoritative: ${panel.characterKeys.length > 0 ? panel.characterKeys.join(', ') : 'none'}. Scene roster, every character who appears somewhere in this scene: ${request.roster.join(', ') || 'none'}. Roster characters absent from this panel who must not appear: ${absent}. Location: ${panel.locationKey}. Shot plan: ${panel.shotPlan} Description: ${panel.description}`,
    `Return these fields. panelNumber, anchorPanel, and predecessorPanel echo the numbers above. axisStatus is consistent when every character visible in both the candidate and the anchor keeps the anchor's left-to-right screen-side arrangement, crossed when two characters visible in both images swapped screen sides without an authored axis break in the shot plan, and not-assessable when fewer than two shared characters are visible or the camera makes screen sides undecidable. castAudit holds exactly one entry per scene roster character: present when the character is listed and visible; intruding when a roster character absent from characterKeys is recognizably drawn, comparing against that character's identity card; vanished when a listed character, or a character the predecessor showed on stage in the same wide or medium-wide framing, is missing without the shot plan cropping them out; not-assessable when the crop or resolution makes it undecidable. characters holds one entry per listed character with screenSide (left, center, right, or not-visible), posture, relativePlacement naming the nearest fixed anchor and neighbours, and wardrobe as seen. furnitureOrientation compares the fixed furniture's orientation and handedness against the anchor and against the predecessor as same, rotated, mirrored, redesigned, or not-assessable. observedStageState is one sentence naming who is on stage, where, and in what posture. blooperCategory is exactly one of side-flip (a character's screen side contradicts the anchor), seat-swap (a seat or posture changed versus the anchor without an authored move), furniture-spin (the furniture orientation contradicts the anchor), intruder (castAudit reports intruding), vanishing-crowd (castAudit reports vanished), wardrobe-swap (a listed character's wardrobe changed versus the anchor or the canonical card without an authored costume deviation), or none; when several apply, choose the most story-visible and keep castAudit, axisStatus, and furnitureOrientation consistent with it. repairRoute is none when nothing is wrong, edit when a bounded local edit could fix the defect without moving anyone, restart when a character must move or a crowd must be restored, and redraft when the panel contract itself is inconsistent. notes holds concise visual evidence.`,
    CONTINUITY_BLOCKING_LABEL_SENTENCE,
    'Judge screen sides in screen space against the anchor panel. A different camera distance, elevation, lens, or crop is desirable shot variation and is not a defect by itself; a swapped screen side, a swapped seat, a spun desk, an unlisted roster character, or a missing on-stage crowd is.',
    `Canonical character catalog descriptions: ${request.characterReferences.length > 0 ? request.characterReferences.map(reference => `${reference.key}: ${reference.description}`).join(' | ') : 'none supplied; rely on the ordered identity cards.'}`,
    `Canonical location specifications: ${request.locationReferences.length > 0 ? request.locationReferences.map(reference => `${reference.key}: ${reference.specification}`).join(' | ') : 'none supplied.'}`,
    'Return only the requested JSON.',
  ].join('\n\n')
}

const requestContinuityJudgment = async (request: ContinuityJudgeRequest): Promise<ContinuityJudgeEntry> => {
  const provider = resolveComicQaProvider(request.model)
  const prompt = buildContinuityJudgePrompt(request)
  const images = await prepareContinuityJudgeImages(request)
  let text: string | undefined
  let inputTokens = 0
  let outputTokens = 0
  if (provider === 'openai') {
    const response = await createOpenAIResponse(getOpenAIClientConfig(), {
      model: request.model,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: prompt },
        ...images.map(image => ({ type: 'input_image', image_url: `data:${image.mimeType};base64,${image.base64}`, detail: image.detail })),
      ] }],
      text: { verbosity: 'low', format: { type: 'json_schema', name: CONTINUITY_QA_JSON_SCHEMA_NAME, schema: CONTINUITY_QA_JSON_SCHEMA, strict: true } },
    })
    text = extractOpenAIResponseText(response)
    const usageObject = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
    inputTokens = typeof usageObject['input_tokens'] === 'number' ? usageObject['input_tokens'] : 0
    outputTokens = typeof usageObject['output_tokens'] === 'number' ? usageObject['output_tokens'] : 0
  } else {
    const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:continuity-qa', description: 'Comic continuity QA' }), {
      model: request.model,
      contents: geminiUserContent([
        { text: prompt },
        ...images.map(image => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })),
      ]),
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: CONTINUITY_QA_JSON_SCHEMA },
    })
    text = response.text
    inputTokens = response.usageMetadata?.promptTokenCount ?? 0
    outputTokens = (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0)
  }
  if (!text) throw InfraError('Continuity judge returned no structured text.', { stage: 'comic:continuity-qa' })
  const result = parseContinuityJudgeResult(text, { panelNumber: request.panelNumber, anchorPanel: request.anchorPanel, predecessorPanel: request.predecessorPanel })
  return buildContinuityJudgeEntry(request, result, images, { inputTokens, outputTokens })
}

export const buildContinuityJudgeEntry = (
  request: Pick<ContinuityJudgeRequest, 'panelNumber' | 'panelPath' | 'anchorPanel' | 'predecessorPanel' | 'model'>,
  result: ContinuityJudgeResult,
  images: readonly ContinuityJudgeImage[] | readonly ContinuityJudgeImageSummary[],
  usage: { inputTokens: number; outputTokens: number },
): ContinuityJudgeEntry => {
  const hardKeys = deriveContinuityHardKeys(result)
  return {
    schemaVersion: CONTINUITY_QA_SCHEMA_VERSION,
    panelNumber: request.panelNumber,
    outputFile: basename(request.panelPath),
    judgeModel: request.model,
    anchorPanel: request.anchorPanel,
    predecessorPanel: request.predecessorPanel,
    hardKeys,
    hardFailure: hardKeys.length > 0,
    result,
    images: images.map(image => {
      const { base64: _base64, ...summary } = image as ContinuityJudgeImage
      return summary
    }),
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.inputTokens + usage.outputTokens, costUsd: estimateLlmCostFromRegistry(request.model, usage.inputTokens, usage.outputTokens) },
  }
}

export const judgePanelContinuity = async (request: ContinuityJudgeRequest, dependencies: ContinuityJudgeDependencies = {}): Promise<ContinuityJudgeEntry> =>
  await (dependencies.judgeContinuity ?? requestContinuityJudgment)(request)
