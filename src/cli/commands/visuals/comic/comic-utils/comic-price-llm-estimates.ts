import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { existsSync } from 'node:fs'
import type { DraftScenesCommandOptions, LogMetadata } from '~/types'
import { formatCost } from '../comic-image-services/image-costs'
import { DEFAULT_LLM_MODEL } from './cli-args'
import { getSceneJsonPath, getStructuredScriptPath } from './project-paths'
import { priceLine, priceNotice, priceRows } from './price-estimate-logging'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { parseJsonFile } from './json-prompt-utils'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../schemas/schemas'
import { getDraftSceneStages } from '../comic-commands/draft-scenes/draft-scenes-command'
import { buildPreparedScene, readPreparedScenePair } from '../comic-commands/draft-scenes/prepare-scene'

export const ESTIMATED_OUTPUT_UNITS_PER_LLM_CALL = 800

export const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = ESTIMATED_OUTPUT_UNITS_PER_LLM_CALL

export const SCENE_DRAFT_OUTPUT_UNITS_FIXED = 400

export const SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL = 480

export const SCENE_DRAFT_MAX_CALLS_WITH_PANEL_COUNT = 2

export const LLM_ESTIMATE_BASIS_NOTE = 'Estimates: input units ~ chars / 4, no cache discount, output ~800 units/call'

export const estimateTokens = (content: string): number => {
  return Math.ceil(content.length / 4)
}

export const estimateLlmCost = (model: DraftScenesCommandOptions['llmModel'], inputTokens: number, outputTokens: number): number =>
  estimateLlmCostFromRegistry(model ?? DEFAULT_LLM_MODEL, inputTokens, outputTokens)

export const logLlmTokenEstimate = (
  title: string,
  model: string,
  sourceLabel: string,
  sourcePath: string,
  units: number,
  options: { maximumCalls?: number | undefined; outputUnitsPerCall?: number | undefined; basisNote?: string | undefined; metadata?: LogMetadata | undefined } = {}
): void => {
  const totalCalls = Math.max(1, Math.floor(options.maximumCalls ?? 1))
  const outputUnitsPerCall = options.outputUnitsPerCall ?? ESTIMATED_OUTPUT_UNITS_PER_LLM_CALL
  const totalInputUnits = units * totalCalls
  const totalOutputUnits = outputUnitsPerCall * totalCalls
  // Context bands apply to each request, not the sum of reserved retries.
  const inputCost = estimateLlmCost(model, units, 0) * totalCalls
  const totalCost = estimateLlmCost(model, units, outputUnitsPerCall) * totalCalls
  const outputCost = totalCost - inputCost

  priceRows(
    title,
    [{
      model,
      [sourceLabel]: sourcePath,
      inputUnits: totalInputUnits.toLocaleString(),
      outputUnits: totalOutputUnits.toLocaleString(),
      calls: totalCalls,
      inputCost: `~${formatCost(inputCost)}`,
      outputCost: `~${formatCost(outputCost)}`,
      total: `~${formatCost(totalCost)}`
    }],
    [sourceLabel, 'model', 'inputUnits', 'outputUnits', 'calls', 'inputCost', 'outputCost', 'total'],
    {
      ...options.metadata,
      model,
      [sourceLabel]: sourcePath,
      inputUnitsPerCall: units,
      outputUnitsPerCall,
      estimatedInput: totalInputUnits,
      estimatedOutput: totalOutputUnits,
      calls: totalCalls,
      maximumCalls: totalCalls,
      inputCost,
      outputCost,
      totalCost
    }
  )
  priceLine(`${options.basisNote ?? LLM_ESTIMATE_BASIS_NOTE}; total ~${formatCost(totalCost)}`, {
    unitsPerChar: 0.25,
    cacheDiscount: false,
    outputUnitsPerCall,
    maximumCalls: totalCalls,
    totalCost
  })
}

export const estimateScenePanelCount = async (sceneSlug: string): Promise<{ panelEstimate: number; panelBasis: string }> => {
  const sceneJsonPath = getSceneJsonPath(sceneSlug)
  if (existsSync(sceneJsonPath)) {
    try {
      const scene = await parseJsonFile(sceneJsonPath, ScenePromptDataSchema)
      if (scene.panels.length > 0) return { panelEstimate: scene.panels.length, panelBasis: 'existing metadata/scene.json panel count' }
    } catch {
      // fall through to the structured script heuristic
    }
  }
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  if (existsSync(structuredScriptPath)) {
    try {
      const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
      if (structuredScript.sourceSegments.length > 0) return { panelEstimate: structuredScript.sourceSegments.length, panelBasis: 'one panel per structured-script source segment (upper bound)' }
    } catch {
      // fall through to the single-panel floor
    }
  }
  return { panelEstimate: 1, panelBasis: 'single-panel floor; no scene JSON or structured script found' }
}


const PREPARE_COMMAND_HINT = `Run "${CLI_INVOCATION} comic draft-scenes <script-path> --only prepare" first.`

const resolveScenePricingInput = async (options: DraftScenesCommandOptions, prepareRuns: boolean): Promise<{ promptText: string; promptFile: string; panelEstimate: number; panelBasis: string } | string> => {
  if (prepareRuns) {
    if (!existsSync(options.scriptPath)) return `script file not found: ${options.scriptPath}`
    const prepared = await buildPreparedScene(options.scriptPath)
    const segments = prepared.structuredScript.sourceSegments.length
    return {
      promptText: prepared.draftPrompt,
      promptFile: `${options.scriptPath} (draft prompt built in memory by prepare)`,
      ...(segments > 0
        ? { panelEstimate: segments, panelBasis: 'one panel per structured-script source segment (upper bound)' }
        : { panelEstimate: 1, panelBasis: 'single-panel floor; the structured script has no source segments' }),
    }
  }
  try {
    const pair = await readPreparedScenePair(options.sceneSlug)
    return { promptText: pair.draftPrompt, promptFile: `${options.sceneSlug}/metadata/draft-prompt.md`, ...await estimateScenePanelCount(options.sceneSlug) }
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions, prepareRuns = false): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const input = await resolveScenePricingInput(options, prepareRuns)
  if (typeof input === 'string') {
    priceNotice(`Comic - Price Estimate: draft-scenes scene stage: ${input}${prepareRuns ? '' : ` ${PREPARE_COMMAND_HINT}`}`, {
      stage: 'draft-scenes:scene',
      model,
    })
    return
  }
  const { panelEstimate, panelBasis } = options.panelCount !== undefined
    ? { panelEstimate: options.panelCount, panelBasis: '--panel-count contract' }
    : input
  const outputUnitsPerCall = SCENE_DRAFT_OUTPUT_UNITS_FIXED + SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL * panelEstimate
  const panelCountRetry = options.panelCount !== undefined
  const maximumCalls = panelCountRetry ? SCENE_DRAFT_MAX_CALLS_WITH_PANEL_COUNT : 1
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes scene stage',
    model,
    'promptFile',
    input.promptFile,
    estimateTokens(input.promptText),
    {
      maximumCalls,
      outputUnitsPerCall,
      basisNote: `Scene estimate: input units ~ chars / 4, no cache discount, output ${SCENE_DRAFT_OUTPUT_UNITS_FIXED} fixed units plus ${SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL} units per panel across an estimated ${panelEstimate} panel${panelEstimate === 1 ? '' : 's'} (${panelBasis}); maximum calls ${maximumCalls}${panelCountRetry ? ' including one panel-count retry that appends validator errors' : ''}`,
      metadata: {
        stage: 'draft-scenes:scene',
        panelEstimate,
        panelBasis,
        outputUnitsFixed: SCENE_DRAFT_OUTPUT_UNITS_FIXED,
        outputUnitsPerPanel: SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL,
        panelCount: options.panelCount ?? null,
        panelCountRetryCalls: panelCountRetry ? SCENE_DRAFT_MAX_CALLS_WITH_PANEL_COUNT - 1 : 0,
      },
    }
  )
}

export const estimatePreparePrice = (): void => {
  priceLine('Comic - Price Estimate: draft-scenes prepare stage: local parsing and draft-prompt building make no LLM or image generation API calls.', {
    stage: 'draft-scenes:prepare',
    llmCalls: 0,
    imageCalls: 0,
    totalCost: 0
  })
}

export const estimatePanelPromptsPrice = (): void => {
  priceLine('Comic - Price Estimate: draft-scenes panel-prompts stage: the panel-prompt stage makes no LLM or image generation API calls.', {
    stage: 'draft-scenes:panel-prompts',
    llmCalls: 0,
    imageCalls: 0,
    totalCost: 0
  })
}

export const estimateDraftScenesPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const stages = getDraftSceneStages(options)
  if (stages.includes('prepare')) estimatePreparePrice()
  if (stages.includes('scene')) await estimateSceneDraftPrice(options, stages.includes('prepare'))
  if (stages.includes('panel-prompts')) estimatePanelPromptsPrice()
}
