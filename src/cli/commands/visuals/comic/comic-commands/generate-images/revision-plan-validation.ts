import { readdir } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import * as v from 'valibot'
import type { GenerateImagesCommandOptions } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { toPosixPath } from '~/utils/runtime-paths'
import { extractPanelBundleData, getPromptBundleFilename, resolveReferenceImages } from '../../comic-utils/panel-prompt-utils'
import { getPanelPromptsDirectory, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { DEFECT_CATEGORY_VALUES, IMPORTANCE_VALUES, REVISION_COMPARISON_PASSES, REVISION_IMAGE_MODEL } from './revision-evaluation-config'
import type { LoadedRevisionEntry, LoadedRevisionPlan, RevisionBoundFile, RevisionPlan, RevisionPriceInventory } from './revision-evaluation-types'
import { ledgerPathFor, panelDirectoryName, readLedger, sha256File } from './revision-evidence-files'

const HASH_PATTERN = /^[a-f0-9]{64}$/

const WORKSPACE_ROOT = resolve(process.cwd())

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

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const sha256Text = (value: string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')

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
