import { basename, dirname, join } from 'node:path'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { PageQaEntry, PageQaRepairDecision, PageQaRepairStagnationState, PageQaRequest, PageQaResult, PanelBundleData } from '~/types'

export const PAGE_QA_REPORT_SCHEMA_VERSION = 2

const HARD_SET_CONTINUITY_STATUSES: ReadonlySet<string> = new Set(['missing', 'relocated', 'duplicated', 'mirrored', 'redesigned'])

const hasHardSetContinuityAuditFailure = (panel: PageQaResult['panels'][number]): boolean =>
  panel.setContinuityAudit.some(item => HARD_SET_CONTINUITY_STATUSES.has(item.status))

const PAGE_QA_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    panelStructure: { type: 'object', additionalProperties: false, properties: {
      pass: { type: 'boolean' }, observedPanelCount: { type: 'integer' }, observedPanelOrder: { type: 'array', items: { type: 'integer' } }, issues: { type: 'array', items: { type: 'string' } },
    }, required: ['pass', 'observedPanelCount', 'observedPanelOrder', 'issues'] },
    panels: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      panelNumber: { type: 'integer' }, requiredCastPresent: { type: 'boolean' }, unexpectedCastAbsent: { type: 'boolean' }, identityMatch: { type: 'boolean' }, identityIssueKind: { type: 'string', enum: ['none', 'minor-variance', 'unmistakable-mismatch'] }, locationMatch: { type: 'boolean' }, setContinuityMatch: { type: 'boolean' }, setContinuityAudit: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { anchor: { type: 'string' }, status: { type: 'string', enum: ['present-correctly', 'outside-crop', 'missing', 'relocated', 'duplicated', 'mirrored', 'redesigned'] }, evidence: { type: 'string' } }, required: ['anchor', 'status', 'evidence'] } }, sourcePrecedence: { type: 'boolean' }, shotPlanMatch: { type: 'boolean' }, dialogueAccuracy: { type: 'boolean' }, dialogueIssueKind: { type: 'string', enum: ['none', 'typography-only', 'content'] }, speakerAttribution: { type: 'boolean' }, artifacts: { type: 'array', items: { type: 'string' } }, visualQualityScore: { type: 'number', minimum: 1, maximum: 10 }, compositionScore: { type: 'number', minimum: 1, maximum: 10 }, issues: { type: 'array', items: { type: 'string' } }, editInstructions: { type: 'string' },
    }, required: ['panelNumber', 'requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'identityIssueKind', 'locationMatch', 'setContinuityMatch', 'setContinuityAudit', 'sourcePrecedence', 'shotPlanMatch', 'dialogueAccuracy', 'dialogueIssueKind', 'speakerAttribution', 'artifacts', 'visualQualityScore', 'compositionScore', 'issues', 'editInstructions'] } },
    summary: { type: 'string' },
  }, required: ['panelStructure', 'panels', 'summary'],
} as const

const dataUrl = async (path: string): Promise<string> => {
  const type = path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${type};base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}`
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
  const result = value as PageQaResult
  const structure = result.panelStructure as unknown
  if (!structure || typeof structure !== 'object' || Array.isArray(structure) || !Array.isArray(result.panels) || typeof result.summary !== 'string' || !result.summary.trim()) throw ValidationError('Page QA result is missing required fields.', { stage: 'comic:page-qa' })
  const structureRecord = structure as unknown as Record<string, unknown>
  if (!hasExactKeys(structureRecord, ['pass', 'observedPanelCount', 'observedPanelOrder', 'issues']) || typeof structureRecord['pass'] !== 'boolean' || !Number.isInteger(structureRecord['observedPanelCount']) || !Array.isArray(structureRecord['observedPanelOrder']) || !structureRecord['observedPanelOrder'].every(Number.isInteger) || !Array.isArray(structureRecord['issues']) || !structureRecord['issues'].every(item => typeof item === 'string')) {
    throw ValidationError('Page QA panelStructure is invalid.', { stage: 'comic:page-qa' })
  }
  if (result.panels.length !== expectedPanels.length || result.panels.some((panel, index) => panel.panelNumber !== expectedPanels[index])) {
    throw ValidationError('Page QA result panels do not exactly match the requested source-panel order.', { stage: 'comic:page-qa' })
  }
  for (const panel of result.panels) {
    if (!panel || typeof panel !== 'object' || !hasExactKeys(panel as unknown as Record<string, unknown>, ['panelNumber', 'requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'identityIssueKind', 'locationMatch', 'setContinuityMatch', 'setContinuityAudit', 'sourcePrecedence', 'shotPlanMatch', 'dialogueAccuracy', 'dialogueIssueKind', 'speakerAttribution', 'artifacts', 'visualQualityScore', 'compositionScore', 'issues', 'editInstructions'])) {
      throw ValidationError('Page QA panel has missing or unexpected fields.', { stage: 'comic:page-qa' })
    }
    for (const key of ['requiredCastPresent', 'unexpectedCastAbsent', 'identityMatch', 'locationMatch', 'setContinuityMatch', 'sourcePrecedence', 'shotPlanMatch', 'dialogueAccuracy', 'speakerAttribution'] as const) {
      if (typeof panel[key] !== 'boolean') throw ValidationError(`Page QA panel ${panel.panelNumber} field ${key} must be boolean.`, { stage: 'comic:page-qa' })
    }
    if (!['none', 'minor-variance', 'unmistakable-mismatch'].includes(panel.identityIssueKind) || !['none', 'typography-only', 'content'].includes(panel.dialogueIssueKind)) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid identity or dialogue issue classification.`, { stage: 'comic:page-qa' })
    }
    const validContinuityStatuses = ['present-correctly', 'outside-crop', 'missing', 'relocated', 'duplicated', 'mirrored', 'redesigned']
    if (!Array.isArray(panel.setContinuityAudit) || panel.setContinuityAudit.some(item => !item || typeof item.anchor !== 'string' || !item.anchor.trim() || !validContinuityStatuses.includes(item.status) || typeof item.evidence !== 'string' || !item.evidence.trim())) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has an invalid setContinuityAudit.`, { stage: 'comic:page-qa' })
    }
    if (!Array.isArray(panel.artifacts) || !panel.artifacts.every(item => typeof item === 'string') || !Array.isArray(panel.issues) || !panel.issues.every(item => typeof item === 'string') || typeof panel.editInstructions !== 'string' || !Number.isFinite(panel.visualQualityScore) || panel.visualQualityScore < 1 || panel.visualQualityScore > 10 || !Number.isFinite(panel.compositionScore) || panel.compositionScore < 1 || panel.compositionScore > 10) {
      throw ValidationError(`Page QA panel ${panel.panelNumber} has invalid artifacts, issues, or advisory scores.`, { stage: 'comic:page-qa' })
    }
  }
  return result
}

export const applyPageQaTolerancePolicy = (result: PageQaResult): PageQaResult => ({
  ...result,
  panels: result.panels.map(panel => ({
    ...panel,
    identityMatch: panel.identityIssueKind !== 'unmistakable-mismatch',
    dialogueAccuracy: panel.dialogueIssueKind !== 'content',
    ...(hasHardSetContinuityAuditFailure(panel) ? { setContinuityMatch: false } : {}),
  })),
})

export const hasHardPageQaFailure = (result: PageQaResult, options: { waiveShotPlanMatch?: boolean } = {}): boolean =>
  !result.panelStructure.pass || result.panels.some(panel =>
    !panel.requiredCastPresent || !panel.unexpectedCastAbsent || panel.identityIssueKind === 'unmistakable-mismatch' || !panel.locationMatch || !panel.setContinuityMatch || hasHardSetContinuityAuditFailure(panel) || !panel.sourcePrecedence || (!options.waiveShotPlanMatch && !panel.shotPlanMatch) || panel.dialogueIssueKind === 'content' || !panel.speakerAttribution
  )

export const applyPageQaRepairPolicy = (entry: PageQaEntry, completedRepairRounds: number): PageQaEntry => {
  if (completedRepairRounds < 1) return entry
  const waivedChecks = entry.result.panels
    .filter(panel => !panel.shotPlanMatch)
    .map(panel => ({
      panelNumber: panel.panelNumber,
      check: 'shotPlanMatch' as const,
      reason: 'Shot-plan framing/staging remained unresolved after one image edit and is advisory from this attempt onward.',
    }))
  if (waivedChecks.length === 0) return entry
  return {
    ...entry,
    hardFailure: hasHardPageQaFailure(entry.result, { waiveShotPlanMatch: true }),
    waivedChecks,
  }
}

export const createPageQaRepairStagnationState = (): PageQaRepairStagnationState => ({
  consecutiveFailures: {},
  restartedFromCanonicalReferences: false,
})

const getPageQaHardFailureKeys = (entry: PageQaEntry): string[] => {
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
    if (panel.dialogueIssueKind === 'content') failures.push(`${prefix}dialogueAccuracy`)
    if (!panel.speakerAttribution) failures.push(`${prefix}speakerAttribution`)
  }
  return failures
}

export const advancePageQaRepairStagnation = (
  state: PageQaRepairStagnationState,
  entry: PageQaEntry,
): PageQaRepairDecision => {
  const failures = getPageQaHardFailureKeys(entry)
  if (failures.length === 0) return { action: 'accept', repeatedHardFailures: [], state }
  const consecutiveFailures = Object.fromEntries(failures.map(failure => [failure, (state.consecutiveFailures[failure] ?? 0) + 1]))
  const repeatedHardFailures = failures.filter(failure => consecutiveFailures[failure]! >= 2)
  if (repeatedHardFailures.length === 0) {
    return { action: 'edit', repeatedHardFailures: [], state: { ...state, consecutiveFailures } }
  }
  if (!state.restartedFromCanonicalReferences) {
    return {
      action: 'restart',
      repeatedHardFailures,
      state: { consecutiveFailures: {}, restartedFromCanonicalReferences: true },
    }
  }
  return {
    action: 'stop',
    repeatedHardFailures,
    state: { ...state, consecutiveFailures },
  }
}

export const buildComicPageQaPrompt = (
  panelData: PanelBundleData,
  characterReferences: Array<{ key: string; description: string }> = [],
  locationReferences: Array<{ key: string; specification: string }> = [],
  designReferences: Array<{ key: string; usage: string }> = [],
): string => [
  'Judge this generated comic output strictly. The first image is the generated output. Following images are ordered canonical character references, followed by every immutable canonical location reference, then every mapped immutable canonical design reference, each in first-panel-appearance order.',
  `Location mapping: ${panelData.panels.map(panel => `panel ${panel.number} -> ${panel.locationKey}`).join('; ')}. Judge each panel only against its mapped location reference.`,
  'Evaluate panels left-to-right. Location identity, set continuity, source-instruction precedence, shot-plan framing/staging, exact cast, dialogue wording and completeness, and bubble-tail/speaker attribution are hard requirements. Artifacts, harmless typography substitutions, minor identity stylization variance, and aesthetic scores are advisory only. For every failed panel return concise actionable editInstructions in this same response.',
  'Perform a mandatory anchor-by-anchor continuity audit before setting setContinuityMatch. Identify permanent architecture, fixed furniture, installed equipment, and every recurring spatial anchor named or visibly established by the mapped canonical location reference/specification. Emit one setContinuityAudit entry for every such anchor, with concrete visual evidence and exactly one allowed status. Presence alone is insufficient: for fixed furniture and architecture, explicitly compare footprint, silhouette, connectedness, orientation, visible edge geometry, and wall relationships. Perspective may foreshorten them but may not turn a straight run into a corner, L-shaped, wraparound, split, or freestanding form; classify that as redesigned. There is no occluded status and character or prop blocking never excuses an unverifiable anchor. If the anchor\'s canonical region is inside the image but the anchor is not visibly identifiable, status is missing, even when a foreground object covers that region. Use outside-crop only when the anchor\'s entire canonical region is beyond the image boundary. Set setContinuityMatch=false if any anchor is missing, relocated, duplicated, mirrored, or redesigned without an explicit source-authored story event. A wide or otherwise revealing view that shows an anchor\'s canonical region but omits the anchor is a hard failure; do not infer that it was intentionally cropped. Judge world-space topology and relative relationships, not screen coordinates. A different camera side, angle, distance, elevation, perspective, or crop is desirable shot variation and must not fail set continuity, but characters and foreground props must be composed around a recognizable visible remainder of every anchor whose canonical region is in frame. Do not demand the canonical reference camera or a repeated composition.',
  'Audit canonical assemblies component by component: seeing a desk, console, shelf, rack, berth, or counter does not establish that its named computer, keyboard, control unit, appliance, instrument, or other co-located components are present. Loose tools, generic clutter, speakers, lamps, or plausible substitute props do not satisfy a missing named component. If the supporting desk, console, shelf, rack, berth, counter, wall zone, footprint, or expected silhouette is in frame but a named component is absent, hidden, or replaced by generic clutter, status is missing.',
  'Canonical character references and their catalog descriptions have highest visual precedence for identity, physical embodiment, projection/display medium, anatomy, costume, and character-specific required props. A generated image that violates this canon is a hard identity failure even when the source panel description or shot plan repeats the same contradiction. Set identityIssueKind=unmistakable-mismatch and provide repair instructions that restore the canonical embodiment.',
  'Dialogue accuracy is about legible wording, completeness, order, and meaning. Treat a Unicode ellipsis (…) and three consecutive periods (...), straight and curly quotation marks or apostrophes, and em/en dashes and hyphens as equivalent when the substitution does not change wording, meaning, speaker, or pacing. Set dialogueAccuracy=false for missing, added, illegible, or reordered words; wrong wording or speaker; or punctuation changes that materially change meaning or timing. Never fail dialogueAccuracy for a harmless typography-only substitution.',
  'Identity must remain clearly recognizable from the canonical character references. Set identityMatch=false only for an unmistakably wrong person, missing defining facial/costume/color features, or a major medium reinterpretation that prevents a clear canonical match. Minor body-width or proportion variance, pose-induced shape changes, shading/detail differences, and ordinary stylization variance are advisory when the character remains recognizable and preserves the canonical design cues. Do not also mark sourcePrecedence=false for the same identity concern unless the image independently contradicts an explicit source instruction.',
  'For each panel classify identityIssueKind as none, minor-variance, or unmistakable-mismatch, and classify dialogueIssueKind as none, typography-only, or content. These classifications must follow the tolerance rules above even when the corresponding raw boolean would otherwise be stricter.',
  `Canonical character catalog descriptions: ${characterReferences.length > 0 ? characterReferences.map(reference => `${reference.key}: ${reference.description}`).join(' | ') : 'none supplied; rely on the ordered canonical reference images.'}`,
  `Canonical location specifications: ${locationReferences.length > 0 ? locationReferences.map(reference => `${reference.key}: ${reference.specification}`).join(' | ') : 'none supplied; rely on the ordered canonical location images.'}`,
  `Canonical design requirements: ${designReferences.length > 0 ? designReferences.map(reference => `${reference.key}: ${reference.usage}`).join(' | ') : 'none supplied.'}`,
  'A mapped canonical design reference is a hard source-precedence requirement. Fail sourcePrecedence when the generated panel unmistakably redesigns, replaces, relabels, or omits a design whose usage requires it to be visible. Do not require a design in panels to which it is not mapped.',
  'Source panel data:', JSON.stringify(panelData, null, 2),
  'Return only the requested JSON.',
].join('\n\n')

export const judgeComicPage = async (request: PageQaRequest): Promise<PageQaEntry> => {
  const prompt = buildComicPageQaPrompt(request.panelData, request.characterReferences ?? [], request.locationReferences ?? [], request.designReferences ?? [])
  const imagePaths = [request.pagePath, ...request.identityCards, ...request.locationSheets, ...(request.designSheets ?? [])]
  const response = await createOpenAIResponse(getOpenAIClientConfig(), {
    model: request.model,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: prompt },
      ...(await Promise.all(imagePaths.map(async path => ({ type: 'input_image', image_url: await dataUrl(path), detail: 'high' })))),
    ] }],
    text: { verbosity: 'low', format: { type: 'json_schema', name: 'comic_page_qa_v1', schema: PAGE_QA_SCHEMA, strict: true } },
  })
  const text = extractOpenAIResponseText(response)
  if (!text) throw InfraError('Page QA judge returned no structured text.', { stage: 'comic:page-qa' })
  const result = applyPageQaTolerancePolicy(parseComicPageQaResult(text, request.panelData.panels.map(panel => panel.number)))
  const usageObject = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
  const inputTokens = typeof usageObject['input_tokens'] === 'number' ? usageObject['input_tokens'] : 0
  const outputTokens = typeof usageObject['output_tokens'] === 'number' ? usageObject['output_tokens'] : 0
  return {
    pageNumber: request.pageNumber,
    panelNumbers: request.panelData.panels.map(panel => panel.number),
    outputFile: basename(request.pagePath),
    judgeModel: request.model,
    hardFailure: hasHardPageQaFailure(result),
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
  const markdown = ['# Comic Page QA Report', '', `Hard failures: ${sorted.filter(entry => entry.hardFailure).length}`, `Waived shot-plan checks: ${sorted.reduce((count, entry) => count + (entry.waivedChecks?.length ?? 0), 0)}`, `Judge usage: ${usage.totalTokens} tokens; $${usage.costUsd.toFixed(4)}`, '', '| Page | Panels | Hard failure | Waived checks | Summary |', '|---:|:---|:---:|:---|:---|', ...sorted.map(entry => `| ${entry.pageNumber} | ${entry.panelNumbers.join(', ')} | ${entry.hardFailure ? 'yes' : 'no'} | ${entry.waivedChecks?.map(check => `panel ${check.panelNumber} ${check.check}`).join(', ') || 'none'} | ${entry.result.summary.replace(/\|/g, '\\|')} |`), '']
  await Bun.write(join(directory, 'page-qa-report.md'), markdown.join('\n'))
}
