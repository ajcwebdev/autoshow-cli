import type { ResolvedLLMConfig, ResolvedLLMModelOptions } from '~/types'
import { selectCheapestDefaultLlmSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { assertNoRemovedLlmSelections } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const buildLLMModelOptions = (config: ResolvedLLMConfig): ResolvedLLMModelOptions => {
  assertNoRemovedLlmSelections(config)
  return {
    openaiModels: config.openaiModels,
    geminiModels: config.geminiModels,
    anthropicModels: config.anthropicModels,
    grokModels: config.grokModels,
  }
}

const first = (models: string[] | undefined): string | undefined => models?.[0]

export const resolveLLMDefaults = (opts: Partial<ResolvedLLMModelOptions>): ResolvedLLMConfig => {
  assertNoRemovedLlmSelections(opts)
  const openaiModels = opts.openaiModels
  const geminiModels = opts.geminiModels
  const anthropicModels = opts.anthropicModels
  const grokModels = opts.grokModels
  const anySelected = [
    openaiModels?.length,
    geminiModels?.length,
    anthropicModels?.length,
    grokModels?.length,
  ].some((value) => typeof value === 'number' && value > 0)

  const cheapest = anySelected ? undefined : selectCheapestDefaultLlmSelection()
  const withDefault = <T extends string[]>(
    models: T | undefined,
    provider: NonNullable<typeof cheapest>['provider']
  ): T | undefined =>
    models
    ?? (cheapest?.provider === provider ? [cheapest.model] as T : undefined)

  const resolvedOpenai = withDefault(openaiModels, 'openai')
  const resolvedGemini = withDefault(geminiModels, 'gemini')
  const resolvedAnthropic = withDefault(anthropicModels, 'anthropic')
  const resolvedGrok = withDefault(grokModels, 'grok')

  return {
    openaiModels: resolvedOpenai,
    geminiModels: resolvedGemini,
    anthropicModels: resolvedAnthropic,
    grokModels: resolvedGrok,
    llmService: resolvedOpenai?.length ? 'openai'
      : resolvedGemini?.length ? 'gemini'
        : resolvedAnthropic?.length ? 'anthropic'
          : resolvedGrok?.length ? 'grok'
            : cheapest?.provider,
    llmModel: first(resolvedOpenai)
      ?? first(resolvedGemini)
      ?? first(resolvedAnthropic)
      ?? first(resolvedGrok)
      ?? cheapest?.model
      ?? '',
  }
}
