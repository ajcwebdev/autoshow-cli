import type { PageQaResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { BLOCKING_AUDIT_STATUSES } from '../../schemas/blocking-plan-schemas'

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && [...keys].sort().every((key, index) => actual[index] === key)
}

const parsePageQaStructure = (text: string): PageQaResult => {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw ValidationError(`Page QA judge returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:page-qa', ...(error instanceof Error ? { cause: error } : {}) })
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw ValidationError('Page QA result must be an object.', { stage: 'comic:page-qa' })
  if (!hasExactKeys(value as Record<string, unknown>, ['panelStructure', 'panels', 'summary'])) throw ValidationError('Page QA result has missing or unexpected top-level fields.', { stage: 'comic:page-qa' })
  const result = value as PageQaResult
  const structure = result.panelStructure as unknown
  if (!structure || typeof structure !== 'object' || Array.isArray(structure) || !Array.isArray(result.panels) || typeof result.summary !== 'string' || !result.summary.trim()) throw ValidationError('Page QA result is missing required fields.', { stage: 'comic:page-qa' })
  const structureRecord = structure as unknown as Record<string, unknown>
  if (!hasExactKeys(structureRecord, ['pass', 'observedPanelCount', 'observedPanelOrder', 'issues']) || typeof structureRecord['pass'] !== 'boolean' || !Number.isInteger(structureRecord['observedPanelCount']) || !Array.isArray(structureRecord['observedPanelOrder']) || !structureRecord['observedPanelOrder'].every(Number.isInteger) || !Array.isArray(structureRecord['issues']) || !structureRecord['issues'].every(item => typeof item === 'string')) {
    throw ValidationError('Page QA panelStructure is invalid.', { stage: 'comic:page-qa' })
  }
  return result
}

const normalizePageQaPanelOrder = (result: PageQaResult, expectedPanels: number[]): PageQaResult => {
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
  return result
}

const validatePageQaPanel = (panel: PageQaResult['panels'][number]): void => {
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
}

const validatePageQaRepairAssessment = (panel: PageQaResult['panels'][number]): void => {
  const assessment = panel.repairAssessment
  if (!assessment || typeof assessment !== 'object' || !hasExactKeys(assessment as unknown as Record<string, unknown>, ['issueVisibility', 'expectedBenefit', 'editScope', 'editIsolation', 'collateralRisk', 'confidence', 'recommendation', 'preservationRequirements', 'rationale']) || !['directly-visible', 'ambiguous', 'not-visible', 'not-assessable'].includes(assessment.issueVisibility) || !['meaningful', 'marginal', 'none'].includes(assessment.expectedBenefit) || !['bounded', 'diffuse'].includes(assessment.editScope) || !['isolated-single-region', 'shared-attribute', 'multi-region', 'generative-redraw'].includes(assessment.editIsolation) || !['low', 'medium', 'high'].includes(assessment.collateralRisk) || !['low', 'medium', 'high'].includes(assessment.confidence) || !['targeted-edit', 'retain-current'].includes(assessment.recommendation) || !Array.isArray(assessment.preservationRequirements) || !assessment.preservationRequirements.every(item => typeof item === 'string' && item.trim()) || typeof assessment.rationale !== 'string' || !assessment.rationale.trim()) {
    throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid repairAssessment.`, { stage: 'comic:page-qa' })
  }
}

export const parseComicPageQaResult = (text: string, expectedPanels: number[]): PageQaResult => {
  const result = normalizePageQaPanelOrder(parsePageQaStructure(text), expectedPanels)
  for (const panel of result.panels) {
    validatePageQaPanel(panel)
    validatePageQaRepairAssessment(panel)
  }
  return result
}
