import { existsSync } from 'node:fs'
import type { DraftScenesCommandOptions, StructureScriptsCommandOptions } from '~/types'
import { formatCost } from '../comic-image-services/image-costs'
import { DEFAULT_LLM_MODEL } from './cli-args'
import { getDraftPromptPath } from './project-paths'
import { priceLine, priceNotice, priceRows } from './price-estimate-logging'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'

export const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = 800

export const LLM_ESTIMATE_BASIS_NOTE = 'Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call'

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
  tokens: number
): void => {
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls
  const inputCost = estimateLlmCost(model, tokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)
  const totalCost = estimateLlmCost(model, tokens, totalOutputTokens)

  priceRows(
    title,
    [{
      model,
      [sourceLabel]: sourcePath,
      inputTokens: tokens.toLocaleString(),
      outputTokens: totalOutputTokens.toLocaleString(),
      inputCost: `~${formatCost(inputCost)}`,
      outputCost: `~${formatCost(outputCost)}`,
      total: `~${formatCost(totalCost)}`
    }],
    [sourceLabel, 'model', 'inputTokens', 'outputTokens', 'inputCost', 'outputCost', 'total'],
    {
      model,
      [sourceLabel]: sourcePath,
      inputTokens: tokens,
      outputTokens: totalOutputTokens,
      calls: totalCalls,
      inputCost,
      outputCost,
      totalCost
    }
  )
  priceLine(LLM_ESTIMATE_BASIS_NOTE, {
    tokensPerChar: 0.25,
    cacheDiscount: false,
    outputTokensPerCall: ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL
  })
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
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes --only scene',
    model,
    'promptFile',
    `${sceneSlug}/metadata/draft-prompt.md`,
    estimateTokens(content)
  )
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
  const stages = options.only ? [options.only] : ['structure', 'prompt', 'scene', 'panel-prompts'] as const

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
