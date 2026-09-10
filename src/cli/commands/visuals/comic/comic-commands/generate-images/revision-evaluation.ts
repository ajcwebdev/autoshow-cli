import { copyFile, mkdir, readdir, rename } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import * as v from 'valibot'
import type { ComicImageRequestInput, GenerateImagesCommandOptions, GeneratedImageResponse, ImageRunStats, PanelBundleData, ResolvedReferenceImages } from '~/types'
import { AppValidationError, InfraError, ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { getFfmpegBinary, toPosixPath } from '~/utils/runtime-paths'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { resolveCredential } from '~/utils/validate/env-utils'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { recordComicImageRevision } from '../../comic-utils/comic-manifest'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { getPanelPromptsDirectory, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { extractPanelBundleData, getPromptBundleFilename, resolveReferenceImages } from '../../comic-utils/panel-prompt-utils'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { createImageRunStats, estimateImageOutputCost } from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'

export const REVISION_IMAGE_MODEL = 'gpt-image-2'
export const REVISION_COMPARISON_MODEL = 'gemini-3.1-pro-preview'
export const REVISION_COMPARISON_PASSES = 2
export const REVISION_ESTIMATED_INPUT_TOKENS_PER_COMPARISON = 6500
export const REVISION_ESTIMATED_OUTPUT_TOKENS_PER_COMPARISON = 1200

const HASH_PATTERN = /^[a-f0-9]{64}$/
const WORKSPACE_ROOT = resolve(process.cwd())
const IMPORTANCE_VALUES = ['critical', 'high', 'medium', 'low', 'not-meaningful'] as const
const DEFECT_CATEGORY_VALUES = ['cast', 'dialogue-speaker', 'identity-costume', 'location-topology', 'set-continuity', 'staging-framing', 'source-prop', 'mixed', 'false-positive'] as const

const HashSchema = v.pipe(v.string(), v.regex(HASH_PATTERN, 'Expected a lowercase SHA-256 hash'))
const BoundFileSchema = v.strictObject({ path: v.string(), sha256: HashSchema })
const RevisionPlanEntrySchema = v.strictObject({
  panelNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  importance: v.picklist(IMPORTANCE_VALUES),
  defectCategory: v.picklist(DEFECT_CATEGORY_VALUES),
  originalFinding: v.pipe(v.string(), v.minLength(1)),
  correctionNote: v.pipe(v.string(), v.minLength(1)),
  originalProvider: v.pipe(v.string(), v.minLength(1)),
  original: BoundFileSchema,
  contract: BoundFileSchema,
  references: v.array(BoundFileSchema),
})
const RevisionPlanSchema = v.strictObject({
  schemaVersion: v.literal(1),
  experimentId: v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case experiment id')),
  createdAt: v.pipe(v.string(), v.minLength(1)),
  sceneSlug: v.pipe(v.string(), v.minLength(1)),
  script: BoundFileSchema,
  priorQa: BoundFileSchema,
  entries: v.pipe(v.array(RevisionPlanEntrySchema), v.minLength(1)),
  planFingerprint: HashSchema,
})

export type RevisionImportance = typeof IMPORTANCE_VALUES[number]
export type RevisionDefectCategory = typeof DEFECT_CATEGORY_VALUES[number]
export type RevisionBoundFile = { path: string; sha256: string }
export type RevisionPlanEntry = {
  panelNumber: number
  importance: RevisionImportance
  defectCategory: RevisionDefectCategory
  originalFinding: string
  correctionNote: string
  originalProvider: string
  original: RevisionBoundFile
  contract: RevisionBoundFile
  references: RevisionBoundFile[]
}
export type RevisionPlan = {
  schemaVersion: 1
  experimentId: string
  createdAt: string
  sceneSlug: string
  script: RevisionBoundFile
  priorQa: RevisionBoundFile
  entries: RevisionPlanEntry[]
  planFingerprint: string
}

export type RevisionComparisonRaw = {
  targetedDefectStatusImageA: 'visible' | 'partly-visible' | 'not-visible' | 'not-assessable'
  targetedDefectStatusImageB: 'visible' | 'partly-visible' | 'not-visible' | 'not-assessable'
  targetedDefectLowerIn: 'image-a' | 'image-b' | 'neither'
  differenceMeaningful: boolean
  majorRegressionImageA: boolean
  majorRegressionImageB: boolean
  nonTargetDifferenceLevel: 'none' | 'minor' | 'major'
  preservationRequirementsSatisfiedImageA: boolean
  preservationRequirementsSatisfiedImageB: boolean
  nonTargetDifferences: string[]
  fullContractPreference: 'image-a' | 'image-b' | 'tie'
  confidence: 'low' | 'medium' | 'high'
  regressionsImageA: string[]
  regressionsImageB: string[]
  rationale: string
}

export type RevisionComparisonNormalized = {
  comparisonContractVersion?: 3 | 4
  pass: 1 | 2
  order: { imageA: 'original' | 'candidate'; imageB: 'original' | 'candidate' }
  originalIssueVisible: boolean
  candidateIssueFixed: boolean
  targetedIssueMateriallyImproved: boolean
  differenceMeaningful: boolean
  candidateHasMajorRegression: boolean
  nonTargetDifferenceLevel?: 'none' | 'minor' | 'major'
  originalPreservationRequirementsSatisfied?: boolean
  candidatePreservationRequirementsSatisfied?: boolean
  candidateIntroducesPreservationRegression?: boolean
  nonTargetDifferences?: string[]
  preference: 'original' | 'candidate' | 'tie'
  confidence: 'low' | 'medium' | 'high'
  candidateRegressions: string[]
  originalRegressions?: string[]
  rationale: string
}

type ComparisonResponse = { text: string; inputTokens: number; outputTokens: number }
type SimilarityMeasurements = { ssim: number; normalizedRmse: number }
type SlotStatus = 'in-flight' | 'completed' | 'failed' | 'malformed' | 'ambiguous'
type PanelLedger = {
  schemaVersion: 1
  planFingerprint: string
  panelNumber: number
  originalSha256: string
  imageSlot?: { status: SlotStatus; attempts: number; startedAt: string; completedAt?: string; error?: string; estimatedCostUsd?: number; usage?: { imageInputUnits: number; textInputUnits: number; outputUnits: number } }
  candidateSha256?: string
  comparisonSlots: Array<{ pass: 1 | 2; status: SlotStatus; attempts: number; startedAt: string; completedAt?: string; error?: string; usage?: { inputTokens: number; outputTokens: number; costUsd: number }; normalized?: RevisionComparisonNormalized }>
  similarity?: SimilarityMeasurements
  decision?: 'clear-winner' | 'retain-original' | 'incomplete'
  decisionReason?: string
  promoted?: boolean
  canonicalSha256After?: string
}

export type RevisionEvaluationDependencies = {
  requestImage?: (input: ComicImageRequestInput) => Promise<GeneratedImageResponse>
  requestComparison?: (input: { prompt: string; imagePaths: string[]; model: string }) => Promise<ComparisonResponse>
  writeImage?: (path: string, imageBase64: string, mimeType?: string) => Promise<void>
  measureSimilarity?: (originalPath: string, candidatePath: string) => Promise<SimilarityMeasurements>
  recordManifest?: (input: Parameters<typeof recordComicImageRevision>[0]) => Promise<unknown>
  now?: () => string
}

export type RevisionEvaluationResult = {
  evidenceDirectory: string
  planFingerprint: string
  ledgers: PanelLedger[]
  stats: ImageRunStats
  promotedPanels: number[]
}

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

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const sha256Text = (value: string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const sha256File = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

export const computeRevisionPlanFingerprint = (plan: Omit<RevisionPlan, 'planFingerprint'>): string => sha256Text(canonicalJson(plan))

const validateBoundPath = (path: string, label: string): string => {
  if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw ValidationError(`${label} must be a safe project-relative path: ${path}`, { stage: 'comic:revision-evaluation' })
  const absolute = resolve(WORKSPACE_ROOT, path)
  const rel = relative(WORKSPACE_ROOT, absolute)
  if (rel.startsWith('..') || isAbsolute(rel)) throw ValidationError(`${label} escapes the project root: ${path}`, { stage: 'comic:revision-evaluation' })
  return absolute
}

const assertBoundFile = async (file: RevisionBoundFile, label: string): Promise<string> => {
  const absolute = validateBoundPath(file.path, label)
  if (!(await Bun.file(absolute).exists())) throw ValidationError(`${label} is missing: ${file.path}`, { stage: 'comic:revision-evaluation' })
  const actual = await sha256File(absolute)
  if (actual !== file.sha256) throw ValidationError(`${label} hash drift for ${file.path}: expected ${file.sha256}, received ${actual}`, { stage: 'comic:revision-evaluation' })
  return absolute
}

export const parseRevisionPlan = (value: unknown): RevisionPlan => {
  let plan: RevisionPlan
  try { plan = v.parse(RevisionPlanSchema, value) as RevisionPlan } catch (error) {
    throw ValidationError(`Revision plan schema validation failed: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:revision-evaluation', ...(error instanceof Error ? { cause: error } : {}) })
  }
  const panelNumbers = plan.entries.map(entry => entry.panelNumber)
  if (new Set(panelNumbers).size !== panelNumbers.length) throw ValidationError('Revision plan contains duplicate panel numbers.', { stage: 'comic:revision-evaluation' })
  if (panelNumbers.some((number, index) => index > 0 && number <= panelNumbers[index - 1]!)) throw ValidationError('Revision plan entries must be sorted by strictly increasing panel number.', { stage: 'comic:revision-evaluation' })
  const { planFingerprint: _fingerprint, ...unsigned } = plan
  const actualFingerprint = computeRevisionPlanFingerprint(unsigned)
  if (actualFingerprint !== plan.planFingerprint) throw ValidationError(`Revision plan fingerprint mismatch: expected ${plan.planFingerprint}, computed ${actualFingerprint}`, { stage: 'comic:revision-evaluation' })
  return plan
}

type LoadedRevisionEntry = RevisionPlanEntry & { originalPath: string; contractPath: string; bundleData: PanelBundleData; referencesResolved: ResolvedReferenceImages }
export type LoadedRevisionPlan = { plan: RevisionPlan; planPath: string; entries: LoadedRevisionEntry[]; evidenceDirectory: string }

export type RevisionPriceInventory = {
  loaded: LoadedRevisionPlan
  imageCalls: number
  comparisonCalls: number
  completedImageSlots: number
  terminalImageSlots: number
  reusedComparisonSlots: number
}

const panelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`
const ledgerPathFor = (evidenceDirectory: string, panelNumber: number): string => join(evidenceDirectory, panelDirectoryName(panelNumber), 'panel-ledger.json')

const readLedger = async (path: string): Promise<PanelLedger | undefined> => {
  if (!(await Bun.file(path).exists())) return undefined
  try { return JSON.parse(await Bun.file(path).text()) as PanelLedger } catch (error) {
    throw ValidationError(`Revision ledger is unreadable: ${path}`, { stage: 'comic:revision-evaluation', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

const selectedPanelsMatch = (selection: GenerateImagesCommandOptions['panels'], planPanels: number[]): boolean => {
  if (selection === undefined || selection === 'all') return true
  return selection.length === planPanels.length && selection.every((panel, index) => panel === planPanels[index])
}

export const loadRevisionEvaluationPlan = async (options: GenerateImagesCommandOptions): Promise<LoadedRevisionPlan> => {
  if (!options.revisionPlan) throw ValidationError('Revision evaluation requires --revision-plan.', { stage: 'comic:revision-evaluation' })
  const planPath = resolve(WORKSPACE_ROOT, options.revisionPlan)
  let raw: unknown
  try { raw = JSON.parse(await Bun.file(planPath).text()) } catch (error) {
    throw ValidationError(`Revision plan could not be read as JSON: ${options.revisionPlan}`, { stage: 'comic:revision-evaluation', ...(error instanceof Error ? { cause: error } : {}) })
  }
  const plan = parseRevisionPlan(raw)
  if (plan.sceneSlug !== options.sceneSlug) throw ValidationError(`Revision plan scene ${plan.sceneSlug} does not match command scene ${options.sceneSlug}.`, { stage: 'comic:revision-evaluation' })
  const planPanels = plan.entries.map(entry => entry.panelNumber)
  if (!selectedPanelsMatch(options.panels, planPanels)) throw ValidationError(`--panels must exactly match the revision plan panels: ${planPanels.join(',')}`, { stage: 'comic:revision-evaluation' })
  const scriptPath = await assertBoundFile(plan.script, 'Revision plan script')
  if (resolve(scriptPath) !== resolve(WORKSPACE_ROOT, options.scriptPath)) throw ValidationError(`Revision plan script ${plan.script.path} does not match command script ${toPosixPath(relative(WORKSPACE_ROOT, resolve(WORKSPACE_ROOT, options.scriptPath)))}.`, { stage: 'comic:revision-evaluation' })
  await assertBoundFile(plan.priorQa, 'Revision plan prior QA')
  const evidenceDirectory = join(getSceneOutputDirectory(options.sceneSlug), 'revision-evaluations', `${plan.experimentId}-${plan.planFingerprint.slice(0, 16)}`)
  const panelPromptsDirectory = getPanelPromptsDirectory(options.sceneSlug)
  const entries: LoadedRevisionEntry[] = []
  for (const entry of plan.entries) {
    const originalPath = validateBoundPath(entry.original.path, `Panel ${entry.panelNumber} original`)
    const canonicalPath = resolve(getPanelComicImagePath(options.sceneSlug, entry.panelNumber))
    if (resolve(originalPath) !== canonicalPath) throw ValidationError(`Panel ${entry.panelNumber} original path is not the canonical panel path.`, { stage: 'comic:revision-evaluation' })
    const existingLedger = await readLedger(ledgerPathFor(evidenceDirectory, entry.panelNumber))
    const originalActual = await sha256File(originalPath)
    const resumedPromotion = existingLedger?.promoted === true && existingLedger.candidateSha256 === originalActual
    if (originalActual !== entry.original.sha256 && !resumedPromotion) throw ValidationError(`Panel ${entry.panelNumber} original hash drift: expected ${entry.original.sha256}, received ${originalActual}`, { stage: 'comic:revision-evaluation' })
    const panelDirectory = join(panelPromptsDirectory, panelDirectoryName(entry.panelNumber))
    const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
    const contractPath = join(panelDirectory, getPromptBundleFilename(panelDirectory, panelEntries))
    if (resolve(validateBoundPath(entry.contract.path, `Panel ${entry.panelNumber} contract`)) !== resolve(contractPath)) throw ValidationError(`Panel ${entry.panelNumber} contract path does not match the reviewed panel bundle.`, { stage: 'comic:revision-evaluation' })
    await assertBoundFile(entry.contract, `Panel ${entry.panelNumber} contract`)
    const bundleData = extractPanelBundleData(await Bun.file(contractPath).text())
    const referencesResolved = resolveReferenceImages(panelDirectory, panelEntries, bundleData, REVISION_IMAGE_MODEL)
    const actualReferencePaths = referencesResolved.all.map(path => toPosixPath(relative(WORKSPACE_ROOT, resolve(WORKSPACE_ROOT, path))))
    if (entry.references.length !== actualReferencePaths.length || entry.references.some((reference, index) => reference.path !== actualReferencePaths[index])) throw ValidationError(`Panel ${entry.panelNumber} reference list/order drifted from the immutable reviewed bundle.`, { stage: 'comic:revision-evaluation' })
    for (const [index, reference] of entry.references.entries()) await assertBoundFile(reference, `Panel ${entry.panelNumber} reference ${index + 1}`)
    validateReferenceImageCount(REVISION_IMAGE_MODEL, referencesResolved.all.length + 1, `Revision edit for panel ${entry.panelNumber}`)
    entries.push({ ...entry, originalPath, contractPath, bundleData, referencesResolved })
  }
  return { plan, planPath, entries, evidenceDirectory }
}

export const loadRevisionPriceInventory = async (options: GenerateImagesCommandOptions): Promise<RevisionPriceInventory> => {
  const loaded = await loadRevisionEvaluationPlan(options)
  let imageCalls = 0
  let comparisonCalls = 0
  let completedImageSlots = 0
  let terminalImageSlots = 0
  let reusedComparisonSlots = 0
  for (const entry of loaded.entries) {
    const ledger = await readLedger(ledgerPathFor(loaded.evidenceDirectory, entry.panelNumber))
    if (!ledger?.imageSlot) {
      imageCalls += 1
      comparisonCalls += REVISION_COMPARISON_PASSES
      continue
    }
    terminalImageSlots += 1
    if (ledger.imageSlot.status !== 'completed') continue
    completedImageSlots += 1
    for (const pass of [1, 2] as const) {
      const slot = ledger.comparisonSlots.find(item => item.pass === pass)
      if (!slot) comparisonCalls += 1
      else reusedComparisonSlots += 1
    }
  }
  return { loaded, imageCalls, comparisonCalls, completedImageSlots, terminalImageSlots, reusedComparisonSlots }
}

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

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'
const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

const defaultRequestComparison = async (input: { prompt: string; imagePaths: string[]; model: string }): Promise<ComparisonResponse> => {
  const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:revision-comparison', description: 'Comic revision comparison' }), {
    model: input.model,
    contents: geminiUserContent([{ text: input.prompt }, ...(await Promise.all(input.imagePaths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } }))))]),
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: REVISION_COMPARISON_SCHEMA },
  })
  if (!response.text) throw InfraError('Revision comparison returned no structured text.', { stage: 'comic:revision-comparison' })
  return { text: response.text, inputTokens: response.usageMetadata?.promptTokenCount ?? 0, outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0) }
}

const buildRevisionPrompt = (entry: LoadedRevisionEntry): string => [
  'Perform exactly one tightly targeted edit of Image 1, the existing canonical panel.',
  'Images after Image 1 are immutable canonical character, location, and design references in contract order.',
  `Frozen issue finding: ${entry.originalFinding}`,
  `Only requested correction: ${entry.correctionNote}`,
  'Preserve every other visible choice from Image 1: composition, camera, poses, expressions, dialogue, lettering, lighting, palette, linework, props, background, and character placement unless the correction explicitly requires changing it.',
  'Do not make the panel merely prettier, reinterpret the scene, add content, remove content, or fix unrelated details.',
  'Return one revised panel with no commentary.',
  `Reviewed full panel contract:\n${JSON.stringify(entry.bundleData)}`,
].join('\n\n')

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

const runFfmpegMetric = async (originalPath: string, candidatePath: string, filter: 'ssim' | 'psnr'): Promise<string> => {
  const normalize = 'scale=384:256:flags=lanczos,setsar=1,format=yuv444p'
  const filterGraph = `[0:v]${normalize}[original];[1:v]${normalize}[candidate];[original][candidate]${filter}`
  const process = Bun.spawn([getFfmpegBinary(), '-hide_banner', '-nostdin', '-i', originalPath, '-i', candidatePath, '-filter_complex', filterGraph, '-f', 'null', '-'], { stdout: 'pipe', stderr: 'pipe' })
  const [, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (exitCode !== 0) throw ValidationError(`FFmpeg ${filter} comparison failed: ${stderr.trim()}`, { stage: 'comic:revision-similarity' })
  return stderr
}

export const measureRevisionSimilarity = async (originalPath: string, candidatePath: string): Promise<SimilarityMeasurements> => {
  const [ssimOutput, psnrOutput] = await Promise.all([runFfmpegMetric(originalPath, candidatePath, 'ssim'), runFfmpegMetric(originalPath, candidatePath, 'psnr')])
  const ssimMatch = ssimOutput.match(/All:([0-9.]+)/)
  const mseMatch = psnrOutput.match(/mse_avg:([0-9.]+)/)
  const averagePsnrMatch = psnrOutput.match(/average:([0-9.]+)/)
  if (!ssimMatch?.[1] || (!mseMatch?.[1] && !averagePsnrMatch?.[1])) throw ValidationError('FFmpeg did not report parseable SSIM/RMSE measurements.', { stage: 'comic:revision-similarity' })
  const normalizedRmse = mseMatch?.[1]
    ? Math.sqrt(Number(mseMatch[1])) / 255
    : 10 ** (-Number(averagePsnrMatch?.[1]) / 20)
  return { ssim: Number(ssimMatch[1]), normalizedRmse }
}

const createInitialLedger = (planFingerprint: string, entry: RevisionPlanEntry): PanelLedger => ({ schemaVersion: 1, planFingerprint, panelNumber: entry.panelNumber, originalSha256: entry.original.sha256, comparisonSlots: [] })

const loadOrCreateLedger = async (loaded: LoadedRevisionPlan, entry: LoadedRevisionEntry): Promise<{ path: string; directory: string; ledger: PanelLedger }> => {
  const directory = join(loaded.evidenceDirectory, panelDirectoryName(entry.panelNumber))
  const path = ledgerPathFor(loaded.evidenceDirectory, entry.panelNumber)
  await mkdir(directory, { recursive: true })
  const existing = await readLedger(path)
  const ledger = existing ?? createInitialLedger(loaded.plan.planFingerprint, entry)
  if (ledger.planFingerprint !== loaded.plan.planFingerprint || ledger.panelNumber !== entry.panelNumber || ledger.originalSha256 !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} ledger does not match the revision plan.`, { stage: 'comic:revision-evaluation' })
  if (!existing) await atomicWriteJson(path, ledger)
  return { path, directory, ledger }
}

const reconcileCompletedComparisonNormalization = async (input: { ledger: PanelLedger; ledgerPath: string; panelDirectory: string; now: () => string }): Promise<void> => {
  let changed = false
  for (const slot of input.ledger.comparisonSlots) {
    if (slot.status !== 'completed' || slot.normalized?.comparisonContractVersion === 4) continue
    const evidencePath = join(input.panelDirectory, `comparison-pass-${slot.pass}.json`)
    let evidence: Record<string, unknown>
    try { evidence = JSON.parse(await Bun.file(evidencePath).text()) as Record<string, unknown> } catch (error) {
      throw ValidationError(`Completed comparison evidence is unreadable for pass ${slot.pass}: ${evidencePath}`, { stage: 'comic:revision-comparison', ...(error instanceof Error ? { cause: error } : {}) })
    }
    if (evidence['planFingerprint'] !== input.ledger.planFingerprint || evidence['panelNumber'] !== input.ledger.panelNumber || evidence['pass'] !== slot.pass) throw ValidationError(`Completed comparison evidence does not match its ledger for pass ${slot.pass}.`, { stage: 'comic:revision-comparison' })
    const raw = parseRevisionComparison(JSON.stringify(evidence['raw']))
    const normalized = normalizeRevisionComparison(raw, slot.pass)
    slot.normalized = normalized
    await atomicWriteJson(evidencePath, { ...evidence, normalized, normalizationReconciliation: { comparisonContractVersion: 4, reconciledAt: input.now(), reason: 'Reclassified shared pre-existing defects separately from candidate-introduced preservation regressions; no provider call was made.' } })
    changed = true
  }
  if (changed) await atomicWriteJson(input.ledgerPath, input.ledger)
}

const completeImageSlot = async (input: { loaded: LoadedRevisionPlan; entry: LoadedRevisionEntry; ledger: PanelLedger; ledgerPath: string; panelDirectory: string; options: GenerateImagesCommandOptions; dependencies: RevisionEvaluationDependencies; hostedIndex: number }): Promise<void> => {
  const { entry, ledger, ledgerPath, panelDirectory, options, dependencies } = input
  const candidatePath = join(panelDirectory, 'candidate.png')
  if (ledger.imageSlot?.status === 'in-flight') {
    ledger.imageSlot = { ...ledger.imageSlot, status: 'ambiguous', completedAt: (dependencies.now ?? (() => new Date().toISOString()))(), error: 'Prior execution ended with an in-flight image slot; automatic redispatch is forbidden.' }
    await atomicWriteJson(ledgerPath, ledger)
    return
  }
  if (ledger.imageSlot) return
  const now = dependencies.now ?? (() => new Date().toISOString())
  const imageSlot: NonNullable<PanelLedger['imageSlot']> = { status: 'in-flight', attempts: 1, startedAt: now() }
  ledger.imageSlot = imageSlot
  await atomicWriteJson(ledgerPath, ledger)
  try {
    const requestImage = dependencies.requestImage ?? (async request => await createImage(request.normalizedPrompt, request.referenceImages, request.model, request.size, request.quality))
    const response = await runComicHostedRequest({ concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY, hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator }, 'openai', 'comic-image', `${options.sceneSlug}:revision:panel-${entry.panelNumber}`, input.hostedIndex, async () => await requestImage({ normalizedPrompt: buildRevisionPrompt(entry), referenceImages: [entry.originalPath, ...entry.referencesResolved.all], model: REVISION_IMAGE_MODEL, size: options.size ?? '1536x1024', quality: options.quality ?? 'high' }))
    await (dependencies.writeImage ?? writeGeneratedImage)(candidatePath, response.result.imageBase64, response.result.mimeType)
    ledger.candidateSha256 = await sha256File(candidatePath)
    const estimatedCostUsd = estimateImageOutputCost(REVISION_IMAGE_MODEL, options.quality ?? 'high', options.size ?? '1536x1024')
    const usage = response.usage ? { imageInputUnits: response.usage.imageInputUnits ?? 0, textInputUnits: response.usage.textInputUnits ?? 0, outputUnits: response.usage.outputUnits ?? 0 } : undefined
    ledger.imageSlot = { ...imageSlot, status: 'completed', completedAt: now(), ...(estimatedCostUsd !== null ? { estimatedCostUsd } : {}), ...(usage ? { usage } : {}) }
  } catch (error) {
    ledger.imageSlot = { ...imageSlot, status: 'ambiguous', completedAt: now(), error: error instanceof Error ? error.message : String(error) }
  }
  await atomicWriteJson(ledgerPath, ledger)
  if (ledger.imageSlot?.status === 'completed') ledger.similarity = await (dependencies.measureSimilarity ?? measureRevisionSimilarity)(join(panelDirectory, 'original.png'), candidatePath)
  await atomicWriteJson(ledgerPath, ledger)
}

const completeComparisonSlot = async (input: { entry: LoadedRevisionEntry; ledger: PanelLedger; ledgerPath: string; panelDirectory: string; pass: 1 | 2; options: GenerateImagesCommandOptions; dependencies: RevisionEvaluationDependencies; hostedIndex: number }): Promise<void> => {
  const { entry, ledger, ledgerPath, panelDirectory, pass, options, dependencies } = input
  const existing = ledger.comparisonSlots.find(slot => slot.pass === pass)
  const now = dependencies.now ?? (() => new Date().toISOString())
  if (existing?.status === 'in-flight') {
    existing.status = 'ambiguous'; existing.completedAt = now(); existing.error = 'Prior execution ended with an in-flight comparison slot; automatic redispatch is forbidden.'
    await atomicWriteJson(ledgerPath, ledger)
    return
  }
  if (existing) return
  const slot: PanelLedger['comparisonSlots'][number] = { pass, status: 'in-flight', attempts: 1, startedAt: now() }
  ledger.comparisonSlots.push(slot)
  ledger.comparisonSlots.sort((left, right) => left.pass - right.pass)
  await atomicWriteJson(ledgerPath, ledger)
  const originalEvidencePath = join(panelDirectory, 'original.png')
  const candidatePath = join(panelDirectory, 'candidate.png')
  const imagePaths = pass === 1 ? [originalEvidencePath, candidatePath, ...entry.referencesResolved.all] : [candidatePath, originalEvidencePath, ...entry.referencesResolved.all]
  let rawText: string | undefined
  try {
    const response = await runComicHostedRequest({ concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY, hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator }, 'gemini', 'comic-qa', `${options.sceneSlug}:revision-compare:panel-${entry.panelNumber}:pass-${pass}`, input.hostedIndex, async () => await (dependencies.requestComparison ?? defaultRequestComparison)({ prompt: buildRevisionComparisonPrompt(entry, pass), imagePaths, model: REVISION_COMPARISON_MODEL }))
    rawText = response.text
    const raw = parseRevisionComparison(response.text)
    const normalized = normalizeRevisionComparison(raw, pass)
    const costUsd = estimateLlmCostFromRegistry(REVISION_COMPARISON_MODEL, response.inputTokens, response.outputTokens)
    Object.assign(slot, { status: 'completed' as const, completedAt: now(), usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens, costUsd }, normalized })
    await atomicWriteJson(join(panelDirectory, `comparison-pass-${pass}.json`), { schemaVersion: 1, planFingerprint: ledger.planFingerprint, panelNumber: entry.panelNumber, pass, raw, normalized, usage: slot.usage })
  } catch (error) {
    slot.status = error instanceof AppValidationError ? 'malformed' : 'failed'
    slot.completedAt = now(); slot.error = error instanceof Error ? error.message : String(error)
    await atomicWriteJson(join(panelDirectory, `comparison-pass-${pass}-error.json`), { schemaVersion: 1, planFingerprint: ledger.planFingerprint, panelNumber: entry.panelNumber, pass, error: slot.error, ...(rawText !== undefined ? { rawText } : {}) })
  }
  await atomicWriteJson(ledgerPath, ledger)
}

const atomicPromote = async (candidatePath: string, canonicalPath: string, expectedCandidateSha256: string): Promise<string> => {
  const temporary = `${canonicalPath}.revision-${crypto.randomUUID()}.tmp`
  await copyFile(candidatePath, temporary)
  if (await sha256File(temporary) !== expectedCandidateSha256) throw ValidationError(`Staged revision bytes do not match candidate ${basename(candidatePath)}.`, { stage: 'comic:revision-promotion' })
  await rename(temporary, canonicalPath)
  const actual = await sha256File(canonicalPath)
  if (actual !== expectedCandidateSha256) throw ValidationError(`Promoted canonical bytes do not match candidate ${basename(candidatePath)}.`, { stage: 'comic:revision-promotion' })
  return actual
}

const canonicalPanelArtifactRefs = async (sceneDirectory: string): Promise<Array<{ path: string; sha256: string }>> => {
  const panelsDirectory = join(sceneDirectory, 'panels')
  const entries = (await readdir(panelsDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && /^panel-\d+\.png$/.test(entry.name)).sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
  return await Promise.all(entries.map(async entry => ({ path: toPosixPath(relative(sceneDirectory, join(panelsDirectory, entry.name))), sha256: await sha256File(join(panelsDirectory, entry.name)) })))
}

export const runRevisionEvaluation = async (options: GenerateImagesCommandOptions, dependencies: RevisionEvaluationDependencies = {}): Promise<RevisionEvaluationResult> => {
  const loaded = await loadRevisionEvaluationPlan(options)
  await mkdir(loaded.evidenceDirectory, { recursive: true })
  await copyFile(loaded.planPath, join(loaded.evidenceDirectory, 'revision-plan.json'))
  const imageIndexByPanel = new Map(loaded.entries.map((entry, index) => [entry.panelNumber, index]))
  const results = await mapWithConcurrency(options.concurrency ?? DEFAULT_CLI_CONCURRENCY, loaded.entries, async entry => {
    const state = await loadOrCreateLedger(loaded, entry)
    await reconcileCompletedComparisonNormalization({ ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, now: dependencies.now ?? (() => new Date().toISOString()) })
    const originalEvidencePath = join(state.directory, 'original.png')
    if (!(await Bun.file(originalEvidencePath).exists())) await copyFile(entry.originalPath, originalEvidencePath)
    if (await sha256File(originalEvidencePath) !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} original evidence hash does not match the frozen plan.`, { stage: 'comic:revision-evaluation' })
    await completeImageSlot({ loaded, entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, options, dependencies, hostedIndex: imageIndexByPanel.get(entry.panelNumber)! })
    if (state.ledger.imageSlot?.status === 'completed') {
      const candidatePath = join(state.directory, 'candidate.png')
      if (!(await Bun.file(candidatePath).exists()) || await sha256File(candidatePath) !== state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} completed image slot has missing or drifted candidate evidence.`, { stage: 'comic:revision-evaluation' })
      if (!state.ledger.similarity) {
        state.ledger.similarity = await (dependencies.measureSimilarity ?? measureRevisionSimilarity)(originalEvidencePath, candidatePath)
        await atomicWriteJson(state.path, state.ledger)
      }
      await completeComparisonSlot({ entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, pass: 1, options, dependencies, hostedIndex: loaded.entries.length + imageIndexByPanel.get(entry.panelNumber)! * 2 })
      await completeComparisonSlot({ entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, pass: 2, options, dependencies, hostedIndex: loaded.entries.length + imageIndexByPanel.get(entry.panelNumber)! * 2 + 1 })
    }
    const comparisons = state.ledger.comparisonSlots.flatMap(slot => slot.status === 'completed' && slot.normalized ? [slot.normalized] : [])
    const outcome = decideRevisionPromotion(entry.importance, comparisons)
    state.ledger.decision = outcome.decision; state.ledger.decisionReason = outcome.reason
    const canonical = await sha256File(entry.originalPath)
    if (outcome.decision === 'clear-winner') {
      if (!state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} clear winner is missing a candidate hash.`, { stage: 'comic:revision-promotion' })
      if (canonical !== entry.original.sha256 && canonical !== state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} clear-winner canonical bytes match neither the frozen original nor candidate.`, { stage: 'comic:revision-promotion' })
      state.ledger.canonicalSha256After = canonical
      state.ledger.promoted = canonical === state.ledger.candidateSha256
    } else {
      if (canonical !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} non-winner canonical bytes changed.`, { stage: 'comic:revision-promotion' })
      state.ledger.canonicalSha256After = canonical
      state.ledger.promoted = false
    }
    await atomicWriteJson(state.path, state.ledger)
    return state.ledger
  })
  const stats = createImageRunStats()
  stats.imagesGenerated = results.filter(ledger => ledger.imageSlot?.status === 'completed').length
  stats.imagesSkipped = results.length - stats.imagesGenerated
  stats.totalCost = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.estimatedCostUsd ?? 0) + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.costUsd ?? 0), 0), 0)
  stats.totalInputTokens = results.reduce((sum, ledger) => sum + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.inputTokens ?? 0), 0), 0)
  stats.totalOutputTokens = results.reduce((sum, ledger) => sum + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.outputTokens ?? 0), 0), 0)
  stats.totalInputImageTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.imageInputUnits ?? 0), 0)
  stats.totalInputTextTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.textInputUnits ?? 0), 0)
  stats.totalOutputImageTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.outputUnits ?? 0), 0)
  const promotedPanels = results.filter(ledger => ledger.decision === 'clear-winner').map(ledger => ledger.panelNumber)
  const retainedOriginalPanels = results.filter(ledger => ledger.decision !== 'clear-winner').map(ledger => ledger.panelNumber)
  const sceneDirectory = getSceneOutputDirectory(options.sceneSlug)
  const completedComparisons = results.reduce((sum, item) => sum + item.comparisonSlots.filter(slot => slot.status === 'completed').length, 0)
  const comparisonAttempts = results.reduce((sum, item) => sum + item.comparisonSlots.length, 0)
  const winnerHashByPath = new Map<string, string>(results.flatMap(ledger => ledger.decision === 'clear-winner' && ledger.candidateSha256
    ? [[`panels/panel-${String(ledger.panelNumber).padStart(2, '0')}.png`, ledger.candidateSha256] as const]
    : []))
  const artifactRefs = (await canonicalPanelArtifactRefs(sceneDirectory)).map(ref => ({ ...ref, sha256: winnerHashByPath.get(ref.path) ?? ref.sha256 }))
  const entryByPanel = new Map(loaded.entries.map(entry => [entry.panelNumber, entry] as const))
  const publishedThisRun = new Set<number>()
  const publishFinal = async (): Promise<Array<{ path: string; sha256: string }>> => {
    for (const ledger of results.filter(item => item.decision === 'clear-winner')) {
      const entry = entryByPanel.get(ledger.panelNumber)
      if (!entry || !ledger.candidateSha256) throw ValidationError(`Panel ${ledger.panelNumber} clear winner is missing publication state.`, { stage: 'comic:revision-promotion' })
      const current = await sha256File(entry.originalPath)
      if (current !== ledger.candidateSha256) {
        if (current !== entry.original.sha256) throw ValidationError(`Panel ${ledger.panelNumber} canonical bytes drifted before revision publication.`, { stage: 'comic:revision-promotion' })
        await atomicPromote(join(loaded.evidenceDirectory, panelDirectoryName(ledger.panelNumber), 'candidate.png'), entry.originalPath, ledger.candidateSha256)
        publishedThisRun.add(ledger.panelNumber)
      }
      ledger.promoted = true
      ledger.canonicalSha256After = ledger.candidateSha256
      await atomicWriteJson(ledgerPathFor(loaded.evidenceDirectory, ledger.panelNumber), ledger)
    }
    return await canonicalPanelArtifactRefs(sceneDirectory)
  }
  const rollbackFinal = async (): Promise<void> => {
    for (const panelNumber of publishedThisRun) {
      const entry = entryByPanel.get(panelNumber)
      const ledger = results.find(item => item.panelNumber === panelNumber)
      if (!entry || !ledger) continue
      await atomicPromote(join(loaded.evidenceDirectory, panelDirectoryName(panelNumber), 'original.png'), entry.originalPath, entry.original.sha256)
      ledger.promoted = false
      ledger.canonicalSha256After = entry.original.sha256
      await atomicWriteJson(ledgerPathFor(loaded.evidenceDirectory, panelNumber), ledger)
    }
  }
  await (dependencies.recordManifest ?? recordComicImageRevision)({
    sceneRunDir: sceneDirectory,
    evaluation: {
      schemaVersion: 1,
      experimentId: loaded.plan.experimentId,
      planFingerprint: loaded.plan.planFingerprint,
      evidenceDirectory: toPosixPath(relative(sceneDirectory, loaded.evidenceDirectory)),
      imageProvider: { service: 'openai', model: REVISION_IMAGE_MODEL, attempts: results.filter(item => item.imageSlot).length, completed: stats.imagesGenerated, ambiguous: results.filter(item => item.imageSlot?.status === 'ambiguous').length },
      comparisonProvider: { service: 'gemini', model: REVISION_COMPARISON_MODEL, attempts: comparisonAttempts, completed: completedComparisons, invalid: comparisonAttempts - completedComparisons },
      promotedPanels,
      retainedOriginalPanels,
      actualCostUsd: stats.totalCost,
    },
    artifactRefs,
    publishFinal,
    rollbackFinal,
  })
  const runLedger = { schemaVersion: 1, mode: 'revision-evaluation', experimentId: loaded.plan.experimentId, sceneSlug: loaded.plan.sceneSlug, planFingerprint: loaded.plan.planFingerprint, imageModel: REVISION_IMAGE_MODEL, comparisonModel: REVISION_COMPARISON_MODEL, comparisonPasses: REVISION_COMPARISON_PASSES, promotionPolicy: 'clear-winners', imageSlots: { total: results.length, completed: stats.imagesGenerated, ambiguous: results.filter(item => item.imageSlot?.status === 'ambiguous').length }, comparisonSlots: { totalPossible: stats.imagesGenerated * 2, completed: completedComparisons, failedOrMalformedOrAmbiguous: results.reduce((sum, item) => sum + item.comparisonSlots.filter(slot => slot.status !== 'completed').length, 0) }, promotedPanels, retainedOriginalPanels, usage: { inputTokens: stats.totalInputTokens, outputTokens: stats.totalOutputTokens, imageInputUnits: stats.totalInputImageTokens, estimatedAndRecordedCostUsd: stats.totalCost }, panels: results }
  await atomicWriteJson(join(loaded.evidenceDirectory, 'revision-evaluation.json'), runLedger)
  return { evidenceDirectory: loaded.evidenceDirectory, planFingerprint: loaded.plan.planFingerprint, ledgers: results, stats, promotedPanels }
}
