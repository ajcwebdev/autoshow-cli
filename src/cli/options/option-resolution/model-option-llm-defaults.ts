import type { ResolvedLLMConfig, ResolvedLLMModelOptions } from '~/types'
import { selectCheapestDefaultLlmSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

export const buildLLMModelOptions = (config: ResolvedLLMConfig): ResolvedLLMModelOptions => ({
  openaiModels: config.openaiModels,
  geminiModels: config.geminiModels,
  anthropicModels: config.anthropicModels,
  minimaxModels: config.minimaxModels,
  grokModels: config.grokModels,
  glmModels: config.glmModels,
  kimiModels: config.kimiModels,
  togetherModels: config.togetherModels,
})

const first = (models: string[] | undefined): string | undefined => models?.[0]

export const resolveLLMDefaults = (opts: Partial<ResolvedLLMModelOptions>): ResolvedLLMConfig => {
  const openaiModels = opts.openaiModels
  const geminiModels = opts.geminiModels
  const anthropicModels = opts.anthropicModels
  const minimaxModels = opts.minimaxModels
  const grokModels = opts.grokModels
  const glmModels = opts.glmModels
  const kimiModels = opts.kimiModels
  const togetherModels = opts.togetherModels
  const anySelected = [
    openaiModels?.length,
    geminiModels?.length,
    anthropicModels?.length,
    minimaxModels?.length,
    grokModels?.length,
    glmModels?.length,
    kimiModels?.length,
    togetherModels?.length,
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
  const resolvedMinimax = withDefault(minimaxModels, 'minimax')
  const resolvedGrok = withDefault(grokModels, 'grok')
  const resolvedGlm = withDefault(glmModels, 'glm')
  const resolvedKimi = withDefault(kimiModels, 'kimi')
  const resolvedTogether = withDefault(togetherModels, 'together')

  return {
    openaiModels: resolvedOpenai,
    geminiModels: resolvedGemini,
    anthropicModels: resolvedAnthropic,
    minimaxModels: resolvedMinimax,
    grokModels: resolvedGrok,
    glmModels: resolvedGlm,
    kimiModels: resolvedKimi,
    togetherModels: resolvedTogether,
    llmService: resolvedOpenai?.length ? 'openai'
      : resolvedGemini?.length ? 'gemini'
        : resolvedAnthropic?.length ? 'anthropic'
          : resolvedMinimax?.length ? 'minimax'
            : resolvedGrok?.length ? 'grok'
              : resolvedGlm?.length ? 'glm'
                : resolvedKimi?.length ? 'kimi'
                  : resolvedTogether?.length ? 'together'
                    : cheapest?.provider,
    llmModel: first(resolvedOpenai)
      ?? first(resolvedGemini)
      ?? first(resolvedAnthropic)
      ?? first(resolvedMinimax)
      ?? first(resolvedGrok)
      ?? first(resolvedGlm)
      ?? first(resolvedKimi)
      ?? first(resolvedTogether)
      ?? cheapest?.model
      ?? '',
  }
}
