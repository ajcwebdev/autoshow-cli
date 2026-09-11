import { existsSync } from 'node:fs'
import * as v from 'valibot'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { BlockingBindings, BlockingPlan, BlockingPlanInputs, BlockingPlanRequest, GenerateBlockingPlanOptions, GenerateBlockingPlanResult } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { ValidationError } from '~/utils/error-handler'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { BlockingPlanDraftSchema, buildBlockingPlanJsonSchema, stripBlockingPlanNulls } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema } from '../../schemas/schemas'

import { validateAndBindBlockingCandidate } from './blocking-draft-candidates'
import { BLOCKING_PLAN_MAX_CALLS } from './blocking-draft-defaults'
import { buildBlockingDrafterPromptFromInputs } from './blocking-draft-inputs'
import { requestBlockingPlanFromProvider } from './blocking-draft-provider'
const STAGE = 'comic:blocking-plan'

export const acquireImportedBlockingPlan = async (options: GenerateBlockingPlanOptions, inputs: BlockingPlanInputs, scene: v.InferOutput<typeof ScenePromptDataSchema> | undefined, sceneSha256: string | undefined) => {
  const importPath = options.importPath!
  if (!existsSync(importPath)) throw ValidationError(`Blocking plan import file not found at ${importPath}`, { stage: STAGE })
  let raw: unknown
  try {
    raw = JSON.parse(await Bun.file(importPath).text())
  } catch (error) {
    throw ValidationError(`Blocking plan import file ${importPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { stage: STAGE })
  }
  const candidate = validateAndBindBlockingCandidate(raw, inputs, 'import', null, scene, sceneSha256, `the import file ${importPath}`)
  return { plan: candidate.plan, bindings: candidate.bindings, attempts: 1, lastErrors: candidate.errors, lastOutput: raw }
}

export const acquireGeneratedBlockingPlan = async (sceneSlug: string, options: GenerateBlockingPlanOptions, inputs: BlockingPlanInputs, scene: v.InferOutput<typeof ScenePromptDataSchema> | undefined, sceneSha256: string | undefined, stats: GenerateBlockingPlanResult['stats']) => {
  let plan: BlockingPlan | undefined
  let bindings: BlockingBindings | null = null
  let attempts = 0
  let lastErrors: string[] = []
  let lastOutput: unknown
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
    const candidate = validateAndBindBlockingCandidate(structuredClone(raw), inputs, 'llm', response.returnedModel ?? options.model, scene, sceneSha256, 'the drafter response')
    lastErrors = candidate.errors
    if (!candidate.plan || lastErrors.length > 0) continue
    plan = candidate.plan
    bindings = candidate.bindings
    break
  }
  return { plan, bindings, attempts, lastErrors, lastOutput }
}
