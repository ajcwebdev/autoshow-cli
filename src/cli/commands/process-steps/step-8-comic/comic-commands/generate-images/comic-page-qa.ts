import { basename, dirname, join } from 'node:path'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { resolveCredential } from '~/utils/validate/env-utils'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { BLOCKING_AUDIT_STATUSES } from '../../schemas/blocking-plan-schemas'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import type { BlockingHardKeyPolicy, PageQaCharacterCue, PageQaEntry, PageQaRepairDecision, PageQaRepairStagnationState, PageQaRequest, PageQaResult, PanelBundleData } from '~/types'

export const PAGE_QA_REPORT_SCHEMA_VERSION = 6

const HARD_SET_CONTINUITY_STATUSES: ReadonlySet<string> = new Set(['missing', 'relocated', 'duplicated', 'mirrored', 'redesigned'])

const ADVISORY_BLOCKING_STATUSES: ReadonlySet<string> = new Set(['on-mark', 'not-assessable'])

const hasHardSetContinuityAuditFailure = (panel: PageQaResult['panels'][number]): boolean =>
  panel.setContinuityAudit.some(item => HARD_SET_CONTINUITY_STATUSES.has(item.status))

const blockingAuditOf = (panel: PageQaResult['panels'][number]): NonNullable<PageQaResult['panels'][number]['blockingAudit']> => panel.blockingAudit ?? []

const hasPolicyBlockingAuditFailure = (panel: PageQaResult['panels'][number], policy: BlockingHardKeyPolicy = []): boolean =>
  blockingAuditOf(panel).some(item => (policy as readonly string[]).includes(item.status))

const hasPolicyAxisSideFailure = (panel: PageQaResult['panels'][number], policy: BlockingHardKeyPolicy = []): boolean =>
  panel.axisSideMatch === false && (policy as readonly string[]).includes('axis-side')

export const PAGE_QA_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    panelStructure: { type: 'object', additionalProperties: false, properties: {
      pass: { type: 'boolean' }, observedPanelCount: { type: 'integer' }, observedPanelOrder: { type: 'array', items: { type: 'integer' } }, issues: { type: 'array', items: { type: 'string' } },
    }, required: ['pass', 'observedPanelCount', 'observedPanelOrder', 'issues'] },
    panels: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      panelNumber: { type: 'integer' }, requiredCastPresent: { type: 'boolean' }, unexpectedCastAbsent: { type: 'boolean' }, identityMatch: { type: 'boolean' }, identityIssueKind: { type: 'string', enum: ['none', 'minor-variance', 'unmistakable-mismatch'] }, locationMatch: { type: 'boolean' }, setContinuityMatch: { type: 'boolean' }, setContinuityAudit: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { anchor: { type: 'string' }, status: { type: 'string', enum: ['present-correctly', 'outside-crop', 'missing', 'relocated', 'duplicated', 'mirrored', 'redesigned'] }, evidence: { type: 'string' } }, required: ['anchor', 'status', 'evidence'] } }, sourcePrecedence: { type: 'boolean' }, shotPlanMatch: { type: 'boolean' }, dialogueAccuracy: { type: 'boolean' }, dialogueIssueKind: { type: 'string', enum: ['none', 'typography-only', 'content'] }, speakerAttribution: { type: 'boolean' }, blockingMatch: { type: 'boolean' }, axisSideMatch: { type: 'boolean' }, blockingAudit: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { subject: { type: 'string' }, status: { type: 'string', enum: [...BLOCKING_AUDIT_STATUSES] }, note: { type: 'string' } }, required: ['subject', 'status', 'note'] } }, artifacts: { type: 'array', items: { type: 'string' } }, visualQualityScore: { type: 'number', minimum: 1, maximum: 10 }, compositionScore: { type: 'number', minimum: 1, maximum: 10 }, issues: { type: 'array', items: { type: 'string' } }, editInstructions: { type: 'string' }, repairAssessment: { type: 'object', additionalProperties: false, properties: { issueVisibility: { type: 'string', enum: ['directly-visible', 'ambiguous', 'not-visible', 'not-assessable'] }, expectedBenefit: { type: 'string', enum: ['meaningful', 'marginal', 'none'] }, editScope: { type: 'string', enum: ['bounded', 'diffuse'] }, editIsolation: { type: 'string', enum: ['isolated-single-region', 'shared-attribute', 'multi-region', 'generative-redraw'] }, collateralRisk: { type: 'string', enum: ['low', 'medium', 'high'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, recommendation: { type: 'string', enum: ['targeted-edit', 'retain-current'] }, preservationRequirements: { type: 'array', items: { type: 'string' } }, rationale: { type: 'string' } }, required: ['issueVisibility', 'expectedBenefit', 'editScope', 'editIsolation', 'collateralRisk', 'confidence', 'recommendation', 'preservationRequirements', 'rationale'] },
    }, required: ['panelNumber', 'requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'identityIssueKind', 'locationMatch', 'setContinuityMatch', 'setContinuityAudit', 'sourcePrecedence', 'shotPlanMatch', 'blockingMatch', 'axisSideMatch', 'blockingAudit', 'dialogueAccuracy', 'dialogueIssueKind', 'speakerAttribution', 'artifacts', 'visualQualityScore', 'compositionScore', 'issues', 'editInstructions', 'repairAssessment'] } },
    summary: { type: 'string' },
  }, required: ['panelStructure', 'panels', 'summary'],
} as const

const dataUrl = async (path: string): Promise<string> => {
  const type = path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${type};base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}`
}

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'

const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

export const resolveComicQaProvider = (model: string): 'openai' | 'gemini' => {
  const service = findRegistryServiceForModel('llm', model)
  if (service !== 'openai' && service !== 'gemini') throw UsageError(`Invalid comic QA model "${model}". Comic QA currently supports OpenAI and Gemini vision-capable LLMs.`)
  return service
}

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && [...keys].sort().every((key, index) => actual[index] === key)
}

export const parseComicPageQaResult = (text: string, expectedPanels: number[]): PageQaResult => {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw ValidationError(`Page QA judge returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:page-qa', ...(error instanceof Error ? { cause: error } : {}) })
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw ValidationError('Page QA result must be an object.', { stage: 'comic:page-qa' })
  if (!hasExactKeys(value as Record<string, unknown>, ['panelStructure', 'panels', 'summary'])) throw ValidationError('Page QA result has missing or unexpected top-level fields.', { stage: 'comic:page-qa' })
  let result = value as PageQaResult
  const structure = result.panelStructure as unknown
  if (!structure || typeof structure !== 'object' || Array.isArray(structure) || !Array.isArray(result.panels) || typeof result.summary !== 'string' || !result.summary.trim()) throw ValidationError('Page QA result is missing required fields.', { stage: 'comic:page-qa' })
  const structureRecord = structure as unknown as Record<string, unknown>
  if (!hasExactKeys(structureRecord, ['pass', 'observedPanelCount', 'observedPanelOrder', 'issues']) || typeof structureRecord['pass'] !== 'boolean' || !Number.isInteger(structureRecord['observedPanelCount']) || !Array.isArray(structureRecord['observedPanelOrder']) || !structureRecord['observedPanelOrder'].every(Number.isInteger) || !Array.isArray(structureRecord['issues']) || !structureRecord['issues'].every(item => typeof item === 'string')) {
    throw ValidationError('Page QA panelStructure is invalid.', { stage: 'comic:page-qa' })
  }
  if (expectedPanels.length === 1 && result.panels.length === 1 && result.panelStructure.observedPanelCount === 1 && result.panelStructure.observedPanelOrder.length === 1) {
    const panelNumber = expectedPanels[0]!
    result = {
      ...result,
      panelStructure: { ...result.panelStructure, observedPanelOrder: [panelNumber] },
      panels: [{ ...result.panels[0]!, panelNumber }],
    }
  }
  if (result.panels.length !== expectedPanels.length || result.panels.some((panel, index) => panel.panelNumber !== expectedPanels[index])) {
    throw ValidationError('Page QA result panels do not exactly match the requested source-panel order.', { stage: 'comic:page-qa' })
  }
  for (const panel of result.panels) {
    if (!panel || typeof panel !== 'object' || !hasExactKeys(panel as unknown as Record<string, unknown>, ['panelNumber', 'requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'identityIssueKind', 'locationMatch', 'setContinuityMatch', 'setContinuityAudit', 'sourcePrecedence', 'shotPlanMatch', 'blockingMatch', 'axisSideMatch', 'blockingAudit', 'dialogueAccuracy', 'dialogueIssueKind', 'speakerAttribution', 'artifacts', 'visualQualityScore', 'compositionScore', 'issues', 'editInstructions', 'repairAssessment'])) {
      throw ValidationError('Page QA panel has missing or unexpected fields.', { stage: 'comic:page-qa' })
    }
    for (const key of ['requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'locationMatch', 'setContinuityMatch', 'sourcePrecedence', 'shotPlanMatch', 'blockingMatch', 'axisSideMatch', 'dialogueAccuracy', 'speakerAttribution'] as const) {
      if (typeof panel[key] !== 'boolean') throw ValidationError(`Page QA panel ${panel.panelNumber} field ${key} must be boolean.`, { stage: 'comic:page-qa' })
    }
    if (!['none', 'minor-variance', 'unmistakable-mismatch'].includes(panel.identityIssueKind) || !['none', 'typography-only', 'content'].includes(panel.dialogueIssueKind)) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid identity or dialogue issue classification.`, { stage: 'comic:page-qa' })
    }
    const validContinuityStatuses = ['present-correctly', 'outside-crop', 'missing', 'relocated', 'duplicated', 'mirrored', 'redesigned']
    if (!Array.isArray(panel.setContinuityAudit) || panel.setContinuityAudit.some(item => !item || typeof item.anchor !== 'string' || !item.anchor.trim() || !validContinuityStatuses.includes(item.status) || typeof item.evidence !== 'string' || !item.evidence.trim())) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid setContinuityAudit.`, { stage: 'comic:page-qa' })
    }
    if (!Array.isArray(panel.blockingAudit) || panel.blockingAudit.some(item => !item || typeof item.subject !== 'string' || !item.subject.trim() || !BLOCKING_AUDIT_STATUSES.includes(item.status as typeof BLOCKING_AUDIT_STATUSES[number]) || typeof item.note !== 'string' || !item.note.trim())) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid blockingAudit.`, { stage: 'comic:page-qa' })
    }
    if (!Array.isArray(panel.artifacts) || !panel.artifacts.every(item => typeof item === 'string') || !Array.isArray(panel.issues) || !panel.issues.every(item => typeof item === 'string') || typeof panel.editInstructions !== 'string' || !Number.isFinite(panel.visualQualityScore) || panel.visualQualityScore < 1 || panel.visualQualityScore > 10 || !Number.isFinite(panel.compositionScore) || panel.compositionScore < 1 || panel.compositionScore > 10) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has invalid artifacts, issues, or advisory scores.`, { stage: 'comic:page-qa' })
    }
    const assessment = panel.repairAssessment
    if (!assessment || typeof assessment !== 'object' || !hasExactKeys(assessment as unknown as Record<string, unknown>, ['issueVisibility', 'expectedBenefit', 'editScope', 'editIsolation', 'collateralRisk', 'confidence', 'recommendation', 'preservationRequirements', 'rationale']) || !['directly-visible', 'ambiguous', 'not-visible', 'not-assessable'].includes(assessment.issueVisibility) || !['meaningful', 'marginal', 'none'].includes(assessment.expectedBenefit) || !['bounded', 'diffuse'].includes(assessment.editScope) || !['isolated-single-region', 'shared-attribute', 'multi-region', 'generative-redraw'].includes(assessment.editIsolation) || !['low', 'medium', 'high'].includes(assessment.collateralRisk) || !['low', 'medium', 'high'].includes(assessment.confidence) || !['targeted-edit', 'retain-current'].includes(assessment.recommendation) || !Array.isArray(assessment.preservationRequirements) || !assessment.preservationRequirements.every(item => typeof item === 'string' && item.trim()) || typeof assessment.rationale !== 'string' || !assessment.rationale.trim()) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid repairAssessment.`, { stage: 'comic:page-qa' })
    }
  }
  return result
}

export const decidePageQaRepairDispatch = (entry: PageQaEntry): { action: 'edit' | 'skip'; reason: string } => {
  if (!entry.hardFailure) return { action: 'skip', reason: 'The current image has no hard QA failure.' }
  if (entry.result.panels.length !== 1) return { action: 'skip', reason: 'Conservative repair-worthiness dispatch is limited to individual-panel images.' }
  const assessment = entry.result.panels[0]?.repairAssessment
  if (!assessment) return { action: 'edit', reason: 'The injected QA entry predates repair-worthiness assessment; preserve legacy dependency behavior.' }
  const objectiveStoryFailure = (
    entry.result.panels[0]?.requiredCastPresent === false
    || entry.result.panels[0]?.unexpectedCastAbsent === false
    || entry.result.panels[0]?.identityIssueKind === 'unmistakable-mismatch'
    || entry.result.panels[0]?.dialogueIssueKind === 'content'
    || entry.result.panels[0]?.speakerAttribution === false
    || entry.result.panels[0]?.sourcePrecedence === false
  )
  const eligibilityBlockers = [
    assessment.issueVisibility !== 'directly-visible' ? `issue visibility is ${assessment.issueVisibility}` : undefined,
    assessment.expectedBenefit !== 'meaningful' && !objectiveStoryFailure ? `expected benefit is ${assessment.expectedBenefit}` : undefined,
    assessment.confidence !== 'high' ? `confidence is ${assessment.confidence}` : undefined,
  ].filter((item): item is string => item !== undefined)
  if (eligibilityBlockers.length > 0) return { action: 'skip', reason: `Repair skipped because ${eligibilityBlockers.join('; ')}. ${assessment.rationale}` }
  const directLane = assessment.editScope === 'bounded' && assessment.editIsolation === 'isolated-single-region' && assessment.collateralRisk === 'low' && assessment.recommendation === 'targeted-edit'
  return directLane
    ? { action: 'edit', reason: 'The defect qualifies for the low-risk targeted-edit lane.' }
    : { action: 'edit', reason: `The defect qualifies for the comparison-protected lane; the candidate remains ineligible unless two order-swapped judgments unanimously find a meaningful regression-free improvement. ${objectiveStoryFailure ? 'Objective story-contract failures override the inconsistent no-benefit label. ' : ''}${assessment.rationale}` }
}

export const applyPageQaTolerancePolicy = (result: PageQaResult): PageQaResult => ({
  ...result,
  panels: result.panels.map(panel => ({
    ...panel,
    identityMatch: panel.identityIssueKind !== 'unmistakable-mismatch',
    dialogueAccuracy: panel.dialogueIssueKind !== 'content',
    ...(hasHardSetContinuityAuditFailure(panel) ? { setContinuityMatch: false } : {}),
    ...(panel.blockingAudit !== undefined ? { blockingMatch: blockingAuditOf(panel).every(item => ADVISORY_BLOCKING_STATUSES.has(item.status)) } : {}),
  })),
})

export const hasHardPageQaFailure = (result: PageQaResult, options: { waiveShotPlanMatch?: boolean; blockingHardKeys?: BlockingHardKeyPolicy } = {}): boolean =>
  !result.panelStructure.pass || result.panels.some(panel =>
    !panel.requiredCastPresent || !panel.unexpectedCastAbsent || panel.identityIssueKind === 'unmistakable-mismatch' || !panel.locationMatch || !panel.setContinuityMatch || hasHardSetContinuityAuditFailure(panel) || !panel.sourcePrecedence || (!options.waiveShotPlanMatch && !panel.shotPlanMatch) || hasPolicyBlockingAuditFailure(panel, options.blockingHardKeys) || hasPolicyAxisSideFailure(panel, options.blockingHardKeys) || panel.dialogueIssueKind === 'content' || !panel.speakerAttribution
  )

export const applyPageQaRepairPolicy = (entry: PageQaEntry, completedRepairRounds: number, blockingHardKeys: BlockingHardKeyPolicy = []): PageQaEntry => {
  void completedRepairRounds
  const { waivedChecks: _waivedChecks, ...withoutWaiver } = entry
  return {
    ...withoutWaiver,
    hardFailure: hasHardPageQaFailure(entry.result, { blockingHardKeys }),
  }
}

export const createPageQaRepairStagnationState = (): PageQaRepairStagnationState => ({
  consecutiveFailures: {},
  restartedFromCanonicalReferences: false,
  bestFailureKeys: [],
  failureSignatures: [],
  attemptsWithoutStrictImprovement: 0,
})

export const getPageQaHardFailureKeys = (entry: PageQaEntry, blockingHardKeys: BlockingHardKeyPolicy = []): string[] => {
  if (!entry.hardFailure) return []
  const failures: string[] = []
  if (!entry.result.panelStructure.pass) failures.push('page:panelStructure')
  for (const panel of entry.result.panels) {
    const prefix = `panel-${panel.panelNumber}:`
    if (!panel.requiredCastPresent) failures.push(`${prefix}requiredCastPresent`)
    if (!panel.unexpectedCastAbsent) failures.push(`${prefix}unexpectedCastAbsent`)
    if (panel.identityIssueKind === 'unmistakable-mismatch') failures.push(`${prefix}identityMatch`)
    if (!panel.locationMatch) failures.push(`${prefix}locationMatch`)
    if (!panel.setContinuityMatch) failures.push(`${prefix}setContinuityMatch`)
    if (hasHardSetContinuityAuditFailure(panel)) failures.push(`${prefix}setContinuityAudit`)
    if (!panel.sourcePrecedence) failures.push(`${prefix}sourcePrecedence`)
    const shotPlanWaived = entry.waivedChecks?.some(check => check.panelNumber === panel.panelNumber && check.check === 'shotPlanMatch') ?? false
    if (!panel.shotPlanMatch && !shotPlanWaived) failures.push(`${prefix}shotPlanMatch`)
    if (hasPolicyBlockingAuditFailure(panel, blockingHardKeys)) failures.push(`${prefix}blockingAudit`)
    if (hasPolicyAxisSideFailure(panel, blockingHardKeys)) failures.push(`${prefix}axisSideMatch`)
    if (panel.dialogueIssueKind === 'content') failures.push(`${prefix}dialogueAccuracy`)
    if (!panel.speakerAttribution) failures.push(`${prefix}speakerAttribution`)
  }
  return failures
}

const BLOCKING_CLASS_FAILURE_KEY_PATTERN = /^panel-\d+:(?:blockingAudit|axisSideMatch)$/
const SPATIAL_FAILURE_KEY_PATTERN = /^panel-\d+:(?:blockingAudit|axisSideMatch|shotPlanMatch|setContinuityMatch|setContinuityAudit)$/

export const isBlockingClassFailureOnly = (entry: PageQaEntry, blockingHardKeys: BlockingHardKeyPolicy = []): boolean => {
  const failures = getPageQaHardFailureKeys(entry, blockingHardKeys)
  return failures.length > 0 && failures.every(failure => BLOCKING_CLASS_FAILURE_KEY_PATTERN.test(failure))
}

export const isBlockingMaterialFailure = (entry: PageQaEntry, blockingHardKeys: BlockingHardKeyPolicy = []): boolean => {
  const failures = getPageQaHardFailureKeys(entry, blockingHardKeys)
  return failures.some(failure => BLOCKING_CLASS_FAILURE_KEY_PATTERN.test(failure))
    && failures.every(failure => SPATIAL_FAILURE_KEY_PATTERN.test(failure))
}

export const advancePageQaRepairStagnation = (
  state: PageQaRepairStagnationState,
  entry: PageQaEntry,
  blockingHardKeys: BlockingHardKeyPolicy = [],
): PageQaRepairDecision => {
  const failures = getPageQaHardFailureKeys(entry, blockingHardKeys)
  if (failures.length === 0) return { action: 'accept', repeatedHardFailures: [], state }
  const orderedFailures = [...new Set(failures)].sort()
  const signature = orderedFailures.join('|')
  const failureSignatures = [...state.failureSignatures, signature].slice(-4)
  const firstFailure = state.bestFailureKeys.length === 0
  const bestFailureSet = new Set(state.bestFailureKeys)
  const strictImprovement = !firstFailure
    && orderedFailures.length < state.bestFailureKeys.length
    && orderedFailures.every(failure => bestFailureSet.has(failure))
  const bestFailureKeys = firstFailure || strictImprovement ? orderedFailures : state.bestFailureKeys
  const attemptsWithoutStrictImprovement = firstFailure || strictImprovement ? 0 : state.attemptsWithoutStrictImprovement + 1
  const consecutiveFailures = Object.fromEntries(failures.map(failure => [failure, (state.consecutiveFailures[failure] ?? 0) + 1]))
  const repeatedHardFailures = failures.filter(failure => consecutiveFailures[failure]! >= 2)
  const alternatingSignature = failureSignatures.length >= 3
    && failureSignatures.at(-1) === failureSignatures.at(-3)
    && failureSignatures.at(-1) !== failureSignatures.at(-2)
  const oscillating = alternatingSignature || attemptsWithoutStrictImprovement >= 2
  const nextState = { ...state, consecutiveFailures, bestFailureKeys, failureSignatures, attemptsWithoutStrictImprovement }
  if (repeatedHardFailures.length > 0 && !state.restartedFromCanonicalReferences) {
    return {
      action: 'restart',
      repeatedHardFailures,
      reason: 'repeated-hard-failure',
      state: { ...nextState, consecutiveFailures: {}, failureSignatures: [], attemptsWithoutStrictImprovement: 0, restartedFromCanonicalReferences: true },
    }
  }
  if (repeatedHardFailures.length > 0) {
    return {
      action: 'stop',
      repeatedHardFailures,
      reason: 'repeated-hard-failure',
      state: nextState,
    }
  }
  if (oscillating) return { action: 'stop', repeatedHardFailures: orderedFailures, reason: 'constraint-oscillation', state: nextState }
  return { action: 'edit', repeatedHardFailures: [], state: nextState }
}

const buildBlockingAuditParagraphs = (
  panelData: PanelBundleData,
  rosterCards: ReadonlyArray<{ key: string; name?: string | undefined }>,
  characterCues: readonly PageQaCharacterCue[],
): string[] => {
  const blocking = panelData.panels.length === 1 ? panelData.blocking : undefined
  const panelKeys = new Set(panelData.panels.flatMap(panel => panel.characterKeys))
  const lookalikeCues = characterCues.flatMap(cue => panelKeys.has(cue.characterKey)
    ? cue.distinguishFrom.filter(item => panelKeys.has(item.characterKey)).map(item => `${cue.characterKey} versus ${item.characterKey}: ${item.cue}`)
    : [])
  const statusGuide = [
    'Fill blockingAudit with one entry per subject using exactly one status: on-mark when the subject and any occupied seat or mark match the ledger; side-swapped when a listed character is on the wrong screen side; depth-swapped when the front-to-back order of two listed characters is reversed; facing-wrong when a listed character faces the wrong way relative to the camera; posture-wrong when standing, seated, kneeling, crouching, lying, or leaning is wrong; wardrobe-wrong when the drawn costume contradicts the declared wardrobe; missing-on-mark when a listed character is absent from the frame or absent from the mark the ledger gives them; unlisted-on-stage when a character who must remain off frame, or any other unlisted character, is drawn in the panel; exposed-empty-mark when an off-frame character is absent but the image reveals that character\'s named seat or projected mark as an empty chair or empty floor; excluded-extra-present when an explicitly excluded extras category appears; scale-wrong when a subject is drawn at an implausible size for its depth band; crowd-uniform when an extras region is drawn as repeated identical figures instead of the declared variety; not-assessable only when the image genuinely cannot support a verdict.',
    'Emit one blockingAudit entry for every character listed in the panel contract, one for every character named in the off-frame roster, and one for every extras region in the contract. For an off-frame character, use unlisted-on-stage when the person is visible, exposed-empty-mark when the person is absent but their occupied seat or mark is exposed and empty, and on-mark only when both the person and the entire occupied seat or mark are outside the actual crop. Absence of the person alone is not enough for on-mark. Set blockingMatch=false when any entry is not on-mark or not-assessable, and set axisSideMatch=false only when the camera is on the opposite side of the declared axis of action from the established side without a declared axis break.',
  ]
  const ledgerParagraphs = blocking
    ? [
        `Blocking ledger supplied for this panel. ${blocking.lines.camera}`,
        `Ledger entries: ${blocking.lines.ledger.length > 0 ? blocking.lines.ledger.join(' | ') : 'nobody is in frame.'}`,
        `Off-frame roster: ${blocking.lines.offFrame}`,
        `Declared wardrobe: ${blocking.lines.wardrobe}`,
        `Declared extras: ${blocking.lines.extras}`,
        `Authoritative fixed-anchor visibility for this camera: ${blocking.lines.anchors} For this blocking-ledger panel, only anchors declared inside the frame are mandatory visibility requirements. Audit every canonical anchor, but mark an undeclared anchor outside-crop unless the generated image actually reveals that anchor or its canonical region. Never fail an undeclared anchor merely because it is absent, and never demand a wider composition to expose it.`,
        'For this blocking-ledger panel, judge shotPlanMatch spatially against the compiled camera line and ledger only. They replace camera, framing, screen-side, depth, facing, posture, seat, crop, and visible-cast phrases in the older prose shot plan. Continue to judge non-spatial story action, expression, props, environment, and lettering from the panel description and source data.',
      ]
    : ['No blocking ledger is supplied for this panel. Leave blockingAudit empty, set blockingMatch=true, and set axisSideMatch=true; judge staging from the prose shot plan only.']
  const rosterParagraph = rosterCards.length > 0
    ? [`After the mapped canonical references, the final images are roster identity cards for ${rosterCards.map(card => card.name ? `${card.key} (${card.name})` : card.key).join(', ')}. Those characters are absent from this panel by contract: the cards exist only so you can recognize them if they were drawn anyway. Never treat a roster card as a requirement to include that character; report any of them you can see as unlisted-on-stage.`]
    : []
  const cueParagraph = lookalikeCues.length > 0
    ? [`Lookalike cues for characters that share this panel: ${lookalikeCues.join(' | ')}. Use them before reporting an identity or blocking swap between those characters.`]
    : []
  return [...ledgerParagraphs, ...statusGuide, ...rosterParagraph, ...cueParagraph]
}

export const buildComicPageQaPrompt = (
  panelData: PanelBundleData,
  characterReferences: Array<{ key: string; description: string }> = [],
  locationReferences: Array<{ key: string; specification: string }> = [],
  designReferences: Array<{ key: string; usage: string }> = [],
  options: { rosterCards?: ReadonlyArray<{ key: string; name?: string | undefined }> | undefined; characterCues?: readonly PageQaCharacterCue[] | undefined } = {},
): string => [
  'Judge this generated comic output strictly. The first image is the generated output. Following images are ordered canonical character references, followed by every immutable canonical location reference, then every mapped immutable canonical design reference, each in first-panel-appearance order.',
  `Location mapping: ${panelData.panels.map(panel => `panel ${panel.number} -> ${panel.locationKey}`).join('; ')}. Judge each panel only against its mapped location reference.`,
  'Evaluate panels left-to-right. Location identity, set continuity, source-instruction precedence, shot-plan framing/staging, exact cast, dialogue wording and completeness, and bubble-tail/speaker attribution are hard requirements. Artifacts, harmless typography substitutions, minor identity stylization variance, and aesthetic scores are advisory only. For every failed panel return concise actionable editInstructions in this same response.',
  'Separately assess whether spending one image-edit call followed by conservative pairwise comparison is likely to create a clear net improvement. A QA failure remains a failure even when repairAssessment recommends retain-current. Recommend targeted-edit when the defect is unequivocally visible, materially affects panel reading, has concrete actionable instructions, and is supported with high confidence. Record scope, isolation, and collateral risk honestly; diffuse, multi-region, shared-attribute, or generative-redraw work may use the comparison-protected lane and is not automatically a retain-current recommendation. Use retain-current for false-positive or source-authorized premises, hidden or out-of-frame details, marginal or merely decorative differences, ambiguous evidence, vague aesthetic preferences, or a correction too underspecified to compare. Required cast, unmistakable identity, dialogue-content, speaker-attribution, and source-precedence failures are meaningful story-contract failures and cannot be labeled expectedBenefit none. Classify editIsolation as isolated-single-region only for one subject/object and one contiguous region; use shared-attribute when the edited attribute must change on one or more visually similar nearby subjects while remaining different on another, multi-region for independent corrections or separate regions, and generative-redraw for hands, limbs, faces, anatomy, or other structural regeneration. List concrete preservationRequirements for every targeted edit.',
  'Perform a mandatory anchor-by-anchor continuity audit before setting setContinuityMatch. Identify permanent architecture, fixed furniture, installed equipment, and every recurring spatial anchor named or visibly established by the mapped canonical location reference/specification. Emit one setContinuityAudit entry for every such anchor, with concrete visual evidence and exactly one allowed status. Presence alone is insufficient: for fixed furniture and architecture, explicitly compare footprint, silhouette, connectedness, orientation, visible edge geometry, and wall relationships. Perspective may foreshorten them but may not turn a straight run into a corner, L-shaped, wraparound, split, or freestanding form; classify that as redesigned. There is no occluded status and character or prop blocking never excuses an unverifiable anchor. If the anchor\'s canonical region is inside the image but the anchor is not visibly identifiable, status is missing, even when a foreground object covers that region. Use outside-crop only when the anchor\'s entire canonical region is beyond the image boundary. Set setContinuityMatch=false if any anchor is missing, relocated, duplicated, mirrored, or redesigned without an explicit source-authored story event. A wide or otherwise revealing view that shows an anchor\'s canonical region but omits the anchor is a hard failure; do not infer that it was intentionally cropped. Judge set anchors in world space (topology and relative relationships), but judge each listed character\'s screen side, depth order, posture, facing, and wardrobe in screen space against the blocking ledger when one is supplied. A different camera distance, elevation, perspective, or crop is desirable shot variation; a swapped screen side or a crossed axis of action is not. Characters and foreground props must be composed around a recognizable visible remainder of every anchor whose canonical region is in frame. Do not demand the canonical reference camera or a repeated composition.',
  'Audit canonical assemblies component by component: seeing a desk, console, shelf, rack, berth, or counter does not establish that its named computer, keyboard, control unit, appliance, instrument, or other co-located components are present. Loose tools, generic clutter, speakers, lamps, or plausible substitute props do not satisfy a missing named component. If the supporting desk, console, shelf, rack, berth, counter, wall zone, footprint, or expected silhouette is in frame but a named component is absent, hidden, or replaced by generic clutter, status is missing.',
  'Canonical character references and their catalog descriptions have highest visual precedence for identity, physical embodiment, projection/display medium, anatomy, costume, and character-specific required props. A generated image that violates this canon is a hard identity failure even when the source panel description or shot plan repeats the same contradiction. Set identityIssueKind=unmistakable-mismatch and provide repair instructions that restore the canonical embodiment.',
  'Dialogue accuracy is about legible wording, completeness, order, and meaning. Treat a Unicode ellipsis (…) and three consecutive periods (...), straight and curly quotation marks or apostrophes, and em/en dashes and hyphens as equivalent when the substitution does not change wording, meaning, speaker, or pacing. Set dialogueAccuracy=false for missing, added, illegible, or reordered words; wrong wording or speaker; or punctuation changes that materially change meaning or timing. Never fail dialogueAccuracy for a harmless typography-only substitution.',
  'Identity must remain clearly recognizable from the canonical character references. Set identityMatch=false only for an unmistakably wrong person, missing defining facial/costume/color features, or a major medium reinterpretation that prevents a clear canonical match. Minor body-width or proportion variance, pose-induced shape changes, shading/detail differences, and ordinary stylization variance are advisory when the character remains recognizable and preserves the canonical design cues. Do not also mark sourcePrecedence=false for the same identity concern unless the image independently contradicts an explicit source instruction.',
  'For each panel classify identityIssueKind as none, minor-variance, or unmistakable-mismatch, and classify dialogueIssueKind as none, typography-only, or content. These classifications must follow the tolerance rules above even when the corresponding raw boolean would otherwise be stricter.',
  `Canonical character catalog descriptions: ${characterReferences.length > 0 ? characterReferences.map(reference => `${reference.key}: ${reference.description}`).join(' | ') : 'none supplied; rely on the ordered canonical reference images.'}`,
  `Canonical location specifications: ${locationReferences.length > 0 ? locationReferences.map(reference => `${reference.key}: ${reference.specification}`).join(' | ') : 'none supplied; rely on the ordered canonical location images.'}`,
  `Canonical design requirements: ${designReferences.length > 0 ? designReferences.map(reference => `${reference.key}: ${reference.usage}`).join(' | ') : 'none supplied.'}`,
  'A mapped canonical design reference is a hard source-precedence requirement. Fail sourcePrecedence when the generated panel unmistakably redesigns, replaces, relabels, or omits a design whose usage requires it to be visible. Do not require a design in panels to which it is not mapped.',
  ...buildBlockingAuditParagraphs(panelData, options.rosterCards ?? [], options.characterCues ?? []),
  'Source panel data:', JSON.stringify(panelData, null, 2),
  'Return only the requested JSON.',
].join('\n\n')

export const buildPageQaImageInputs = async (
  imagePaths: readonly string[],
  rosterCardPaths: readonly string[],
): Promise<Array<{ type: 'input_image'; image_url: string; detail: 'high' | 'low' }>> => [
  ...(await Promise.all(imagePaths.map(async path => ({ type: 'input_image' as const, image_url: await dataUrl(path), detail: 'high' as const })))),
  ...(await Promise.all(rosterCardPaths.map(async path => ({ type: 'input_image' as const, image_url: await dataUrl(path), detail: 'low' as const })))),
]

export const resolvePageQaCharacterCues = (characterKeys: readonly string[]): PageQaCharacterCue[] => {
  let catalog: ReturnType<typeof loadCharacterCatalog>
  try { catalog = loadCharacterCatalog() } catch { return [] }
  const known = new Set(catalog.characterKeys)
  return characterKeys
    .filter((key, index) => known.has(key as never) && characterKeys.indexOf(key) === index)
    .flatMap(key => {
      const distinguishFrom = catalog.get(key as never).distinguishFrom ?? []
      return distinguishFrom.length > 0 ? [{ characterKey: key, distinguishFrom: [...distinguishFrom] }] : []
    })
}

export const judgeComicPage = async (request: PageQaRequest): Promise<PageQaEntry> => {
  const rosterCards = request.rosterCards ?? []
  const characterCues = request.characterCues ?? resolvePageQaCharacterCues(request.panelData.panels.flatMap(panel => panel.characterKeys))
  const prompt = buildComicPageQaPrompt(request.panelData, request.characterReferences ?? [], request.locationReferences ?? [], request.designReferences ?? [], { rosterCards, characterCues })
  const imagePaths = [request.pagePath, ...request.identityCards, ...request.locationSheets, ...(request.designSheets ?? [])]
  const rosterCardPaths = rosterCards.map(card => card.path)
  const provider = resolveComicQaProvider(request.model)
  let text: string | undefined
  let inputTokens = 0
  let outputTokens = 0
  if (provider === 'openai') {
    const response = await createOpenAIResponse(getOpenAIClientConfig(), {
      model: request.model,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: prompt },
        ...(await buildPageQaImageInputs(imagePaths, rosterCardPaths)),
      ] }],
      text: { verbosity: 'low', format: { type: 'json_schema', name: 'comic_page_qa_v2', schema: PAGE_QA_SCHEMA, strict: true } },
    })
    text = extractOpenAIResponseText(response)
    const usageObject = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
    inputTokens = typeof usageObject['input_tokens'] === 'number' ? usageObject['input_tokens'] : 0
    outputTokens = typeof usageObject['output_tokens'] === 'number' ? usageObject['output_tokens'] : 0
  } else {
    const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:page-qa', description: 'Comic panel QA' }), {
      model: request.model,
      contents: geminiUserContent([
        { text: prompt },
        ...(await Promise.all([...imagePaths, ...rosterCardPaths].map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } })))),
      ]),
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: PAGE_QA_SCHEMA },
    })
    text = response.text
    inputTokens = response.usageMetadata?.promptTokenCount ?? 0
    outputTokens = (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0)
  }
  if (!text) throw InfraError('Page QA judge returned no structured text.', { stage: 'comic:page-qa' })
  const result = applyPageQaTolerancePolicy(parseComicPageQaResult(text, request.panelData.panels.map(panel => panel.number)))
  return {
    pageNumber: request.pageNumber,
    panelNumbers: request.panelData.panels.map(panel => panel.number),
    outputFile: basename(request.pagePath),
    judgeModel: request.model,
    hardFailure: hasHardPageQaFailure(result, { blockingHardKeys: request.blockingHardKeys ?? [] }),
    ...(request.blockingHardKeys && request.blockingHardKeys.length > 0 ? { blockingHardKeys: request.blockingHardKeys } : {}),
    result,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd: estimateLlmCostFromRegistry(request.model, inputTokens, outputTokens) },
  }
}

export const readReusablePageQaEntry = async (pagePath: string, model: string): Promise<PageQaEntry | undefined> => {
  const reportPath = join(dirname(pagePath), 'page-qa-report.json')
  if (!(await Bun.file(reportPath).exists())) return undefined
  try {
    const report = JSON.parse(await Bun.file(reportPath).text()) as { schemaVersion?: number; pages?: PageQaEntry[] }
    return report.schemaVersion === PAGE_QA_REPORT_SCHEMA_VERSION ? report.pages?.find(entry => entry.outputFile === basename(pagePath) && entry.judgeModel === model) : undefined
  } catch { return undefined }
}

export const writePageQaReports = async (directory: string, entries: PageQaEntry[]): Promise<void> => {
  const sorted = [...entries].sort((a, b) => a.pageNumber - b.pageNumber || a.outputFile.localeCompare(b.outputFile))
  const usage = sorted.reduce((total, entry) => ({
    inputTokens: total.inputTokens + entry.usage.inputTokens,
    outputTokens: total.outputTokens + entry.usage.outputTokens,
    totalTokens: total.totalTokens + entry.usage.totalTokens,
    costUsd: total.costUsd + entry.usage.costUsd,
  }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 })
  await Bun.write(join(directory, 'page-qa-report.json'), `${JSON.stringify({ schemaVersion: PAGE_QA_REPORT_SCHEMA_VERSION, usage, pages: sorted }, null, 2)}\n`)
  const markdown = ['# Comic Page QA Report', '', `Hard failures: ${sorted.filter(entry => entry.hardFailure).length}`, `Waived shot-plan checks: ${sorted.reduce((count, entry) => count + (entry.waivedChecks?.length ?? 0), 0)}`, `Repair dispatches skipped: ${sorted.filter(entry => entry.repairPolicy?.action === 'skip').length}`, `Repair candidates retained instead of promoted: ${sorted.filter(entry => entry.repairPolicy?.action === 'retain-original').length}`, `Unanimous repair wins: ${sorted.filter(entry => entry.repairComparison?.decision === 'clear-winner').length}`, `Judge usage: ${usage.totalTokens} tokens; $${usage.costUsd.toFixed(4)}`, '', '| Page | Panels | Hard failure | Repair action | Comparison | Waived checks | Summary |', '|---:|:---|:---:|:---|:---|:---|:---|', ...sorted.map(entry => `| ${entry.pageNumber} | ${entry.panelNumbers.join(', ')} | ${entry.hardFailure ? 'yes' : 'no'} | ${entry.repairPolicy?.action ?? 'none'} | ${entry.repairComparison?.decision ?? 'not run'} | ${entry.waivedChecks?.map(check => `panel ${check.panelNumber} ${check.check}`).join(', ') || 'none'} | ${entry.result.summary.replace(/\|/g, '\\|')} |`), '']
  await Bun.write(join(directory, 'page-qa-report.md'), markdown.join('\n'))
}
