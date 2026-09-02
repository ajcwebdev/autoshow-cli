import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { BlockingBindings, BlockingDrafterCharacterInput, BlockingDrafterLocationInput, BlockingLocationSpecification, BlockingPlan, BlockingPlanCallEstimate, BlockingPlanInputs, BlockingPlanRequest, BlockingPlanResponse, BlockingScenePanelInput, BlockingValidationContext, GenerateBlockingPlanOptions, GenerateBlockingPlanResult, StructuredScriptData } from '~/types'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { resolveCredential } from '~/utils/validate/env-utils'
import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { isRecord, sha256Bytes } from '~/utils/value-helpers'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { BLOCKING_BINDINGS_SCHEMA_VERSION, BLOCKING_PLAN_SCHEMA_VERSION, BlockingBindingsSchema, BlockingPlanDraftSchema, BlockingPlanSchema, buildBlockingPlanJsonSchema, stripBlockingPlanNulls } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { comicLog, err, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { readLocationReferenceCatalog, requireCurrentLocationReference, resolveLocationCatalogEntry, specificationHash } from '../../comic-utils/location-reference'
import { getSceneJsonPath, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { getBlockingBindingsPath, getBlockingPlanPath, getInvalidBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { hashSourceSegmentText, validateBlockingPlan, validateScenePanelBlocking } from '../../comic-utils/blocking-plan-validation'
import { buildBlockingDrafterPrompt, extractBracketPanelNotes, extractFixedAnchorSentence } from '../../comic-utils/blocking-plan-prompt'
import { hashBlockingPlan, serializeBlockingPlan } from '../../comic-utils/blocking-plan-compile'

const STAGE = 'comic:blocking-plan'
export const BLOCKING_PLAN_MAX_CALLS = 2
export const BLOCKING_PLAN_OUTPUT_UNITS_PER_CALL = 3000
export const BLOCKING_PLAN_IMAGE_INPUT_UNITS = 1000

const dataUrl = async (path: string): Promise<string> => {
  const lower = path.toLowerCase()
  const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${type};base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}`
}

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'

const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

export const resolveBlockingPlanProvider = (model: string): 'openai' | 'gemini' => {
  const service = findRegistryServiceForModel('llm', model)
  if (service !== 'openai' && service !== 'gemini') throw UsageError(`Invalid blocking plan model "${model}". The blocking drafter requires an OpenAI or Gemini vision-capable LLM.`)
  return service
}

export const requestBlockingPlanFromProvider = async (request: BlockingPlanRequest): Promise<BlockingPlanResponse> => {
  const service = resolveBlockingPlanProvider(request.model)
  if (service === 'openai') {
    const response = await createOpenAIResponse(getOpenAIClientConfig(), {
      model: request.model,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: request.prompt },
        ...(await Promise.all(request.imagePaths.map(async path => ({ type: 'input_image', image_url: await dataUrl(path), detail: 'high' })))),
      ] }],
      text: { verbosity: 'low', format: { type: 'json_schema', name: request.schemaName, schema: request.jsonSchema, strict: true } },
    })
    const usage = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
    const text = extractOpenAIResponseText(response)
    if (!text) throw InfraError('Blocking plan drafter returned no structured text.', { stage: STAGE })
    return {
      text,
      inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0,
      outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : 0,
      returnedModel: response.model,
    }
  }
  const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: STAGE, description: 'Comic blocking plan drafting' }), {
    model: request.model,
    contents: geminiUserContent([
      { text: request.prompt },
      ...(await Promise.all(request.imagePaths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } })))),
    ]),
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: request.jsonSchema },
  })
  if (!response.text) throw InfraError('Blocking plan drafter returned no structured text.', { stage: STAGE })
  return {
    text: response.text,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  }
}

export const collectSceneLocationKeys = (structuredScript: StructuredScriptData): string[] => {
  const keys: string[] = []
  const push = (key: string | undefined): void => { if (key && !keys.includes(key)) keys.push(key) }
  push(structuredScript.scene.location.key)
  for (const segment of structuredScript.sourceSegments) push(segment.location.key)
  return keys
}

export const estimateBlockingPlanCalls = (structuredScript: StructuredScriptData, options: { promptText?: string | undefined } = {}): BlockingPlanCallEstimate => {
  const locationCount = collectSceneLocationKeys(structuredScript).length
  const promptChars = options.promptText?.length ?? (JSON.stringify(structuredScript.sourceSegments).length + 6000)
  return {
    maxCalls: BLOCKING_PLAN_MAX_CALLS,
    outputUnitsPerCall: BLOCKING_PLAN_OUTPUT_UNITS_PER_CALL,
    inputUnitsPerCall: Math.ceil(promptChars / 4),
    imageInputUnitsPerCall: locationCount * BLOCKING_PLAN_IMAGE_INPUT_UNITS,
    locationCount,
    segmentCount: structuredScript.sourceSegments.length,
  }
}

export const loadBlockingPlanInputs = async (sceneSlug: string, options: { locationPlans?: BlockingPlanInputs['locationPlans']; requireEstablishingImages?: boolean | undefined } = {}): Promise<BlockingPlanInputs> => {
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  if (!existsSync(structuredScriptPath)) throw ValidationError(`Structured script not found at ${structuredScriptPath}. Run "bun autoshow comic draft-scenes <script-path> --only structure" first.`, { stage: STAGE })
  const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
  const structuredScriptSha256 = sha256Bytes(new Uint8Array(await Bun.file(structuredScriptPath).arrayBuffer()))
  const catalog = loadCharacterCatalog()
  const locationCatalog = await readLocationReferenceCatalog()
  const locationKeys = collectSceneLocationKeys(structuredScript)
  const locations: BlockingDrafterLocationInput[] = []
  const locationSpecifications: Record<string, BlockingLocationSpecification> = {}
  const establishingImages: Array<{ locationKey: string; path: string }> = []
  for (const key of locationKeys) {
    const entry = resolveLocationCatalogEntry(key, locationCatalog)
    const geometry = options.locationPlans?.plans.find(plan => plan.locationKey === entry.key)
    locations.push({ key: entry.key, name: entry.name, specification: entry.specification, fixedAnchorSentence: extractFixedAnchorSentence(entry.specification), ...(geometry ? { geometry } : {}) })
    locationSpecifications[entry.key] = { key: entry.key, name: entry.name, specification: entry.specification }
    if (options.requireEstablishingImages) {
      const current = await requireCurrentLocationReference(entry.key)
      establishingImages.push({ locationKey: entry.key, path: current.views[0]!.imagePath })
    }
  }
  return { sceneSlug, structuredScript, structuredScriptSha256, catalog, locationKeys, locations, locationSpecifications, establishingImages, locationPlans: options.locationPlans }
}

const catalogCharacterInputs = (catalog: BlockingPlanInputs['catalog']): BlockingDrafterCharacterInput[] => catalog.characters.map(character => ({
  key: character.key,
  name: character.name,
  description: character.description,
  aliases: character.aliases,
  ...(character.variantOf ? { variantOf: character.variantOf } : {}),
  ...(character.distinguishFrom ? { distinguishFrom: character.distinguishFrom } : {}),
  ...(character.wardrobe ? { wardrobe: character.wardrobe } : {}),
}))

export const buildBlockingDrafterPromptFromInputs = (inputs: BlockingPlanInputs, options: { bindPanels?: v.InferOutput<typeof ScenePromptDataSchema>['panels'] | undefined; validationErrors?: readonly string[] | undefined } = {}): string => buildBlockingDrafterPrompt({
  sceneSlug: inputs.sceneSlug,
  sceneTitle: inputs.structuredScript.scene.title,
  segments: inputs.structuredScript.sourceSegments,
  locations: inputs.locations,
  characters: catalogCharacterInputs(inputs.catalog),
  panelNotes: extractBracketPanelNotes(inputs.structuredScript),
  bindPanels: options.bindPanels?.map(panel => ({ number: panel.number, description: panel.description, shotPlan: panel.shotPlan, characterKeys: panel.characterKeys, sourceSegmentIds: panel.sourceSegmentIds, locationKey: panel.locationKey })),
  validationErrors: options.validationErrors,
})

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

const writeInvalidPlan = async (sceneSlug: string, output: unknown, errors: readonly string[]): Promise<string> => {
  const path = getInvalidBlockingPlanPath(sceneSlug)
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, `${JSON.stringify({ schemaVersion: BLOCKING_PLAN_SCHEMA_VERSION, validationErrors: [...errors], output }, null, 2)}\n`)
  return path
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

export const generateBlockingPlan = async (sceneSlug: string, options: GenerateBlockingPlanOptions): Promise<GenerateBlockingPlanResult> => {
  const stats: GenerateBlockingPlanResult['stats'] = { filesProcessed: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalCost: 0, totalDurationMs: 0 }
  const mode: 'llm' | 'import' = options.importPath ? 'import' : 'llm'
  try {
    const sceneJsonPath = getSceneJsonPath(sceneSlug)
    const sceneExists = existsSync(sceneJsonPath)
    const bind = options.bind ?? sceneExists
    if (bind && !sceneExists) throw ValidationError(`Bind mode requires a reviewed scene JSON at ${sceneJsonPath}`, { stage: STAGE })
    const inputs = await loadBlockingPlanInputs(sceneSlug, { locationPlans: options.locationPlans, requireEstablishingImages: options.requireEstablishingImages ?? mode === 'llm' })
    const scene = bind ? await parseJsonFile(sceneJsonPath, ScenePromptDataSchema) : undefined
    const sceneSha256 = bind ? sha256Bytes(new Uint8Array(await Bun.file(sceneJsonPath).arrayBuffer())) : undefined
    const planPath = getBlockingPlanPath(sceneSlug)
    const bindingsPath = getBlockingBindingsPath(sceneSlug)

    let plan: BlockingPlan | undefined
    let bindings: BlockingBindings | null = null
    let attempts = 0
    let lastErrors: string[] = []
    let lastOutput: unknown

    if (mode === 'import') {
      attempts = 1
      const importPath = options.importPath!
      if (!existsSync(importPath)) throw ValidationError(`Blocking plan import file not found at ${importPath}`, { stage: STAGE })
      let raw: unknown
      try {
        raw = JSON.parse(await Bun.file(importPath).text())
      } catch (error) {
        throw ValidationError(`Blocking plan import file ${importPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: STAGE })
      }
      lastOutput = raw
      const candidate = parseCandidate(raw, inputs, 'import', null)
      lastErrors = candidate.errors
      if (candidate.plan && lastErrors.length === 0) {
        if (scene && sceneSha256) {
          const bound = bindCandidate(candidate.plan, candidate.panelBindings, scene, sceneSha256, inputs, `the import file ${importPath}`)
          lastErrors = bound.errors
          bindings = bound.bindings ?? null
        }
        if (lastErrors.length === 0) plan = candidate.plan
      }
    } else {
      const requestPlan = options.requestPlan ?? requestBlockingPlanFromProvider
      const hostedProvider = findRegistryServiceForModel('llm', options.model) ?? 'comic-llm'
      const scheduling = { concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY, hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator }
      const jsonSchema = buildBlockingPlanJsonSchema({
        characterKeys: inputs.catalog.characterKeys,
        locationKeys: inputs.locationKeys,
        segmentIds: inputs.structuredScript.sourceSegments.map(segment => segment.id),
        bindPanelNumbers: scene?.panels.map(panel => panel.number),
      })
      for (let attempt = 1; attempt <= BLOCKING_PLAN_MAX_CALLS; attempt++) {
        attempts = attempt
        const prompt = buildBlockingDrafterPromptFromInputs(inputs, { bindPanels: scene?.panels, validationErrors: attempt > 1 ? lastErrors : undefined })
        const request: BlockingPlanRequest = { prompt, imagePaths: inputs.establishingImages.map(item => item.path), schemaName: jsonSchema.name, jsonSchema: jsonSchema.schema, model: options.model, attempt, sceneSlug }
        const started = Date.now()
        const response = await runComicHostedRequest(scheduling, hostedProvider, 'comic-llm', `comic-blocking:${sceneSlug}`, attempt - 1, async () => await requestPlan(request))
        stats.totalDurationMs += Date.now() - started
        stats.totalInputTokens += response.inputTokens ?? 0
        stats.totalOutputTokens += response.outputTokens ?? 0
        stats.totalCost += estimateLlmCostFromRegistry(options.model, response.inputTokens ?? 0, response.outputTokens ?? 0)
        let raw: unknown
        try {
          raw = JSON.parse(extractLlmJsonPayload(response.text, STAGE))
        } catch (error) {
          lastErrors = [`Model response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`]
          lastOutput = response.text
          continue
        }
        lastOutput = raw
        const draft = v.safeParse(BlockingPlanDraftSchema, stripBlockingPlanNulls(structuredClone(raw)))
        if (!draft.success) {
          lastErrors = draft.issues.map(item => `${v.getDotPath(item) ?? 'plan'}: ${item.message}`)
          continue
        }
        const candidate = parseCandidate(structuredClone(raw), inputs, 'llm', response.returnedModel ?? options.model)
        lastErrors = candidate.errors
        if (!candidate.plan || lastErrors.length > 0) continue
        if (scene && sceneSha256) {
          const bound = bindCandidate(candidate.plan, candidate.panelBindings, scene, sceneSha256, inputs, 'the drafter response')
          if (bound.errors.length > 0) { lastErrors = bound.errors; continue }
          bindings = bound.bindings ?? null
        }
        plan = candidate.plan
        break
      }
    }

    if (!plan) {
      const invalidPath = await writeInvalidPlan(sceneSlug, lastOutput, lastErrors)
      comicLog.line(`Saved invalid blocking plan candidate: ${invalidPath}`)
      throw ValidationError(`Blocking plan for ${sceneSlug} failed validation after ${attempts} attempt${attempts === 1 ? '' : 's'}:\n- ${lastErrors.join('\n- ')}`, { stage: STAGE })
    }

    await mkdir(dirname(planPath), { recursive: true })
    await Bun.write(planPath, serializeBlockingPlan(plan))
    stats.filesProcessed++
    if (bindings) {
      await Bun.write(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`)
      stats.filesProcessed++
    }
    const details = [
      `file=${basename(planPath)}`,
      mode === 'llm' ? `model=${plan.generatedBy.model ?? options.model}` : 'source=import',
      mode === 'llm' ? `tokens=${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}` : undefined,
      mode === 'llm' ? `cost=${formatCompactCost(stats.totalCost)}` : undefined,
      mode === 'llm' ? `api=${formatDuration(stats.totalDurationMs)}` : undefined,
      `attempts=${attempts}`,
      `states=${plan.stageStates.length}`,
      `cameras=${plan.cameraSetups.length}`,
    ]
    comicLog.line(mode === 'llm' ? 'blocking-plan generated' : 'blocking-plan imported', details)
    if (bindings) comicLog.line('blocking-bindings generated', [`file=${basename(bindingsPath)}`, `panels=${bindings.panels.length}`])
    return { mode, bind, planPath, bindingsPath: bindings ? bindingsPath : null, plan, bindings, attempts, stats }
  } catch (error) {
    err(`Failed to generate blocking plan for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}
