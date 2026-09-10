import { existsSync } from 'node:fs'
import type { DraftScenesCommandOptions, LogMetadata, StructureScriptsCommandOptions } from '~/types'
import { formatCost } from '../comic-image-services/image-costs'
import { DEFAULT_LLM_MODEL } from './cli-args'
import { getDraftPromptPath, getSceneJsonPath, getStructuredScriptPath } from './project-paths'
import { getBlockingPromptPath } from './blocking-plan-paths'
import { priceLine, priceNotice, priceRows } from './price-estimate-logging'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { appendScenePlanSection, parseJsonFile, readBlockingPlanIfPresent, stripScenePlanSection } from './json-prompt-utils'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../schemas/schemas'
import { estimateBlockingPlanCalls } from '../comic-commands/draft-scenes/generate-blocking-plan'
import { getDraftSceneStages } from '../comic-commands/draft-scenes/draft-scenes-command'

export const ESTIMATED_OUTPUT_UNITS_PER_LLM_CALL = 800

export const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = ESTIMATED_OUTPUT_UNITS_PER_LLM_CALL

export const SCENE_DRAFT_OUTPUT_UNITS_FIXED = 400

export const SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL = 480

export const SCENE_DRAFT_MAX_CALLS_WITH_PLAN = 2

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
  const inputCost = estimateLlmCost(model, totalInputUnits, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputUnits)
  const totalCost = estimateLlmCost(model, totalInputUnits, totalOutputUnits)

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
  // The row table is not rendered to stdout, so restate the total on the basis line: the project
  // approval threshold is checked against an exact estimated total a human can read off the preflight.
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

export const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options

  const draftPromptPath = getDraftPromptPath(sceneSlug)

  if (!existsSync(draftPromptPath)) {
    priceNotice('Comic - Price Estimate: draft-scenes --only scene: no draft prompt file found. Run "bun autoshow comic draft-scenes --only prompt" first.', {
      stage: 'draft-scenes:scene',
      model,
      draftPromptPath
    })
    return
  }

  const content = await Bun.file(draftPromptPath).text()
  const blockingPlan = options.blocking === false ? undefined : await readBlockingPlanIfPresent(sceneSlug)
  const promptText = blockingPlan ? appendScenePlanSection(content, blockingPlan.plan) : stripScenePlanSection(content)
  const { panelEstimate, panelBasis } = await estimateScenePanelCount(sceneSlug)
  const outputUnitsPerCall = SCENE_DRAFT_OUTPUT_UNITS_FIXED + SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL * panelEstimate
  const maximumCalls = blockingPlan ? SCENE_DRAFT_MAX_CALLS_WITH_PLAN : 1
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes --only scene',
    model,
    'promptFile',
    `${sceneSlug}/metadata/draft-prompt.md`,
    estimateTokens(promptText),
    {
      maximumCalls,
      outputUnitsPerCall,
      basisNote: `Scene estimate: input units ~ chars / 4 (${blockingPlan ? 'including the blocking plan section' : 'no blocking plan section'}), no cache discount, output ${SCENE_DRAFT_OUTPUT_UNITS_FIXED} fixed units plus ${SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL} units per panel across an estimated ${panelEstimate} panel${panelEstimate === 1 ? '' : 's'} (${panelBasis}); maximum calls ${maximumCalls}${blockingPlan ? ' including one retry that appends blocking validator errors' : ''}`,
      metadata: {
        stage: 'draft-scenes:scene',
        panelEstimate,
        panelBasis,
        outputUnitsFixed: SCENE_DRAFT_OUTPUT_UNITS_FIXED,
        outputUnitsPerPanel: SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL,
        blockingPlan: blockingPlan ? blockingPlan.planSha256 : null,
      },
    }
  )
}

export const estimateBlockingPlanPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options
  if (options.rebind) {
    priceLine('Comic - Price Estimate: draft-scenes --only blocking: --rebind remaps plan citations locally and makes no LLM or image generation API calls.', {
      stage: 'draft-scenes:blocking',
      llmCalls: 0,
      imageCalls: 0,
      maximumCalls: 0,
      totalCost: 0
    })
    return
  }
  if (options.blockingPlan !== undefined) {
    priceLine(`Comic - Price Estimate: draft-scenes --only blocking: --blocking-plan imports ${options.blockingPlan} locally and makes no LLM or image generation API calls.`, {
      stage: 'draft-scenes:blocking',
      importPath: options.blockingPlan,
      llmCalls: 0,
      imageCalls: 0,
      maximumCalls: 0,
      totalCost: 0
    })
    return
  }
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  if (!existsSync(structuredScriptPath)) {
    priceNotice('Comic - Price Estimate: draft-scenes --only blocking: no structured script found. Run "bun autoshow comic draft-scenes --only structure" first.', {
      stage: 'draft-scenes:blocking',
      model,
      structuredScriptPath
    })
    return
  }
  const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
  const blockingPromptPath = getBlockingPromptPath(sceneSlug)
  const promptText = existsSync(blockingPromptPath) ? await Bun.file(blockingPromptPath).text() : undefined
  const estimate = estimateBlockingPlanCalls(structuredScript, { promptText })
  const inputUnitsPerCall = estimate.inputUnitsPerCall + estimate.imageInputUnitsPerCall
  const estimatedInput = inputUnitsPerCall * estimate.maxCalls
  const estimatedOutput = estimate.outputUnitsPerCall * estimate.maxCalls
  const inputCost = estimateLlmCost(model, estimatedInput, 0)
  const outputCost = estimateLlmCost(model, 0, estimatedOutput)
  const totalCost = estimateLlmCost(model, estimatedInput, estimatedOutput)
  const promptFile = promptText ? `${sceneSlug}/metadata/blocking-prompt.md` : `${sceneSlug}/metadata/structured-script.json (blocking-prompt.md not yet written)`
  priceRows(
    'Comic - Price Estimate: draft-scenes --only blocking',
    [{
      model,
      promptFile,
      inputUnits: estimatedInput.toLocaleString(),
      imageInputUnits: (estimate.imageInputUnitsPerCall * estimate.maxCalls).toLocaleString(),
      outputUnits: estimatedOutput.toLocaleString(),
      calls: estimate.maxCalls,
      inputCost: `~${formatCost(inputCost)}`,
      outputCost: `~${formatCost(outputCost)}`,
      total: `~${formatCost(totalCost)}`
    }],
    ['promptFile', 'model', 'inputUnits', 'imageInputUnits', 'outputUnits', 'calls', 'inputCost', 'outputCost', 'total'],
    {
      stage: 'draft-scenes:blocking',
      model,
      promptFile,
      maximumCalls: estimate.maxCalls,
      inputUnitsPerCall: estimate.inputUnitsPerCall,
      imageInputUnitsPerCall: estimate.imageInputUnitsPerCall,
      outputUnitsPerCall: estimate.outputUnitsPerCall,
      locationCount: estimate.locationCount,
      segmentCount: estimate.segmentCount,
      estimatedInput,
      estimatedOutput,
      inputCost,
      outputCost,
      totalCost
    }
  )
  priceLine(`Blocking plan: maximum calls ${estimate.maxCalls} (one drafting call plus one automatic retry that appends validator errors), ${estimate.outputUnitsPerCall.toLocaleString()} output units per call, image input modeled at ${estimate.imageInputUnitsPerCall.toLocaleString()} units per call across ${estimate.locationCount} location establishing view${estimate.locationCount === 1 ? '' : 's'}; total ~${formatCost(totalCost)}`, {
    stage: 'draft-scenes:blocking',
    maximumCalls: estimate.maxCalls,
    outputUnitsPerCall: estimate.outputUnitsPerCall,
    imageInputUnitsPerCall: estimate.imageInputUnitsPerCall,
    locationCount: estimate.locationCount,
    totalCost
  })
}

export const estimatePanelPromptsPrice = (): void => {
  priceLine('Comic - Price Estimate: draft-scenes --only panel-prompts: the panel-prompt stage makes no LLM or image generation API calls.', {
    stage: 'draft-scenes:panel-prompts',
    llmCalls: 0,
    imageCalls: 0,
    totalCost: 0
  })
}

export const estimateDraftScenesPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const stages = getDraftSceneStages(options)

  if (stages.includes('structure')) {
    await estimateStructureScriptsPrice({
      scriptPath: options.scriptPath,
      sceneSlug: options.sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })
  }

  if (stages.includes('prompt')) {
    priceLine('Comic - Price Estimate: draft-scenes --only prompt: the prompt-bundle stage makes no LLM or image generation API calls.', {
      stage: 'draft-scenes:prompt',
      llmCalls: 0,
      imageCalls: 0,
      totalCost: 0
    })
  }

  if (stages.includes('blocking')) {
    await estimateBlockingPlanPrice(options)
  }

  if (stages.includes('scene')) {
    await estimateSceneDraftPrice(options)
  }

  if (stages.includes('panel-prompts')) {
    estimatePanelPromptsPrice()
  }
}

export const estimateStructureScriptsPrice = async (options: StructureScriptsCommandOptions): Promise<void> => {
  if (!options.llmModel) {
    priceNotice('Comic - Price Estimate: draft-scenes --only structure: no --llm-model specified, so the structure stage makes no API calls.', {
      stage: 'draft-scenes:structure',
      llmCalls: 0,
      totalCost: 0
    })
    return
  }

  const model = options.llmModel
  const { scriptPath, sceneSlug } = options

  if (!existsSync(scriptPath)) {
    priceNotice(`Comic - Price Estimate: draft-scenes --only structure: script file not found: ${scriptPath}`, {
      stage: 'draft-scenes:structure',
      model,
      scriptPath
    })
    return
  }

  const content = await Bun.file(scriptPath).text()
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes --only structure',
    model,
    'scriptFile',
    sceneSlug,
    estimateTokens(content)
  )
}
