import { ValidationError } from '~/utils/error-handler'
import { REVISION_COMPARISON_PASSES } from './revision-evaluation-config'
import type { LoadedRevisionEntry, RevisionComparisonNormalized, RevisionComparisonRaw, RevisionImportance } from './revision-evaluation-types'

export const REVISION_COMPARISON_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    targetedDefectStatusImageA: { type: 'string', enum: ['visible', 'partly-visible', 'not-visible', 'not-assessable'] },
    targetedDefectStatusImageB: { type: 'string', enum: ['visible', 'partly-visible', 'not-visible', 'not-assessable'] },
    targetedDefectLowerIn: { type: 'string', enum: ['image-a', 'image-b', 'neither'] },
    differenceMeaningful: { type: 'boolean' },
    majorRegressionImageA: { type: 'boolean' },
    majorRegressionImageB: { type: 'boolean' },
    nonTargetDifferenceLevel: { type: 'string', enum: ['none', 'minor', 'major'] },
    preservationRequirementsSatisfiedImageA: { type: 'boolean' },
    preservationRequirementsSatisfiedImageB: { type: 'boolean' },
    nonTargetDifferences: { type: 'array', items: { type: 'string' } },
    fullContractPreference: { type: 'string', enum: ['image-a', 'image-b', 'tie'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    regressionsImageA: { type: 'array', items: { type: 'string' } },
    regressionsImageB: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
  required: ['targetedDefectStatusImageA', 'targetedDefectStatusImageB', 'targetedDefectLowerIn', 'differenceMeaningful', 'majorRegressionImageA', 'majorRegressionImageB', 'nonTargetDifferenceLevel', 'preservationRequirementsSatisfiedImageA', 'preservationRequirementsSatisfiedImageB', 'nonTargetDifferences', 'fullContractPreference', 'confidence', 'regressionsImageA', 'regressionsImageB', 'rationale'],
} as const

const assertComparisonShape = (value: unknown): RevisionComparisonRaw => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw ValidationError('Revision comparison must be a JSON object.', { stage: 'comic:revision-comparison' })
  const record = value as Record<string, unknown>
  const expectedKeys = Object.keys(REVISION_COMPARISON_SCHEMA.properties).sort()
  const actualKeys = Object.keys(record).sort()
  if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) throw ValidationError('Revision comparison has missing or unexpected fields.', { stage: 'comic:revision-comparison' })
  const statusValues = ['visible', 'partly-visible', 'not-visible', 'not-assessable']
  if (!statusValues.includes(String(record['targetedDefectStatusImageA'])) || !statusValues.includes(String(record['targetedDefectStatusImageB']))) throw ValidationError('Revision comparison has an invalid targeted-defect status.', { stage: 'comic:revision-comparison' })
  if (!['image-a', 'image-b', 'neither'].includes(String(record['targetedDefectLowerIn'])) || !['image-a', 'image-b', 'tie'].includes(String(record['fullContractPreference']))) throw ValidationError('Revision comparison has an invalid preference.', { stage: 'comic:revision-comparison' })
  if (!['low', 'medium', 'high'].includes(String(record['confidence']))) throw ValidationError('Revision comparison has invalid confidence.', { stage: 'comic:revision-comparison' })
  for (const key of ['differenceMeaningful', 'majorRegressionImageA', 'majorRegressionImageB', 'preservationRequirementsSatisfiedImageA', 'preservationRequirementsSatisfiedImageB']) if (typeof record[key] !== 'boolean') throw ValidationError(`Revision comparison ${key} must be boolean.`, { stage: 'comic:revision-comparison' })
  if (!['none', 'minor', 'major'].includes(String(record['nonTargetDifferenceLevel']))) throw ValidationError('Revision comparison has an invalid non-target difference level.', { stage: 'comic:revision-comparison' })
  for (const key of ['nonTargetDifferences', 'regressionsImageA', 'regressionsImageB']) if (!Array.isArray(record[key]) || !(record[key] as unknown[]).every(item => typeof item === 'string')) throw ValidationError(`Revision comparison ${key} must be an array of strings.`, { stage: 'comic:revision-comparison' })
  if ((record['nonTargetDifferenceLevel'] === 'none') !== ((record['nonTargetDifferences'] as unknown[]).length === 0)) throw ValidationError('Revision comparison non-target difference level and evidence are internally inconsistent.', { stage: 'comic:revision-comparison' })
  if (typeof record['rationale'] !== 'string' || !record['rationale'].trim()) throw ValidationError('Revision comparison rationale must be non-empty.', { stage: 'comic:revision-comparison' })
  const severity = (status: unknown): number | undefined => status === 'not-visible' ? 0 : status === 'partly-visible' ? 1 : status === 'visible' ? 2 : undefined
  const severityA = severity(record['targetedDefectStatusImageA'])
  const severityB = severity(record['targetedDefectStatusImageB'])
  if (severityA === undefined || severityB === undefined) {
    if (record['targetedDefectLowerIn'] !== 'neither') throw ValidationError('Revision comparison targeted-defect fields are internally inconsistent.', { stage: 'comic:revision-comparison' })
  } else if (severityA !== severityB) {
    const expectedLower = severityA < severityB ? 'image-a' : 'image-b'
    if (record['targetedDefectLowerIn'] !== expectedLower) throw ValidationError('Revision comparison targeted-defect fields are internally inconsistent.', { stage: 'comic:revision-comparison' })
  }
  return record as RevisionComparisonRaw
}

export const parseRevisionComparison = (text: string): RevisionComparisonRaw => {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw ValidationError(`Revision comparison returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:revision-comparison', ...(error instanceof Error ? { cause: error } : {}) })
  }
  return assertComparisonShape(value)
}

const issueVisible = (status: RevisionComparisonRaw['targetedDefectStatusImageA']): boolean => status === 'visible' || status === 'partly-visible'

const equivalentRegressionEvidence = (left: string[], right: string[]): boolean => {
  const normalize = (items: string[]): string[] => items.map(item => item.trim().toLowerCase()).sort()
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((item, index) => item === normalizedRight[index])
}

export const normalizeRevisionComparison = (raw: RevisionComparisonRaw, pass: 1 | 2): RevisionComparisonNormalized => {
  const originalIsA = pass === 1
  const originalStatus = originalIsA ? raw.targetedDefectStatusImageA : raw.targetedDefectStatusImageB
  const candidateStatus = originalIsA ? raw.targetedDefectStatusImageB : raw.targetedDefectStatusImageA
  const betterCandidateLabel = originalIsA ? 'image-b' : 'image-a'
  const candidatePreferenceLabel = originalIsA ? 'image-b' : 'image-a'
  const candidateRegression = originalIsA ? raw.majorRegressionImageB : raw.majorRegressionImageA
  const originalPreservationRequirementsSatisfied = originalIsA ? raw.preservationRequirementsSatisfiedImageA : raw.preservationRequirementsSatisfiedImageB
  const candidatePreservationRequirementsSatisfied = originalIsA ? raw.preservationRequirementsSatisfiedImageB : raw.preservationRequirementsSatisfiedImageA
  const originalRegressions = originalIsA ? raw.regressionsImageA : raw.regressionsImageB
  const candidateRegressions = originalIsA ? raw.regressionsImageB : raw.regressionsImageA
  const originalVisible = issueVisible(originalStatus)
  const improved = originalVisible && raw.targetedDefectLowerIn === betterCandidateLabel && raw.differenceMeaningful
  return {
    comparisonContractVersion: 4,
    pass,
    order: originalIsA ? { imageA: 'original', imageB: 'candidate' } : { imageA: 'candidate', imageB: 'original' },
    originalIssueVisible: originalVisible,
    candidateIssueFixed: originalVisible && candidateStatus === 'not-visible',
    targetedIssueMateriallyImproved: improved,
    differenceMeaningful: raw.differenceMeaningful,
    candidateHasMajorRegression: candidateRegression,
    nonTargetDifferenceLevel: raw.nonTargetDifferenceLevel,
    originalPreservationRequirementsSatisfied,
    candidatePreservationRequirementsSatisfied,
    candidateIntroducesPreservationRegression: !candidatePreservationRequirementsSatisfied && (originalPreservationRequirementsSatisfied || !equivalentRegressionEvidence(originalRegressions, candidateRegressions)),
    nonTargetDifferences: raw.nonTargetDifferences,
    preference: raw.fullContractPreference === 'tie' ? 'tie' : raw.fullContractPreference === candidatePreferenceLabel ? 'candidate' : 'original',
    confidence: raw.confidence,
    candidateRegressions,
    originalRegressions,
    rationale: raw.rationale,
  }
}

export const decideRevisionPromotion = (importance: RevisionImportance, comparisons: RevisionComparisonNormalized[]): { decision: 'clear-winner' | 'retain-original' | 'incomplete'; reason: string } => {
  if (comparisons.length !== REVISION_COMPARISON_PASSES) return { decision: 'incomplete', reason: 'Two valid order-swapped comparisons were not completed.' }
  if (importance === 'not-meaningful') return { decision: 'retain-original', reason: 'The frozen pre-run finding was not meaningful, so the candidate is ineligible for promotion.' }
  if (!comparisons.every(item => item.preference === 'candidate')) return { decision: 'retain-original', reason: 'The two comparison passes did not unanimously prefer the candidate.' }
  if (!comparisons.every(item => item.originalIssueVisible && item.targetedIssueMateriallyImproved && item.differenceMeaningful)) return { decision: 'retain-original', reason: 'The two comparison passes did not unanimously find a visible, meaningful targeted improvement.' }
  if (comparisons.some(item => item.candidateHasMajorRegression)) return { decision: 'retain-original', reason: 'At least one comparison found a major collateral regression.' }
  const versionedComparisons = comparisons.filter(item => item.comparisonContractVersion === 3 || item.comparisonContractVersion === 4)
  if (versionedComparisons.length > 0 && versionedComparisons.length !== comparisons.length) return { decision: 'retain-original', reason: 'Comparison evidence mixes incompatible contract versions.' }
  if (new Set(versionedComparisons.map(item => item.comparisonContractVersion)).size > 1) return { decision: 'retain-original', reason: 'Comparison evidence mixes incompatible contract versions.' }
  if (versionedComparisons.some(item => item.nonTargetDifferenceLevel === 'major')) return { decision: 'retain-original', reason: 'At least one comparison found major change outside the targeted correction.' }
  if (versionedComparisons.some(item => item.comparisonContractVersion === 3 && item.candidatePreservationRequirementsSatisfied !== true)) return { decision: 'retain-original', reason: 'At least one legacy comparison found that the candidate did not satisfy the frozen preservation requirements.' }
  if (versionedComparisons.some(item => item.comparisonContractVersion === 4 && item.candidateIntroducesPreservationRegression !== false)) return { decision: 'retain-original', reason: 'At least one comparison found that the candidate introduced a preservation regression.' }
  return { decision: 'clear-winner', reason: 'Both order-swapped comparisons unanimously preferred a meaningful targeted improvement with no major regression.' }
}

export const buildRevisionComparisonPrompt = (entry: LoadedRevisionEntry, pass: 1 | 2): string => [
  'Blindly compare Image A and Image B as alternate renderings of the same reviewed comic panel. Do not assume the first image is the original.',
  `Frozen pre-run importance: ${entry.importance}.`,
  `Frozen issue finding: ${entry.originalFinding}`,
  `Targeted correction: ${entry.correctionNote}`,
  'After Image A and Image B, all remaining images are immutable canonical character, location, and design references in contract order.',
  'First determine the targeted DEFECT status independently in A and B. targetedDefectStatusImageA and targetedDefectStatusImageB report whether the defect itself is visible: visible means the defect exists in that image, partly-visible means some of the defect exists, and not-visible means the defect is absent. targetedDefectLowerIn names the image with less of the defect, or neither when severity is equal or not assessable. These fields must agree with one another.',
  'Independently audit change outside the targeted correction. nonTargetDifferenceLevel is none only when the rest of the pair is visually preserved, minor only for immaterial antialiasing, texture, or tiny paint drift, and major when crop, camera, composition, character pose/position/identity, object placement, background architecture, lighting, or another meaningful non-target element changes. List every observed non-target change in nonTargetDifferences; none requires an empty list, while minor or major requires evidence. Judge only explicitly frozen preservation requirements separately for A and B. A defect already present to the same degree in both images is pre-existing evidence, not a regression introduced by either image: list the same evidence for both images and do not use it to favor or disqualify one. If no explicit preservation requirement exists, set both preservationRequirementsSatisfied fields true. A full-contract preference cannot excuse major non-target drift or a newly introduced preservation failure.',
  'Then decide whether the targeted difference matters to panel reading, whether either image introduces a major regression, and which image better satisfies the full reviewed contract. Do not prefer an image merely because it is prettier or more polished.',
  `This is order-swapped comparison pass ${pass} of 2. Evaluate only the supplied order and return only the required JSON.`,
  `Reviewed full panel contract:\n${JSON.stringify(entry.bundleData)}`,
].join('\n\n')
