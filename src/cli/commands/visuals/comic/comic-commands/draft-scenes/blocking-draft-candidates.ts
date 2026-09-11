import * as v from 'valibot'
import type { BlockingBindings, BlockingPlan, BlockingPlanInputs, BlockingScenePanelInput, BlockingValidationContext } from '~/types'
import { isRecord } from '~/utils/value-helpers'
import { hashBlockingPlan } from '../../comic-utils/blocking-plan-compile'
import { hashSourceSegmentText, validateBlockingPlan, validateScenePanelBlocking } from '../../comic-utils/blocking-plan-validation'
import { specificationHash } from '../../comic-utils/location-reference'
import { BLOCKING_BINDINGS_SCHEMA_VERSION, BLOCKING_PLAN_SCHEMA_VERSION, BlockingBindingsSchema, BlockingPlanSchema, stripBlockingPlanNulls } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema } from '../../schemas/schemas'

const hydrateCitation = (value: unknown, segmentHashes: Map<string, string>, overwrite: boolean): void => {
  if (!isRecord(value)) return
  const id = value['sourceSegmentId']
  if (typeof id !== 'string') return
  const hash = segmentHashes.get(id)
  if (!hash) return
  const existing = value['sourceSegmentSha256']
  if (overwrite || typeof existing !== 'string' || existing.length === 0) value['sourceSegmentSha256'] = hash
}

export const hydrateBlockingPlan = (raw: unknown, inputs: Pick<BlockingPlanInputs, 'sceneSlug' | 'structuredScript' | 'structuredScriptSha256' | 'locationSpecifications' | 'locationPlans'>, options: { mode: 'llm' | 'import'; model: string | null; overwriteCitations: boolean }): unknown => {
  if (!isRecord(raw)) return raw
  const segmentHashes = new Map(inputs.structuredScript.sourceSegments.map(segment => [segment.id, hashSourceSegmentText(segment.text)] as const))
  const hydrate = (value: unknown): void => hydrateCitation(value, segmentHashes, options.overwriteCitations)
  if (raw['schemaVersion'] === undefined) raw['schemaVersion'] = BLOCKING_PLAN_SCHEMA_VERSION
  if (raw['sceneSlug'] === undefined) raw['sceneSlug'] = inputs.sceneSlug
  raw['structuredScriptSha256'] = inputs.structuredScriptSha256
  raw['generatedBy'] = { mode: options.mode, model: options.model }
  if (Array.isArray(raw['locations'])) {
    for (const location of raw['locations']) {
      if (!isRecord(location)) continue
      const key = typeof location['locationKey'] === 'string' ? location['locationKey'] : ''
      const specification = inputs.locationSpecifications[key]
      if (specification) location['specificationSha256'] = specificationHash(specification.specification)
      location['geometrySource'] = inputs.locationPlans?.plans.some(plan => plan.locationKey === key) ? 'location-plans' : 'specification'
      for (const suppressed of Array.isArray(location['suppressedAnchors']) ? location['suppressedAnchors'] : []) if (isRecord(suppressed)) hydrate(suppressed['citation'])
      for (const dressing of Array.isArray(location['dressing']) ? location['dressing'] : []) if (isRecord(dressing)) hydrate(dressing['citation'])
    }
  }
  if (Array.isArray(raw['stageStates'])) {
    for (const state of raw['stageStates']) {
      if (!isRecord(state)) continue
      hydrate(state['startsAt'])
      for (const mark of Array.isArray(state['characters']) ? state['characters'] : []) if (isRecord(mark)) hydrate(mark['wardrobeCitation'])
      for (const move of Array.isArray(state['moves']) ? state['moves'] : []) if (isRecord(move)) hydrate(move['citation'])
    }
  }
  return raw
}

const validationContext = (inputs: BlockingPlanInputs): BlockingValidationContext => ({
  structuredScript: inputs.structuredScript,
  locationSpecifications: inputs.locationSpecifications,
  catalog: inputs.catalog,
  locationPlans: inputs.locationPlans,
})

const scenePanelsWithBindings = (scene: v.InferOutput<typeof ScenePromptDataSchema>, bindings: BlockingBindings): BlockingScenePanelInput[] => scene.panels.map(panel => {
  const bound = bindings.panels.find(item => item.panelNumber === panel.number)
  return {
    number: panel.number,
    characterKeys: panel.characterKeys,
    sourceSegmentIds: panel.sourceSegmentIds,
    locationKey: panel.locationKey,
    blocking: panel.blocking ?? (bound ? { ...(bound.stageStateId !== null ? { stageStateId: bound.stageStateId } : {}), cameraSetupId: bound.cameraSetupId, croppedOnStage: bound.croppedOnStage, axisBreak: bound.axisBreak } : undefined),
  }
})

const parseCandidate = (raw: unknown, inputs: BlockingPlanInputs, mode: 'llm' | 'import', model: string | null): { plan?: BlockingPlan | undefined; panelBindings?: BlockingBindings['panels'] | undefined; errors: string[] } => {
  const errors: string[] = []
  const stripped = stripBlockingPlanNulls(raw)
  if (isRecord(stripped) && typeof stripped['sceneSlug'] === 'string' && stripped['sceneSlug'] !== inputs.sceneSlug) {
    errors.push(`Blocking plan sceneSlug "${stripped['sceneSlug']}" does not match the scene "${inputs.sceneSlug}"`)
  }
  let panelBindings: BlockingBindings['panels'] | undefined
  if (isRecord(stripped) && Array.isArray(stripped['panelBindings'])) {
    const parsed = v.safeParse(v.array(BlockingBindingsSchema.entries.panels.item), stripped['panelBindings'])
    if (parsed.success) panelBindings = parsed.output
    else errors.push(`panelBindings: ${parsed.issues.map(item => item.message).join('; ')}`)
    delete stripped['panelBindings']
  }
  const hydrated = hydrateBlockingPlan(stripped, inputs, { mode, model, overwriteCitations: mode === 'llm' })
  const parsed = v.safeParse(BlockingPlanSchema, hydrated)
  if (!parsed.success) {
    for (const item of parsed.issues) errors.push(`${v.getDotPath(item) ?? 'plan'}: ${item.message}`)
    return { errors, panelBindings }
  }
  for (const item of validateBlockingPlan(parsed.output, validationContext(inputs))) errors.push(item.message)
  return { plan: parsed.output, panelBindings, errors }
}

const bindingsFromPanels = (sceneSha256: string, plan: BlockingPlan, panels: BlockingBindings['panels']): BlockingBindings => v.parse(BlockingBindingsSchema, {
  schemaVersion: BLOCKING_BINDINGS_SCHEMA_VERSION,
  sceneSha256,
  planSha256: hashBlockingPlan(plan),
  panels: [...panels].sort((left, right) => left.panelNumber - right.panelNumber),
})

const formatPanelNumbers = (numbers: readonly number[]): string => {
  const sorted = [...new Set(numbers)].sort((left, right) => left - right)
  const runs: string[] = []
  for (let start = 0; start < sorted.length;) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end]! + 1) end++
    runs.push(end > start ? `${sorted[start]}-${sorted[end]}` : String(sorted[start]))
    start = end + 1
  }
  return runs.join(', ')
}

const bindCandidate = (plan: BlockingPlan, panelBindings: BlockingBindings['panels'] | undefined, scene: v.InferOutput<typeof ScenePromptDataSchema>, sceneSha256: string, inputs: BlockingPlanInputs, source: string): { bindings?: BlockingBindings | undefined; errors: string[] } => {
  const unbound = scene.panels.filter(panel => !panel.blocking)
  if (!panelBindings) {
    if (unbound.length > 0) return { errors: [`Bind mode needs panelBindings for panels ${formatPanelNumbers(unbound.map(panel => panel.number))} in ${source}: the reviewed scene JSON carries no blocking citation for those panels`] }
    return { bindings: bindingsFromPanels(sceneSha256, plan, []), errors: [] }
  }
  const errors: string[] = []
  const seen = new Set<number>()
  for (const item of panelBindings) {
    if (seen.has(item.panelNumber)) errors.push(`panelBindings lists panel ${item.panelNumber} more than once`)
    seen.add(item.panelNumber)
    if (!scene.panels.some(panel => panel.number === item.panelNumber)) errors.push(`panelBindings names panel ${item.panelNumber} which is not in the reviewed scene JSON`)
  }
  for (const panel of unbound) {
    if (!seen.has(panel.number)) errors.push(`Panel ${panel.number} has no binding in panelBindings`)
  }
  const provisional = bindingsFromPanels(sceneSha256, plan, panelBindings)
  for (const item of validateScenePanelBlocking(plan, scenePanelsWithBindings(scene, provisional), { segmentOrder: inputs.structuredScript.sourceSegments.map(segment => segment.id) })) errors.push(item.message)
  return errors.length > 0 ? { errors } : { bindings: provisional, errors: [] }
}

export const validateAndBindBlockingCandidate = (raw: unknown, inputs: BlockingPlanInputs, mode: 'llm' | 'import', model: string | null, scene: v.InferOutput<typeof ScenePromptDataSchema> | undefined, sceneSha256: string | undefined, source: string) => {
  const candidate = parseCandidate(raw, inputs, mode, model)
  if (!candidate.plan || candidate.errors.length > 0) return { plan: undefined, bindings: null, errors: candidate.errors }
  if (scene && sceneSha256) {
    const bound = bindCandidate(candidate.plan, candidate.panelBindings, scene, sceneSha256, inputs, source)
    if (bound.errors.length > 0) return { plan: undefined, bindings: null, errors: bound.errors }
    return { plan: candidate.plan, bindings: bound.bindings ?? null, errors: [] }
  }
  return { plan: candidate.plan, bindings: null, errors: [] }
}
